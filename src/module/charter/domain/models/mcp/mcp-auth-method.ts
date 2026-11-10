/** The ways a developer may sign in to an mcp origin (FR-142): what an `mcp`
 *  primitive declares, and what the list of mcp origins carries for each address.
 *  Shared by the charter and the output, as the agent providers are. */
const MCP_AUTH_METHOD_NAMES = ["oauth", "token"] as const;

/** One of them, as a primitive's headers and the list of mcp origins write it. */
export type McpAuthMethodName = (typeof MCP_AUTH_METHOD_NAMES)[number];

/** One way a developer signs in to an mcp origin: a value, one per name. */
export class McpAuthMethod {
  static readonly OAUTH = new McpAuthMethod("oauth");
  static readonly TOKEN = new McpAuthMethod("token");

  private constructor(readonly name: McpAuthMethodName) {}

  /** Every name, in the order they are offered. */
  static get names(): typeof MCP_AUTH_METHOD_NAMES {
    return MCP_AUTH_METHOD_NAMES;
  }
}
