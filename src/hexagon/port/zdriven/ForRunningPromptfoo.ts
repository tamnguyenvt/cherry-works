/** What an adapter answering this port raises when promptfoo cannot be
 *  installed or stops with an error, named again here so it names this port and
 *  nothing behind it. */
export { DrivenFault } from "./DrivenFault.js";

/**
 * DRIVEN PORT — promptfoo, the evaluation framework a charter is evaluated
 * under (EVAL-FR-020, EVAL-FR-032): installed once onto this machine, then
 * handed one test at a time, which it runs against Claude Code in the folder
 * named and grades by the assertions it carries.
 */
export interface ForRunningPromptfoo {
  /** Is promptfoo, and what it needs to run Claude Code, on this machine? */
  isInstalled(): Promise<boolean>;

  /** Install it once into a folder of its own, outside every repository. */
  install(): Promise<void>;

  /** Where it is installed, as the developer would find it. */
  readonly installFolderPath: string;

  /** One test run with `promptfoo eval`: its prompt put to Claude Code,
   *  headless, in the working folder, with the project's settings and skills
   *  and edits accepted, on whatever it is signed in with; and how it came
   *  out. A run promptfoo itself fails raises a `DrivenFault`. */
  evaluate(promptfooTest: PromptfooTest): Promise<PromptfooTestResult>;
}

/** One promptfoo test, in promptfoo's own words. */
export interface PromptfooTest {
  readonly description: string;
  readonly prompt: string;
  /** The folder Claude Code runs in. */
  readonly workingFolder: URL;
  readonly assertions: readonly PromptfooAssertion[];
}

/** One promptfoo assertion: a skill the agent invoked, a rubric an agent
 *  grader holds what the agent did to, reading the working folder itself, or
 *  a JavaScript check of the response. */
export interface PromptfooAssertion {
  readonly type: "skill-used" | "agent-rubric" | "javascript";
  readonly value: string;
}

/** How one test came out, as promptfoo writes it: whether it passed, the
 *  tokens the provider reported in all, each assertion's grading, and the
 *  error where the provider could not run. */
export interface PromptfooTestResult {
  readonly success: boolean;
  readonly totalTokens: number;
  readonly componentResults: readonly { readonly assertionType: string; readonly pass: boolean; readonly reason: string }[];
  readonly error?: string;
}
