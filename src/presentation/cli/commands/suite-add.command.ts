import { TEST_DIRECTORY } from "#module/charter/module.js";
import { EXIT_FAILURE, EXIT_OK, type Command, type Context, type Outcome } from "./command.interface.js";
import { printFault } from "./helper.js";

/**
 * `cw suite add`: a new test file under `.cw/charter/test/`, named so no other test file
 * has its name, holding one sample case that reads (FR-091).
 */
export class SuiteAddCommand implements Command {
  readonly name = "suite add";
  readonly summary = `Write a new test file under ${TEST_DIRECTORY}/, holding one sample case`;

  async run({ charterAuthoringApp }: Context): Promise<Outcome> {
    const testSuiteNameDTO = await charterAuthoringApp.addSuite();
    if (testSuiteNameDTO.type === "Fault") return { code: EXIT_FAILURE, problem: printFault(testSuiteNameDTO) };
    const { name } = testSuiteNameDTO.data;
    return {
      code: EXIT_OK,
      result: [`Wrote ${TEST_DIRECTORY}/${name}.`, `Run "cw suite edit ${name}" to write its cases, then "cw test".`, ""].join("\n"),
    };
  }
}
