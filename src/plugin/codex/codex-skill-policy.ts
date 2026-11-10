import { ProviderComponent, StampedDocument } from "#module/charter/module.js";

export class CodexSkillPolicy extends ProviderComponent {
  readonly kind = "skill-policy";

  /** The policy of the skill `name`, compiled from a primitive of `primitiveKind`. */
  static of(primitiveKind: string, name: string): CodexSkillPolicy {
    return new CodexSkillPolicy("codex", primitiveKind, name, `# ${StampedDocument.stampText}. Do not edit; edit the charter and build again.\npolicy:\n  allow_implicit_invocation: false\n`);
  }
}
