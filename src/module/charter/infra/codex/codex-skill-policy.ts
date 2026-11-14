import { ProviderComponent } from "../../app/port/out/managing-local-agent-output.port.js";

export class CodexSkillPolicy extends ProviderComponent {
  static readonly kind = "skill-policy" as const;
  readonly kind = CodexSkillPolicy.kind;
}
