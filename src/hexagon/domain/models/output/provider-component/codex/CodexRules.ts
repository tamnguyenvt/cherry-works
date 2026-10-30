import { CODEX_DIRECTORY } from "../../../../path.js";
import { GENERATED_STAMP } from "../../StampedDocument.js";
import { ProviderComponent } from "../ProviderComponent.js";

export interface CodexCommandRule {
  readonly pattern: readonly string[];
  readonly decision: "allow" | "forbidden";
  readonly justification: string;
}

/** Execution policy for command prefixes outside the sandbox, not Markdown
 * guidance or file glob rules. Native Codex resolves conflicting decisions. */
export class CodexRules extends ProviderComponent {
  readonly kind = "rules";

  static of(rules: readonly CodexCommandRule[]): CodexRules {
    return new CodexRules(`${CODEX_DIRECTORY}/rules/cw.rules`, [
      `# ${GENERATED_STAMP}. Do not edit; edit the charter and build again.`,
      ...rules.map((rule) => `prefix_rule(pattern = ${JSON.stringify(rule.pattern)}, decision = ${JSON.stringify(rule.decision)}, justification = ${JSON.stringify(rule.justification)})`),
      "",
    ].join("\n"), "replace");
  }
}
