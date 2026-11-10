import type { AgentProvider } from "../models/agent/agent-provider.js";
import type { CharterRoot } from "../models/charter/charter-root.js";
import { McpPrimitive } from "../models/primitive/mcp-primitive.js";
import { Primitives } from "../models/primitive/primitive.js";
import { ModelHelper } from "../helper.js";
import { CharterOutput } from "../models/projection/charter-output.js";
import { McpOrigins, type McpToolDefinition } from "../models/projection/mcp-origin.js";
import { CatalogueFactory } from "../models/projection/catalogue.factory.js";
import { Catalogue } from "../models/projection/catalogue.js";
import { CharterMdFactory } from "../models/projection/charter-md.factory.js";
import { CompiledPrimitiveFactory } from "../models/projection/compiled-primitive.factory.js";
import { McpOriginsFactory } from "../models/projection/mcp-origins.factory.js";
import { BuiltSensorsFactory } from "../models/projection/built-sensors.factory.js";
import { BuiltSensors } from "../models/projection/built-sensor.js";
/** Compiles a charter into what its readers and its hosts are given. */
export class CompileService {
  /**
   * Everything one reading of a charter compiles to (FR-021).
   *
   * Models and nothing else. What every reader of the charter gets is in it
   * whether an agent is installed or not — the listing, and the file that orients
   * a reader to it (FR-019); what the agents this repository runs get is each
   * primitive in that host's own kinds (FR-018).
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
   * The tools each mcp origin listed when the build reached it, by `originKeyOf`, are
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
    const shortMcpIds = ModelHelper.shortenStringsOf(
      charter.primitives.filter((primitive) => primitive.kind === McpPrimitive.kind).map((mcpPrimitive) => mcpPrimitive.headers.id),
    );
    // In the order ids sort in, as the catalogue lists them, so the same
    // charter is put down in the same order however its files were read (SC-007).
    const compiledPrimitiveByPrimitive = new Map(
      [...charter.primitives]
        .sort((leftPrimitive, rightPrimitive) => (leftPrimitive.headers.id < rightPrimitive.headers.id ? -1 : leftPrimitive.headers.id > rightPrimitive.headers.id ? 1 : 0))
        .map((primitive) => [primitive, CompiledPrimitiveFactory.create(charter, primitive)] as const),
    );
    // What `cw sensor run` runs, each sensor's command as built: written once,
    // read by every host given one command per signal (FR-175, FR-179).
    const builtSensors = new BuiltSensors(BuiltSensorsFactory.create(charter, compiledPrimitiveByPrimitive));
    const allCatalogue = CatalogueFactory.create(charter, (primitive) => compiledPrimitiveByPrimitive.get(primitive)!.outputPart.linkOf());
    const agentBasedCatalogues = Object.fromEntries(agents.map((agentProvider) => [
      agentProvider.name,
      new Catalogue(allCatalogue.entries.filter(({ agentProviders }) => agentProviders !== "all" && agentProviders.includes(agentProvider.name)), agentProvider),
    ]));
    return new CharterOutput(
      // What an agent opens from the catalogue is the primitive as it compiled,
      // not the file its author wrote: the whole body in one place, under the
      // output whichever layer brought it (FR-140).
      new Catalogue(allCatalogue.entries.filter(({ agentProviders }) => agentProviders === "all")),
      CharterMdFactory.create(Primitives.classes),
      [...compiledPrimitiveByPrimitive.values()],
      new McpOrigins(McpOriginsFactory.create(charter, shortMcpIds, toolsByOriginKey)),
      builtSensors,
      agentBasedCatalogues,
    );
  }

  private constructor() {}
}
