import { covers } from "../../../utils/globs.js";
import { primitiveOf, type Primitive } from "./primitive/Primitive.js";
import { CharterRootFault, FaultsByFile, type DomainFault } from "../DomainFault.js";
import type { ForParsingYaml } from "../../../port/zdriven/ForParsingYaml.js";
import { MCP_MENTION, MCP_TOOL_REFERENCE, McpPrimitive } from "./primitive/McpPrimitive.js";
import { SCRIPT_MENTION, ScriptPrimitive } from "./primitive/ScriptPrimitive.js";
import { BasePrimitive, type NormalizedIdentity, type AssetFile } from "./primitive/BasePrimitive.js";
import { BUILTIN_LAYER, BUILTIN_PRIMITIVE_LAYER, REPO_LAYER, VENDOR_LAYER, type LayerName } from "./PrimitiveLayer.js";
import { TEMPLATE_MENTION } from "./primitive/TemplatePrimitive.js";
import { AgentPrimitive } from "./primitive/AgentPrimitive.js";
import { SensorPrimitive } from "./primitive/SensorPrimitive.js";


/**
 * One charter, read: what the engine brings, what this repository authored,
 * what it installed under `vendor/`, and what any of them got wrong.
 *
 * Every question about the charter as a whole is asked of it here — what a
 * primitive is named by, which mixin a name means, what is wrong once the files
 * are read together — so nothing outside joins a vendor's name onto anything by
 * hand.
 */
export class CharterRoot {
  constructor(
    /** Every primitive this charter holds, whichever layer authored it: what
     *  the engine brings, what this repository wrote and what it installed
     *  under `vendor/`, each under the file it was authored in and the layer
     *  its layer gives it. What a primitive says is its own; where it was
     *  written is what a fault is filed under (SC-003) and what the catalogue
     *  records (FR-011). */
    readonly primitives: readonly Primitive[],
    /** The files that were meant to be primitives and could not be read as one,
     *  and why, wherever they were. Held rather than raised: a charter is worth
     *  having with one file broken, and the broken one is worth naming
     *  (FR-009). */
    readonly faultsByFiles: FaultsByFile,
  ) {}

  /** Everything wrong with this charter, under the file that has to change: the
   *  files that could not be read as a primitive at all, and what the ones that
   *  were read get wrong together. The two never name one file — a file reading
   *  refused holds no primitive to get anything else wrong — so one asking is
   *  the whole answer (FR-009). */
  get allFaultsByFiles(): FaultsByFile {
    return this.faultsByFiles.with(this.compositeFaultsByFiles);
  }

  /** Every mixin, under the id a host names it by, wherever it was authored. */
  get mixins(): ReadonlyMap<string, Primitive> {
    return new Map(
      this.primitives
        .filter((primitive) => primitive.kind === "mixin")
        .map((one) => [one.headers.id, one]),
    );
  }

  /**
   * Every primitive under the identity the whole charter names it by (FR-017).
   *
   * Held here for the reason `mixins` is: one identity space covers every
   * layer, so which file declares a name is a question about the whole charter
   * and not about either layer on its own (FR-014).
   *
   * The first claim on an identity is the one in here where two files claim it.
   * A collision is what `compositeFaultsByFiles` is for, and it names both files
   * there; nothing is asked to explain a charter that has one (SC-006).
   */
  get primitiveById(): ReadonlyMap<string, Primitive> {
    const byIdentity = new Map<string, Primitive>();
    for (const one of this.primitives) if (!byIdentity.has(one.identity)) byIdentity.set(one.identity, one);
    return byIdentity;
  }

  /** Every corpus, under the identity a primitive cites it by, wherever it was
   *  authored: `corpus:<id>`. */
  get corpora(): ReadonlySet<string> {
    return new Set(
      this.primitives.filter((primitive) => primitive.kind === "corpus").map((one) => one.identity),
    );
  }

  /** Every mixin one primitive uses, in the order it named them (FR-014). A
   *  name nothing answers to is left out: `compositeFaultsByFiles` already
   *  names that file as an error. */
  mixinsOf(one: Primitive): readonly Primitive[] {
    const byIdentity = this.primitiveById;
    return (one.headers.mixins ?? []).flatMap((id) => byIdentity.get(`mixin:${id}`) ?? []);
  }

