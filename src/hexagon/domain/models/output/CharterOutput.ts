import type { Catalogue } from "./common/Catalogue.js";
import type { CharterMd } from "./common/CharterMd.js";
import type { CompiledPrimitive } from "./common/CompiledPrimitive.js";
import type { McpOrigin } from "./common/McpOrigin.js";
import type { ClaudeComponent } from "./providers/claude/ClaudeComponent.js";

/**
 * Everything one reading of a charter compiles to (FR-021).
 *
 * Models and nothing else — no path, no contents and no file. What every reader
 * of the charter gets is here whether an agent is installed or not: the listing,
 * and the file that orients a reader to it (FR-019). What the agents this
 * repository runs get is each primitive in that host's own kinds, and a
 * repository running none has none of them (FR-018).
 */
export interface CharterOutput {
  readonly catalogue: Catalogue;
  readonly charterMd: CharterMd;
  readonly compiledPrimitives: readonly CompiledPrimitive[];
  /** Every place the charter's mcps reach, each once: what `cw mcp serve` and
   *  `cw mcp auth` read (FR-145). Ordered by address, then path (SC-007). */
  readonly mcpOrigins: readonly McpOrigin[];
  readonly providerComponents: readonly ClaudeComponent[];
}
