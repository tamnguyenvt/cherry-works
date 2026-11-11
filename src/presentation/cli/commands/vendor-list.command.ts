import { type Command, type Context, EXIT_FAILURE, EXIT_OK, type Outcome } from "./command.interface.js";
import { printFault } from "./helper.js";

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

  async run({ charterAuthoringApp }: Context): Promise<Outcome> {
    const vendorFoldersDTO = await charterAuthoringApp.vendors();
    if (vendorFoldersDTO.type === "Fault") return { code: EXIT_FAILURE, problem: printFault(vendorFoldersDTO) };
    const { folders } = vendorFoldersDTO.data;
    if (folders.length === 0)
      return { code: EXIT_OK, result: 'No vendor source is installed. Run "cw vendor add <source>" to install one.\n' };
    return { code: EXIT_OK, result: `${folders.join("\n")}\n` };
  }
}
