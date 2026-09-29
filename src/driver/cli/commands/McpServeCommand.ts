import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { startMcpServer } from "../../mcp/server.js";
import { EXIT_OK, type Command, type Context, type Outcome } from "./Command.js";

/**
 * `cw mcp serve`: the one MCP server the agent's host starts, speaking over
 * standard input and output, serving the places the last build listed (FR-152
 * – FR-154).
 *
 * Every place is reached before the protocol starts, so what was left out and
 * why is said once, on standard error: standard output is the protocol's. A
 * repository never built stops here, saying to build. The run lasts as long as
 * the host keeps standard input open, and every place reached — a local
 * command's process among them — is let go when it ends.
 */
export class McpServeCommand implements Command {
  readonly name = "mcp serve";
  readonly summary = "Serve every place the charter reaches to your agent, over stdio";

  async run({ mcpConnectingApp, version }: Context): Promise<Outcome> {
    const servedTools = await mcpConnectingApp.served();
    for (const problem of servedTools.data.problems) process.stderr.write(`${problem}\n`);

    const transport = new StdioServerTransport();
    const { serverClosed } = await startMcpServer(mcpConnectingApp, transport, version);
    const closeTransport = () => void transport.close();
    process.stdin.once("end", closeTransport);
    process.once("SIGTERM", closeTransport);
    process.once("SIGINT", closeTransport);
    await serverClosed;

    await mcpConnectingApp.stopServing();
    return { code: EXIT_OK };
  }
}
