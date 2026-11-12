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

  /** The way this name writes, as a primitive's headers, a DTO or a kept
   *  credential write it. */
  static of(methodName: McpAuthMethodName): McpAuthMethod {
    return methodName === McpAuthMethod.OAUTH.name ? McpAuthMethod.OAUTH : McpAuthMethod.TOKEN;
  }

  toString(): McpAuthMethodName {
    return this.name;
  }

  /** Written as its name, wherever a model holding it is written as JSON. */
  toJSON(): McpAuthMethodName {
    return this.name;
  }

  /** Every name, in the order they are offered. */
  static get names(): typeof MCP_AUTH_METHOD_NAMES {
    return MCP_AUTH_METHOD_NAMES;
  }
}
