import { AgentProvider } from "../../app/port/out/managing-local-agent-output.port.js";
import { ClaudeAgent } from "./claude-agent.js";
import { ClaudeEntryFile } from "./claude-entry-file.js";
import { ClaudeRule } from "./claude-rule.js";
import { ClaudeMcpConfig } from "./claude-mcp-config.js";
import { ClaudeSettings } from "./claude-settings.js";
import { ClaudeSkill } from "./claude-skill.js";

/** The kinds this host has, one class each. Adding a kind is a file beside them
 *  and a line here; what the kinds are is read back off this list rather than
 *  written down twice. */
const CLAUDE_COMPONENT_CLASSES = [
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
const CLAUDE_COMPONENT_KINDS = Object.freeze(CLAUDE_COMPONENT_CLASSES.map((one) => one.kind));

export type ClaudeComponentKind = (typeof CLAUDE_COMPONENT_CLASSES)[number]["kind"];

/** Every kind of file this engine puts down for claude. */
export class ClaudeComponents {
  /** The agent they are read by. */
  static readonly agentProvider = new AgentProvider("claude");

  static get classes(): typeof CLAUDE_COMPONENT_CLASSES {
    return CLAUDE_COMPONENT_CLASSES;
  }

  static get kinds(): typeof CLAUDE_COMPONENT_KINDS {
    return CLAUDE_COMPONENT_KINDS;
  }

  private constructor() {}
}
