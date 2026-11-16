import { charterPath } from "#module/charter/module.js";
import { type Command, type Context, EXIT_FAILURE, EXIT_OK, type Options, type Outcome } from "./command.interface.js";
import { formatStatusLine, layAnswerRows, printFault, printFaultsByFile, printProblem } from "./helper.js";

/**
 * `cw test`: put every situation this repository wrote down to its charter, and
 * say how each one came out (FR-048, FR-050).
 *
 * One line per case, pass or fail, and under a failing one why the charter did
 * not answer it — so an author reads which situation broke and what it was
 * supposed to do, rather than that something broke.
 *
 * Nothing is run, nothing is fetched and no agent is asked (FR-049). A case is
 * resolved, which is why the exit status is worth gating a pipeline on: the same
 * charter and the same cases answer the same way on every machine (FR-050).
 *
 * A repository that wrote no tests is told so and passes: writing none is not a
 * failure, and being told is how an author finds out the file is not there.
 */
export class TestCommand implements Command {
  readonly name = "test";
  readonly summary = `Resolve every situation in ${charterPath.testFolderPath}/ against the charter`;

  async runCommand({ charterAuthoringApp }: Context, _options: Options): Promise<Outcome> {
    const testRunReportDTO = await charterAuthoringApp.testCharter();
    if (testRunReportDTO.type === "Fault") return { exitCode: EXIT_FAILURE, problemText: printFault(testRunReportDTO) };

    // Either the charter does not hold or the tests do not read; either way
    // nothing was resolved, and what has to change is named under its own path
    // (SC-003).
    if (testRunReportDTO.type === "FaultsByFile")
      return {
        exitCode: EXIT_FAILURE,
        problemText: `${printProblem("Nothing was resolved.")}\n${printFaultsByFile(testRunReportDTO)}`,
      };

    const testCaseReports = testRunReportDTO.data.testCaseReports;

    if (testCaseReports.length === 0) {
      return {
        exitCode: EXIT_OK,
        resultText: `No tests: ${charterPath.testFolderPath}/ holds no case.\nWrite one as ${charterPath.testFolderPath}/<name>.json to pin a situation down.\n`,
      };
    }

    const failedTestCaseReports = testCaseReports.filter((testCaseReport) => !testCaseReport.data.passed);

    return {
      exitCode: failedTestCaseReports.length === 0 ? EXIT_OK : EXIT_FAILURE,
      resultText: [
        // One case: the situation it put, whether the charter answered it as
        // expected, and under a failing one why it did not (FR-048). A case is
        // named by what it puts rather than by a title its author also had to
        // write, so a failing line already says what broke.
        ...layAnswerRows(
          testCaseReports.map(({ data: { passed: hasPassed, situation, unmet: unmetFault } }) => [
            hasPassed ? formatStatusLine("good", "pass") : formatStatusLine("fault", "FAIL"),
            [situation, ...(unmetFault === undefined ? [] : [unmetFault.data.message, unmetFault.data.fix])],
          ]),
        ),
        "",
        failedTestCaseReports.length === 0
          ? formatStatusLine("good", `${testCaseReports.length} case${testCaseReports.length === 1 ? "" : "s"} passed.`)
          : formatStatusLine(
              "fault",
              `${failedTestCaseReports.length} of ${testCaseReports.length} case${testCaseReports.length === 1 ? "" : "s"} failed.`,
            ),
        "",
      ].join("\n"),
    };
  }
}