  /** The corpus one primitive cites as its rationale, or nothing where it cites
   *  none or cites one this charter does not hold — the second is a warning
   *  `compositeFaultsByFiles` already names (FR-005, FR-014). */
  rationaleOf(one: Primitive): Primitive | undefined {
    const { rationale } = one.headers;
    return rationale !== undefined && this.corpora.has(rationale) ? this.primitiveById.get(rationale) : undefined;
  }

  /** Every primitive using one mixin; nothing for any other kind (FR-014). */
  hostsOf(mixin: Primitive): readonly Primitive[] {
    if (mixin.kind !== "mixin") return [];
    return this.primitives.filter((host) => (host.headers.mixins ?? []).includes(mixin.headers.id));
  }

  /** Every primitive citing one corpus as its rationale; nothing for any other
   *  kind (FR-014). */
  citersOf(corpus: Primitive): readonly Primitive[] {
    if (corpus.kind !== "corpus") return [];
    return this.primitives.filter((citer) => citer.headers.rationale === corpus.identity);
  }

  /** Every primitive naming one place, script or template; nothing for any
   *  other kind, since no other is reached by being named (FR-144, FR-163). */
  mentionersOf(named: Primitive): readonly Primitive[] {
    return this.primitives.filter((mentioner) => this.identitiesMentionedIn(mentioner).includes(named.identity));
  }

  /** The places, scripts and templates one primitive mentions, whether the
   *  charter holds them or not: in its body, in the author's own words (FR-143,
   *  FR-161); for an agent, each place it holds by listing it among its tools
   *  (FR-156); and for a sensor, each script its `run` names (FR-161). */
  private identitiesMentionedIn(one: Primitive): readonly string[] {
    return [
      ...[...one.body.matchAll(MCP_MENTION)].map(([, id]) => `mcp:${id}`),
      ...[...one.body.matchAll(SCRIPT_MENTION)].map(([, id]) => `script:${id}`),
      ...[...one.body.matchAll(TEMPLATE_MENTION)].map(([, id]) => `template:${id}`),
      ...(one instanceof AgentPrimitive ? one.headers.tools.flatMap((tool) => tool.match(MCP_TOOL_REFERENCE)?.[1] ?? []) : []),
      ...(one instanceof SensorPrimitive ? [...one.headers.run.matchAll(SCRIPT_MENTION)].map(([mentionedIdentity]) => mentionedIdentity) : []),
    ];
  }

  /** Does what a mixin lends reach as far as the host pulling it in, or the host
   *  no further than the mixin? A side that names no files is asking about
   *  nothing in particular, and is left alone (FR-006). */
  private reaches(host: Primitive, mixin: Primitive): boolean {
    const hostGlobs = host.headers.globs ?? [];
    const mixinGlobs = mixin.headers.globs ?? [];
    if (hostGlobs.length === 0 || mixinGlobs.length === 0) return true;
    const coversAll = (outer: readonly string[], inner: readonly string[]) =>
      inner.every((narrower) => outer.some((wider) => covers(wider, narrower)));
    return coversAll(mixinGlobs, hostGlobs) || coversAll(hostGlobs, mixinGlobs);
  }

