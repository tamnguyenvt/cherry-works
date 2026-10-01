import type { AgentProvider } from "../../models/AgentProvider.js";
import type { CharterRoot } from "../../models/charter/CharterRoot.js";
import { McpPrimitive } from "../../models/charter/primitive/McpPrimitive.js";
import { PRIMITIVE_CLASSES } from "../../models/charter/primitive/Primitive.js";
import { shortenStringsOf, type ShortStrings } from "../../models/helper.js";
import type { CharterOutput } from "../../models/output/CharterOutput.js";
import type { CompiledPrimitive } from "../../models/output/common/CompiledPrimitive.js";
import type { ProviderComponent } from "../../models/output/provider-component/ProviderComponent.js";
import { catalogueOf } from "./catalogueFactory.js";
import { charterMdOf } from "./charterMdFactory.js";
import { compiledPrimitiveOf } from "./compiledPrimitiveFactory.js";
import { claudeComponentsOf } from "./claudeComponentFactory.js";
import { mcpOriginsOf } from "./mcpOriginsFactory.js";

/**
 * Everything one reading of a charter compiles to (FR-021).
 *
 * Models and nothing else. What every reader of the charter gets is in it
 * whether an agent is installed or not — the listing, and the file that orients
 * a reader to it (FR-019); what the agents this repository runs get is each
 * primitive in that host's own kinds (FR-018).
 *
 * The whole of what this does is reading primitives into the parameters those
 * models take — the neutral ones here, and each host's in `<host>ComponentFactory.ts`
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
  // mcps come and go (FR-145). Written into `mcp-origins.json` beside each
  // place, so the server, which reads no charter, serves under these.
  const shortenMcpIdentities = shortenStringsOf(
    charter.primitives.filter(({ primitive }) => primitive.kind === McpPrimitive.kind).map((one) => one.identity),
  );
  const compiledPrimitives = charter.primitives.map((one) => compiledPrimitiveOf(charter, one, shortenMcpIdentities));
  return {
    // What an agent opens from the catalogue is the primitive as it compiled,
    // not the file its author wrote: the whole body in one place, under the
    // output folder whichever layer brought it (FR-140). The catalogue is where
    // this path is said; the projection reads it from there.
    catalogue: catalogueOf(charter, (one) => compiledPrimitives.find((compiled) => compiled.identity === one.identity)!.file),
    charterMd: charterMdOf(PRIMITIVE_CLASSES),
    compiledPrimitives,
    mcpOrigins: mcpOriginsOf(charter, shortenMcpIdentities),
    providerComponents: agents.flatMap((agent) => providerComponentsOf(agent, charter, compiledPrimitives, shortenMcpIdentities)),
  };
}

/** Every file one agent this engine compiles for reads (FR-018). One arm per
 *  host, so a second host is a case here, a compiler beside this and a folder of
 *  its own under `provider-component/` (plan §2.6). */
function providerComponentsOf(
  agent: AgentProvider,
  charter: CharterRoot,
  compiledPrimitives: readonly CompiledPrimitive[],
  shortenMcpIdentities: ShortStrings,
): readonly ProviderComponent[] {
  switch (agent) {
    case "claude":
      return claudeComponentsOf(charter, compiledPrimitives, shortenMcpIdentities);
  }
}
