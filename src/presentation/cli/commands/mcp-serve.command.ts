import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { startMcpServer } from "../../mcp/mcp.server.js";
import { type Command, type Context, EXIT_FAILURE, EXIT_OK, type Outcome } from "./command.interface.js";
import { printFault } from "./helper.js";

/**
 * `cw mcp serve`: the one MCP server the agent's host starts, speaking over
 * standard input and output, serving the mcp origins the last build listed (FR-152
 * – FR-154).
 *
 * What was left out and why is said once, before the protocol starts, on
 * standard error: standard output is the protocol's. A repository never built
 * stops here, saying to build. The run lasts as long as the host keeps
 * standard input open; every mcp origin reached, a local command's process among
 * them, is let go once it has answered.
 */
export class McpServeCommand implements Command {
  readonly name = "mcp serve";
  readonly summary = "Serve every mcp origin the charter reaches to your agent, over stdio";

  async run({ charterBuildingApp, charterRuntimeApp, version }: Context): Promise<Outcome> {
    const servedTools = await charterBuildingApp.tools();
    if (servedTools.type === "Fault") return { code: EXIT_FAILURE, problem: printFault(servedTools) };
    for (const problem of servedTools.data.problems) process.stderr.write(`${problem}\n`);

    const transport = new StdioServerTransport();
    const { serverClosed } = await startMcpServer(charterBuildingApp, charterRuntimeApp, transport, version);
    const closeTransport = () => void transport.close();
    process.stdin.once("end", closeTransport);
    process.once("SIGTERM", closeTransport);
    process.once("SIGINT", closeTransport);
    await serverClosed;

    return { code: EXIT_OK };
  }
}
