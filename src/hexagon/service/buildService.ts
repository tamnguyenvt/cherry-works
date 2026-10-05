import type { AgentProvider } from "../domain/models/AgentProvider.js";
import type { CharterRoot } from "../domain/models/charter/CharterRoot.js";
import type { CharterOutput } from "../domain/models/output/CharterOutput.js";
import { isStamped } from "../domain/models/output/StampedDocument.js";
import { compile } from "../domain/services/compile/compileService.js";
import { loadToolsByOriginKey, type McpReaching } from "./mcpOriginsRepo.js";
import { agentProviderFolderIn, outFolderIn } from "../domain/path.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";
import { DomainFault, FaultsByFile } from "../domain/models/DomainFault.js";
import type { ForWritingFiles } from "../port/zdriven/ForWritingFiles.js";

/**
 * One file a build has decided about, before anything on disk moves.
 *
 * Where it goes, what it would hold once the build is done, and what is there
 * now — so what a build would do to it is read off the plan rather than worked
 * out again against disk (FR-022).
 */
export interface PlannedFile {
  /** Where it sits, at its path from the repository: what a build says it did. */
  readonly path: string;
  readonly file: URL;
  /** What the build would leave in it, or nothing where the plan is to take it
   *  away. */
  readonly contents?: string | undefined;
  /** What it holds now, or nothing where there is no such file yet. */
  readonly held?: string | undefined;
  /** Run by its path once it is down: a built script (FR-160). */
  readonly executable?: boolean;
}

/**
 * What a build would do, decided and not yet done (FR-020, FR-021, FR-022).
 *
 * The two halves together, because neither is worth anything alone: what the
 * last build left is only a deletion where this one puts nothing back, and what
 * this one puts down is only a change against what is there. Asked for once and
 * handed to `executePlan` or to `previewPlan`, so a preview and the build after
 * it are looking at one plan rather than at two readings that may have drifted.
 *
 * Reads, and only reads. Which agents are compiled for is what the repository
 * said at setup, never what happens to be installed on the machine running this
 * (FR-033); one naming none still gets the surface every reader shares (FR-019).
 *
 * What each mcp origin lists is asked of it through `mcpReaching` where
 * `refreshMcpOrigins` says so, and read off what the last build kept otherwise;
 * an mcp origin that cannot be asked, or lacks a tool declared, is answered as
 * its faults in place of a plan (EVAL-FR-031).
 */
export async function plan(
  repo: URL,
  charter: CharterRoot,
  agentProviders: readonly AgentProvider[],
  fileReaders: ForReadingFiles,
  mcpReaching: McpReaching | undefined,
  { refreshMcpOrigins }: { readonly refreshMcpOrigins: boolean },
): Promise<Plan | FaultsByFile> {
  const { toolsByOriginKey, faultsByFile } = await loadToolsByOriginKey(repo, charter, fileReaders, mcpReaching, refreshMcpOrigins);
  if (!faultsByFile.isEmpty) return faultsByFile;

  const [cleanupPlan, projectionPlan] = await Promise.all([
    planForCleanup(repo, agentProviders, fileReaders),
    planForProjection(repo, compile(charter, agentProviders, toolsByOriginKey), fileReaders),
  ]);

  return { cleanupPlan, projectionPlan };
}

/** One reading of a charter, said as what it would do to disk. */
export interface Plan {
  /** What the last build left, whether this one writes it again or not. */
  readonly cleanupPlan: readonly PlannedFile[];
  /** Everything this reading of the charter would put down. */
  readonly projectionPlan: readonly PlannedFile[];
}

/**
 * Everything one reading of a charter would put down (FR-020, FR-021).
 *
 * Reads, and only reads. A file the charter shares with the repository is read
 * here so the plan carries the whole of what that file would hold: what the
 * charter speaks for is its, and everything else in that file — every other
 * field of a host's settings, every line outside the section of an entry
 * file — is the repository's and is left as it was (FR-018, FR-051).
 *
 * One entry to a path — more than one output may name one file, every posture
 * and every sensor naming the host's settings — and what is there now is read
 * with it, so nothing after this has to go and look. Which files those are is
 * the output's own to say (`CharterOutput.projections`).
 */
