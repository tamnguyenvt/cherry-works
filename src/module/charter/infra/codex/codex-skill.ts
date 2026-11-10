import { DocumentBasedComponent } from "../../app/port/out/managing-local-agent-output.port.js";

export interface CodexSkillHeaders {
  readonly name: string;
  readonly description: string;
}

export class CodexSkill extends DocumentBasedComponent<CodexSkillHeaders> {
  readonly kind = "skill";

  /** One compiled from a primitive of `primitiveKind`: a `skill` or a `playbook`. */
  static of(primitiveKind: string, name: string, description: string, body: string): CodexSkill {
    return new CodexSkill("codex", primitiveKind, name, { name, description }, body);
  }
}
