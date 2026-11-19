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
  charter: {
    type: "string",
    describe: "The charter the test file is written into; the one charter the repository authored where none is named",
  },
} as const satisfies OptionSpec;

/**
 * `cw suite add`: a new test file under `.cw/charter/<charter>/test/`,
 * named so no other test file of the charter has its name, holding one sample
 * case that reads (FR-091, VENDOR-FR-009).
 */
export class SuiteAddCommand implements Command<typeof OPTIONS> {
  readonly name = "suite add";
  readonly summary =
    `Write a new test file under ${charterPath.charterFolderPath}/<charter>/${charterPath.testFolderName}/, holding one sample case`;
  readonly options = OPTIONS;

  async runCommand(
    { charterAuthoringApp }: Context,
    { charter: charterName }: Options<typeof OPTIONS>,
  ): Promise<Outcome> {
    const testSuiteNameDTO = await charterAuthoringApp.addTestSuite(charterName ?? "");
    if (testSuiteNameDTO.type === "Fault") return reportFault(testSuiteNameDTO);
    const { name: testSuiteName, charterName: writtenCharterName } = testSuiteNameDTO.data;
    return {
      exitCode: EXIT_OK,
      resultText: [
        formatHeading(
          formatStatusLine(
            "good",
            `Wrote ${formatMention(`${charterPath.charterFolderPath}/${writtenCharterName}/${charterPath.testFolderName}/${testSuiteName}`)}.`,
          ),
        ),
        `Run "cw suite edit ${testSuiteName} --charter=${writtenCharterName}" to write its cases, then "cw test".`,
        "",
      ].join("\n"),
      answerDTO: testSuiteNameDTO,
    };
  }
}
