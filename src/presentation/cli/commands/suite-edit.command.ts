import { charterPath } from "#module/charter/module.js";
import {
  type Command,
  type Context,
  EXIT_OK,
  type OptionSpec,
  type Options,
  type Outcome,
} from "./command.interface.js";
import { editInEditor, formatHeading, formatMention, formatStatusLine, reportFault } from "./helper.js";

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
 * `cw suite edit`: the author's own editor on one test file (FR-090, FR-109;
 * plan §13), as `cw edit` opens a primitive's.
 *
 * It writes nothing: whoever saves in the editor wrote the file, and `cw test`
 * is what says whether it still reads. A name the engine lists no test file
 * under in the charter, or a charter it cannot take, is refused before any editor
 * is opened (VENDOR-FR-009).
 */
export class SuiteEditCommand implements Command<typeof OPTIONS> {
  readonly name = "suite edit <name>";
  readonly summary = "Open one test file in your editor";
  readonly options = OPTIONS;

  async runCommand(
    { cwd, charterAuthoringApp, isJsonAnswer }: Context,
    { name: testSuiteName, charter: charterName }: Options<typeof OPTIONS>,
  ): Promise<Outcome> {
    const testSuiteDTO = await charterAuthoringApp.openTestSuite(charterName ?? "", testSuiteName ?? "");
    if (testSuiteDTO.type === "Fault") return reportFault(testSuiteDTO);

    const filePath = `${charterPath.charterFolderPath}/${testSuiteDTO.data.charterName}/${charterPath.testFolderName}/${testSuiteDTO.data.name}`;
    const editorOutcome = await editInEditor(cwd, filePath, isJsonAnswer);
    if (editorOutcome !== undefined) return editorOutcome;

    return {
      exitCode: EXIT_OK,
      resultText: [
        formatHeading(formatStatusLine("good", `Closed ${formatMention(filePath)}.`)),
        'Run "cw test" to see how its cases come out.',
        "",
      ].join("\n"),
      answerDTO: testSuiteDTO,
    };
  }
}
