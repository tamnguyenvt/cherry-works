import { covers } from "../../libs/globs.lib.js";
import type { Primitive } from "../primitive/primitive.js";
import { DomainFault, FaultsByFile } from "../../../../shared/module.js";
import { McpPrimitive } from "../primitive/mcp-primitive.js";
import { ScriptPrimitive } from "../primitive/script-primitive.js";
import { BasePrimitive } from "../primitive/base-primitive.js";
import type { LayerName } from "../primitive/primitive-layer.js";
import { AgentPrimitive } from "../primitive/agent-primitive.js";
import { SensorPrimitive } from "../primitive/sensor-primitive.js";
import { AgentBasedPrimitive } from "../primitive/agent-based-primitive.js";
import { CharterPrimitiveFault, CharterRootFault } from "../charter.fault.js";

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
    /** The layer of everything kept, read as a primitive or not, by where it is
     *  kept: what a fault under it is weighed by (FR-005). */
    readonly layerNameByUri: Readonly<Record<string, LayerName>> = {},
  ) {}

  /** Everything wrong with this charter, under the file that has to change: the
   *  files that could not be read as a primitive at all, and what the ones that
   *  were read get wrong together. The two never name one file — a file reading
   *  refused holds no primitive to get anything else wrong — so one asking is
   *  the whole answer (FR-009). */
  get allFaultsByFiles(): FaultsByFile {
    return this.faultsByFiles.with(this.compositeFaultsByFiles);
  }

  /**
   * Every primitive under the id the whole charter names it by (FR-015,
   * FR-017).
   *
   * One id space covers every layer and every kind, so which file declares a
   * name is a question about the whole charter and not about any one layer.
   * The first claim on an id is the one in here where two files claim it: a
   * collision is what `compositeFaultsByFiles` is for, and it names both files
   * there; nothing is asked to explain a charter that has one (SC-006).
   */
  /** Every primitive naming an agent outside `agentNames`, the agents the
   *  charter can be compiled for, under the file that has to change: in the
   *  agents it is for, or in the model it runs on (FR-033). */
  agentFaultsByFilesOf(agentNames: readonly string[]): FaultsByFile {
    const faultsByFile: Record<string, readonly DomainFault[]> = {};
    for (const primitive of this.primitives) {
      const namedAgents = [
        ...(primitive instanceof AgentBasedPrimitive ? (primitive.headers["agent-provider"] ?? []).map((agentName) => ["agent-provider", agentName] as const) : []),
        ...(primitive instanceof AgentPrimitive && primitive.modelProvider !== undefined ? [["model", primitive.modelProvider] as const] : []),
      ];
      const faults = namedAgents
        .filter(([, agentName]) => !agentNames.includes(agentName))
        .map(([header, agentName]) => new CharterPrimitiveFault(`"${header}" names "${agentName}", an agent this charter is compiled for none of.`, `Name any of: ${agentNames.join(", ")}.`, { internal: false }));
      if (faults.length > 0) faultsByFile[primitive.uri] = faults;
    }
    return new FaultsByFile(faultsByFile);
  }

  get primitiveById(): ReadonlyMap<string, Primitive> {
    const primitiveById = new Map<string, Primitive>();
    for (const one of this.primitives) if (!primitiveById.has(one.headers.id)) primitiveById.set(one.headers.id, one);
    return primitiveById;
  }

  /** Every mixin one primitive uses, in the order it named them (FR-014). A
   *  name nothing answers to, or that answers with another kind, is left out:
   *  `compositeFaultsByFiles` already names that file as an error. */
  mixinsOf(one: Primitive): readonly Primitive[] {
    const primitiveById = this.primitiveById;
    return (one.headers.mixins ?? []).flatMap((id) => {
      const mixin = primitiveById.get(id);
      return mixin?.kind === "mixin" ? [mixin] : [];
    });
  }

  /** The corpus one primitive cites as its rationale, or nothing where it cites
   *  none or cites one this charter does not hold as a corpus — which
   *  `compositeFaultsByFiles` already names (FR-005, FR-014). */
  rationaleOf(one: Primitive): Primitive | undefined {
    const { rationale } = one.headers;
    const corpusPrimitive = rationale === undefined ? undefined : this.primitiveById.get(rationale);
    return corpusPrimitive?.kind === "corpus" ? corpusPrimitive : undefined;
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
    return this.primitives.filter((citer) => citer.headers.rationale === corpus.headers.id);
  }

  /** Every primitive naming one, as `[[<id>]]` (FR-144, FR-163, FR-172). */
  mentionersOf(referencedPrimitive: Primitive): readonly Primitive[] {
    return this.primitives.filter((mentioner) => this.idsMentionedIn(mentioner).includes(referencedPrimitive.headers.id));
  }

  /** The ids one primitive names as `[[<id>]]`, whether the charter holds them
   *  or not: in its body (FR-143, FR-172); for an agent, each mcp origin it holds by
   *  listing it among its tools (FR-156); and for a sensor, each script its
   *  `run` names (FR-161). */
  private idsMentionedIn(one: Primitive): readonly string[] {
    return [
      ...[...one.body.matchAll(BasePrimitive.referencePattern)].map(([, id]) => id!),
      ...(one instanceof AgentPrimitive ? one.headers.tools.flatMap((tool) => tool.match(BasePrimitive.toolReferencePattern)?.[1] ?? []) : []),
      ...(one instanceof SensorPrimitive ? [...one.headers.run.matchAll(BasePrimitive.referencePattern)].map(([, id]) => id!) : []),
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
   * layer is read into one id space, the way one registry holds one name
   * per package: two files claim one id; one names a mixin nothing
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
    const primitiveById = this.primitiveById;
    const referencedIds = new Set(everyPrimitive.flatMap((one) => this.idsMentionedIn(one)));

    const uriById = new Map<string, string>();
    const idByNormId = new Map<string, string>();
    const faultsByFiles: Record<string, DomainFault[]> = {};
    const addFault = (file: string, found: DomainFault) => {
      faultsByFiles[file] = [...(faultsByFiles[file] ?? []), found];
    };
    for (const primitive of everyPrimitive) {
      const { uri: primitiveUri } = primitive;
      const { id } = primitive.headers;
      const declaringUri = uriById.get(id);
      if (declaringUri === undefined) uriById.set(id, primitiveUri);
      else
        addFault(
          primitiveUri,
          new CharterRootFault(
            `"${id}" is already declared by ${declaringUri}. One id names one primitive in a charter, whatever its kind and whichever layer it was authored in.`,
            `Give this one an id of its own, or delete it if the other says the same thing. A vendor claiming an id you authored is one to raise with whoever publishes it. An id (built into cw) claims is the engine's own and nobody can change it, so the one to rename is yours.`,
            { internal: false },
          ),
        );

      // `/` is written `-` in a name given to a host, so two ids can come to
      // one file there: `a/b` and `a-b`. Caught where the name is made, as a
      // second claim on it (FR-141).
      const { normId } = primitive;
      const claimingId = idByNormId.get(normId);
      if (claimingId === undefined) idByNormId.set(normId, id);
      else if (claimingId !== id)
        addFault(
          primitiveUri,
          new CharterRootFault(
            `"${id}" and "${claimingId}" are both named "${normId}" in an agent's files, where "/" is written as "-". Only one of them would be written there.`,
            `Give this one an id that stays its own once "/" is written as "-".`,
            { internal: false },
          ),
        );

      for (const mixinId of primitive.headers.mixins ?? []) {
        // An id of another kind is no mixin, and is said as one nothing
        // answers to.
        const mixin = primitiveById.get(mixinId);
        if (mixin?.kind !== "mixin") {
          addFault(
            primitiveUri,
            new CharterRootFault(
              `This pulls in the mixin "${mixinId}", and this charter holds no mixin of that id.`,
              `Author it, or drop "${mixinId}" from "mixins". A mixin is named by its id, whichever layer authored it.`,
              { internal: false },
            ),
          );
          continue;
        }
        if (!this.reaches(primitive, mixin)) {
          addFault(
            primitiveUri,
            new CharterRootFault(
              `This pulls in the mixin "${mixinId}", and neither one's "globs" covers the other's. The mixin's body would be written into a primitive that applies to different files.`,
              `Widen one side's "globs" until it covers the other's, or move the shared text into a corpus and cite it with "rationale".`,
              { internal: false },
            ),
          );
        }
      }

      // A rationale nobody can follow is worth saying and not worth stopping
      // on: the rule still holds, and the reasoning behind it is what went
      // missing (FR-005).
      const rationaleId = primitive.headers.rationale;
      if (rationaleId !== undefined && primitiveById.get(rationaleId)?.kind !== "corpus")
        addFault(
          primitiveUri,
          new CharterRootFault(
            `This cites "${rationaleId}" as its rationale, and this charter holds no corpus of that id.`,
            `Author that corpus, correct the reference, or drop "rationale". A corpus is cited by its id, whichever layer authored it.`,
            { severity: "warn", internal: false },
          ),
        );

      // A name nothing holds stops the build: an agent sent to something that
      // is not there may guess at one, or invent it, and act on the guess
      // (FR-143, FR-162).
      for (const referencedId of new Set(this.idsMentionedIn(primitive)))
        if (!primitiveById.has(referencedId))
          addFault(
            primitiveUri,
            new CharterRootFault(
              `This names "${referencedId}", and this charter holds no primitive of that id.`,
              `Author it, or correct the name. It is named as "[[<id>]]", whichever layer authored it.`,
              { internal: false },
            ),
          );

      // What a script runs is one of its own assets, and nothing anywhere
      // else: a build copies those and no other (FR-165).
      if (primitive instanceof ScriptPrimitive && !primitive.assets.some((assetFile) => primitive.isExecutionFile(assetFile.file)))
        addFault(
          primitiveUri,
          new CharterRootFault(
            `"executionPath" names "${primitive.headers.executionPath}", and the folder of this index.md holds no such file.`,
            `Write that file beside this index.md, or name one that is there.`,
            { internal: false },
          ),
        );

      // A role holds what its tools say and nothing else, so each mcp origin it
      // lists must be an mcp the charter holds, and each tool one it declares
      // (FR-156).
      if (primitive instanceof AgentPrimitive)
        for (const tool of primitive.headers.tools.filter((one) => one.startsWith("[["))) {
          const [, mcpId, mcpTool] = tool.match(BasePrimitive.toolReferencePattern) ?? [];
          const mcpPrimitive = mcpId === undefined ? undefined : primitiveById.get(mcpId);
          if (mcpId === undefined)
            addFault(
              primitiveUri,
              new CharterRootFault(
                `"${tool}" under "tools" is not an mcp origin this role can hold.`,
                `Write an mcp origin as "[[<id>]]" for every tool it declares, or "[[<id>]]:<tool>" for one.`,
                { internal: false },
              ),
            );
          // An mcp origin no layer holds is already said above, as any name nothing
          // holds is.
          else if (mcpPrimitive instanceof McpPrimitive && mcpTool !== undefined && !mcpPrimitive.headers.tools.includes(mcpTool))
            addFault(
              primitiveUri,
              new CharterRootFault(
                `"${tool}" under "tools" names a tool "${mcpId}" does not declare; it declares ${mcpPrimitive.headers.tools.join(", ")}.`,
                `Name one of those, or add "${mcpTool}" to the tools of "${mcpId}".`,
                { internal: false },
              ),
            );
        }

      // Reasoning nobody cites and text nobody lends are dead weight in every
      // layer, a vendor's included: its author is told, and can remove what
      // brought them (FR-014).
      if (primitive.kind === "corpus" && this.citersOf(primitive).length === 0)
        addFault(
          primitiveUri,
          new CharterRootFault(
            `No primitive cites "${id}" as its rationale, so nothing an agent reads leads to it.`,
            `Cite it from the rules it explains with "rationale: ${id}", or delete it.`,
            { severity: "warn", internal: false },
          ),
        );
      if (primitive.kind === "mixin" && this.hostsOf(primitive).length === 0)
        addFault(
          primitiveUri,
          new CharterRootFault(
            `No primitive pulls in the mixin "${id}", so its body is never written anywhere.`,
            `Name "${id}" under "mixins" of the primitives it was written for, or delete it.`,
            { severity: "warn", internal: false },
          ),
        );
      // A kind reached only by being named — an mcp origin, a script, a template —
      // is dead weight where nothing names it (FR-144, FR-163).
      if ((primitive.kind === "mcp" || primitive.kind === "script" || primitive.kind === "template") && !referencedIds.has(id))
        addFault(
          primitiveUri,
          new CharterRootFault(
            `No primitive names "${id}" in its body, so nothing an agent reads leads to it.`,
            `Name it where it is used, as "[[${id}]]", or delete it.`,
            { severity: "warn", internal: false },
          ),
        );
    }

    // Every mcp with the file it was authored in, read together: the fault
    // below takes every layer to see.
    const mcpPrimitives = everyPrimitive
      .flatMap((primitive) => (primitive instanceof McpPrimitive ? [primitive] : []))
      .sort((one, another) => (one.headers.id < another.headers.id ? -1 : 1));

    // One command is one process, and a process reads its token from one
    // variable: two named for one address leave it unsaid which (FR-145).
    for (const primitive of mcpPrimitives) {
      const { uri: primitiveUri } = primitive;
      const { tokenEnv } = primitive.headers;
      const conflictingMcp = mcpPrimitives.find(
        (other) =>
          other.address === primitive.address &&
          other.headers.tokenEnv !== undefined &&
          other.headers.tokenEnv !== tokenEnv,
      );
      if (tokenEnv !== undefined && conflictingMcp !== undefined)
        addFault(
          primitiveUri,
          new CharterRootFault(
            `This hands "${primitive.address}" its token in "${tokenEnv}", and "${conflictingMcp.headers.id}" in "${conflictingMcp.headers.tokenEnv}". One process reads its token from one variable.`,
            `Name the variable that command reads in both, or drop "tokenEnv" and "auth" from one of them.`,
            { internal: false },
          ),
        );
    }

    return new FaultsByFile(faultsByFiles);
  }
}
