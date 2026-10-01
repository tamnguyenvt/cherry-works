import { ClaudeAgent } from "./ClaudeAgent.js";
import { ClaudeEntryFile } from "./ClaudeEntryFile.js";
import { ClaudeRule } from "./ClaudeRule.js";
import { ClaudeMcpConfig } from "./ClaudeMcpConfig.js";
import { ClaudeSettings } from "./ClaudeSettings.js";
import { ClaudeSkill } from "./ClaudeSkill.js";

/** The kinds this host has, one class each. Adding a kind is a file beside them
 *  and a line here; what the kinds are is read back off this list rather than
 *  written down twice. */
export const CLAUDE_COMPONENT_CLASSES = [
  ClaudeAgent,
  ClaudeSkill,
  ClaudeSettings,
  ClaudeMcpConfig,
  ClaudeRule,
  ClaudeEntryFile,
] as const;

/**
 * One file as claude's own kinds have it, discriminated on `kind`.
 *
 * Read off what those classes hand back rather than listed again: a constructor
 * is private, so `of` is the only way one comes into being, and what it returns
 * is what a primitive of this host is.
 */
export type ClaudeComponent = ReturnType<(typeof CLAUDE_COMPONENT_CLASSES)[number]["of"]>;

/** The kinds, each read off the class that writes it. The set is closed:
 *  the compiler reads it to know where a file of that kind goes, and a kind
 *  with nowhere to go is a compile error. */
export const CLAUDE_COMPONENT_KINDS = Object.freeze(CLAUDE_COMPONENT_CLASSES.map((one) => one.kind));

export type ClaudeComponentKind = (typeof CLAUDE_COMPONENT_CLASSES)[number]["kind"];
