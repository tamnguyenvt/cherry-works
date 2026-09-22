import { TEST_DIRECTORY } from "#hexagon/port/driver/ForManagingCharter.js";
import { EXIT_OK, type Command, type Context, type OptionSpec, type Options, type Outcome } from "./Command.js";

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

  async run({ testAuthoringApp }: Context, { name }: Options<typeof OPTIONS>): Promise<Outcome> {
    const removedName = await testAuthoringApp.removeSuite(name ?? "");
    return { code: EXIT_OK, result: `Removed ${TEST_DIRECTORY}/${removedName}.\n` };
  }
}
