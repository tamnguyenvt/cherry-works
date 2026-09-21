import type { ProjectionPolicy } from "../../ProjectionPolicy.js";

/** The events this host raises, and the only keys `hooks` takes: a name outside
 *  this set is a hook that never fires, which is a charter naming an event of a
 *  host that does not have it. */
export const CLAUDE_HOOK_EVENTS = [
  "PreToolUse",
  "PostToolUse",
  "UserPromptSubmit",
  "Notification",
  "Stop",
  "SubagentStop",
  "PreCompact",
  "SessionStart",
  "SessionEnd",
] as const;

/** One of them, read off the list rather than written out again. */
export type ClaudeHookEvent = (typeof CLAUDE_HOOK_EVENTS)[number];

/** Is this name one of them? What anything asks before writing a hook: a signal
 *  read off a charter is a string until this says otherwise. */
export function isClaudeHookEvent(name: string): name is ClaudeHookEvent {
  return (CLAUDE_HOOK_EVENTS as readonly string[]).includes(name);
}

/** One command this host runs when an event fires. */
export interface ClaudeHook {
  readonly type: "command";
  readonly command: string;
}

/**
 * What one primitive asks of the settings this host runs on: what may and may
 * not be run, or a command to run when one of this host's events fires.
 *
 * Both in one shape because claude reads both out of one file. Each field is
 * optional and a primitive names the one it asks for: a posture the permissions,
 * a sensor the hooks.
 */
export interface ClaudeSettings {
  readonly permissions?: {
    readonly allow: readonly string[];
    readonly deny: readonly string[];
  };
  readonly hooks?: Readonly<Partial<Record<ClaudeHookEvent, readonly { readonly hooks: readonly ClaudeHook[] }[]>>>;
  /** Whatever else this host reads out of that file and this engine knows
   *  nothing about — the model a repository set, its environment. Read and
   *  written back untouched: what the repository set for itself is not this
   *  engine's to take away (FR-020). */
  readonly [field: string]: unknown;
}

/**
 * The settings this host runs on: what the agent may and may not do, and what it
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
export class ClaudeSettingsComponent {
  static readonly kind = "settings" as const;
  readonly kind = ClaudeSettingsComponent.kind;

  /** The settings file this host reads is shared with whatever the repository set
   *  for itself, so what is put down there is written into what is there rather
   *  than in place of it (FR-018). */
  readonly projection: ProjectionPolicy = "mergeJSON";

  static of(settings: ClaudeSettings): ClaudeSettingsComponent {
    return new ClaudeSettingsComponent(settings);
  }

  private constructor(
    /** The fields this asks of the settings file, as claude reads them. */
    readonly settings: ClaudeSettings,
  ) {}

}
