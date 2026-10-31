/** What an adapter answering this port raises when promptfoo cannot be
 *  installed or stops with an error, named again here so it names this port and
 *  nothing behind it. */
export { AdapterFault } from "./AdapterFault.js";

/**
 * DRIVEN PORT — promptfoo, the evaluation framework a charter is evaluated
 * under (EVAL-FR-020, EVAL-FR-032): installed once onto this machine, then
 * handed one test at a time, which it runs against the selected agent in the folder
 * named and grades by the assertions it carries.
 */
export interface ForRunningPromptfoo {
  /** Is promptfoo, and what it needs to run the supported agents, on this machine? */
  isInstalled(): Promise<boolean>;

  /** Install it once into a folder of its own, outside every repository. */
  install(): Promise<void>;

  /** Where it is installed, as the developer would find it. */
  readonly installFolderPath: string;

  /** One test run with `promptfoo eval`: its prompt put to the selected agent,
   *  headless, in the working folder, with the project's settings and skills
   *  and edits accepted, on whatever it is signed in with; and how it came
   *  out. A run promptfoo itself fails raises an `AdapterFault`. */
  evaluate(promptfooTest: PromptfooTest): Promise<PromptfooTestResult>;

  /** Read saved promptfoo artifacts without invoking an agent. With no path,
   * list the latest twenty case logs belonging to this repository. */
  readLogs(repositoryFolder: URL, logFilePath?: string): Promise<readonly PromptfooLog[]>;
}

/** One promptfoo test, in promptfoo's own words. */
export interface PromptfooTest {
  readonly agent: "claude" | "codex";
  readonly description: string;
  readonly prompt: string;
  /** The folder the selected agent runs in. */
  readonly workingFolder: URL;
  readonly assertions: readonly PromptfooAssertion[];
}

/** One promptfoo assertion: a skill the agent invoked, a rubric an agent
 *  grader holds what the agent did to, reading the working folder itself, or
 *  a JavaScript check of the response. */
export interface PromptfooAssertion {
  readonly type: "skill-used" | "agent-rubric" | "javascript" | "file-read";
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
  readonly logPath?: string;
  readonly sessionId?: string;
  readonly sessionPath?: string;
}

/** A saved case and its diagnostics, read without an inference call. */
export interface PromptfooLog {
  readonly logPath: string;
  readonly createdAt: string;
  readonly agent: "claude" | "codex";
  readonly prompt: string;
  readonly workingFolderPath: string;
  readonly outputPath: string;
  readonly stdoutPath: string;
  readonly stderrPath: string;
  readonly success: boolean;
  readonly totalTokens: number;
  readonly unmetReasons: readonly string[];
  readonly answer: string;
  readonly toolCalls: readonly string[];
  readonly sessionId?: string;
  readonly sessionPath?: string;
  readonly error?: string;
}
