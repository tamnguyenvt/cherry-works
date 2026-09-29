import { DomainFault, TEST_DIRECTORY } from "#hexagon/port/driver/ForManagingCharter.js";
import { editInEditor } from "./helper.js";
import { EXIT_FAILURE, EXIT_OK, type Command, type Context, type OptionSpec, type Options, type Outcome } from "./Command.js";

const OPTIONS = {
  name: {
    type: "string",
    describe: `The test file's name under ${TEST_DIRECTORY}/: "untitled-1.json"`,
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

  async run({ cwd, testAuthoringApp }: Context, { name }: Options<typeof OPTIONS>): Promise<Outcome> {
    const { testSuites } = (await testAuthoringApp.suites()).data;
    if (!testSuites.some((one) => one.data.name === name))
      throw new DomainFault(`${TEST_DIRECTORY}/ holds no test file called "${name ?? ""}".`, 'Run "cw suite add" to write a new one.');

    const file = `${TEST_DIRECTORY}/${name}`;
    const problem = await editInEditor(cwd, file);
    if (problem !== undefined) return { code: EXIT_FAILURE, problem };

    return { code: EXIT_OK, result: [`Closed ${file}.`, 'Run "cw test" to see how its cases come out.', ""].join("\n") };
  }
}
