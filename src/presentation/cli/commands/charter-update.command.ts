import {
  type Command,
  type Context,
  EXIT_OK,
  type OptionSpec,
  type Options,
  type Outcome,
} from "./command.interface.js";
import { formatHeading, formatMention, formatStatusLine, layAnswerRows, reportFault } from "./helper.js";

const OPTIONS = {
  charter: {
    type: "string",
    describe: "The installed charter to pull again, by the name it is held under",
  },
  all: {
    type: "boolean",
    default: false,
    describe: "Pull every installed charter again",
  },
} as const satisfies OptionSpec;

/**
 * `cw charter update`: the installed charter `--charter` names, or every one
 * with `--all`, pulled again from the source its `cw-package.json` names, at
 * the newest version (VENDOR-FR-030). Neither flag, or both, is refused by
 * the engine, nothing written.
 */
export class CharterUpdateCommand implements Command<typeof OPTIONS> {
  readonly name = "charter update";
  readonly summary = "Pull installed charters again from their source, at the newest version";
  readonly options = OPTIONS;

  async runCommand(
    { charterAuthoringApp }: Context,
    { charter: charterName, all: isAll }: Options<typeof OPTIONS>,
  ): Promise<Outcome> {
    const charterPullOutcomeDTO = await charterAuthoringApp.updateCharters(charterName ?? "", isAll);
    if (charterPullOutcomeDTO.type === "Fault") return reportFault(charterPullOutcomeDTO);
    if (charterPullOutcomeDTO.data.length === 0)
      return {
        exitCode: EXIT_OK,
        resultText: "No charter is installed: nothing to update.\n",
        answerDTO: charterPullOutcomeDTO,
      };
    return {
      exitCode: EXIT_OK,
      resultText: [
        ...charterPullOutcomeDTO.data.flatMap(({ folder: folderPath, primitives }) => [
          formatHeading(formatStatusLine("good", `Updated ${formatMention(folderPath)}.`)),
          ...layAnswerRows(primitives.map(({ data: { kind, id } }) => [kind, formatMention(id)])),
        ]),
        'Run "cw build" to compile what it changes in this charter.',
        "",
      ].join("\n"),
      answerDTO: charterPullOutcomeDTO,
    };
  }
}
