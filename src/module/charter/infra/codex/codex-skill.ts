import { DocumentBasedComponent } from "../../app/port/out/managing-local-agent-output.port.js";

export interface CodexSkillHeaders {
  readonly name: string;
  readonly description: string;
}

export class CodexSkill extends DocumentBasedComponent<CodexSkillHeaders> {
  readonly kind = "skill";
}