export async function planForProjection(
  repo: URL,
  output: CharterOutput,
  fileReaders: ForReadingFiles,
): Promise<readonly PlannedFile[]> {
  const planned = new Map<string, PlannedFile>();

  for (const one of output.projections) {
    const file = new URL(one.file, repo);
    const held = await fileReaders.readIfThere(file);

    // One arm per way a file goes down, and the set is closed: a file the
    // charter owns is what the charter says, and the two the charter shares are
    // what is there now with this build's part of it written into it.
    let contents: string;
    switch (one.projectionPolicy) {
      case "replace":
        contents = one.contents;
        break;
      // What the repository set for itself is read and written back: the fields
      // this charter speaks for are put over the top of it, and every other one
      // is theirs and comes through untouched (FR-018). Field by field at every
      // depth, so an entry of the repository's beside the charter's under one
      // key — a server of its own under `mcpServers` — stays (FR-146); a list
      // or a value is the charter's whole, so what it no longer asks for goes.
      case "mergeJSON": {
        const isPlainObject = (value: unknown): value is Record<string, unknown> =>
          typeof value === "object" && value !== null && !Array.isArray(value);
        const mergedJSON = (already: unknown, written: unknown): unknown =>
          isPlainObject(already) && isPlainObject(written)
            ? Object.fromEntries(
                [...new Set([...Object.keys(already), ...Object.keys(written)])].map((field) => [
                  field,
                  field in written ? mergedJSON(already[field], written[field]) : already[field],
                ]),
              )
            : written;
        contents = `${JSON.stringify(mergedJSON(JSON.parse(held?.trim() || "{}"), JSON.parse(one.contents)), undefined, 2)}\n`;
        break;
      }
      // A section says where it starts and ends itself — its first line and its
      // last — so nothing here knows what a marker of this engine's looks like,
      // and a second output written this way brings its own (FR-051).
      case "upsertWithMarker": {
        const already = held ?? "";
        const lines = one.contents.trimEnd().split("\n");
        // Escaped, because a marker is a comment and a comment holds characters
        // a regular expression reads as its own.
        const [start, end] = [lines.at(0) ?? "", lines.at(-1) ?? ""].map((line) =>
          line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        );
        const section = new RegExp(`${start}[\\s\\S]*?${end}\\n?`, "g");

        if (already.match(section) === null) {
          // Nothing of this build's is in that file yet: the section goes after
          // whatever is there, and an empty file is the section alone.
          contents = already === "" ? one.contents : `${already.replace(/\n*$/, "\n")}\n${one.contents}`;
          break;
        }

        // A file carrying the marker more than once — a merge conflict resolved
        // by keeping both sides — comes back with one, so a second build over it
        // changes nothing (SC-007).
        let written = false;
        contents = already.replace(section, () => {
          if (written) return "";
          written = true;
          return one.contents;
        });
        break;
      }
    }

    planned.set(one.file, { path: one.file, file, contents, held, ...(one.executable === true ? { executable: true } : {}) });
  }

  return [...planned.values()];
}

/**
 * Everything the last build left where this one would put nothing (FR-020).
 *
 * Two things are the engine's to take away, and nothing else. Everything under
 * the workspace's own output folder, which this engine writes and nothing else
 * does. And every stamped document under a host's directory — the stamp is what
 * makes that safe, since that directory is also where someone may have written a
 * command or a skill of their own by hand, and a path cannot tell the two apart.
 * A host's settings file is neither: it is JSON with nowhere to carry a stamp,
 * and it holds what the repository set for itself, so it is written into and
 * never taken away (FR-018).
 *
 * What comes back is the whole of what the engine owns on disk. Which of it is
 * really gone is the projection's to say — a file this build writes again is not
 * a deletion — and that is `previewPlan`'s reading of the two plans together.
 */
