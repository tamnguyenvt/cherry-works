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
    describe: "The new charter's name, written as an id is",
  },
} as const satisfies OptionSpec;

/** `cw charter create`: an empty charter, the repository's own, ready for
 *  `cw add --charter=<name>`; a name held, or one no charter may take, is
 *  refused by the engine (VENDOR-FR-029). */
export class CharterCreateCommand implements Command<typeof OPTIONS> {
  readonly name = "charter create <name>";
  readonly summary = "Make an empty charter of this repository's own";
  readonly options = OPTIONS;

  async runCommand({ charterAuthoringApp }: Context, { name: charterName }: Options<typeof OPTIONS>): Promise<Outcome> {
    const charterMetadataDTO = await charterAuthoringApp.addCharter(charterName ?? "");
    if (charterMetadataDTO.type === "Fault") return reportFault(charterMetadataDTO);
    return {
      exitCode: EXIT_OK,
      resultText: [
        formatHeading(formatStatusLine("good", `Created ${formatMention(charterMetadataDTO.data.folder)}.`)),
        `Run "cw add <kind> <id> --charter=${charterMetadataDTO.data.name}" to write a primitive into it.`,
        "",
      ].join("\n"),
      answerDTO: charterMetadataDTO,
    };
  }
}
