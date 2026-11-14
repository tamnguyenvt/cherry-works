import {
  type Command,
  type Context,
  EXIT_FAILURE,
  EXIT_OK,
  type OptionSpec,
  type Options,
  type Outcome,
} from "./command.interface.js";
import { printFault } from "./helper.js";

const OPTIONS = {
  name: {
    type: "string",
    describe: "The folder this charter was installed as, as it reads under .cw/charter/vendor/",
  },
} as const satisfies OptionSpec;

/**
 * `cw vendor remove`: take an installed charter away (FR-030).
 *
 * Named by the folder rather than by the address it came from: the folder is
 * what a reader of this repository sees, and what the charter is read out of.
 *
 * What leaves is left gone in the working tree for the developer to read and
 * commit, as what is installed is left there. A name no vendor folder answers
 * to is refused (CORE-FR-204).
 */
export class VendorRemoveCommand implements Command<typeof OPTIONS> {
  readonly name = "vendor remove <name>";
  readonly summary = "Take an installed charter away";
  readonly options = OPTIONS;

  async runCommand({ charterAuthoringApp }: Context, { name: vendorName }: Options<typeof OPTIONS>): Promise<Outcome> {
    const vendorFolderDTO = await charterAuthoringApp.removeVendor(vendorName ?? "");
    if (vendorFolderDTO.type === "Fault") return { exitCode: EXIT_FAILURE, problemText: printFault(vendorFolderDTO) };
    const { folder: folderPath } = vendorFolderDTO.data;

    return {
      exitCode: EXIT_OK,
      resultText: [`Removed ${folderPath}.`, 'Run "cw build" to compile this charter without it.', ""].join("\n"),
    };
  }
}
