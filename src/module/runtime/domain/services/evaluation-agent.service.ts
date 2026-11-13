import {
  NoEvaluationAgentFault,
  UnchosenEvaluationAgentFault,
  UnnamedEvaluationAgentFault,
  UnsupportedEvaluationAgentFault,
} from "../models/runtime.fault.js";

/** What an evaluation decides before it runs a case. */
export class EvaluationAgentService {
  /**
   * The agent an evaluation puts its cases to: the one named, which the
   * repository must have chosen, or the only one it chose. An agent this
   * engine does not support, none chosen, or several chosen with none named,
   * is refused before anything runs (EVAL-FR-033 – EVAL-FR-038).
   */
  static selectEvaluationAgent(
    chosenAgents: readonly string[],
    supportedAgents: readonly string[],
    requestedAgent?: string,
  ): string {
    if (requestedAgent !== undefined && !supportedAgents.includes(requestedAgent))
      throw new UnsupportedEvaluationAgentFault(
        `Unsupported evaluation agent "${requestedAgent}".`,
        `Choose one of: ${supportedAgents.join(", ")}.`,
        { internal: false },
      );
    const evaluableAgents = supportedAgents.filter((supportedAgent) => chosenAgents.includes(supportedAgent));
    if (evaluableAgents.length === 0)
      throw new NoEvaluationAgentFault("No agent is chosen.", 'Run "cw init" to choose one.', {
        internal: false,
      });
    if (requestedAgent !== undefined) {
      if (!evaluableAgents.includes(requestedAgent))
        throw new UnchosenEvaluationAgentFault(
          `Agent ${requestedAgent} is not chosen.`,
          `Run "cw init" and choose ${requestedAgent}.`,
          { internal: false },
        );
      return requestedAgent;
    }
    if (evaluableAgents.length !== 1)
      throw new UnnamedEvaluationAgentFault(
        "Several agents are chosen and none is named.",
        'Run "cw eval --agent=<agent>" to name one.',
        { internal: false },
      );
    return evaluableAgents[0]!;
  }

  private constructor() {}
}
