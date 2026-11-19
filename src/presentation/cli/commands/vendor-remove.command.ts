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
    describe: 'The charter installed, by the name "cw vendor list" gives it',
  },
} as const satisfies OptionSpec;

/**
 * `cw vendor remove`: take an installed charter away whole (VENDOR-FR-021).
 *
 * What leaves is left gone in the working tree for the developer to read and
 * commit, as what is installed is left there. A name no installed charter
 * answers to, one the repository authored among them, is refused.
 */
export class VendorRemoveCommand implements Command<typeof OPTIONS> {
  readonly name = "vendor remove <name>";
  readonly summary = "Take an installed charter away";
  readonly options = OPTIONS;

  async runCommand({ charterAuthoringApp }: Context, { name: vendorName }: Options<typeof OPTIONS>): Promise<Outcome> {
    const vendorFolderDTO = await charterAuthoringApp.removeVendor(vendorName ?? "");
    if (vendorFolderDTO.type === "Fault") return reportFault(vendorFolderDTO);
    const { folder: folderPath } = vendorFolderDTO.data;

    return {
      exitCode: EXIT_OK,
      resultText: [
        formatHeading(formatStatusLine("good", `Removed ${formatMention(folderPath)}.`)),
        'Run "cw build" to compile this charter without it.',
        "",
      ].join("\n"),
      answerDTO: vendorFolderDTO,
    };
  }
}
