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
    describe: 'The charter to delete, by the name "cw charter" gives it',
  },
  all: {
    type: "boolean",
    default: false,
    describe: "Delete every charter held",
  },
} as const satisfies OptionSpec;

/**
 * `cw charter remove`: the charter `--charter` names, or every charter with
 * `--all`, authored or installed, deleted whole, asking nothing
 * (VENDOR-FR-031). Neither flag, or both, is refused by the
 * engine, nothing written.
 *
 * What leaves is left gone in the working tree for the developer to read and
 * commit, as what is installed is left there.
 */
export class CharterRemoveCommand implements Command<typeof OPTIONS> {
  readonly name = "charter remove";
  readonly summary = "Delete a charter, authored or installed, or every one";
  readonly options = OPTIONS;

  async runCommand(
    { charterAuthoringApp }: Context,
    { charter: charterName, all: isAll }: Options<typeof OPTIONS>,
  ): Promise<Outcome> {
    const charterMetadataListDTO = await charterAuthoringApp.removeCharters(charterName ?? "", isAll, false);
    if (charterMetadataListDTO.type === "Fault") return reportFault(charterMetadataListDTO);
    if (charterMetadataListDTO.data.charters.length === 0)
      return {
        exitCode: EXIT_OK,
        resultText: "No charter is held: nothing to remove.\n",
        answerDTO: charterMetadataListDTO,
      };
    return {
      exitCode: EXIT_OK,
      resultText: [
        ...charterMetadataListDTO.data.charters.map(({ data: { folder: folderPath } }) =>
          formatHeading(formatStatusLine("good", `Removed ${formatMention(folderPath)}.`)),
        ),
        `Run "cw build" to build the charter root without ${charterMetadataListDTO.data.charters.length === 1 ? "it" : "them"}.`,
        "",
      ].join("\n"),
      answerDTO: charterMetadataListDTO,
    };
  }
}
