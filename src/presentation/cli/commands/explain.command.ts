import { BUILTIN_LAYER_NAME, type LayerName, PACKAGE_LAYER_NAME, REPO_LAYER_NAME } from "#module/charter/module.js";
import {
  type Command,
  type Context,
  EXIT_FAILURE,
  EXIT_OK,
  type OptionSpec,
  type Options,
  type Outcome,
} from "./command.interface.js";
import { formatHeading, formatMention, formatStatusLine, layAnswerRows, printProblem, reportFault } from "./helper.js";

/** What `cw explain` takes: the id to trace, typed where it is written
 *  rather than offered as a flag beside itself. */
const OPTIONS = {
  id: {
    type: "string",
    describe: 'What the primitive is named by across the whole charter, its id: "no-any"',
  },
} as const satisfies OptionSpec;

/** Which layer a file arrived in, said rather than spelled: the three are what
 *  a charter is made of, and the path above already names the charter it was
 *  installed as (FR-023, FR-017). */
const SAID_BY_LAYER: Readonly<Record<LayerName, string>> = {
  [REPO_LAYER_NAME]: "authored in this repository",
  [PACKAGE_LAYER_NAME]: "installed from a charter source",
  [BUILTIN_LAYER_NAME]: "built into cw, and not authored in this repository",
};

/**
 * `cw explain`: trace one id to the single file that declares it
 * (FR-017, SC-006).
 *
 * One command and one answer: what the primitive is for, the file it was
 * authored in, which layer that file arrived in, when it comes up, the mixins
 * it uses and the corpus it cites, what uses, cites or names it, and the
 * situations this repository wrote down about it (FR-014, FR-163). The id
 * is passed on as it was typed — which names this charter answers to is the charter's
 * business, and one it does not comes back as a fault the command line reports
 * the way it reports any other.
 *
 * A charter with an error explains nothing, and what is wrong is not repeated
 * here: `cw doctor` is the command that says it under each file, and the
 * collision that makes two files claim one id is said there naming both
 * (SC-006).
 */
export class ExplainCommand implements Command<typeof OPTIONS> {
  readonly name = "explain <id>";
  readonly summary = "Say which file declares an id, and which layer it came from";
  readonly options = OPTIONS;

  async runCommand({ charterAuthoringApp }: Context, { id }: Options<typeof OPTIONS>): Promise<Outcome> {
    const explanationOutcomeDTO = await charterAuthoringApp.explainPrimitive(id ?? "");
    if (explanationOutcomeDTO.type === "Fault") return reportFault(explanationOutcomeDTO);

    if (explanationOutcomeDTO.type === "FaultsByFile") {
      const faultyFileCount = Object.keys(explanationOutcomeDTO.data.files).length;
      return {
        exitCode: EXIT_FAILURE,
        problemText: printProblem(
          `Nothing was explained: ${faultyFileCount} file${faultyFileCount === 1 ? " has" : "s have"} errors.`,
          'Run "cw doctor" to see what is wrong with them.',
        ),
        answerDTO: explanationOutcomeDTO,
      };
    }

    const { primitive, activatesWhen, useMixins, rationale, usedByPrimitives, citers, mentioners, testCasesByFile } =
      explanationOutcomeDTO.data;
    // A corpus the charter does not hold is not in `rationale`: what was cited
    // is read off the primitive's own header, and said as not resolving rather
    // than left out, since it is a warning and the explanation still stands
    // (FR-029).
    const rationaleId = primitive.data.headers.rationale;
    // What this one primitive declared, beside what its kind says of all of
    // them: the line above says a sensor runs what it names, and this is where
    // what it names is read. Its id and description are said on the first line.
    const declaredHeaders = Object.entries(primitive.data.headers).filter(
      ([headerName]) => headerName !== "id" && headerName !== "description",
    );
    return {
      exitCode: EXIT_OK,
      resultText: [
        formatHeading(`${formatMention(primitive.data.id)}  ${primitive.data.description}`),
        `  ${formatMention(primitive.data.file)}`,
        `  ${SAID_BY_LAYER[primitive.data.layerName]}`,
        // Each tie of this primitive to the charter in one column, what it is
        // tied to in another.
        ...layAnswerRows([
          ["comes up when", activatesWhen],
          ...declaredHeaders.map(
            ([headerName, headerValue]) =>
              [
                "declares",
                `${headerName}: ${typeof headerValue === "string" ? headerValue : headerValue.join(", ")}`,
              ] as const,
          ),
          ...useMixins.map(({ data: mixinEntry }) => ["uses mixin", formatMention(mixinEntry.id)] as const),
          ...(rationale !== undefined
            ? [["rationale", formatMention(rationale.data.id)] as const]
            : rationaleId !== undefined
              ? [
                  [
                    "rationale",
                    formatStatusLine("todo", `${formatMention(String(rationaleId))} (does not resolve)`),
                  ] as const,
                ]
              : []),
          ...usedByPrimitives.map(
            ({ data: pullerPrimitive }) => ["mixin of", formatMention(pullerPrimitive.id)] as const,
          ),
          ...citers.map(({ data: citerEntry }) => ["rationale of", formatMention(citerEntry.id)] as const),
          ...mentioners.map(({ data: mentionerEntry }) => ["mentioned in", formatMention(mentionerEntry.id)] as const),
          ...Object.entries(testCasesByFile.data).flatMap(([filePath, situations]) =>
            situations.map((situation) => ["pinned down by", `${formatMention(filePath)}: ${situation}`] as const),
          ),
        ]),
        "",
      ].join("\n"),
      answerDTO: explanationOutcomeDTO,
    };
  }
}
