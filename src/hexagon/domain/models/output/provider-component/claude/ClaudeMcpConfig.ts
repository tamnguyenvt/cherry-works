import { CLAUDE_MCP_CONFIG_FILE } from "../../../../path.js";
import { SettingBasedComponent } from "../SettingBasedComponent.js";

/** One server this host starts, as its MCP configuration names it. */
export interface ClaudeMcpServer {
  readonly command: string;
  readonly args: readonly string[];
}

/**
 * The MCP configuration this host reads: the one server that reaches every
 * mcp origin the charter declares (FR-146).
 *
 * One for the whole charter, whatever it holds: the agent is given
 * `cw mcp serve` and nothing per mcp origin, so the host's configuration says the
 * same however many mcp origins there are — none included — and shows the agent only
 * the tools the charter declares (plan §19).
 */
export class ClaudeMcpConfig extends SettingBasedComponent<{ readonly mcpServers: Readonly<Record<string, ClaudeMcpServer>> }> {
  static readonly kind = "mcp-config" as const;
  readonly kind = ClaudeMcpConfig.kind;

  /** What this host names the server, and so what it puts before each tool it
   *  serves: `mcp__cw__<tool>`. */
  static readonly cwMcpName = "cw";

  /** The one entry the charter speaks for, under `mcpServers`, in the file this
   *  host starts a project's servers from. That file is the repository's too —
   *  every server it wrote itself is there — so the entry is written into it,
   *  and it is never taken away (FR-146). */
  static of(): ClaudeMcpConfig {
    return new ClaudeMcpConfig(CLAUDE_MCP_CONFIG_FILE, {
      mcpServers: { [ClaudeMcpConfig.cwMcpName]: { command: "cw", args: ["mcp", "serve"] } },
    });
  }
}
