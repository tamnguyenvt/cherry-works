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
    chosenAgentNames: readonly string[],
    supportedAgentNames: readonly string[],
    namedAgentName?: string,
  ): string {
    if (namedAgentName !== undefined && !supportedAgentNames.includes(namedAgentName))
      throw new UnsupportedEvaluationAgentFault(
        `Unsupported evaluation agent "${namedAgentName}".`,
        `Name one of: ${supportedAgentNames.join(", ")}.`,
        { internal: false },
      );
    const evaluableAgentNames = supportedAgentNames.filter((supportedAgentName) =>
      chosenAgentNames.includes(supportedAgentName),
    );
    if (evaluableAgentNames.length === 0)
      throw new NoEvaluationAgentFault("No agent is chosen.", 'Run "cw init" to choose one.', {
        internal: false,
      });
    if (namedAgentName !== undefined) {
      if (!evaluableAgentNames.includes(namedAgentName))
        throw new UnchosenEvaluationAgentFault(
          `Agent ${namedAgentName} is not chosen.`,
          `Run "cw init" and choose ${namedAgentName}.`,
          { internal: false },
        );
      return namedAgentName;
    }
    if (evaluableAgentNames.length !== 1)
      throw new UnnamedEvaluationAgentFault(
        "Several agents are chosen and none is named.",
        'Run "cw eval --agent=<agent>" to name one.',
        { internal: false },
      );
    return evaluableAgentNames[0]!;
  }

  private constructor() {}
}