  /**
   * What is wrong with this charter that is wrong with no one file on its own,
   * under the file that has to change (FR-009).
   *
   * Reading refused the files whose own headers do not hold, and said so where
   * it read them; what is left are the questions no single file answers. Every
   * layer is read into one identity space, the way one registry holds one name
   * per package: two files claim one identity; one names a mixin nothing
   * answers to; one pulls in a mixin that speaks about other files than it does
   * — a mixin lends its body at projection time, so what makes the two belong
   * together is the files they both apply to (FR-006, FR-014). One cites a
   * rationale no corpus answers to, which is a warning rather than an error:
   * the rule holds without its reasoning, and the author is told the reasoning
   * is gone (FR-005). A corpus nobody cites and a mixin nobody pulls in are
   * warnings too: nothing breaks, and nothing reads them either (FR-014). So
   * are an mcp nothing names (FR-144) and a script or a template nothing names
   * (FR-163). A name no layer holds is an error (FR-162), and so are an agent
   * holding a tool its mcp does not declare — the role would be promised a
   * tool it cannot have (FR-156) — and a script whose `executionPath` names
   * no asset of it (FR-165).
   */
  get compositeFaultsByFiles(): FaultsByFile {
    const everyPrimitive = this.primitives;
    const mixinsByIdentity = this.mixins;
    const corpusIdentities = this.corpora;
    const toolsByMcpIdentity = new Map(
      everyPrimitive.flatMap((primitive) => (primitive instanceof McpPrimitive ? [[primitive.identity, primitive.headers.tools] as const] : [])),
    );
    const everyIdentity = new Set(everyPrimitive.map(({ identity }) => identity));
    const mentionedIdentities = new Set(everyPrimitive.flatMap((one) => this.identitiesMentionedIn(one)));

    const fileByIdentity = new Map<string, string>();
    const identityByNormalizedIdentity = new Map<NormalizedIdentity, string>();
    const faultsByFiles: Record<string, DomainFault[]> = {};
    const addFault = (file: string, found: DomainFault) => {
      faultsByFiles[file] = [...(faultsByFiles[file] ?? []), found];
    };

    for (const one of everyPrimitive) {
      const { file } = one;
      const primitive = one;
      const { identity } = one;
      const { normIdentity } = primitive;
      const declaredIn = fileByIdentity.get(identity);
      if (declaredIn === undefined) fileByIdentity.set(identity, file);
      else
        addFault(
          file,
          new CharterRootFault(
            `"${identity}" is already declared by ${declaredIn}. One identity names one primitive in a charter, whichever layer it was authored in.`,
            `Give this one an id of its own, or delete it if the other says the same thing. A vendor claiming an id you authored is one to raise with whoever publishes it. An id ${BUILTIN_PRIMITIVE_LAYER.charterFolder} claims is the engine's own and nobody can change it, so the one to rename is yours.`,
          ),
        );

      // `/` is replaced where `:` is in a name given to a host, so two
      // identities can come to one file there: `guide:a/b` and `guide:a-b`.
      // Caught where the name is made, as a second claim on it (FR-141).
      const normalizedIdentityClaimedBy = identityByNormalizedIdentity.get(normIdentity);
      if (normalizedIdentityClaimedBy === undefined) identityByNormalizedIdentity.set(normIdentity, identity);
      else if (normalizedIdentityClaimedBy !== identity)
        addFault(
          file,
          new CharterRootFault(
            `"${identity}" and "${normalizedIdentityClaimedBy}" are both named "${normIdentity}" in an agent's files, where "/" is written as "-". Only one of them would be written there.`,
            `Give this one an id that stays its own once "/" is written as "-".`,
          ),
        );

      for (const namedMixin of primitive.headers.mixins ?? []) {
        const mixin = mixinsByIdentity.get(namedMixin);
        if (mixin === undefined) {
          addFault(
            file,
            new CharterRootFault(
              `This pulls in the mixin "${namedMixin}", and this charter holds no mixin of that id.`,
              `Author it, or drop "${namedMixin}" from "mixins". A mixin is named by its id, whichever layer authored it.`,
            ),
          );
          continue;
        }
        if (!this.reaches(primitive, mixin)) {
          addFault(
            file,
            new CharterRootFault(
              `This pulls in the mixin "${namedMixin}", and neither one's "globs" covers the other's. The mixin's body would be written into a primitive that applies to different files.`,
              `Widen one side's "globs" until it covers the other's, or move the shared text into a corpus and cite it with "rationale".`,
            ),
          );
        }
      }

      // A rationale nobody can follow is worth saying and not worth stopping
      // on: the rule still holds, and the reasoning behind it is what went
      // missing (FR-005).
      const cited = primitive.headers.rationale;
      if (cited !== undefined && !corpusIdentities.has(cited)) {
        addFault(
          file,
          new CharterRootFault(
            `This cites "${cited}" as its rationale, and this charter holds no corpus of that identity.`,
            `Author that corpus, correct the reference, or drop "rationale". A corpus is cited as "corpus:<id>", whichever layer authored it.`,
            "warn",
          ),
        );
      }

      // A name nothing holds stops the build: an agent sent to a place, a
      // script or a template that is not there may guess at one, or invent
      // it, and act on the guess (FR-143, FR-162).
      for (const mentionedIdentity of new Set(this.identitiesMentionedIn(one)))
        if (!everyIdentity.has(mentionedIdentity))
          addFault(
            file,
            new CharterRootFault(
              `This names "${mentionedIdentity}", and this charter holds no primitive of that identity.`,
              `Author it, or correct the name. It is named as "<kind>:<id>", whichever layer authored it.`,
            ),
          );

      // What a script runs is one of its own assets, and nothing anywhere
      // else: a build copies those and no other (FR-165).
      if (primitive instanceof ScriptPrimitive && !primitive.assets.some((assetFile) => primitive.isExecutionFile(assetFile.file)))
        addFault(
          file,
          new CharterRootFault(
            `"executionPath" names "${primitive.headers.executionPath}", and the folder of this index.md holds no such file.`,
            `Write that file beside this index.md, or name one that is there.`,
          ),
        );

      // A role holds what its tools say and nothing else, so each place it
      // lists must be one the charter holds, and each tool one it declares
      // (FR-156).
      if (primitive instanceof AgentPrimitive)
        for (const tool of primitive.headers.tools.filter((one) => one.startsWith("mcp:"))) {
          const [, mcpIdentity, mcpTool] = tool.match(MCP_TOOL_REFERENCE) ?? [];
          const declaredTools = mcpIdentity === undefined ? undefined : toolsByMcpIdentity.get(mcpIdentity);
          if (mcpIdentity === undefined)
            addFault(
              file,
              new CharterRootFault(
                `"${tool}" under "tools" is not a place this role can hold.`,
                `Write a place as "mcp:<id>" for every tool it declares, or "mcp:<id>:<tool>" for one.`,
              ),
            );
          // A place no layer holds is already said above, as any name nothing
          // holds is.
          else if (declaredTools !== undefined && mcpTool !== undefined && !declaredTools.includes(mcpTool))
            addFault(
              file,
              new CharterRootFault(
                `"${tool}" under "tools" names a tool "${mcpIdentity}" does not declare; it declares ${declaredTools.join(", ")}.`,
                `Name one of those, or add "${mcpTool}" to the tools of "${mcpIdentity}".`,
              ),
            );
        }

      // Reasoning nobody cites and text nobody lends are dead weight in every
      // layer, a vendor's included: its author is told, and can remove what
      // brought them (FR-014).
      if (primitive.kind === "corpus" && this.citersOf(one).length === 0)
        addFault(
          file,
          new CharterRootFault(
            `No primitive cites "${identity}" as its rationale, so nothing an agent reads leads to it.`,
            `Cite it from the rules it explains with "rationale: ${identity}", or delete it.`,
            "warn",
          ),
        );
      if (primitive.kind === "mixin" && this.hostsOf(one).length === 0)
        addFault(
          file,
          new CharterRootFault(
            `No primitive pulls in the mixin "${primitive.headers.id}", so its body is never written anywhere.`,
            `Name "${primitive.headers.id}" under "mixins" of the primitives it was written for, or delete it.`,
            "warn",
          ),
        );
      // A kind reached only by being named — a place, a script, a template —
      // is dead weight where nothing names it (FR-144, FR-163).
      if ((primitive.kind === "mcp" || primitive.kind === "script" || primitive.kind === "template") && !mentionedIdentities.has(identity))
        addFault(
          file,
          new CharterRootFault(
            `No primitive names "${identity}" in its body, so nothing an agent reads leads to it.`,
            `Name it where it is used, as "${identity}", or delete it.`,
            "warn",
          ),
        );
    }

    // Every mcp with the file it was authored in, read together: the fault
    // below takes every layer to see.
    const mcpPrimitives = everyPrimitive
      .flatMap((primitive) => (primitive instanceof McpPrimitive ? [primitive] : []))
      .sort((one, another) => (one.identity < another.identity ? -1 : 1));

    // One command is one process, and a process reads its token from one
    // variable: two named for one address leave it unsaid which (FR-145).
    for (const primitive of mcpPrimitives) {
      const { file } = primitive;
      const { tokenEnv } = primitive.headers;
      const conflictingMcp = mcpPrimitives.find(
        (other) =>
          other.address === primitive.address &&
          other.headers.tokenEnv !== undefined &&
          other.headers.tokenEnv !== tokenEnv,
      );
      if (tokenEnv !== undefined && conflictingMcp !== undefined)
        addFault(
          file,
          new CharterRootFault(
            `This hands "${primitive.address}" its token in "${tokenEnv}", and "${conflictingMcp.identity}" in "${conflictingMcp.headers.tokenEnv}". One process reads its token from one variable.`,
            `Name the variable that command reads in both, or drop "tokenEnv" and "auth" from one of them.`,
          ),
        );
    }

    return new FaultsByFile(faultsByFiles);
  }
}

