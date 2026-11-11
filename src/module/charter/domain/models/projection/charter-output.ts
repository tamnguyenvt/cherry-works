import type { AgentProviderName } from "../agent/agent-provider.js";
import type { BuiltSensors } from "./built-sensor.js";
import type { Catalogue } from "./catalogue.js";
import type { CharterMd } from "./charter-md.js";
import type { CompiledPrimitive } from "./compiled-primitive.js";
import type { McpOrigins } from "./mcp-origin.js";
/** One part of what a charter compiles to: what it is, its text, and, for a
 *  compiled primitive, its assets (CORE-FR-220). */
export type CompiledPart = Catalogue | CharterMd | CompiledPrimitive | McpOrigins | BuiltSensors;

/**
 * Everything one reading of a charter compiles to (FR-021), naming no place
 * but inside the build's output: where the output lands, and what each agent
 * reads of it, is each projection's (CORE-FR-220, CORE-FR-221).
 *
 * What every reader of the charter gets is here whether an agent is installed or
 * not: the listing, and the file that orients a reader to it (FR-019). What the
 * agents this repository runs get is each agent's own listing here, and the
 * rest its projection makes of this (FR-018).
 */
export class CharterOutput {
  constructor(
    /** Primitives shared by all providers. */
    readonly catalogue: Catalogue,
    readonly charterMd: CharterMd,
    readonly compiledPrimitives: readonly CompiledPrimitive[],
    readonly mcpOrigins: McpOrigins,
    readonly builtSensors: BuiltSensors,
    readonly agentBasedCatalogues: Readonly<Record<AgentProviderName, Catalogue>> = {},
  ) {}

  /** Every part of it, in the order a build lays them (FR-020, FR-021). */
  get compiledParts(): readonly CompiledPart[] {
    return [
      this.catalogue,
      ...Object.values(this.agentBasedCatalogues),
      this.mcpOrigins,
      this.builtSensors,
      this.charterMd,
      ...this.compiledPrimitives,
    ];
  }
}
