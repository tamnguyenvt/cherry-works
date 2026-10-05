import {
  DrivenFault,
  UnauthorizedMcpFault,
  type ForCallingMcpServers,
  type McpServerAddress,
  type McpServerConnection,
  type ToolAnswer,
  type UpstreamTool,
} from "#hexagon/port/zdriven/ForCallingMcpServers.js";

/** One mcp origin a test stands up: what it lists, and what it answers a call with.
 *  `acceptsToken` says which token it lets through; any other is a `401`. */
export interface InMemoryMcpServer {
  readonly tools: readonly UpstreamTool[];
  readonly answer?: (name: string, args: Readonly<Record<string, unknown>>) => ToolAnswer;
  readonly acceptsToken?: (accessToken: string | undefined) => boolean;
}

/** MCP servers answered from memory: a test sets each mcp origin under its address,
 *  or leaves it out to have it unreachable, and reads back what was asked of
 *  them. The second implementation that earns `ForCallingMcpServers` its
 *  place. */
export class InMemoryMcpServers implements ForCallingMcpServers {
  readonly servers = new Map<string, InMemoryMcpServer>();
  readonly connected: { readonly address: string; readonly accessToken: string | undefined }[] = [];
  readonly calls: { readonly address: string; readonly name: string; readonly args: unknown; readonly accessToken: string | undefined }[] = [];
  readonly closed: string[] = [];

  async connect({ address }: McpServerAddress, accessToken: string | undefined): Promise<McpServerConnection> {
    const server = this.servers.get(address);
    if (server === undefined) throw new DrivenFault(`${address} could not be reached.`, "Check the mcp origin is up.");
    this.connected.push({ address, accessToken });
    return {
      tools: server.tools,
      callTool: async (name, args, callToken) => {
        this.calls.push({ address, name, args, accessToken: callToken });
        if (server.acceptsToken !== undefined && !server.acceptsToken(callToken))
          throw new UnauthorizedMcpFault(`${address} refused the credential.`, "Sign in again.");
        return server.answer?.(name, args) ?? { content: [{ type: "text", text: `${name} answered` }] };
      },
      close: async () => void this.closed.push(address),
    };
  }
}
