import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { startMcpServer } from "../../mcp/mcp.server.js";
import { type Command, type Context, EXIT_FAILURE, EXIT_OK, type Outcome } from "./command.interface.js";
import { printFault } from "./helper.js";

/**
 * `cw mcp serve`: the one MCP server the agent starts, speaking over
 * standard input and output, serving the mcp origins the last build listed (FR-152
 * – FR-154).
 *
 * What was left out and why is said once, before the protocol starts, on
 * standard error: standard output is the protocol's. A repository never built
 * stops here, saying to build. The run lasts as long as the agent keeps
 * standard input open; every mcp origin reached, a local command's process among
 * them, is let go once it has answered.
 */
export class McpServeCommand implements Command {
  readonly name = "mcp serve";
  readonly summary = "Serve every mcp origin the charter reaches to your agent, over stdio";

  async runCommand({ charterBuildingApp, charterRuntimeApp, version }: Context): Promise<Outcome> {
    const servedToolsDTO = await charterBuildingApp.listServedTools();
    if (servedToolsDTO.type === "Fault") return { exitCode: EXIT_FAILURE, problemText: printFault(servedToolsDTO) };
    for (const servingProblem of servedToolsDTO.data.problems) process.stderr.write(`${servingProblem}\n`);

    const transport = new StdioServerTransport();
    const { serverClosePromise } = await startMcpServer(charterBuildingApp, charterRuntimeApp, transport, version);
    const closeTransport = () => void transport.close();
    process.stdin.once("end", closeTransport);
    process.once("SIGTERM", closeTransport);
    process.once("SIGINT", closeTransport);
    await serverClosePromise;

    return { exitCode: EXIT_OK };
  }
}
