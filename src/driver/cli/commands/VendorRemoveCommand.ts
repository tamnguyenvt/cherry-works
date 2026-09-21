import { EXIT_OK, type Command, type Context, type OptionSpec, type Options, type Outcome } from "./Command.js";

const OPTIONS = {
  name: {
    type: "string",
    describe: "The folder this charter was installed as, as it reads under .cw/vendor/",
  },
} as const satisfies OptionSpec;

/**
 * `cw vendor remove`: take an installed charter away (FR-030).
 *
 * Named by the folder rather than by the address it came from: the folder is
 * what a reader of this repository sees, and what the charter is read out of.
 *
 * What was installed as a commit leaves as one, so this repository's history
 * says when it arrived and when it went. A folder this repository has not got
 * is refused in git's own words.
 */
export class VendorRemoveCommand implements Command<typeof OPTIONS> {
  readonly name = "vendor remove <name>";
  readonly summary = "Take an installed charter away";
  readonly options = OPTIONS;

  async run({ charterVendoringApp }: Context, { name }: Options<typeof OPTIONS>): Promise<Outcome> {
    const folder = await charterVendoringApp.remove(name ?? "");

    return {
      code: EXIT_OK,
      result: [
        `Removed ${folder}.`,
        'Run "cw build" to compile this charter without it.',
        "",
      ].join("\n"),
    };
  }
}
