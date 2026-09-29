import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult, type Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ForConnectingMcps } from "#hexagon/port/driver/ForConnectingMcps.js";

/**
 * DRIVER ADAPTER: the one MCP server an agent's host is given, `cw mcp serve`
 * (FR-152).
 *
 * Answers `tools/list` and `tools/call` through `ForConnectingMcps` and nothing
 * else: which tools there are, where a call goes and what it answers are the
 * hexagon's. A place's answer is handed back as it came.
 *
 * Answers when the server is speaking over `transport`, with what settles once
 * the transport closes.
 */
export async function startMcpServer(mcpConnectingApp: ForConnectingMcps, transport: Transport, version = "0.0.0"): Promise<{ serverClosed: Promise<void> }> {
  const server = new Server({ name: "cw", version }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: (await mcpConnectingApp.served()).data.tools.map(({ data }) => data as Tool),
  }));
  server.setRequestHandler(
    CallToolRequestSchema,
    async ({ params }) => (await mcpConnectingApp.call(params.name, params.arguments ?? {})).data as CallToolResult,
  );
  const serverClosed = new Promise<void>((resolve) => (server.onclose = resolve));
  await server.connect(transport);
  return { serverClosed };
}
