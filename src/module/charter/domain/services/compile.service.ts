import type { AgentProvider } from "#module/shared/module.js";
import { outputPath } from "../constants.js";
import { ContentHelper } from "../helper.js";
import type { CharterRoot } from "../models/charter/charter-root.js";
import { BuiltSensorsFactory } from "../models/charter-output/built-sensors.factory.js";
import { CatalogueFactory } from "../models/charter-output/catalogue.factory.js";
import { Catalogue } from "../models/charter-output/catalogue.js";
import { CharterMdFactory } from "../models/charter-output/charter-md.factory.js";
import { CharterOutput } from "../models/charter-output/charter-output.js";
import { CompiledPrimitiveFactory } from "../models/charter-output/compiled-primitive.factory.js";
import type { McpToolDefinition } from "../models/charter-output/mcp-origin.js";
import { McpOriginsFactory } from "../models/charter-output/mcp-origins.factory.js";
import { McpPrimitive } from "../models/primitive/mcp-primitive.js";
import { Primitives } from "../models/primitive/primitive.js";
/** Compiles a charter into what its readers and its agents are given. */
export class CompileService {
  /**
   * Everything one reading of a charter compiles to (FR-021).
   *
   * Models and nothing else. What every reader of the charter gets is in it
   * whether an agent is installed or not — the listing, and the file that orients
   * a reader to it (FR-019); what the agents this repository runs get is each
   * primitive in that agent's own kinds (FR-018).
   *
   * The whole of what this does is reading primitives into the parameters those
   * models take. What each agent reads of them — a `guide` as a claude rule —
   * is that agent's projection's, handed this output and the charter; the
   * charter does not know any of them exists. A model holds what it is and what
   * it says, naming every other part by its path inside the output; where the
   * output lands is the projection's (CORE-FR-220, CORE-FR-221).
   *
   * There is no exported path that produces one of these without the rest, which
   * is the whole of SC-004 — a caller asks what the charter compiles to and gets
   * all of it or none.
   *
   * What is wrong with the charter is not asked here. A charter that has faults
   * still compiles to something, and whether that something may be written is
   * `everythingWrong` answered by whoever is about to write (FR-009).
   *
   * The tools each mcp origin listed when the build reached it, by `McpPrimitive.originKey`, are
   * handed in, since reaching an mcp origin is no model's to do; none for an mcp origin
   * keeps none (EVAL-FR-031).
   */
  static compileCharterRoot(
    charter: CharterRoot,
    agents: readonly AgentProvider[],
    toolsByOriginKey: ReadonlyMap<string, readonly McpToolDefinition[]> = new Map(),
  ): CharterOutput {
    // What `cw mcp serve` serves each mcp origin's tools under, `<prefix>__<tool>`:
    // short whatever the id's length, and the same on every build whatever other
    // mcps come and go (FR-145). Written into `mcp-origins.json` beside each
    // mcp origin, so the server, which reads no charter, serves under these.
    const shortMcpIds = ContentHelper.shortenStringsOf(
      charter.primitives
        .filter((primitive) => primitive.kind === McpPrimitive.kind)
        .map((mcpPrimitive) => mcpPrimitive.headers.id),
    );
    // In the order ids sort in, as the catalogue lists them, so the same
    // charter is put down in the same order however its files were read (SC-007).
    const compiledPrimitiveByPrimitive = new Map(
      [...charter.primitives]
        .sort((leftPrimitive, rightPrimitive) =>
          leftPrimitive.headers.id < rightPrimitive.headers.id
            ? -1
            : leftPrimitive.headers.id > rightPrimitive.headers.id
              ? 1
              : 0,
        )
        .map((primitive) => [primitive, CompiledPrimitiveFactory.create(charter, primitive)] as const),
    );
    // What `cw sensor run` runs, each sensor's command as built: written once,
    // read by every agent given one command per signal (FR-175, FR-179).
    const builtSensors = BuiltSensorsFactory.create(charter, compiledPrimitiveByPrimitive);
    const allCatalogue = CatalogueFactory.create(charter, (primitive) =>
      outputPath.getLink(compiledPrimitiveByPrimitive.get(primitive)!),
    );
    // In the order a build lays them (FR-020, FR-021). What an agent opens
    // from the catalogue is the primitive as it compiled, not the file its
    // author wrote: the whole body in one place, under the output whichever
    // layer brought it (FR-140).
    const charterOutput = new CharterOutput();
    charterOutput.add(new Catalogue(allCatalogue.entries.filter(({ agentProviders }) => agentProviders === "all")));
    for (const agentProvider of agents)
      charterOutput.add(
        new Catalogue(
          allCatalogue.entries.filter(
            ({ agentProviders }) =>
              agentProviders !== "all" &&
              agentProviders.some((entryAgentProvider) => entryAgentProvider.name === agentProvider.name),
          ),
          agentProvider,
        ),
      );
    charterOutput.add(McpOriginsFactory.create(charter, shortMcpIds, toolsByOriginKey));
    charterOutput.add(builtSensors);
    charterOutput.add(CharterMdFactory.create(Primitives.classes, charter.charterPlace));
    for (const compiledPrimitive of compiledPrimitiveByPrimitive.values()) charterOutput.add(compiledPrimitive);
    return charterOutput;
  }

  private constructor() {}
}
