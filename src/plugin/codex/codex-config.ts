import { ProviderComponent } from "#module/charter/module.js";

/** Events supported by Codex command hooks, independent of charter signals. */
const CODEX_HOOK_EVENTS = [
  "SessionStart", "SessionEnd", "PreToolUse", "PermissionRequest", "PostToolUse",
  "UserPromptSubmit", "SubagentStart", "SubagentStop", "PreCompact", "PostCompact", "Stop",
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

  readonly kind = "config";

  private constructor(document: string, warnings: readonly string[]) {
    super("codex", "charter", "config", document, warnings);
  }

  static of(hooks: readonly CodexHook[], filesystem: Readonly<Record<string, "read" | "write" | "deny">> = {}, warnings: readonly string[] = []): CodexConfig {
    const hasPermissions = Object.keys(filesystem).length > 0;
    const absolutePaths = Object.entries(filesystem).filter(([path]) => path.startsWith("/") || path.startsWith("~/"));
    const workspacePaths = Object.fromEntries(Object.entries(filesystem).filter(([path]) => !path.startsWith("/") && !path.startsWith("~/")));
    return new CodexConfig([
      'project_doc_max_bytes = 1048576', // 1 MiB of project instructions.
      "",
      ...(hasPermissions ? ['default_permissions = "cw"', ""] : []),
      "[mcp_servers.cw]",
      'command = "cw"',
      'args = ["mcp", "serve"]',
      ...(hasPermissions ? [
        "",
        "[permissions.cw]",
        'extends = ":workspace"',
        ...(absolutePaths.length === 0 ? [] : ["[permissions.cw.filesystem]", ...absolutePaths.sort(([first], [second]) => first.localeCompare(second)).map(([path, access]) => `${JSON.stringify(path)} = ${JSON.stringify(access)}`)]),
        '[permissions.cw.filesystem.":workspace_roots"]',
        ...Object.entries({ ".": "write", ...workspacePaths }).sort(([first], [second]) => first.localeCompare(second)).map(([path, access]) => `${JSON.stringify(path)} = ${JSON.stringify(access)}`),
      ] : []),
      ...hooks.flatMap((hook) => [
        "",
        `[[hooks.${hook.event}]]`,
        `[[hooks.${hook.event}.hooks]]`,
        'type = "command"',
        `command = ${JSON.stringify(hook.command)}`,
        `statusMessage = ${JSON.stringify(hook.description)}`,
      ]),
      "",
    ].join("\n"), warnings);
  }
}
