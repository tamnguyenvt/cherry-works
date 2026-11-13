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
import { editInEditor, printFault } from "./helper.js";

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

  async runCommand({ cwd, charterAuthoringApp }: Context, { name }: Options<typeof OPTIONS>): Promise<Outcome> {
    const testSuitesDTO = await charterAuthoringApp.listTestSuites();
    if (testSuitesDTO.type === "Fault") return { exitCode: EXIT_FAILURE, problemText: printFault(testSuitesDTO) };
    if (!testSuitesDTO.data.testSuites.some((testSuite) => testSuite.data.name === name))
      return {
        exitCode: EXIT_FAILURE,
        problemText: `${charterPath.testFolderPath}/ holds no test file called "${name ?? ""}".\n  Run "cw suite add" to write a new one.\n`,
      };

    const filePath = `${charterPath.testFolderPath}/${name}`;
    const editorProblem = await editInEditor(cwd, filePath);
    if (editorProblem !== undefined) return { exitCode: EXIT_FAILURE, problemText: editorProblem };

    return {
      exitCode: EXIT_OK,
      resultText: [`Closed ${filePath}.`, 'Run "cw test" to see how its cases come out.', ""].join("\n"),
    };
  }
}
