import { EXIT_OK, type Command, type Context, type OptionSpec, type Options, type Outcome } from "./Command.js";

const OPTIONS = {
  source: {
    type: "string",
    describe: "What git clones the charter from: an address over any transport, or a path on disk",
  },
  ref: {
    type: "string",
    describe: "The tag, branch or commit to pin to; the source's own default where none is named",
  },
} as const satisfies OptionSpec;

/**
 * `cw vendor add`: install a charter this repository did not author (FR-023,
 * FR-027).
 *
 * The source is passed on as it was typed. Which transport it names, whether
 * the credentials for it are there, whether the version exists: git answers all
 * of that, and what git says is what the user reads — there is no second
 * opinion here to disagree with it (FR-031).
 *
 * Running it again on a source already installed brings it up to date (FR-030),
 * so there is one thing to type rather than two to remember.
 *
 * What is installed is left unstaged, with the source's README beside it, for
 * the user to read and commit, whatever else is in hand; and the build that
 * compiles it is not run here: a charter is read and compiled by `cw build`,
 * which is the one command that writes what an agent reads (FR-020).
 */
export class VendorAddCommand implements Command<typeof OPTIONS> {
  readonly name = "vendor add <source>";
  readonly summary = "Install a charter from a git source, or bring an installed one up to date";
  readonly options = OPTIONS;

  async run({ charterVendoringApp }: Context, { source, ref }: Options<typeof OPTIONS>): Promise<Outcome> {
    const folder = await charterVendoringApp.add(source ?? "", ref);

    return {
      code: EXIT_OK,
      result: [
        `Installed ${source} under ${folder}${ref === undefined ? "" : `, pinned to ${ref}`}.`,
        'Run "cw build" to compile what it adds to this charter.',
        "",
      ].join("\n"),
    };
  }
}
