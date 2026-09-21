import { BUILTIN_SCOPE, REPO_SCOPE, VENDOR_SCOPE, type Scope } from "#hexagon/port/driver/ForManagingCharter.js";
import {
  EXIT_FAILURE,
  EXIT_OK,
  type Command,
  type Context,
  type OptionSpec,
  type Options,
  type Outcome,
} from "./Command.js";

/** What `cw explain` takes: the identity to trace, typed where it is written
 *  rather than offered as a flag beside itself. */
const OPTIONS = {
  identity: {
    type: "string",
    describe: 'What the primitive is named by across the whole charter: "guide:no-any"',
  },
} as const satisfies OptionSpec;

/**
 * `cw explain`: trace one identity to the single file that declares it
 * (FR-017, SC-006).
 *
 * One command and one answer: what the primitive is for, the file it was
 * authored in, which layer that file arrived in, the mixins it uses and the
 * corpus it cites, what uses or cites it, and the situations this repository
 * wrote down about it (FR-014). The identity is passed on
 * as it was typed — which names this charter answers to is the charter's
 * business, and one it does not comes back as a fault the command line reports
 * the way it reports any other.
 *
 * A charter with an error explains nothing, and what is wrong is not repeated
 * here: `cw doctor` is the command that says it under each file, and the
 * collision that makes two files claim one identity is said there naming both
 * (SC-006).
 */
export class ExplainCommand implements Command<typeof OPTIONS> {
  readonly name = "explain <identity>";
  readonly summary = "Say which file declares an identity, and which layer it came from";
  readonly options = OPTIONS;

  async run({ charterAuthoringApp }: Context, { identity }: Options<typeof OPTIONS>): Promise<Outcome> {
    const explanationOutcomeDTO = await charterAuthoringApp.explain(identity ?? "");

    if (explanationOutcomeDTO.type === "FaultsByFile") {
      const noOfFiles = Object.keys(explanationOutcomeDTO.data.files).length;
      return {
        code: EXIT_FAILURE,
        problem: `Nothing was explained: ${noOfFiles} file${noOfFiles === 1 ? " has" : "s have"} errors.\nRun "cw doctor" to see what is wrong with them.\n`,
      };
    }

    const { scopedPrimitive, useMixins, rationale, hosts, citers, testCasesByFile } = explanationOutcomeDTO.data;
    return {
      code: EXIT_OK,
      result: [
        `${scopedPrimitive.data.identity}  ${scopedPrimitive.data.description}`,
        `  ${scopedPrimitive.data.file}`,
        `  ${layer(scopedPrimitive.data.scope)}`,
        ...useMixins.map(({ data }) => `  uses mixin ${data.identity}`),
        ...(rationale === undefined ? [] : [`  rationale ${rationale.data.identity}`]),
        ...hosts.map(({ data }) => `  mixin of ${data.identity}`),
        ...citers.map(({ data }) => `  rationale of ${data.identity}`),
        ...Object.entries(testCasesByFile.data).flatMap(([file, situations]) =>
          situations.map((situation) => `  pinned down by ${file}: ${situation}`),
        ),
        "",
      ].join("\n"),
    };
  }
}

/** Which layer a file arrived in, said rather than spelled: the three are what
 *  a charter is made of, and the path above already names the vendor it was
 *  installed as (FR-023, FR-017). */
function layer(scope: Scope): string {
  const saidByScope: Record<Scope, string> = {
    [REPO_SCOPE]: "authored in this repository",
    [VENDOR_SCOPE]: "installed from a vendor",
    [BUILTIN_SCOPE]: "built into cw, and not authored in this repository",
  };
  return saidByScope[scope];
}
