import type { DataDTOs } from "./dtos/index.js";

/** What a driver says beside the DTOs: where the cases live. */
export { EVAL_DIRECTORY } from "../../domain/path.js";

/**
 * DRIVER PORT — the charter evaluated against the real agent (EVAL-FR-020 –
 * EVAL-FR-026).
 *
 * Apart from `ForManagingCharter` because it is a different conversation: it
 * spends the developer's sign-in on a real model, where everything there runs
 * offline, and it is never part of the self-regression tests (CORE-FR-084).
 */
export interface ForEvaluatingCharter {
  /**
   * Every case under `.cw/eval/` as last committed, each handed once to
   * promptfoo, which puts it to the agent, run headless in a worktree of the
   * last commit under `.cw/eval/.worktrees/` with its charter built, and
   * grades it; and how each came out — passed or not, why not, and the tokens
   * it used — and the tokens of them all (EVAL-FR-020). promptfoo is installed
   * first where it is not on the machine yet, saying so (EVAL-FR-032). Every worktree is removed, the
   * ones a run stopped halfway left among them, and the working tree is left
   * as it was (EVAL-FR-021).
   *
   * A charter with an error, an evaluation file that does not read, and a case
   * naming a skill or a guide the charter does not hold are given back as
   * faults under their files, with no case run; the agent's command line not
   * installed is raised, with no case run either (EVAL-FR-026). None written
   * is a report of no case.
   */
  evaluate(): Promise<DataDTOs.EvalRunReport | DataDTOs.FaultsByFile>;
}
