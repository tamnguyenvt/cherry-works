import { SettingBasedComponent } from "../../app/port/out/managing-local-agent-output.port.js";

/** Events this compiler installs hooks for. This is the engine's supported
 *  subset, not an exhaustive list of Claude Code's lifecycle events. */
const CLAUDE_HOOK_EVENTS = [
  "PreToolUse",
  "PostToolUse",
  "UserPromptSubmit",
  "Stop",
  "SubagentStop",
  "PreCompact",
  "SessionStart",
  "SessionEnd",
  "PermissionRequest",
  "SubagentStart",
  "PostCompact",
] as const;

/** One of them, read off the list rather than written out again. */
export type ClaudeHookEvent = (typeof CLAUDE_HOOK_EVENTS)[number];

/** What turns on this agent's own tool search, so a session opens with each
 *  tool's name and no schema, and the agent searches for a schema when it needs
 *  one (EVAL-FR-016). */
const CLAUDE_TOOL_SEARCH_ENV = { ENABLE_TOOL_SEARCH: "true" } as const;

/** One command this agent runs when an event fires. */
export interface ClaudeHook {
  readonly type: "command";
  readonly command: string;
}

/**
 * What one primitive asks of the settings this agent runs on: what may and may
 * not be run, or a command to run when one of this agent's events fires.
 *
 * Both in one shape because claude reads both out of one file. Each field is
 * optional and a primitive names the one it asks for: a posture the permissions,
 * a sensor the hooks.
 */
export interface ClaudeSettingsFields {
  readonly permissions?: {
    readonly allow: readonly string[];
    readonly deny: readonly string[];
  };
  readonly hooks?: Readonly<Partial<Record<ClaudeHookEvent, readonly { readonly hooks: readonly ClaudeHook[] }[]>>>;
  /** Whatever else this agent reads out of that file and this engine knows
   *  nothing about — the model a repository set, its environment. Read and
   *  written back untouched: what the repository set for itself is not this
   *  engine's to take away (FR-020). */
  readonly [field: string]: unknown;
}

/**
 * The settings this agent runs on: what it may and may not do, and what it
 * runs when an event fires.
 *
 * The one kind here that is not a document. What claude reads is JSON, so this
 * writes JSON — no frontmatter, no body, and none of the reasoning the primitive
 * was authored with, because there is nowhere in that file to put it.
 *
 * One primitive, one fragment of that file. A repository with three postures and
 * two sensors compiles five of these, all naming the same file, and merging them
 * into the one settings claude reads is the projector's — the step after
 * compiling, which is also where a settings file the repository already has is
 * merged with rather than overwritten.
 */
export class ClaudeSettings extends SettingBasedComponent<ClaudeSettingsFields> {
  static get hookEvents(): typeof CLAUDE_HOOK_EVENTS {
    return CLAUDE_HOOK_EVENTS;
  }

  static get toolSearchEnv(): typeof CLAUDE_TOOL_SEARCH_ENV {
    return CLAUDE_TOOL_SEARCH_ENV;
  }

  static readonly kind = "settings" as const;
  readonly kind = ClaudeSettings.kind;
}
