import { charterPath } from "#module/charter/module.js";
import {
  type Command,
  type Context,
  EXIT_OK,
  type OptionSpec,
  type Options,
  type Outcome,
} from "./command.interface.js";
import { formatHeading, formatMention, formatStatusLine, reportFault } from "./helper.js";

const OPTIONS = {
  name: {
    type: "string",
    describe: `The test file's name under ${charterPath.charterFolderPath}/<charter>/${charterPath.testFolderName}/: "untitled-1.json"`,
  },
  charter: {
    type: "string",
    describe: "The charter the test file is kept in; the one charter the repository authored where none is named",
  },
} as const satisfies OptionSpec;

/**
 * `cw suite remove`: one test file taken away, and nothing else (FR-092).
 *
 * Asked about by nobody first: a test file is small and committed, and git
 * gives it back. A name that is no test file of the charter, or a charter it
 * cannot take, is refused by the engine (VENDOR-FR-009).
 */
export class SuiteRemoveCommand implements Command<typeof OPTIONS> {
  readonly name = "suite remove <name>";
  readonly summary = "Delete one test file";
  readonly options = OPTIONS;

  async runCommand(
    { charterAuthoringApp }: Context,
    { name: testSuiteName, charter: charterName }: Options<typeof OPTIONS>,
  ): Promise<Outcome> {
    const testSuiteNameDTO = await charterAuthoringApp.removeTestSuite(charterName ?? "", testSuiteName ?? "");
    if (testSuiteNameDTO.type === "Fault") return reportFault(testSuiteNameDTO);
    return {
      exitCode: EXIT_OK,
      resultText: `${formatHeading(formatStatusLine("good", `Removed ${formatMention(`${charterPath.charterFolderPath}/${testSuiteNameDTO.data.charterName}/${charterPath.testFolderName}/${testSuiteNameDTO.data.name}`)}.`))}\n`,
      answerDTO: testSuiteNameDTO,
    };
  }
}
