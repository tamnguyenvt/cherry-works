import { charterPath } from "#module/charter/module.js";
import { type Command, type Context, EXIT_OK, type Outcome } from "./command.interface.js";
import { formatHeading, formatMention, formatStatusLine, reportFault } from "./helper.js";

/**
 * `cw suite add`: a new test file under `.cw/charter/test/`, named so no other test file
 * has its name, holding one sample case that reads (FR-091).
 */
export class SuiteAddCommand implements Command {
  readonly name = "suite add";
  readonly summary = `Write a new test file under ${charterPath.testFolderPath}/, holding one sample case`;

  async runCommand({ charterAuthoringApp }: Context): Promise<Outcome> {
    const testSuiteNameDTO = await charterAuthoringApp.addTestSuite();
    if (testSuiteNameDTO.type === "Fault") return reportFault(testSuiteNameDTO);
    const { name: testSuiteName } = testSuiteNameDTO.data;
    return {
      exitCode: EXIT_OK,
      resultText: [
        formatHeading(
          formatStatusLine("good", `Wrote ${formatMention(`${charterPath.testFolderPath}/${testSuiteName}`)}.`),
        ),
        `Run "cw suite edit ${testSuiteName}" to write its cases, then "cw test".`,
        "",
      ].join("\n"),
      answerDTO: testSuiteNameDTO,
    };
  }
}
