import { EVAL_DIRECTORY } from "#hexagon/port/driver/ForEvaluatingCharter.js";
import { toText } from "./helper.js";
import { EXIT_FAILURE, EXIT_OK, type Command, type Context, type Options, type Outcome } from "./Command.js";

/**
 * `cw eval`: put every case in `.cw/eval/` to the real agent under promptfoo,
 * and say how each came out and the tokens it used (EVAL-FR-020 –
 * EVAL-FR-026, EVAL-FR-032).
 *
 * One line per case, pass or fail, its tokens and its prompt, and under a
 * failing one every expectation it did not meet; then how many failed and the
 * tokens of them all. A case failing fails the run through its exit status
 * (EVAL-FR-025). Apart from `cw test`: this spends a sign-in, and that never does.
 */
export class EvalCommand implements Command {
  readonly name = "eval";
  readonly summary = `Put every case in ${EVAL_DIRECTORY}/ to the real agent under promptfoo`;

  async run({ charterEvaluatingApp }: Context, _options: Options): Promise<Outcome> {
    const evalRunReportDTO = await charterEvaluatingApp.evaluate();
    if (evalRunReportDTO.type === "FaultsByFile") return { code: EXIT_FAILURE, problem: `No case was run.\n\n${toText(evalRunReportDTO)}` };

    const { evalCaseReports, totalTokens } = evalRunReportDTO.data;
    if (evalCaseReports.length === 0)
      return {
        code: EXIT_OK,
        result: `No evaluation: ${EVAL_DIRECTORY}/ holds no case as last committed.\nWrite one as ${EVAL_DIRECTORY}/<name>.json and commit it: a run is of the last commit.\n`,
      };

    const failedCount = evalCaseReports.filter(({ data: { passed } }) => !passed).length;
    const casesWord = `case${evalCaseReports.length === 1 ? "" : "s"}`;
    return {
      code: failedCount === 0 ? EXIT_OK : EXIT_FAILURE,
      result: [
        ...evalCaseReports.flatMap(({ data: { passed, tokens, prompt, unmetReasons } }) => [
          `  ${passed ? "pass" : "FAIL"}  ${`${tokens.toLocaleString("en-US")} tokens`.padStart(14)}  ${prompt.split("\n")[0]}`,
          ...unmetReasons.map((unmetReason) => `          ${unmetReason}`),
        ]),
        "",
        `${failedCount === 0 ? `${evalCaseReports.length} ${casesWord} passed` : `${failedCount} of ${evalCaseReports.length} ${casesWord} failed`}, ${totalTokens.toLocaleString("en-US")} tokens in all.`,
        "",
      ].join("\n"),
    };
  }
}
