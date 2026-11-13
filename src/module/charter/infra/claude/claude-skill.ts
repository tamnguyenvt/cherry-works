import { DocumentBasedComponent } from "../../app/port/out/managing-local-agent-output.port.js";

/** A skill's frontmatter: the name its directory carries, the description
 *  this agent reads on every turn to decide whether to open the body, and,
 *  where it is no command of the user's, `user-invocable: false`: left out of
 *  the `/` menu, still opened by the agent (CORE-FR-174); and where the user
 *  alone starts it, `disable-model-invocation: true`: in the `/` menu, never
 *  opened by the agent by itself (CORE-FR-182). */
export interface ClaudeSkillHeaders {
  readonly name: string;
  readonly description: string;
  readonly "user-invocable"?: false;
  readonly "disable-model-invocation"?: true;
}

/** What a skill is compiled with, its name aside: that is what the component is
 *  called, and this agent reads it out of the frontmatter as well. */
export type ClaudeSkillDeclared = Omit<ClaudeSkillHeaders, "name">;

/**
 * A skill: a directory holding one `SKILL.md`, whose description claude
 * reads on every turn and whose body it opens only when that description
 * matches what is being asked.
 *
 * This is the agent's one mechanism for know-how that is loaded when the
 * request calls for it and not before, so more than one charter kind compiles
 * to it: a `skill`, and a `playbook` (FR-013).
 *
 * Whatever decides that the body is worth opening is written into the
 * description, because that line is all this agent reads before deciding.
 */
export class ClaudeSkill extends DocumentBasedComponent<ClaudeSkillHeaders> {
  static readonly kind = "skill" as const;
  readonly kind = ClaudeSkill.kind;
}
