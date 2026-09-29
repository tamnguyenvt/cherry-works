import type { MCP_AUTHS } from "../../charter/primitive/McpPrimitive.js";

/**
 * One address and `path`, once, however many mcps declare it (FR-145).
 *
 * Where a place is and how a developer signs in to it, and nothing else: what
 * each mcp there lets the agent use is its own, and the catalogue already lists
 * every mcp. Keyed by where it is rather than by what it is called, because the
 * repository and a vendor may call one place by two names.
 */
export interface McpOrigin {
  /** Every mcp at this address and path, sorted. */
  readonly identities: readonly string[];
  readonly address: string;
  readonly endpoint?: string;
  readonly command?: { readonly command: string; readonly args: readonly string[]; readonly tokenEnv?: string };
  readonly path?: string;
  /** Every way any identity here lets a developer sign in. */
  readonly auth: readonly (typeof MCP_AUTHS)[number][];
}
