import { CodexAgent } from "./CodexAgent.js";
import { CodexEntryFile } from "./CodexEntryFile.js";
import { CodexConfig } from "./CodexConfig.js";
import { CodexRules } from "./CodexRules.js";
import { CodexSkill } from "./CodexSkill.js";
import { CodexSkillPolicy } from "./CodexSkillPolicy.js";

export const CODEX_COMPONENT_CLASSES = [CodexAgent, CodexEntryFile, CodexConfig, CodexRules, CodexSkill, CodexSkillPolicy] as const;
export type CodexComponent = ReturnType<(typeof CODEX_COMPONENT_CLASSES)[number]["of"]>;
