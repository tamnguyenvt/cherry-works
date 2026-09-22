import { EXIT_OK, type Command, type Context, type Outcome } from "./Command.js";

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

  async run({ charterVendoringApp }: Context): Promise<Outcome> {
    const folders = await charterVendoringApp.installed();
    if (folders.length === 0)
      return { code: EXIT_OK, result: 'No vendor source is installed. Run "cw vendor add <source>" to install one.\n' };
    return { code: EXIT_OK, result: `${folders.join("\n")}\n` };
  }
}
