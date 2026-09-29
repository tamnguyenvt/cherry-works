import type { ProjectionPolicy } from "../../ProjectionPolicy.js";

/** One server this host starts, as its MCP configuration names it. */
export interface ClaudeMcpServer {
  readonly command: string;
  readonly args: readonly string[];
}

/**
 * The MCP configuration this host reads: the one server that reaches every
 * place the charter declares (FR-146).
 *
 * One for the whole charter, whatever it holds: the agent is given
 * `cw mcp serve` and nothing per place, so the host's configuration says the
 * same however many places there are — none included — and shows the agent only
 * the tools the charter declares (plan §19).
 */
export class ClaudeMcpConfigComponent {
  static readonly kind = "mcp-config" as const;
  readonly kind = ClaudeMcpConfigComponent.kind;

  /** What this host names the server, and so what it puts before each tool it
   *  serves: `mcp__cw__<tool>`. */
  static readonly cwMcpName = "cw";

  /** That file is the repository's too — every server it wrote itself is
   *  there — so the charter's one entry is written into it, and it is never
   *  taken away, as the settings are not (FR-146). */
  readonly projection: ProjectionPolicy = "mergeJSON";

  /** The one entry the charter speaks for, under `mcpServers`. */
  readonly mcpServers: Readonly<Record<string, ClaudeMcpServer>> = { [ClaudeMcpConfigComponent.cwMcpName]: { command: "cw", args: ["mcp", "serve"] } };

  static of(): ClaudeMcpConfigComponent {
    return new ClaudeMcpConfigComponent();
  }

  private constructor() {}
}