/** One file of a charter as it was authored: what it says, and the path it was
 *  read from, which travels with it so a fault and a catalogue entry can name
 *  it (SC-003, FR-011). Nothing here reads that path — where the files live is
 *  the service's business (plan §2). */
export interface AuthoredFile {
  readonly path: string;
  readonly contents: string;
  /** Where it sits in its layer, from the layer's folder:
   *  `mcp/billing/index.md` (FR-141). */
  readonly pathInLayer: string;
  /** Every other file of the folder it sits in, at any depth: its assets
   *  (FR-168). */
  readonly assetFiles?: readonly AssetFile[];
}

/** One file a vendor published, under the name this repository installed it as.
 *  The name says where the file came from, and nothing about what the
 *  primitives in it are called (FR-014, FR-025). */
export interface VendoredFile extends AuthoredFile {
  readonly vendor: string;
}

/**
 * The one way a charter is read (FR-008): every use case comes through here, so
 * a charter is parsed in one place and one way.
 *
 * Takes the three layers apart rather than somewhere to find them: a charter is
 * what the engine brings, what this repository authored and what it installed,
 * and which of them a file belongs to is known by whoever read it — never
 * worked out here from a path (plan §2).
 *
 * The engine's layer arrives as files too, and is read by `primitiveOf` like
 * every other: a primitive handed in ready-made would be the one nothing
 * validated (FR-018).
 *
 * What reads as a primitive is held under the file it came from; what does not
 * leaves its faults under that same file. So a charter always comes back, and
 * one read names every bad file rather than the first (FR-009).
 */
