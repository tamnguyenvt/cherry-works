import type { Answer, ForRunningAgentCli } from "#hexagon/port/zdriven/ForRunningAgentCli.js";

/** What every run sends the model besides the prompt, here: the command line's
 *  own instructions and tools, the same on every run. */
export const AGENT_CLI_OWN_TOKENS = 5_000;

/**
 * An agent's command line held in memory: installed or not, as a test says,
 * and sending the model two tokens per word of a prompt on top of its own — so a test reads an exact count apart from the
 * estimate of the same text. Every prompt it was given is kept, in order.
 */
export class InMemoryAgentCli implements ForRunningAgentCli {
  readonly prompts: string[] = [];

  constructor(private readonly installed: boolean = true) {}

  async isInstalled(): Promise<boolean> {
    return this.installed;
  }

  async ask(prompt: string): Promise<Answer> {
    this.prompts.push(prompt);
    const promptTokens = 2 * prompt.split(/\s+/).filter((word) => word !== "").length;
    return { resultText: "", usage: { inputTokens: promptTokens, cacheCreationInputTokens: 0, cacheReadInputTokens: AGENT_CLI_OWN_TOKENS } };
  }
}
