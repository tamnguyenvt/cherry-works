import { CODEX_SKILLS_DIRECTORY } from "../../../../path.js";
import { GENERATED_STAMP } from "../../StampedDocument.js";
import { ProviderComponent } from "../ProviderComponent.js";

export class CodexSkillPolicy extends ProviderComponent {
  readonly kind = "skill-policy";

  static of(name: string): CodexSkillPolicy {
    return new CodexSkillPolicy(`${CODEX_SKILLS_DIRECTORY}/${name}/agents/openai.yaml`, `# ${GENERATED_STAMP}. Do not edit; edit the charter and build again.\npolicy:\n  allow_implicit_invocation: false\n`, "replace");
  }
}
