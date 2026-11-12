import {
  type ForCallingMcpServers,
  type McpServerAddress,
  type McpServerConnection,
  type ToolAnswer,
  UnauthorizedMcpFault,
  UnreachableMcpOriginFault,
  type UpstreamTool,
} from "../../app/port/out/calling-mcp-servers.port.js";

/** One mcp origin a test stands up: what it lists, and what it answers a call with.
 *  `acceptsToken` says which token it lets through; any other is a `401`. */
export interface InMemoryMcpServer {
  readonly tools: readonly UpstreamTool[];
  readonly answerCall?: (toolName: string, toolArguments: Readonly<Record<string, unknown>>) => ToolAnswer;
  readonly acceptsToken?: (accessToken: string | undefined) => boolean;
}

/** MCP servers answered from memory: a test sets each mcp origin under its address,
 *  or leaves it out to have it unreachable, and reads back what was asked of
 *  them. The second implementation that earns `ForCallingMcpServers` its
 *  place. */
export class InMemoryMcpServers implements ForCallingMcpServers {
  readonly servers = new Map<string, InMemoryMcpServer>();
  readonly connected: { readonly address: string; readonly accessToken: string | undefined }[] = [];
  readonly calls: {
    readonly address: string;
    readonly toolName: string;
    readonly toolArguments: unknown;
    readonly accessToken: string | undefined;
  }[] = [];
  readonly closed: string[] = [];

  async connectServer({ address }: McpServerAddress, accessToken: string | undefined): Promise<McpServerConnection> {
    const server = this.servers.get(address);
    if (server === undefined)
      throw new UnreachableMcpOriginFault(`${address} could not be reached.`, "Check the mcp origin is up.", {
        internal: false,
      });
    this.connected.push({ address, accessToken });
    return {
      tools: server.tools,
      callTool: async (toolName, toolArguments, callToken) => {
        this.calls.push({ address, toolName, toolArguments, accessToken: callToken });
        if (server.acceptsToken !== undefined && !server.acceptsToken(callToken))
          throw new UnauthorizedMcpFault(`${address} refused the credential.`, "Sign in again.", { internal: false });
        return (
          server.answerCall?.(toolName, toolArguments) ?? { content: [{ type: "text", text: `${toolName} answered` }] }
        );
      },
      closeConnection: async () => void this.closed.push(address),
    };
  }
}
