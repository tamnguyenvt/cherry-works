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

  async runCommand({ charterAuthoringApp }: Context, { kind }: Options<typeof OPTIONS>): Promise<Outcome> {
    if (kind === undefined) {
      const primitiveKindsDTO = await charterAuthoringApp.listKinds();
      if (primitiveKindsDTO.type === "Fault")
        return { exitCode: EXIT_FAILURE, problemText: printFault(primitiveKindsDTO) };
      const primitiveKinds = primitiveKindsDTO.data;
      return {
        exitCode: EXIT_OK,
        resultText: `${Object.entries(primitiveKinds)
          .map(([kindName, activatesWhen]) => `${kindName}  ${activatesWhen}`)
          .join("\n")}\n`,
      };
    }

    // A word that is no kind is answered with the fault the engine answers
    // everywhere else, naming every kind there is, so what an author reads is
    // the same sentence whichever command they asked with.
    const primitiveRequirementsDTO = await charterAuthoringApp.listPrimitiveRequirements(kind);
    if (primitiveRequirementsDTO.type === "Fault")
      return { exitCode: EXIT_FAILURE, problemText: printFault(primitiveRequirementsDTO) };
    const primitiveRequirements = primitiveRequirementsDTO.data;

    // Only what the kind requires: a header it takes without requiring is one
    // an author leaves out, and naming it here would be asking for what a file
    // is never refused for. The same set `cw add` asks at a terminal.
    const requiredHeaders = primitiveRequirements.headers.filter((primitiveHeader) => primitiveHeader.data.required);
    const widestFieldLength = Math.max(...requiredHeaders.map((primitiveHeader) => primitiveHeader.data.field.length));

    return {
      exitCode: EXIT_OK,
      resultText: [
        `A ${kind} requires:`,
        // A header read from a closed set is one of those values or refused, so
        // the values are part of what it requires (FR-118).
        ...requiredHeaders.map(
          ({ data: { field, shape, allowedValues } }) =>
            `  ${field.padEnd(widestFieldLength)}  ${shape}${allowedValues === undefined ? "" : `, one of ${allowedValues.join(", ")}`}`,
        ),
        "",
        `Write one the way this ${kind} is written:`,
        primitiveRequirements.sample,
        "",
      ].join("\n"),
    };
  }
}
