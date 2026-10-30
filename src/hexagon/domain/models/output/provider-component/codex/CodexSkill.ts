import { CODEX_SKILLS_DIRECTORY } from "../../../../path.js";
import { DocumentBasedComponent } from "../DocumentBasedComponent.js";

export interface CodexSkillHeaders {
  readonly name: string;
  readonly description: string;
}

export class CodexSkill extends DocumentBasedComponent<CodexSkillHeaders> {
  readonly kind = "skill";

  static of(name: string, description: string, body: string): CodexSkill {
    return new CodexSkill(name, `${CODEX_SKILLS_DIRECTORY}/${name}/SKILL.md`, { name, description }, body);
  }
}
