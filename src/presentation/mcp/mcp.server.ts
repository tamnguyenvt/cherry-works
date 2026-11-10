import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult, type Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ForBuildingCharter } from "#module/charter/module.js";
import type { ForRunningCharter } from "#module/runtime/module.js";

/**
 * DRIVER ADAPTER: the one MCP server an agent's host is given, `cw mcp serve`
 * (FR-152).
 *
 * Answers `tools/list` through `ForBuildingCharter` and `tools/call` through
 * `ForRunningCharter`, and nothing else: which tools there are, where a call goes and what it answers are the
 * hexagon's. An mcp origin's answer is handed back as it came.
 *
 * Answers when the server is speaking over `transport`, with what settles once
 * the transport closes.
 */
export async function startMcpServer(
  charterBuildingApp: Pick<ForBuildingCharter, "tools">,
  charterRuntimeApp: Pick<ForRunningCharter, "call">,
  transport: Transport,
  version = "0.0.0",
): Promise<{ serverClosed: Promise<void> }> {
  const server = new Server({ name: "cw", version }, { capabilities: { tools: {} } });
  // A fault is said as the protocol says a refusal, an error the host reads.
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const servedToolsDTO = await charterBuildingApp.tools();
    if (servedToolsDTO.type === "Fault") throw new Error(`${servedToolsDTO.data.message} ${servedToolsDTO.data.fix}`);
    return { tools: servedToolsDTO.data.tools.map(({ data }) => data as Tool) };
  });
  server.setRequestHandler(
    CallToolRequestSchema,
    async ({ params }) => {
      const toolAnswerDTO = await charterRuntimeApp.call(params.name, params.arguments ?? {});
      // A fault of the call is the tool's own error, which the host reads as
      // the result. A list that fails is still a protocol error, above.
      if (toolAnswerDTO.type === "Fault")
        return { content: [{ type: "text", text: `${toolAnswerDTO.data.message} ${toolAnswerDTO.data.fix}` }], isError: true };
      return toolAnswerDTO.data as CallToolResult;
    },
  );
  const serverClosed = new Promise<void>((resolve) => (server.onclose = resolve));
  await server.connect(transport);
  return { serverClosed };
}
