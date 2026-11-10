import { ProviderComponent, StampedDocument } from "../../app/port/out/managing-local-agent-output.port.js";

export interface CodexCommandRule {
  readonly pattern: readonly string[];
  readonly decision: "allow" | "forbidden";
  readonly justification: string;
}

/** Execution policy for command prefixes outside the sandbox, not Markdown
 * guidance or file glob rules. Native Codex resolves conflicting decisions. */
export class CodexRules extends ProviderComponent {
  static readonly kind = "rules";
  readonly kind = CodexRules.kind;

  /** Where it lands, from the repository's root, whether this charter
   *  writes one or not: what the entry file names. */
  static readonly path = ".codex/rules/cw.rules";

  static of(rules: readonly CodexCommandRule[]): CodexRules {
    return new CodexRules("codex", "charter", CodexRules.kind, [
      `# ${StampedDocument.stampText}. Do not edit; edit the charter and build again.`,
      ...rules.map((rule) => `prefix_rule(pattern = ${JSON.stringify(rule.pattern)}, decision = ${JSON.stringify(rule.decision)}, justification = ${JSON.stringify(rule.justification)})`),
      "",
    ].join("\n"));
  }
}
