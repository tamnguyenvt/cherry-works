import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { aTestMcpServer, TEST_TOOLS } from "./an-mcp-server.js";

/**
 * A place started as a local command: the test tools over standard input and
 * output, and two more — `read_token` answering what `PLACE_TOKEN` holds, the
 * variable its mcp names, and `process_id` answering its own, so a test can
 * see it stopped.
 */
const server = aTestMcpServer();
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    ...TEST_TOOLS,
    { name: "read_token", inputSchema: { type: "object", properties: {} } },
    { name: "process_id", inputSchema: { type: "object", properties: {} } },
  ],
}));
server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
  if (params.name === "read_token") return { content: [{ type: "text", text: process.env.PLACE_TOKEN ?? "" }] };
  if (params.name === "process_id") return { content: [{ type: "text", text: String(process.pid) }] };
  return { content: [{ type: "text", text: `echo: ${String(params.arguments?.text ?? "")}` }] };
});
await server.connect(new StdioServerTransport());