export function charterRootOf(
  {
    repo,
    vendor,
    builtin,
  }: {
    readonly repo: readonly AuthoredFile[];
    readonly vendor: readonly VendoredFile[];
    readonly builtin: readonly AuthoredFile[];
  },
  yamlParser: ForParsingYaml,
): CharterRoot {
  const primitives: Primitive[] = [];
  const faultsByFiles: Record<string, readonly DomainFault[]> = {};

  const read = (one: AuthoredFile, layerName: LayerName) => {
    // This file's charter folder: its path, less where it sits in its layer.
    const charterFolder = one.path.slice(0, -one.pathInLayer.length - 1);
    // A primitive is a folder holding its index.md; a markdown file of its own
    // is how an earlier version kept one, and is sent where it belongs now
    // (FR-141).
    if (!one.pathInLayer.endsWith(`/${BasePrimitive.index}`)) {
      faultsByFiles[one.path] = [
        new CharterRootFault(
          `This is a markdown file of its own, and a primitive is a folder holding its ${BasePrimitive.index}.`,
          `Move it to "${charterFolder}/${one.pathInLayer.replace(/\.md$/, "")}/${BasePrimitive.index}".`,
        ),
      ];
      return;
    }
    try {
      const primitive = primitiveOf(one.contents, yamlParser, one.assetFiles ?? [], { name: layerName, charterFolder });
      // Its folder is its kind and id: what it declares is where it is kept
      // (FR-003, FR-141).
      if (one.pathInLayer !== `${primitive.primitiveFolder}/${primitive.index}`) {
        faultsByFiles[one.path] = [
          new CharterRootFault(
            `This declares "${primitive.identity}", and it is kept at "${one.pathInLayer}"; a primitive is kept at "<kind>/<id>/${BasePrimitive.index}".`,
            `Move its folder to "${charterFolder}/${primitive.primitiveFolder}/", or declare the kind and id its folder says.`,
          ),
        ];
        return;
      }
      primitives.push(primitive);
    } catch (raised) {
      // Every fault one file has arrives together (FR-009); anything else is
      // not this file being wrong and is not ours to swallow.
      if (!(raised instanceof AggregateError)) throw raised;
      faultsByFiles[one.path] = raised.errors as readonly DomainFault[];
    }
  };

  /** The files of one layer, in the order their paths sort in. */
  const sorted = <One extends AuthoredFile>(files: readonly One[]): readonly One[] =>
    [...files].sort((one, another) => one.path.localeCompare(another.path));

  // Read in the order the files sort in, whatever order they arrived in: a
  // charter compiles to the same bytes however a folder was walked (SC-007).
  // The engine's layer first: the first claim on an identity is the one kept,
  // so a collision with it is filed against the file its author can rename
  // (plan §3.1).
  for (const one of sorted(builtin)) read(one, BUILTIN_LAYER);
  for (const one of sorted(repo)) read(one, REPO_LAYER);
  for (const one of sorted(vendor)) read(one, VENDOR_LAYER);

  return new CharterRoot(primitives, new FaultsByFile(faultsByFiles));
}
