import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport, StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  DrivenFault,
  UnauthorizedMcpFault,
  type ForCallingMcpServers,
  type McpServerAddress,
  type McpServerConnection,
} from "#hexagon/port/zdriven/ForCallingMcpServers.js";

/**
 * DRIVEN ADAPTER: the places a charter declares, reached over the SDK's own
 * client — Streamable HTTP to an endpoint, standard input and output to a local
 * command it starts.
 *
 * A place at an endpoint is sent the token each call is handed as a bearer
 * credential, so a renewal takes effect at the next call. A local command is
 * handed its token once, in the variable its mcp names and in no other way, and
 * is stopped when its place is let go. Its standard error is the server's own.
 */
export class McpClients implements ForCallingMcpServers {
  async connect({ address, endpoint, command }: McpServerAddress, accessToken: string | undefined, timeoutMs: number): Promise<McpServerConnection> {
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
              ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)),
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
            () => reject(new DrivenFault(`${address} did not answer within ${timeoutMs / 1000} seconds.`, "Check the place is up, then start the server again.")),
            timeoutMs,
          );
        }),
      ]);
      return {
        tools: tools.map(({ name, description, inputSchema }) => ({ name, ...(description !== undefined && { description }), inputSchema })),
        callTool: async (name, args, callToken) => {
          if (endpoint !== undefined) bearerToken = callToken;
          try {
            return await client.callTool({ name, arguments: { ...args } });
          } catch (raised) {
            throw faultOf(raised, `Calling "${name}" at ${address} failed`, "Check the place is up, then try again.");
          }
        },
        close: () => client.close(),
      };
    } catch (raised) {
      await client.close().catch(() => undefined);
      throw faultOf(raised, `${address} could not be reached`, "Check the place is up, or its command installed, then start the server again.");
    } finally {
      clearTimeout(connectTimeout);
    }
  }
}

/** What the SDK raised, as this port raises it: a `401` the one refusal the
 *  caller can act on, anything else a `DrivenFault` saying what failed where.
 *  Never what was sent: a credential is not in any message. */
function faultOf(raised: unknown, failed: string, fix: string): DrivenFault {
  if (raised instanceof DrivenFault) return raised;
  if (raised instanceof StreamableHTTPError && raised.code === 401)
    return new UnauthorizedMcpFault(`${failed}: the place refused your credential.`, 'Run "cw mcp auth" at a terminal to sign in there again.');
  return new DrivenFault(`${failed}: ${raised instanceof Error ? raised.message : String(raised)}`, fix);
}
