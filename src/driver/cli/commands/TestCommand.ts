import { TEST_DIRECTORY } from "#hexagon/port/driver/ForManagingCharter.js";
import { printFaultsByFile } from "./helper.js";
import type { DataDTOs } from "#hexagon/port/driver/dtos/index.js";
import { EXIT_FAILURE, EXIT_OK, type Command, type Context, type Options, type Outcome } from "./Command.js";

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
  readonly summary = `Resolve every situation in ${TEST_DIRECTORY}/ against the charter`;

  async run({ charterAuthoringApp }: Context, _options: Options): Promise<Outcome> {
    const testRunReportDTO = await charterAuthoringApp.test();

    // Either the charter does not hold or the tests do not read; either way
    // nothing was resolved, and what has to change is named under its own path
    // (SC-003).
    if (testRunReportDTO.type === "FaultsByFile")
      return { code: EXIT_FAILURE, problem: `Nothing was resolved.\n\n${printFaultsByFile(testRunReportDTO)}` };

    const cases = testRunReportDTO.data.testCaseReports;

    if (cases.length === 0) {
      return {
        code: EXIT_OK,
        result: `No tests: ${TEST_DIRECTORY}/ holds no case.\nWrite one as ${TEST_DIRECTORY}/<name>.json to pin a situation down.\n`,
      };
    }

    const failed = cases.filter((one) => !one.data.passed);

    return {
      code: failed.length === 0 ? EXIT_OK : EXIT_FAILURE,
      result: [
        ...cases.flatMap(lines),
        "",
        failed.length === 0
          ? `${cases.length} case${cases.length === 1 ? "" : "s"} passed.`
          : `${failed.length} of ${cases.length} case${cases.length === 1 ? "" : "s"} failed.`,
        "",
      ].join("\n"),
    };
  }
}

/** One case: the situation it put, whether the charter answered it as expected,
 *  and under a failing one why it did not (FR-048). A case is named by what it
 *  puts rather than by a title its author also had to write, so a failing line
 *  already says what broke. */
function lines(one: DataDTOs.TestCaseReport): readonly string[] {
  return [
    `  ${one.data.passed ? "pass" : "FAIL"}  ${one.data.situation}`,
    ...(one.data.unmet === undefined ? [] : [`          ${one.data.unmet.data.message}`, `          ${one.data.unmet.data.fix}`]),
  ];
}
