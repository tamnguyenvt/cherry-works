import { type AgentProvider, ProviderComponent } from "../../app/port/out/managing-local-agent-output.port.js";

/** Events supported by Codex command hooks, independent of charter signals. */
const CODEX_HOOK_EVENTS = [
  "SessionStart",
  "SessionEnd",
  "PreToolUse",
  "PermissionRequest",
  "PostToolUse",
  "UserPromptSubmit",
  "SubagentStart",
  "SubagentStop",
  "PreCompact",
  "PostCompact",
  "Stop",
] as const;

export type CodexHookEvent = (typeof CODEX_HOOK_EVENTS)[number];

export interface CodexHook {
  readonly event: CodexHookEvent;
  readonly command: string;
  readonly description: string;
}

/** Desired TOML settings. The projection parses and merges these values with
 * the repository's current settings in memory, without a separate state file. */
export class CodexConfig extends ProviderComponent {
  static get hookEvents(): typeof CODEX_HOOK_EVENTS {
    return CODEX_HOOK_EVENTS;
  }

  static readonly kind = "config" as const;

  readonly kind = CodexConfig.kind;

  constructor(agentProvider: AgentProvider, text: string, warnings: readonly string[]) {
    super(agentProvider, "charter", "config", text, warnings);
  }
}
