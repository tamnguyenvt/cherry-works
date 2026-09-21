import { DocumentBasedComponent } from "./DocumentBasedComponent.js";

/** A skill's frontmatter: the name its directory carries, and the description
 *  this host reads on every turn to decide whether to open the body. */
export interface ClaudeSkillHeaders {
  readonly name: string;
  readonly description: string;
}

/** What a skill is compiled with, its name aside: that is what the component is
 *  called, and this host reads it out of the frontmatter as well. */
export type ClaudeSkillDeclared = Omit<ClaudeSkillHeaders, "name">;

/**
 * A skill: a directory holding one `SKILL.md`, whose description claude
 * reads on every turn and whose body it opens only when that description
 * matches what is being asked.
 *
 * This is the host's one mechanism for know-how that is loaded when the
 * request calls for it and not before, so more than one charter kind compiles
 * to it: a `skill`, and a `playbook` (FR-013).
 *
 * Whatever decides that the body is worth opening is written into the
 * description, because that line is all this host reads before deciding.
 */
export class ClaudeSkillComponent extends DocumentBasedComponent<ClaudeSkillHeaders> {
  static readonly kind = "skill" as const;
  readonly kind = ClaudeSkillComponent.kind;

  static of(name: string, declared: ClaudeSkillDeclared, body: string): ClaudeSkillComponent {
    return new ClaudeSkillComponent(name, { name, ...declared }, body);
  }
}
