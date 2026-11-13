import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  type ForCallingMcpServers,
  type McpServerAddress,
  type McpServerConnection,
  UnansweringMcpOriginFault,
} from "../app/port/out/calling-mcp-servers.port.js";
import { wrapMcpFault } from "./helper.js";

/**
 * DRIVEN ADAPTER: the mcp origins a charter declares, reached over the SDK's own
 * client — Streamable HTTP to an endpoint, standard input and output to a local
 * command it starts.
 *
 * An mcp origin at an endpoint is sent the token each call is handed as a bearer
 * credential, so a renewal takes effect at the next call. A local command is
 * handed its token once, in the variable its mcp names and in no other way, and
 * is stopped when its mcp origin is let go. Its standard error is the server's own.
 */
export class McpClients implements ForCallingMcpServers {
  async connectServer(
    { address, endpoint, command }: McpServerAddress,
    accessToken: string | undefined,
    timeoutMs: number,
  ): Promise<McpServerConnection> {
    let bearerToken = accessToken;
    // Typed as the SDK's own `Transport`, which its transports are, but for
    // optional fields `exactOptionalPropertyTypes` reads more strictly.
    const transport = (
      endpoint !== undefined
        ? new StreamableHTTPClientTransport(new URL(endpoint), {
            fetch: (url, init) => {
              const headers = new Headers(init?.headers);
              if (bearerToken !== undefined) headers.set("authorization", `Bearer ${bearerToken}`);
              return fetch(url, { ...init, headers });
            },
          })
        : new StdioClientTransport({
            command: command?.command ?? "",
            args: [...(command?.args ?? [])],
            env: {
              ...Object.fromEntries(
                Object.entries(process.env).filter(
                  (environmentEntry): environmentEntry is [string, string] => environmentEntry[1] !== undefined,
                ),
              ),
              ...(command?.tokenEnv !== undefined && accessToken !== undefined && { [command.tokenEnv]: accessToken }),
            },
            stderr: "inherit",
          })
    ) as Transport;
    const client = new Client({ name: "cherry-works", version: "1" });

    let connectTimeout: NodeJS.Timeout | undefined;
    try {
      const { tools } = await Promise.race([
        client.connect(transport).then(() => client.listTools()),
        new Promise<never>((_resolve, reject) => {
          connectTimeout = setTimeout(
            () =>
              reject(
                new UnansweringMcpOriginFault(
                  `${address} did not answer within ${timeoutMs / 1000} seconds.`,
                  "Check the mcp origin is up, then start the server again.",
                  { internal: false },
                ),
              ),
            timeoutMs,
          );
        }),
      ]);
      return {
        tools: tools.map(({ name, description, inputSchema }) => ({
          name,
          ...(description !== undefined && { description }),
          inputSchema,
        })),
        callTool: async (toolName, toolArguments, callToken) => {
          if (endpoint !== undefined) bearerToken = callToken;
          try {
            return await client.callTool({ name: toolName, arguments: { ...toolArguments } });
          } catch (raisedValue) {
            throw wrapMcpFault(
              raisedValue,
              `Calling "${toolName}" at ${address} failed`,
              "Check the mcp origin is up, then try again.",
            );
          }
        },
        closeConnection: () => client.close(),
      };
    } catch (raisedValue) {
      await client.close().catch(() => undefined);
      throw wrapMcpFault(
        raisedValue,
        `${address} could not be reached`,
        "Check the mcp origin is up, or its command installed, then start the server again.",
      );
    } finally {
      clearTimeout(connectTimeout);
    }
  }
}
