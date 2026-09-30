import { CLAUDE_DIRECTORY } from "../../../../path.js";
import { DocumentBasedComponent } from "../DocumentBasedComponent.js";

/** A rule's frontmatter: the files that bring it up, where only some do. A rule
 *  declaring no `paths` is loaded at the start of every session. */
export interface ClaudeRuleHeaders {
  readonly paths?: readonly string[];
}

/**
 * A rule this host loads into context whole, one file under the directory it
 * reads every one of.
 *
 * A charter's guides land here. One that names files becomes a rule whose
 * `paths` are those globs, so this host loads it when one of them is touched;
 * one that names none becomes a rule with no `paths`, loaded at the start of
 * every session whether or not anything in it comes up (FR-004, FR-013). That
 * one is charged for on every turn of every session, so a guide that speaks
 * about some files only is worth naming them (SC-005).
 *
 * What the body reads like is the compiler's (plan §2.6).
 */
export class ClaudeRule extends DocumentBasedComponent<ClaudeRuleHeaders> {
  static readonly kind = "rule" as const;
  readonly kind = ClaudeRule.kind;

  static of(name: string, headers: ClaudeRuleHeaders, body: string): ClaudeRule {
    return new ClaudeRule(name, `${CLAUDE_DIRECTORY}/rules/${name}.md`, headers, body);
  }
}
