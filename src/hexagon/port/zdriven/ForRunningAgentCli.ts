/** What an adapter answering this port raises when the command line refuses,
 *  named again here so it names this port and nothing behind it. */
export { DrivenFault } from "./DrivenFault.js";

/**
 * DRIVEN PORT — an agent's own command line, run headless: one prompt asked,
 * and the model's answer to it out. One adapter per agent's command line;
 * the composition root hands each under the agent it runs (EVAL-FR-004).
 *
 * The prompt is run in a folder of its own holding nothing, so what the model
 * was sent is the command line's own and the prompt, and nothing of whichever
 * repository asked.
 */
export interface ForRunningAgentCli {
  /** Is the command line installed on this machine? */
  isInstalled(): Promise<boolean>;

  /** This prompt asked, and what the model answered: what it said, and the
   *  usage the command line reports of what it was sent. */
  ask(prompt: string): Promise<Answer>;
}

/** One prompt answered, as the command line reports it. */
export interface Answer {
  readonly resultText: string;
  readonly usage: PromptUsage;
}

/** The input side of one run's usage, as the command line reports it: tokens
 *  sent fresh, written to the cache, and read from it. */
export interface PromptUsage {
  readonly inputTokens: number;
  readonly cacheCreationInputTokens: number;
  readonly cacheReadInputTokens: number;
}