export async function planForCleanup(
  repo: URL,
  agentProviders: readonly AgentProvider[],
  fileReaders: ForReadingFiles,
): Promise<readonly PlannedFile[]> {
  // Where this build writes, and the only places it looks: the workspace's own
  // output folder, and the directory of each agent this repository compiles for
  // — so one compiling for none has only its own output looked at (FR-019).
  const outFolder = outFolderIn(repo);
  const folders = [outFolder, ...agentProviders.map((agent) => agentProviderFolderIn(repo, agent))];

  const found = await Promise.all(folders.map((folder) => fileReaders.readFilesRecursively(folder)));

  return found
    .flat()
    .filter(({ file, contents }) => file.href.startsWith(outFolder.href) || isStamped(contents))
    .map(({ file, contents }) => ({ path: decodeURIComponent(file.href.slice(repo.href.length)), file, held: contents }));
}

/**
 * What a build did, or would do: each file under what happened to it (FR-020,
 * FR-022).
 *
 * The one answer both give, so a preview and the build after it say the same
 * thing in the same words — every path from the repository.
 *
 * A summary of the whole `Plan`, and not a third half of it. The cleanup plan
 * and the projection plan are each one side, file by file with what it holds:
 * what the last build left, and what this one puts down. This is what the two
 * come to read together, each path under the one change it gets and no contents
 * left — a file both halves name is written again here, never deleted.
 */
export class PlanSummary {
  constructor(
    /** Put where there was no such file. */
    readonly added: readonly string[],
    /** Written over something that said something else. */
    readonly edited: readonly string[],
    /** Taken away, its primitive gone with it. */
    readonly deleted: readonly string[],
    /** Already holding exactly what the build compiles to. */
    readonly unchanged: readonly string[],
  ) {}}

/**
 * What running the two plans would come to, and nothing done (FR-022).
 *
 * Read off the plans and nothing else: the projection carries what each file
 * would hold and what it holds now, and the cleanup carries what the engine owns
 * on disk. A file both plans name is one this build writes again rather than one
 * it takes away.
 *
 * A file already holding byte for byte what the build compiles to is unchanged,
 * which is the whole of the question a preview asks: a repository where every
 * file is unchanged is one that is fully built (SC-007).
 */
export function previewPlan(
  cleanupPlan: readonly PlannedFile[],
  projectionPlan: readonly PlannedFile[],
): PlanSummary {
  return new PlanSummary(
    projectionPlan.filter((one) => one.held === undefined).map((one) => one.path),
    projectionPlan.filter((one) => one.held !== undefined && one.held !== one.contents).map((one) => one.path),
    cleanupPlan.filter((one) => !projectionPlan.some((other) => other.path === one.path)).map((one) => one.path),
    projectionPlan.filter((one) => one.held === one.contents).map((one) => one.path),
  );
}

/**
 * The two plans, carried out (FR-020, FR-021).
 *
 * Taking away first and writing second, so nothing put down has to be compared
 * with what was there: what the last build left is gone before this one says the
 * whole of what the charter compiles to.
 *
 * It says nothing about what it did: `previewPlan` reads that off the same two
 * plans, and a caller wanting both asks for the preview and then runs it — so
 * what a user was told a build would do is what the build reports having done.
 *
 * A file that cannot be written or taken away is a fault naming it: the disk
 * refusing is not something a caller can read out of a list of paths.
 */
export async function executePlan(
  cleanupPlan: readonly PlannedFile[],
  projectionPlan: readonly PlannedFile[],
  fileWriter: ForWritingFiles,
): Promise<void> {
  try {
    await Promise.all(cleanupPlan.map((one) => fileWriter.delete(one.file)));
    for (const one of projectionPlan) await fileWriter.write(one.file, one.contents ?? "", { executable: one.executable === true });
  } catch (raised) {
    // What the disk said, said as a fault with the next move on it: a caller
    // reading a list of paths has nowhere to learn that one of them refused
    // (SC-003).
    throw new DomainFault(
      `This build could not be written: ${raised instanceof Error ? raised.message : String(raised)}`,
      "Check that the files this build writes can be written, then build again.",
    );
  }
}
