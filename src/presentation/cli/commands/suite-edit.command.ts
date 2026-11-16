import { charterPath } from "#module/charter/module.js";
import {
  type Command,
  type Context,
  EXIT_OK,
  type OptionSpec,
  type Options,
  type Outcome,
} from "./command.interface.js";
import { editInEditor, formatHeading, formatMention, formatStatusLine, refuseCommand, reportFault } from "./helper.js";

const OPTIONS = {
  name: {
    type: "string",
    describe: `The test file's name under ${charterPath.testFolderPath}/: "untitled-1.json"`,
  },
} as const satisfies OptionSpec;

/**
 * `cw suite edit`: the author's own editor on one test file (FR-090, FR-109;
 * plan §13), as `cw edit` opens a primitive's.
 *
 * It writes nothing: whoever saves in the editor wrote the file, and `cw test`
 * is what says whether it still reads. A name the engine lists no test file
 * under is refused before any editor is opened.
 */
export class SuiteEditCommand implements Command<typeof OPTIONS> {
  readonly name = "suite edit <name>";
  readonly summary = "Open one test file in your editor";
  readonly options = OPTIONS;

  async runCommand(
    { cwd, charterAuthoringApp, isJsonAnswer }: Context,
    { name: testSuiteName }: Options<typeof OPTIONS>,
  ): Promise<Outcome> {
    const testSuitesDTO = await charterAuthoringApp.listTestSuites();
    if (testSuitesDTO.type === "Fault") return reportFault(testSuitesDTO);
    // The one test file opened is what is answered of the list the use case
    // answered, each entry of it a DTO of its own: what was opened, as the
    // spec gate chose (CORE-FR-241).
    const testSuiteDTO = testSuitesDTO.data.testSuites.find((testSuite) => testSuite.data.name === testSuiteName);
    if (testSuiteDTO === undefined)
      return reportFault(
        refuseCommand(
          "UnknownTestSuiteFault",
          `${charterPath.testFolderPath}/ holds no test file called "${testSuiteName ?? ""}".`,
          `Run "cw suite add" to write a new one.`,
        ),
      );

    const filePath = `${charterPath.testFolderPath}/${testSuiteName}`;
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
