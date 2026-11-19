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
      "A charter the source holds, by its name; typed once per charter, and every charter it holds where none is named. What a charter names of another charter of the source comes with it",
  },
  as: {
    type: "string",
    describe: "The name the one charter named is held under here; its own where none is given",
  },
  fork: {
    type: "boolean",
    default: false,
    describe: "Copy the charters in as this repository's own, to edit, with no cw-package.json",
  },
} as const satisfies OptionSpec;

/**
 * `cw charter pull`: install charters this repository did not author, or
 * bring them up to date; with `--fork`, copy them in as its own (FR-023,
 * VENDOR-FR-017, VENDOR-FR-022).
 *
 * The source is passed on as it was typed. Which transport it names, whether
 * the sign-in to it is there, whether the version exists: git answers all of
 * that, and what git says is what the user reads — there is no second
 * opinion here to disagree with it (FR-031).
 *
 * With no `--charter`, every charter the source holds is pulled, authored
 * or installed there alike; `--charter` names charters, each pulled whole with every charter of the
 * source it names, beside a `cw-package.json` saying where it came from, or
 * none with `--fork` (VENDOR-FR-017 to VENDOR-FR-019, VENDOR-FR-022). `--as`
 * holds the one charter under another name (VENDOR-FR-020). Running it again
 * on a charter installed from the same source replaces it whole.
 *
 * What is pulled is left unstaged for the user to read and commit, whatever
 * else is in hand; and the build that compiles it is not run here: a charter is
 * read and compiled by `cw build`, which is the one command that writes what
 * an agent reads (FR-020).
 */
export class CharterPullCommand implements Command<typeof OPTIONS> {
  readonly name = "charter pull <source>";
  readonly summary = "Install charters from a git source, or bring an installed charter up to date";
  readonly options = OPTIONS;

  async runCommand(
    { charterAuthoringApp }: Context,
    { source, ref, charter: charterNames, as: asName, fork: isForked }: Options<typeof OPTIONS>,
  ): Promise<Outcome> {
    const charterPullOutcomeDTO = await charterAuthoringApp.pullCharters(
      source ?? "",
      isForked,
      ref,
      charterNames,
      asName,
    );
    if (charterPullOutcomeDTO.type === "Fault") return reportFault(charterPullOutcomeDTO);
    const charterInstalls = charterPullOutcomeDTO.data;

    return {
      exitCode: EXIT_OK,
      resultText: [
        ...charterInstalls.flatMap(({ folder: folderPath, primitives }) => [
          formatHeading(
            formatStatusLine(
              "good",
              `${isForked ? "Forked" : "Installed"} ${formatMention(source ?? "")} under ${formatMention(folderPath)}${ref === undefined ? "" : `, pinned to ${ref}`}.`,
            ),
          ),
          ...layAnswerRows(primitives.map(({ data: { kind, id } }) => [kind, formatMention(id)])),
        ]),
        'Run "cw build" to compile what it adds to this charter.',
        "",
      ].join("\n"),
      answerDTO: charterPullOutcomeDTO,
    };
  }
}
