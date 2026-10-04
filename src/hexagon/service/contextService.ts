import type { AgentProvider } from "../domain/models/AgentProvider.js";
import type { CharterRoot } from "../domain/models/charter/CharterRoot.js";
import { MainContext } from "../domain/models/context/MainContext.js";
import { DomainFault } from "../domain/models/DomainFault.js";
import { mainContextTextsOf, tokenFactorOf } from "../domain/services/context/mainContextService.js";
import type { ForCountingTokens } from "../port/zdriven/ForCountingTokens.js";
import type { ForRunningAgentCli, PromptUsage } from "../port/zdriven/ForRunningAgentCli.js";

/** What one agent's main context of this charter comes to, counted by a
 *  tokenizer on this machine and scaled to that agent's: an estimate, with no
 *  key and no network (EVAL-FR-001, EVAL-FR-002, EVAL-SC-001, EVAL-SC-002). */
export function estimatedMainContextOf(charter: CharterRoot, agent: AgentProvider, tokenCounter: ForCountingTokens): MainContext {
  return new MainContext(
    agent,
    mainContextTextsOf(charter, agent).map(({ text, ...mainContextText }) => ({ ...mainContextText, tokens: Math.round(tokenCounter.countTokens(text) * tokenFactorOf(agent)) })),
    false,
  );
}

/**
 * The same, counted exactly by the agent's own command line (EVAL-FR-004).
 *
 * Every text is run as a prompt, and so is a prompt of next to nothing; what
 * the model was sent for the text past what it was sent for that is the text's
 * count, the command line's own instructions taken away. Refused before
 * anything runs where the command line is not installed.
 */
export async function exactMainContextOf(charter: CharterRoot, agent: AgentProvider, agentCli: ForRunningAgentCli): Promise<MainContext> {
  if (!(await agentCli.isInstalled()))
    throw new DomainFault(
      `Counting exactly runs ${agent}'s own command line, and it is not installed here.`,
      'Run "cw context" without --exact: the estimate needs nothing.',
    );

  const sentTokensOf = ({ inputTokens, cacheCreationInputTokens, cacheReadInputTokens }: PromptUsage) =>
    inputTokens + cacheCreationInputTokens + cacheReadInputTokens;
  const ownTokens = sentTokensOf(await agentCli.promptUsage("."));
  const mainContextTexts = mainContextTextsOf(charter, agent);
  const sentTokenCounts = await Promise.all(mainContextTexts.map(async ({ text }) => sentTokensOf(await agentCli.promptUsage(text))));
  return new MainContext(
    agent,
    mainContextTexts.map(({ text: _text, ...mainContextText }, index) => ({ ...mainContextText, tokens: Math.max(0, sentTokenCounts[index]! - ownTokens) })),
    true,
  );
}
