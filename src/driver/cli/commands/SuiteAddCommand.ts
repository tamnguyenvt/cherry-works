import { TEST_DIRECTORY } from "#hexagon/port/driver/ForManagingCharter.js";
import { EXIT_OK, type Command, type Context, type Outcome } from "./Command.js";

/**
 * `cw suite add`: a new test file under `.cw/test/`, named so no other test file
 * has its name, holding one sample case that reads (FR-091).
 */
export class SuiteAddCommand implements Command {
  readonly name = "suite add";
  readonly summary = `Write a new test file under ${TEST_DIRECTORY}/, holding one sample case`;

  async run({ testAuthoringApp }: Context): Promise<Outcome> {
    const name = await testAuthoringApp.addSuite();
    return {
      code: EXIT_OK,
      result: [`Wrote ${TEST_DIRECTORY}/${name}.`, `Run "cw suite edit ${name}" to write its cases, then "cw test".`, ""].join("\n"),
    };
  }
}
