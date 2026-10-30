import { CODEX_DIRECTORY } from "../../../../path.js";
import { GENERATED_STAMP } from "../../StampedDocument.js";
import { ProviderComponent } from "../ProviderComponent.js";

/** TOML basic strings use the same escapes as JSON for these string values. */
export class CodexAgent extends ProviderComponent {
  readonly kind = "agent";

  static of(name: string, description: string, instructions: string, model?: string, disabledFeatures: readonly string[] = [], disableSkills = false): CodexAgent {
    return new CodexAgent(`${CODEX_DIRECTORY}/agents/${name}.toml`, [
      `# ${GENERATED_STAMP}. Do not edit; edit the charter and build again.`,
      `name = ${JSON.stringify(name)}`,
      `description = ${JSON.stringify(description)}`,
      `developer_instructions = ${JSON.stringify(instructions)}`,
      ...(model === undefined ? [] : [`model = ${JSON.stringify(model)}`]),
      ...(disabledFeatures.length === 0 ? [] : ["[features]", ...disabledFeatures.map((feature) => `${feature} = false`)]),
      ...(disableSkills ? ["[skills]", "include_instructions = false", "[skills.bundled]", "enabled = false"] : []),
      "",
    ].join("\n"), "replace");
  }
}
