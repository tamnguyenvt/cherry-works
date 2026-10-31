import { AGENT_PROVIDERS, isAgentProvider, type AgentProvider } from "../models/AgentProvider.js";
import type { CharterRoot } from "../models/charter/CharterRoot.js";
import { EvalSuiteFault, FaultsByFile, DomainFault } from "../models/DomainFault.js";
import type { EvalRoot } from "../models/eval/EvalSuite.js";

/** How one evaluation case came out: the file it is in, its prompt, the tokens
 *  the agent used, and every expectation it did not meet, said (EVAL-FR-025). */
export class EvalCaseReport {
  constructor(
    readonly suiteName: string,
    readonly prompt: string,
    readonly tokens: number,
    readonly unmetReasons: readonly string[],
    readonly logPath?: string,
    readonly sessionId?: string,
    readonly sessionPath?: string,
  ) {}

  get passed(): boolean {
    return this.unmetReasons.length === 0;
  }
}

/** How every case came out, in the order their files and cases were read, and
 *  the tokens of them all (EVAL-FR-025). */
export class EvalRunReport {
  constructor(readonly evalCaseReports: readonly EvalCaseReport[], readonly agent: AgentProvider) {}

  get totalTokens(): number {
    return this.evalCaseReports.reduce((tokens, evalCaseReport) => tokens + evalCaseReport.tokens, 0);
  }
}

/**
 * Every case naming what the charter does not hold, under the file it is in
 * (EVAL-FR-026): a skill to invoke that is no skill or playbook — a playbook is
 * invoked the way a skill is — and a guide to follow that is no guide. Asked
 * before any case runs, so a run spends nothing on a case that cannot pass.
 */
export function validateEvalRoot(charter: CharterRoot, evalRoot: EvalRoot): FaultsByFile {
  const faultsByFiles: Record<string, readonly DomainFault[]> = {};
  for (const [path, evalSuite] of Object.entries(evalRoot.suitesByFile)) {
    const faults = evalSuite.cases.flatMap(({ expect: { invoke: skillId, follow: guideId } }) => {
      const skillPrimitive = skillId === undefined ? undefined : charter.primitiveById.get(skillId);
      const guidePrimitive = guideId === undefined ? undefined : charter.primitiveById.get(guideId);
      return [
        ...(skillId === undefined || skillPrimitive?.kind === "skill" || skillPrimitive?.kind === "playbook"
          ? []
          : [
              skillPrimitive === undefined
                ? new EvalSuiteFault(`This charter holds no skill or playbook called "${skillId}".`, `Author it, or correct the name. "cw list skill" says every skill this charter holds.`)
                : new EvalSuiteFault(`"${skillId}" is a ${skillPrimitive.kind}, and a case invokes a skill or a playbook.`, `Name a skill or a playbook under "invoke".`),
            ]),
        ...(guideId === undefined || guidePrimitive?.kind === "guide"
          ? []
          : [
              guidePrimitive === undefined
                ? new EvalSuiteFault(`This charter holds no guide called "${guideId}".`, `Author it, or correct the name. "cw list guide" says every guide this charter holds.`)
                : new EvalSuiteFault(`"${guideId}" is a ${guidePrimitive.kind}, and a case follows a guide.`, `Name a guide under "follow".`),
            ]),
      ];
    });
    if (faults.length > 0) faultsByFiles[path] = faults;
  }
  return new FaultsByFile(faultsByFiles);
}

/** Resolve a run's agent before any case can spend tokens. */
export function selectEvaluationAgent(configuredAgents: readonly AgentProvider[], requestedAgent?: string): AgentProvider {
  if (requestedAgent !== undefined && !isAgentProvider(requestedAgent))
    throw new DomainFault(`Unsupported evaluation agent "${requestedAgent}".`, `Choose one of: ${AGENT_PROVIDERS.join(", ")}.`);
  configuredAgents = [...new Set(configuredAgents)];
  if (configuredAgents.length === 0)
    throw new DomainFault("No evaluation agent is configured.", 'Run "cw init" and configure an agent.');
  if (requestedAgent !== undefined) {
    if (!configuredAgents.includes(requestedAgent as AgentProvider))
      throw new DomainFault(`Evaluation agent ${requestedAgent} is not configured.`, `Run "cw init" and add ${requestedAgent} to the settings.`);
    return requestedAgent as AgentProvider;
  }
  if (configuredAgents.length !== 1)
    throw new DomainFault("Several evaluation agents are configured and no agent was selected.", 'Run "cw eval --agent=<agent>" to select one.');
  return configuredAgents[0]!;
}
