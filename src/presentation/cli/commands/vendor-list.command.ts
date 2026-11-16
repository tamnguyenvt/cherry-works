import { type Command, type Context, EXIT_OK, type Outcome } from "./command.interface.js";
import { formatHeading, formatMention, reportFault } from "./helper.js";

/**
 * `cw vendor list`: every folder a charter was installed as, one per line
 * (FR-053, FR-122).
 *
 * The folder is what there is to say. Where it came from is what its
 * installer typed, and nothing keeps that: `cw vendor add` is run with the
 * source again to bring one up to date.
 */
export class VendorListCommand implements Command {
  readonly name = "vendor list";
  readonly summary = "List the folders this repository installed charters as";

  async runCommand({ charterAuthoringApp }: Context): Promise<Outcome> {
    const vendorFoldersDTO = await charterAuthoringApp.listVendors();
    if (vendorFoldersDTO.type === "Fault") return reportFault(vendorFoldersDTO);
    const { folders: vendorFolderPaths } = vendorFoldersDTO.data;
    if (vendorFolderPaths.length === 0)
      return {
        exitCode: EXIT_OK,
        resultText: 'No vendor source is installed. Run "cw vendor add <source>" to install one.\n',
        answerDTO: vendorFoldersDTO,
      };
    return {
      exitCode: EXIT_OK,
      resultText: [
        formatHeading("Vendors"),
        ...vendorFolderPaths.map((folderPath) => `  ${formatMention(folderPath)}`),
        "",
      ].join("\n"),
      answerDTO: vendorFoldersDTO,
    };
  }
}
