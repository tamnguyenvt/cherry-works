import { EXIT_OK, type Command, type Context, type OptionSpec, type Options, type Outcome } from "./Command.js";

const OPTIONS = {
  source: {
    type: "string",
    describe: "What git fetches the charter or the skills from: an address over any transport, or a path on disk",
  },
  ref: {
    type: "string",
    describe: "The tag, branch or commit to pin to; the source's own default where none is named",
  },
  skill: {
    type: "string",
    isArray: true,
    describe: "A skill to take from a skills repository, by its name; typed once per skill, and every skill it holds where none is named. Refused for a charter",
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
 * A charter is installed whole, and `--skill` is refused for it (CORE-FR-193).
 * A source holding no charter folder is a skills repository: each skill named
 * with `--skill`, or every one it holds, is converted into a skill of the
 * charter, asking nothing, and what each left out of its `SKILL.md` is said
 * (CORE-FR-184, CORE-FR-186, CORE-FR-188).
 *
 * What is installed is left unstaged, with the source's README beside it, for
 * the user to read and commit, whatever else is in hand; and the build that
 * compiles it is not run here: a charter is read and compiled by `cw build`,
 * which is the one command that writes what an agent reads (FR-020).
 */
export class VendorAddCommand implements Command<typeof OPTIONS> {
  readonly name = "vendor add <source>";
  readonly summary = "Install a charter or skills from a git source, or bring an installed one up to date";
  readonly options = OPTIONS;

  async run({ charterVendoringApp }: Context, { source, ref, skill }: Options<typeof OPTIONS>): Promise<Outcome> {
    const { folder, primitives } = (await charterVendoringApp.add(source ?? "", ref, skill)).data;

    return {
      code: EXIT_OK,
      result: [
        `Installed ${source} under ${folder}${ref === undefined ? "" : `, pinned to ${ref}`}.`,
        ...primitives.map(
          ({ data: { kind, id, leftOutHeaders } }) =>
            `  ${kind} ${id}${leftOutHeaders.length === 0 ? "" : `, leaving out ${leftOutHeaders.join(", ")}: the charter has no field for them`}`,
        ),
        'Run "cw build" to compile what it adds to this charter.',
        "",
      ].join("\n"),
    };
  }
}
