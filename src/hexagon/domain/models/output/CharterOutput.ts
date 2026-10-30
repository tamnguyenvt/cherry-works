import type { AgentProvider } from "../AgentProvider.js";
import type { Catalogue } from "./common/Catalogue.js";
import type { CharterMd } from "./common/CharterMd.js";
import type { CompiledPrimitive } from "./common/CompiledPrimitive.js";
import type { McpOrigins } from "./common/McpOrigin.js";
import type { BuiltSensors } from "./common/BuiltSensor.js";
import type { Projection } from "./ProjectionPolicy.js";
import type { ProviderComponent } from "./provider-component/ProviderComponent.js";
/**
 * Everything one reading of a charter compiles to (FR-021), and every file it is
 * put down as (FR-020).
 *
 * What every reader of the charter gets is here whether an agent is installed or
 * not: the listing, and the file that orients a reader to it (FR-019). What the
 * agents this repository runs get is each primitive in that host's own kinds,
 * and a repository running none has none of them (FR-018).
 */
export class CharterOutput {
  constructor(
    /** Primitives shared by all providers. */
    readonly catalogue: Catalogue,
    readonly charterMd: CharterMd,
    readonly compiledPrimitives: readonly CompiledPrimitive[],
    readonly mcpOrigins: McpOrigins,
    readonly builtSensors: BuiltSensors,
    readonly providerComponents: readonly ProviderComponent[],
    readonly agentBasedCatalogues: Readonly<Partial<Record<AgentProvider, Catalogue>>> = {},
  ) {}

  get warnings(): readonly string[] {
    return this.providerComponents.flatMap((component) => component.warnings);
  }

  /** Every file this output is put down as: what each of its parts says it is
   *  put down as, together (FR-020, FR-021). */
  get projections(): readonly Projection[] {
    return [this.catalogue, ...Object.values(this.agentBasedCatalogues), this.mcpOrigins, this.builtSensors, this.charterMd, ...this.compiledPrimitives, ...this.providerComponents].flatMap(
      (outputPart) => outputPart.projections,
    );
  }
}
