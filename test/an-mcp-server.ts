import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

/** The tools every test mcp origin has: `echo` answers what it was handed, and
 *  `fail` answers an error of its own, which is still the mcp origin's answer. */
export const TEST_TOOLS = [
  { name: "echo", description: "Answers what it was handed.", inputSchema: { type: "object", properties: { text: { type: "string" } } } },
  { name: "fail", description: "Answers an error of its own.", inputSchema: { type: "object", properties: {} } },
];

/** One MCP server as a test stands it up: its answers to `tools/list` and
 *  `tools/call`, whoever is speaking to it. */
export function aTestMcpServer(): Server {
  const server = new Server({ name: "a-test-mcp-origin", version: "0.0.0" }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TEST_TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async ({ params }) =>
    params.name === "fail"
      ? { content: [{ type: "text", text: "it failed at the mcp origin" }], isError: true }
      : { content: [{ type: "text", text: `echo: ${String(params.arguments?.text ?? "")}` }] },
  );
  return server;
}

/**
 * An MCP server over Streamable HTTP on `127.0.0.1` at a free port, letting
 * through only a request carrying `Authorization: Bearer <acceptedToken>`, and
 * answering any other with `401`. Stateless: each request is its own session,
 * with no session id. Records the `Authorization` header of every request.
 */
export async function anMcpServer(acceptedToken: string): Promise<{ endpoint: string; server: HttpServer; authorizations: (string | undefined)[] }> {
  const authorizations: (string | undefined)[] = [];
  const server = createServer(async (request, response) => {
    authorizations.push(request.headers.authorization);
    if (request.headers.authorization !== `Bearer ${acceptedToken}`) return void response.writeHead(401).end();
    const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true });
    response.on("close", () => void transport.close());
    await aTestMcpServer().connect(transport as Transport);
    await transport.handleRequest(request, response);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { endpoint: `http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`, server, authorizations };
}
