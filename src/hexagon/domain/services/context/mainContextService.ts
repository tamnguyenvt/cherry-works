import type { AgentProvider } from "../../models/AgentProvider.js";
import type { CharterRoot } from "../../models/charter/CharterRoot.js";
import type { MainContextText } from "../../models/context/MainContext.js";
import { CLAUDE_TOKEN_FACTOR, claudeMainContextOf } from "./claudeMainContextFactory.js";

/** What one agent puts into its main context of this charter, as the text it
 *  is sent (EVAL-FR-001). One arm per host, as `providerComponentsOf` has: a
 *  second host is a case here and a factory beside this one. */
export function mainContextTextsOf(charter: CharterRoot, agent: AgentProvider): readonly MainContextText[] {
  switch (agent) {
    case "claude":
      return claudeMainContextOf(charter);
  }
}

/** How many of one agent's tokens one token of the tokenizer on this machine
 *  stands for: what an estimate is scaled by (EVAL-SC-002). */
export function tokenFactorOf(agent: AgentProvider): number {
  switch (agent) {
    case "claude":
      return CLAUDE_TOKEN_FACTOR;
  }
}
