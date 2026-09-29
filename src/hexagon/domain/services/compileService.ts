import type { AgentProvider } from "../models/AgentProvider.js";
import { PRIMITIVE_CLASSES } from "../models/charter/primitive/Primitive.js";
import type { CharterOutput } from "../models/output/CharterOutput.js";
import { Catalogue } from "../models/output/common/Catalogue.js";
import { CharterMd } from "../models/output/common/CharterMd.js";
import { CompiledPrimitive } from "../models/output/common/CompiledPrimitive.js";
import type { McpOrigin } from "../models/output/common/McpOrigin.js";
import { shortenStringsOf } from "../models/helper.js";
import type { CharterRoot, ScopedPrimitive } from "../models/charter/CharterRoot.js";
import { MixinPrimitive } from "../models/charter/primitive/MixinPrimitive.js";
import { MCP_AUTHS, MCP_MENTION, McpPrimitive } from "../models/charter/primitive/McpPrimitive.js";
import type { ClaudeComponent } from "../models/output/providers/claude/ClaudeComponent.js";
import { compileForClaude } from "./providers/claude.js";

/**
 * Everything one reading of a charter compiles to (FR-021).
 *
 * Models and nothing else. What every reader of the charter gets is in it
 * whether an agent is installed or not — the listing, and the file that orients
 * a reader to it (FR-019); what the agents this repository runs get is each
 * primitive in that host's own kinds (FR-018).
 *
 * The whole of what this does is reading primitives into the parameters those
 * models take — the neutral ones here, and each host's in `compile<Host>.ts`
 * beside this: a `guide` becomes a claude skill there and nowhere in the
 * charter, and the charter does not know any of these exist. A model holds what
 * its file says and answers for how it is written; putting it somewhere is the
 * projection's.
 *
 * There is no exported path that produces one of these without the rest, which
 * is the whole of SC-004 — a caller asks what the charter compiles to and gets
 * all of it or none.
 *
 * What is wrong with the charter is not asked here. A charter that has faults
 * still compiles to something, and whether that something may be written is
 * `everythingWrong` answered by whoever is about to write (FR-009).
 */
export function compile(charter: CharterRoot, agents: readonly AgentProvider[]): CharterOutput {
  // What `cw mcp serve` serves each place's tools under, `<prefix>__<tool>`:
  // short whatever the id's length, and the same on every build whatever other
  // mcps come and go (FR-145). Made from the identities alone, so the server,
  // which reads `mcp-origins.json` and no charter, makes the same ones.
  const shortStrings = shortenStringsOf(
    charter.primitives.filter(({ primitive }) => primitive.kind === McpPrimitive.kind).map((one) => one.identity),
  );
  const compiledPrimitives = charter.primitives.map((one) =>
    CompiledPrimitive.of(
      one,
      one.primitive.toMarkdown({
        // A mixin nothing answers to is left out: the charter already names
        // that file as an error, and a build refused for it never reaches
        // here (FR-009).
        mixins: charter.mixinsOf(one).flatMap(({ primitive }) => (primitive.kind === MixinPrimitive.kind ? [primitive] : [])),
        // Each place the body names as `mcp:<id>` written as the prefix of its
        // tools as claude calls them: claude names every tool of the `cw`
        // server `mcp__cw__<tool>`, and `cw mcp serve` serves a place's under
        // its served prefix (FR-147). A name no mcp answers to has no prefix
        // and is left as written; the charter has warned about it (FR-143).
        idReplacer: (body) =>
          body.replace(MCP_MENTION, (identity) => {
            const found = shortStrings[identity];
            return found === undefined ? identity : `mcp__cw__${found}`;
          }),
      }),
    ),
  );
  return {
    // What an agent opens from the catalogue is the primitive as it compiled,
    // not the file its author wrote: the whole body in one place, under the
    // output folder whichever layer brought it (FR-140). The catalogue is where
    // this path is said; the projection reads it from there.
    catalogue: catalogueOf(charter, (one) => compiledPrimitives.find((compiled) => compiled.identity === one.identity)!.file),
    charterMd: CharterMd.of(PRIMITIVE_CLASSES),
    compiledPrimitives,
    mcpOrigins: mcpOriginsOf(charter),
    providerComponents: agents.flatMap((agent) => compileForAgent(agent, charter, compiledPrimitives)),
  };
}

