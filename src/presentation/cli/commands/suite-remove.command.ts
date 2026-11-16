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
import { formatHeading, formatMention, formatStatusLine, printFault } from "./helper.js";

const OPTIONS = {
  name: {
    type: "string",
    describe: `The test file's name under ${charterPath.testFolderPath}/: "untitled-1.json"`,
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

  async runCommand(
    { charterAuthoringApp }: Context,
    { name: testSuiteName }: Options<typeof OPTIONS>,
  ): Promise<Outcome> {
    const testSuiteNameDTO = await charterAuthoringApp.removeTestSuite(testSuiteName ?? "");
    if (testSuiteNameDTO.type === "Fault") return { exitCode: EXIT_FAILURE, problemText: printFault(testSuiteNameDTO) };
    return {
      exitCode: EXIT_OK,
      resultText: `${formatHeading(formatStatusLine("good", `Removed ${formatMention(`${charterPath.testFolderPath}/${testSuiteNameDTO.data.name}`)}.`))}\n`,
    };
  }
}
