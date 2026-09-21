import type { DataDTOs } from "#hexagon/port/driver/dtos/index.js";
import {
  EXIT_FAILURE,
  EXIT_OK,
  type Command,
  type Context,
  type OptionSpec,
  type Options,
  type Outcome,
} from "./Command.js";

/** What `cw list` takes: which kind to narrow to, and how much of each
 *  primitive to say. Both are how the listing is read, never what is in it —
 *  the listing is the charter's own and this command only asks it for less. */
const LISTING = {
  kind: { type: "string", describe: "Only the primitives of this kind" },
  min: {
    type: "boolean",
    describe: "What an agent surveys by: identity and description, nothing else",
    default: false,
  },
} as const satisfies OptionSpec;

type Listing = typeof LISTING;

/**
 * `cw list`: say what the charter holds (FR-011, FR-012).
 *
 * It reaches for `list` and nothing else, and listing reads and says: nothing
 * this command runs can write a file (FR-041). What it adds is presentation —
 * one primitive to a line, ordered by identity as the listing already is, with
 * `--min` saying what an agent surveys by and the default adding where the body
 * is and what the author declared about it. The kind is passed on as it was
 * typed: which words are kinds is the charter's business and not this command's,
 * and a word that is none comes back from the use case as a fault the command
 * line reports the way it reports any other.
 *
 * A charter with an error lists nothing, and what is wrong is not repeated
 * here: `cw doctor` is the command that says it under each file, and sending
 * the user there is one line rather than two commands saying the same thing
 * differently.
 */
export class ListCommand implements Command<Listing> {
  readonly name = "list";
  readonly summary = "Say what the charter holds";
  readonly options = LISTING;

  async run({ charterAuthoringApp }: Context, { kind, min }: Options<Listing>): Promise<Outcome> {
    const catalogueDTO = await charterAuthoringApp.list(kind);

    if (catalogueDTO.type === "FaultsByFile") {
      const noOfFiles = Object.keys(catalogueDTO.data.files).length;
      return {
        code: EXIT_FAILURE,
        problem: `Nothing was listed: ${noOfFiles} file${noOfFiles === 1 ? " has" : "s have"} errors.\nRun "cw doctor" to see what is wrong with them.\n`,
      };
    }

    const { entries } = catalogueDTO.data;
    if (entries.length === 0)
      return {
        code: EXIT_OK,
        result: kind === undefined ? "This charter holds nothing yet.\n" : `This charter holds no ${kind}.\n`,
      };

    return {
      code: EXIT_OK,
      result: min
        ? `${entries.map(surveyed).join("\n")}\n`
        : `${entries.map(inFull).join("\n")}\n`,
    };
  }
}

/** One primitive as an agent surveys it: what it is called and what it is for
 *  (FR-012). */
function surveyed({ data: { identity, description } }: DataDTOs.CatalogueEntry): string {
  return `${identity}  ${description}`;
}

/** One primitive in full: what it is called and what it is for, where its body
 *  is, and whatever else its author declared about it (FR-011). A header nobody
 *  wrote is not said, the way the listing does not record it. */
function inFull(entry: DataDTOs.CatalogueEntry): string {
  const { file, tags, globs, rationale, mixins } = entry.data;
  const declared = [
    ...(globs === undefined ? [] : [`globs: ${globs.join(", ")}`]),
    ...(tags === undefined ? [] : [`tags: ${tags.join(", ")}`]),
    ...(mixins === undefined ? [] : [`mixins: ${mixins.join(", ")}`]),
    ...(rationale === undefined ? [] : [`rationale: ${rationale}`]),
  ];
  return [surveyed(entry), `  ${file}`, ...(declared.length === 0 ? [] : [`  ${declared.join(", ")}`])].join("\n");
}
