import { TEST_FOLDER_PATH } from "#module/charter/module.js";
import { type Command, type Context, EXIT_FAILURE, EXIT_OK, type Outcome } from "./command.interface.js";
import { printFault } from "./helper.js";

/**
 * `cw suite add`: a new test file under `.cw/charter/test/`, named so no other test file
 * has its name, holding one sample case that reads (FR-091).
 */
export class SuiteAddCommand implements Command {
  readonly name = "suite add";
  readonly summary = `Write a new test file under ${TEST_FOLDER_PATH}/, holding one sample case`;

  async runCommand({ charterAuthoringApp }: Context): Promise<Outcome> {
    const testSuiteNameDTO = await charterAuthoringApp.addTestSuite();
    if (testSuiteNameDTO.type === "Fault") return { exitCode: EXIT_FAILURE, problemText: printFault(testSuiteNameDTO) };
    const { name } = testSuiteNameDTO.data;
    return {
      exitCode: EXIT_OK,
      resultText: [
        `Wrote ${TEST_FOLDER_PATH}/${name}.`,
        `Run "cw suite edit ${name}" to write its cases, then "cw test".`,
        "",
      ].join("\n"),
    };
  }
}
