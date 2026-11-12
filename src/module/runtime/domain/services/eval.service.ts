import {
  NoEvaluationAgentFault,
  UnconfiguredEvaluationAgentFault,
  UnselectedEvaluationAgentFault,
  UnsupportedEvaluationAgentFault,
} from "../models/runtime.fault.js";

/** What an evaluation decides before it runs a case. */
export class EvalService {
  /**
   * The agent an evaluation puts its cases to: the one asked for, which the
   * repository must compile for, or the only one it compiles for. An agent
   * this engine does not compile for, none configured, or several with none
   * asked for, is refused before anything runs (EVAL-FR-020).
   */
  static selectEvaluationAgent(
    configuredAgents: readonly string[],
    supportedAgents: readonly string[],
    requestedAgent?: string,
  ): string {
    if (requestedAgent !== undefined && !supportedAgents.includes(requestedAgent))
      throw new UnsupportedEvaluationAgentFault(
        `Unsupported evaluation agent "${requestedAgent}".`,
        `Choose one of: ${supportedAgents.join(", ")}.`,
        { internal: false },
      );
    const evaluableAgents = supportedAgents.filter((supportedAgent) => configuredAgents.includes(supportedAgent));
    if (evaluableAgents.length === 0)
      throw new NoEvaluationAgentFault("No evaluation agent is configured.", 'Run "cw init" and configure an agent.', {
        internal: false,
      });
    if (requestedAgent !== undefined) {
      if (!evaluableAgents.includes(requestedAgent))
        throw new UnconfiguredEvaluationAgentFault(
          `Evaluation agent ${requestedAgent} is not configured.`,
          `Run "cw init" and add ${requestedAgent} to the settings.`,
          { internal: false },
        );
      return requestedAgent;
    }
    if (evaluableAgents.length !== 1)
      throw new UnselectedEvaluationAgentFault(
        "Several evaluation agents are configured and no agent was selected.",
        'Run "cw eval --agent=<agent>" to select one.',
        { internal: false },
      );
    return evaluableAgents[0]!;
  }
}
