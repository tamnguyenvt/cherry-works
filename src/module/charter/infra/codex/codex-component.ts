import { AgentProvider } from "../../app/port/out/managing-local-agent-output.port.js";
import { CodexAgent } from "./codex-agent.js";
import { CodexEntryFile } from "./codex-entry-file.js";
import { CodexConfig } from "./codex-config.js";
import { CodexRules } from "./codex-rules.js";
import { CodexSkill } from "./codex-skill.js";
import { CodexSkillPolicy } from "./codex-skill-policy.js";

const CODEX_COMPONENT_CLASSES = [CodexAgent, CodexEntryFile, CodexConfig, CodexRules, CodexSkill, CodexSkillPolicy] as const;
export type CodexComponent = ReturnType<(typeof CODEX_COMPONENT_CLASSES)[number]["of"]>;

/** Every kind of file this engine puts down for Codex. */
export class CodexComponents {
  /** The agent they are read by. */
  static readonly agentProvider = new AgentProvider("codex");

  static get classes(): typeof CODEX_COMPONENT_CLASSES {
    return CODEX_COMPONENT_CLASSES;
  }

  private constructor() {}
}
