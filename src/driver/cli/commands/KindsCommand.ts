import { EXIT_OK, type Command, type Context, type OptionSpec, type Options, type Outcome } from "./Command.js";

/** What `cw kinds` takes: which kind to be told about, or nothing.
 *
 *  A positional rather than a flag, because it is the subject of the question
 *  rather than something said about it — `cw kinds skill` is how it reads. */
const OPTIONS = {
  kind: {
    type: "string",
    describe: "Which kind to be told what it requires; left off, every kind and when each comes up",
  },
} as const satisfies OptionSpec;

/**
 * `cw kinds`: which kinds a charter can be written in, and when a primitive of
 * each comes up (FR-010). Asked about one kind, what that kind requires of
 * whoever authors one (FR-001).
 *
 * What `cw list` does not answer. A listing says what this repository authored,
 * and a kind it authored nothing of is missing from it — so whoever is deciding
 * which kind to write something as reads this, and reads it in a repository
 * whose charter is empty or will not hold, since neither is asked about here.
 *
 * The lines are the kinds' own, said once behind the port and read here as they
 * come: the compiled orientation an agent reads says them too, and the portal
 * shows them above its listing, so all three say what a kind is in the same
 * words (FR-006). One kind's headers are the same contract `cw add` asks from
 * and a refusal is worded against, so an agent that reads this and answers with
 * flags is answering what the engine will check (FR-004, FR-005).
 */
export class KindsCommand implements Command<typeof OPTIONS> {
  readonly name = "kinds [kind]";
  readonly summary = "Say which kinds a charter is written in, and what one of them requires";
  readonly options = OPTIONS;

  async run({ charterAuthoringApp }: Context, { kind }: Options<typeof OPTIONS>): Promise<Outcome> {
    if (kind === undefined) {
      const { data } = await charterAuthoringApp.kinds();
      return {
        code: EXIT_OK,
        result: `${Object.entries(data)
          .map(([named, activatesWhen]) => `${named}  ${activatesWhen}`)
          .join("\n")}\n`,
      };
    }

    // A word that is no kind raises the fault the engine raises everywhere
    // else, naming every kind there is: nothing is caught here, so what an
    // author reads is the same sentence whichever command they asked with.
    const { data } = await charterAuthoringApp.listPrimitiveRequirements(kind);

    // Only what the kind requires: a header it takes without requiring is one
    // an author leaves out, and naming it here would be asking for what a file
    // is never refused for. The same set `cw add` asks at a terminal.
    const required = data.headers.filter((one) => one.data.required);
    const widestField = Math.max(...required.map((one) => one.data.field.length));

    return {
      code: EXIT_OK,
      result: [
        `A ${kind} requires:`,
        // A header read from a closed set is one of those values or refused, so
        // the values are part of what it requires (FR-118).
        ...required.map(
          ({ data: { field, shape, allowedValues } }) =>
            `  ${field.padEnd(widestField)}  ${shape}${allowedValues === undefined ? "" : `, one of ${allowedValues.join(", ")}`}`,
        ),
        "",
        `Write one the way this ${kind} is written:`,
        data.sample,
        "",
      ].join("\n"),
    };
  }
}