/**
 * Every primitive of the charter, listed under the file a reader is sent to for
 * its body (FR-011).
 *
 * Two readers, two files. The catalogue a build writes sends an agent to the
 * compiled primitive; the listing a person asks for sends them to the file they
 * would edit, which is also what says which layer it came from (FR-140). Which
 * is the caller's to say, and everything else an entry holds is the same.
 *
 * A header nobody wrote is left out rather than listed as nothing: a listing
 * says what the author declared.
 */
export function catalogueOf(charter: CharterRoot, fileOf: (one: ScopedPrimitive) => string): Catalogue {
  return Catalogue.of(
    charter.primitives.map((one) => {
      const { id, description, tags, globs, rationale, mixins } = one.primitive.headers;
      return {
        identity: one.identity,
        kind: one.primitive.kind,
        id,
        description,
        file: fileOf(one),
        ...(tags === undefined ? {} : { tags }),
        ...(globs === undefined ? {} : { globs }),
        ...(rationale === undefined ? {} : { rationale }),
        ...(mixins === undefined ? {} : { mixins }),
      };
    }),
  );
}

/**
 * Every place the charter's mcps reach, each once, whichever layer declared it
 * (FR-145).
 *
 * One per address and `path`: the repository and a vendor may call one place
 * by two names, and it is one place under both. What is held is where it is and
 * how it is signed in to — every way any identity there allows — and nothing
 * an mcp's own file already says.
 */
function mcpOriginsOf(charter: CharterRoot): readonly McpOrigin[] {
  const mcpsByKey = new Map<string, { identity: string; primitive: McpPrimitive }[]>();
  for (const { identity, primitive } of [...charter.primitives].sort((one, another) => (one.identity < another.identity ? -1 : 1))) {
    if (primitive.kind !== McpPrimitive.kind) continue;
    // Joined by a character neither side can hold: a path is one line, and an
    // address is an endpoint or a command line.
    const key = `${primitive.address}\n${primitive.headers.path ?? ""}`;
    mcpsByKey.set(key, [...(mcpsByKey.get(key) ?? []), { identity, primitive }]);
  }

  return [...mcpsByKey.entries()]
    .sort(([oneKey], [anotherKey]) => (oneKey < anotherKey ? -1 : 1))
    .map(([, mcpsAtOrigin]) => {
      const [firstMcp] = mcpsAtOrigin as [(typeof mcpsAtOrigin)[number], ...typeof mcpsAtOrigin];
      const { endpoint, command, args = [], path } = firstMcp.primitive.headers;
      const tokenEnv = mcpsAtOrigin.find((one) => one.primitive.headers.tokenEnv !== undefined)?.primitive.headers.tokenEnv;
      const auths = new Set(mcpsAtOrigin.flatMap((one) => one.primitive.headers.auth ?? []));

      return {
        identities: mcpsAtOrigin.map((one) => one.identity),
        address: firstMcp.primitive.address,
        ...(endpoint === undefined ? {} : { endpoint }),
        ...(command === undefined ? {} : { command: { command, args, ...(tokenEnv === undefined ? {} : { tokenEnv }) } }),
        ...(path === undefined ? {} : { path }),
        auth: MCP_AUTHS.filter((auth) => auths.has(auth)),
      };
    });
}

/** Every file one agent this engine compiles for reads (FR-018). One arm per
 *  host, so a second host is a case here, a compiler beside this and a folder of
 *  its own under `output/providers/` (plan §2.6). */
function compileForAgent(
  agent: AgentProvider,
  charter: CharterRoot,
  compiledPrimitives: readonly CompiledPrimitive[],
): readonly ClaudeComponent[] {
  switch (agent) {
    case "claude":
      return compileForClaude(charter, compiledPrimitives);
  }
}
