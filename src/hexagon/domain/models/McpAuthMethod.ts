/** The ways a developer may sign in to an mcp origin (FR-142): what an `mcp`
 *  primitive declares, and what the list of mcp origins carries for each address.
 *  Shared by the charter and the output, as `AgentProvider` is. */
export const MCP_AUTH_METHODS = ["oauth", "token"] as const;

/** One of them, read off the list rather than written out again. */
export type McpAuthMethod = (typeof MCP_AUTH_METHODS)[number];
