import { DocumentBasedComponent } from "../../app/port/out/managing-local-agent-output.port.js";

export interface CodexSkillHeaders {
  readonly name: string;
  readonly description: string;
}

export class CodexSkill extends DocumentBasedComponent<CodexSkillHeaders> {
  static readonly kind = "skill" as const;
  readonly kind = CodexSkill.kind;
}
