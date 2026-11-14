import prompts from "prompts";
import { charterPath } from "#module/charter/module.js";
import {
  type Command,
  type Context,
  EXIT_FAILURE,
  EXIT_OK,
  type OptionSpec,
  type Options,
  type Outcome,
} from "./command.interface.js";
import { printFault, printFaultsByFile } from "./helper.js";

const OPTIONS = {
  agent: { type: "string", describe: "Evaluate with an agent the repository chose: claude or codex" },
} as const satisfies OptionSpec;

/**
 * `cw eval`: put every case in `.cw/charter/eval/` to the real agent under promptfoo,
 * and say how each came out and the tokens it used (EVAL-FR-020 –
 * EVAL-FR-026, EVAL-FR-032).
 *
 * One line per case, pass or fail, its tokens and its prompt, and under a
 * failing one every expectation it did not meet; then how many failed and the
 * tokens of them all. A case failing fails the run through its exit status
 * (EVAL-FR-025). Apart from `cw test`: this spends a sign-in, and that never does.
 */
export class EvalCommand implements Command<typeof OPTIONS> {
  readonly name = "eval";
  readonly summary = `Put every case in ${charterPath.evalFolderPath}/ to the real agent under promptfoo`;
  readonly options = OPTIONS;

  async runCommand(
    { charterRuntimeApp, workspaceSettings }: Context,
    { agent: namedAgentName }: Options<typeof OPTIONS>,
  ): Promise<Outcome> {
    let evaluationAgentName = namedAgentName;
    if (evaluationAgentName === undefined) {
      const chosenAgentNames = [...new Set(workspaceSettings.agents)];
      if (chosenAgentNames.length > 1 && process.stdin.isTTY) {
        const promptAnswer = await prompts({
          type: "select",
          name: "agent",
          message: "Which agent should evaluate this charter?",
          choices: chosenAgentNames.map((agentName) => ({ title: agentName, value: agentName })),
        });
        if (promptAnswer.agent === undefined)
          return { exitCode: EXIT_FAILURE, problemText: "Evaluation cancelled. No case was run.\n" };
        evaluationAgentName = promptAnswer.agent;
      }
    }
    const evalRunReportDTO = await charterRuntimeApp.evaluateCharter(evaluationAgentName);
    if (evalRunReportDTO.type === "Fault") return { exitCode: EXIT_FAILURE, problemText: printFault(evalRunReportDTO) };
    if (evalRunReportDTO.type === "FaultsByFile")
      return { exitCode: EXIT_FAILURE, problemText: `No case was run.\n\n${printFaultsByFile(evalRunReportDTO)}` };

    const { evalCaseReports, totalTokens } = evalRunReportDTO.data;
    if (evalCaseReports.length === 0)
      return {
        exitCode: EXIT_OK,
        resultText: `No evaluation: ${charterPath.evalFolderPath}/ holds no case.\nWrite one as ${charterPath.evalFolderPath}/<name>.json, and run "cw eval" again.\n`,
      };

    const failedCount = evalCaseReports.filter(({ data: { passed: hasPassed } }) => !hasPassed).length;
    const casesWord = `case${evalCaseReports.length === 1 ? "" : "s"}`;
    return {
      exitCode: failedCount === 0 ? EXIT_OK : EXIT_FAILURE,
      resultText: [
        `Agent: ${evalRunReportDTO.data.agent}`,
        ...evalCaseReports.flatMap(
          ({
            data: { passed: hasPassed, tokens: tokenCount, prompt, unmetReasons, logPath, sessionId, sessionPath },
          }) => [
            `  ${hasPassed ? "pass" : "FAIL"}  ${`${tokenCount.toLocaleString("en-US")} tokens`.padStart(14)}  ${prompt.split("\n")[0]}`,
            ...unmetReasons.map((unmetReason) => `          ${unmetReason}`),
            ...(logPath === undefined ? [] : [`          Log: ${logPath}`]),
            ...(sessionId === undefined ? [] : [`          Agent session: ${sessionId}`]),
            ...(sessionPath === undefined ? [] : [`          Session log: ${sessionPath}`]),
          ],
        ),
        "",
        `${failedCount === 0 ? `${evalCaseReports.length} ${casesWord} passed` : `${failedCount} of ${evalCaseReports.length} ${casesWord} failed`}, ${totalTokens.toLocaleString("en-US")} tokens in all.`,
        "",
      ].join("\n"),
    };
  }
}
