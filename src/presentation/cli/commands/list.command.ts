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

/** What `cw list` takes: which kind to narrow to, and how much of each
 *  primitive to say. Both are how the listing is read, never what is in it —
 *  the listing is the charter's own and this command only asks it for less. */
const OPTIONS = {
  kind: { type: "string", describe: "Only the primitives of this kind" },
  min: {
    type: "boolean",
    describe: "What an agent surveys by: id and description, nothing else",
    default: false,
  },
} as const satisfies OptionSpec;

/**
 * `cw list`: say what the charter holds (FR-011, FR-012).
 *
 * It reaches for `listCatalogue` and nothing else, and listing reads and says: nothing
 * this command runs can write a file (FR-041). What it adds is presentation —
 * one primitive to a line, ordered by id as the listing already is, with
 * `--min` saying what an agent surveys by and the default adding where the body
 * is and the files it applies to. The kind is passed on as it was
 * typed: which words are kinds is the charter's business and not this command's,
 * and a word that is none comes back from the use case as a fault the command
 * line reports the way it reports any other.
 *
 * A charter with an error lists nothing, and what is wrong is not repeated
 * here: `cw doctor` is the command that says it under each file, and sending
 * the user there is one line rather than two commands saying the same thing
 * differently.
 */
export class ListCommand implements Command<typeof OPTIONS> {
  readonly name = "list";
  readonly summary = "Say what the charter holds";
  readonly options = OPTIONS;

  async runCommand({ charterAuthoringApp }: Context, { kind, min: isMin }: Options<typeof OPTIONS>): Promise<Outcome> {
    const catalogueDTO = await charterAuthoringApp.listCatalogue(kind);
    if (catalogueDTO.type === "Fault") return { exitCode: EXIT_FAILURE, problemText: printFault(catalogueDTO) };

    if (catalogueDTO.type === "FaultsByFile") {
      const faultyFileCount = Object.keys(catalogueDTO.data.files).length;
      return {
        exitCode: EXIT_FAILURE,
        problemText: `Nothing was listed: ${faultyFileCount} file${faultyFileCount === 1 ? " has" : "s have"} errors.\nRun "cw doctor" to see what is wrong with them.\n`,
      };
    }

    const { entries } = catalogueDTO.data;
    if (entries.length === 0)
      return {
        exitCode: EXIT_OK,
        resultText: kind === undefined ? "This charter holds nothing yet.\n" : `This charter holds no ${kind}.\n`,
      };

    return {
      exitCode: EXIT_OK,
      // A primitive as an agent surveys it is what it is called and what it is
      // for (FR-012); in full, also where its body is and the files it applies
      // to (FR-011). Globs nobody wrote are not said, the way the listing does
      // not record them.
      resultText: `${entries
        .map(({ data: { id, description, file: filePath, globs } }) =>
          [
            `${id}  ${description}`,
            ...(isMin ? [] : [`  ${filePath}`, ...(globs === undefined ? [] : [`  globs: ${globs.join(", ")}`])]),
          ].join("\n"),
        )
        .join("\n")}\n`,
    };
  }
}
