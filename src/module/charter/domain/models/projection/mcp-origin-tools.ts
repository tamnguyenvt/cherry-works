import type { FaultsByFile } from "../../../../shared/module.js";
import type { McpToolDefinition } from "./mcp-origin.js";

/** The tools each mcp origin serves, by its key, as a build learned them, and
 *  what is wrong with the mcps that declare them: an origin not reached, not
 *  signed in to, or not listing a tool one declares (FR-145). */
export class McpOriginTools {
  constructor(
    readonly toolsByOriginKey: ReadonlyMap<string, readonly McpToolDefinition[]>,
    readonly faultsByFile: FaultsByFile,
  ) {}
}
