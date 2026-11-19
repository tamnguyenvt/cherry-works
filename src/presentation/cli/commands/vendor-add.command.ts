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
  source: {
    type: "string",
    describe: "What git fetches the charters from: an address over any transport, or a path on disk",
  },
  ref: {
    type: "string",
    describe: "The tag, branch or commit to pin to; the source's own default where none is named",
  },
  charter: {
    type: "string",
    isArray: true,
    describe:
      "A charter the source authored, by its name; typed once per charter, and every charter it authored where none is named. What a charter names of another charter of the source comes with it",
  },
  as: {
    type: "string",
    describe: "The name the one charter named is held under here; its own where none is given",
  },
} as const satisfies OptionSpec;

/**
 * `cw vendor add`: install charters this repository did not author, or bring
 * them up to date (FR-023, VENDOR-FR-017).
 *
 * The source is passed on as it was typed. Which transport it names, whether
 * the credentials for it are there, whether the version exists: git answers all
 * of that, and what git says is what the user reads — there is no second
 * opinion here to disagree with it (FR-031).
 *
 * With no `--charter`, every charter the source authored is installed;
 * `--charter` names charters, each installed whole with every charter of the
 * source it names, beside a `cw-vendor.json` saying where it came from
 * (VENDOR-FR-017 to VENDOR-FR-019). `--as` holds the one charter under another
 * name (VENDOR-FR-020). Running it again on a charter installed from the same
 * source replaces it whole.
 *
 * What is installed is left unstaged for the user to read and commit, whatever
 * else is in hand; and the build that compiles it is not run here: a charter is
 * read and compiled by `cw build`, which is the one command that writes what
 * an agent reads (FR-020).
 */
export class VendorAddCommand implements Command<typeof OPTIONS> {
  readonly name = "vendor add <source>";
  readonly summary = "Install charters from a git source, or bring an installed charter up to date";
  readonly options = OPTIONS;

  async runCommand(
    { charterAuthoringApp }: Context,
    { source, ref, charter: charterNames, as: asName }: Options<typeof OPTIONS>,
  ): Promise<Outcome> {
    const vendorAddOutcomeDTO = await charterAuthoringApp.addVendor(source ?? "", ref, charterNames, asName);
    if (vendorAddOutcomeDTO.type === "Fault") return reportFault(vendorAddOutcomeDTO);
    const vendorInstalls = vendorAddOutcomeDTO.data;

    return {
      exitCode: EXIT_OK,
      resultText: [
        ...vendorInstalls.flatMap(({ folder: folderPath, primitives }) => [
          formatHeading(
            formatStatusLine(
              "good",
              `Installed ${formatMention(source ?? "")} under ${formatMention(folderPath)}${ref === undefined ? "" : `, pinned to ${ref}`}.`,
            ),
          ),
          ...layAnswerRows(primitives.map(({ data: { kind, id } }) => [kind, formatMention(id)])),
        ]),
        'Run "cw build" to compile what it adds to this charter.',
        "",
      ].join("\n"),
      answerDTO: vendorAddOutcomeDTO,
    };
  }
}
