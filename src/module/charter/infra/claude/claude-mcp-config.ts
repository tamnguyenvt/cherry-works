import { SettingBasedComponent } from "../../app/port/out/managing-local-agent-output.port.js";

/** One server this agent starts, as its MCP configuration names it. */
export interface ClaudeMcpServer {
  readonly command: string;
  readonly args: readonly string[];
}

/**
 * The MCP configuration this agent reads: the one server that reaches every
 * mcp origin the charter declares (FR-146).
 *
 * One for the whole charter, whatever it holds: the agent is given
 * `cw run mcp` and nothing per mcp origin, so the agent's configuration says the
 * same however many mcp origins there are — none included — and shows the agent only
 * the tools the charter declares (plan §19).
 */
export class ClaudeMcpConfig extends SettingBasedComponent<{
  readonly mcpServers: Readonly<Record<string, ClaudeMcpServer>>;
}> {
  static readonly kind = "mcp-config" as const;
  readonly kind = ClaudeMcpConfig.kind;

  /** What this agent names the server, and so what it puts before each tool it
   *  serves: `mcp__cw__<tool>`. */
  static readonly cwMcpName = "cw";
}
