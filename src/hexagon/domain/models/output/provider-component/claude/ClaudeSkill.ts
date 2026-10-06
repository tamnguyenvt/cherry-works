import { CLAUDE_DIRECTORY } from "../../../../path.js";
import { DocumentBasedComponent } from "../DocumentBasedComponent.js";

/** A skill's frontmatter: the name its directory carries, the description
 *  this host reads on every turn to decide whether to open the body, and,
 *  where it is no command of the user's, `user-invocable: false`: left out of
 *  the `/` menu, still opened by the agent (CORE-FR-174). */
export interface ClaudeSkillHeaders {
  readonly name: string;
  readonly description: string;
  readonly "user-invocable"?: false;
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
export class ClaudeSkill extends DocumentBasedComponent<ClaudeSkillHeaders> {
  static readonly kind = "skill" as const;
  readonly kind = ClaudeSkill.kind;

  static of(name: string, declared: ClaudeSkillDeclared, body: string): ClaudeSkill {
    return new ClaudeSkill(name, `${CLAUDE_DIRECTORY}/skills/${name}/SKILL.md`, { name, ...declared }, body);
  }
}
