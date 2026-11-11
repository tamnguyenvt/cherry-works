import { TEST_DIRECTORY } from "#module/charter/module.js";
import {
  type Command,
  type Context,
  EXIT_FAILURE,
  EXIT_OK,
  type OptionSpec,
  type Options,
  type Outcome,
} from "./command.interface.js";
import { printFault } from "./helper.js";

const OPTIONS = {
  name: {
    type: "string",
    describe: `The test file's name under ${TEST_DIRECTORY}/: "untitled-1.json"`,
  },
} as const satisfies OptionSpec;

/**
 * `cw suite remove`: one test file taken away, and nothing else (FR-092).
 *
 * Asked about by nobody first: a test file is small and committed, and git
 * gives it back. A name that is no test file is refused by the engine.
 */
export class SuiteRemoveCommand implements Command<typeof OPTIONS> {
  readonly name = "suite remove <name>";
  readonly summary = "Delete one test file";
  readonly options = OPTIONS;

  async run({ charterAuthoringApp }: Context, { name }: Options<typeof OPTIONS>): Promise<Outcome> {
    const testSuiteNameDTO = await charterAuthoringApp.removeSuite(name ?? "");
    if (testSuiteNameDTO.type === "Fault") return { code: EXIT_FAILURE, problem: printFault(testSuiteNameDTO) };
    return { code: EXIT_OK, result: `Removed ${TEST_DIRECTORY}/${testSuiteNameDTO.data.name}.\n` };
  }
}
