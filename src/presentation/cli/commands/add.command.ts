import prompts from "prompts";
import {
  type Command,
  type Context,
  EXIT_FAILURE,
  EXIT_OK,
  type OptionSpec,
  type Options,
  type Outcome,
} from "./command.interface.js";
import {
  formatHeading,
  formatMention,
  formatStatusLine,
  parseKVParams,
  printFault,
  refuseCommand,
  reportFault,
} from "./helper.js";

/** What `cw add` takes: which kind of primitive, what it is to be named, and
 *  what the kind requires under it.
 *
 *  The headers are one repeated flag rather than a flag apiece: which headers a
 *  kind requires is that kind's own business, and a flag per header of every
 *  kind is a command line nobody could read. Whoever is at a terminal answers
 *  them instead, and types none of this. */
const OPTIONS = {
  kind: {
    type: "string",
    describe: "Which kind of primitive to write; a word that is none is answered with every kind there is",
  },
  id: {
    type: "string",
    describe: 'What it is named by across the whole charter: "no-any"',
  },
  charter: {
    type: "string",
    describe: 'The charter it is written into, made where there is none of that name: "team"',
  },
  header: {
    type: "string",
    isArray: true,
    describe: 'One header the kind requires, as name=value; typed once per header, and what "cw kinds <kind>" names',
  },
} as const satisfies OptionSpec;

/**
 * `cw add`: a correctly-shaped primitive without looking up what its kind
 * requires (FR-039).
 *
 * The asking happens here and only here, as it does in `cw init`: the engine is
 * asked what the kind requires, whoever is at the terminal answers one question
 * per header, and the answers go back as they were typed. Which words are kinds
 * and whether an answer is one the kind takes are both the engine's to say, and
 * what it says is what the user reads.
 *
 * It is written into the charter `--charter` names; with none, whoever is at the
 * terminal picks one of the charters the repository authored, or names one where
 * it holds none, and with nobody there the engine refuses it, naming the charters
 * held (VENDOR-FR-014, VENDOR-FR-015).
 *
 * Nothing is compiled after it: the body is what its author has yet to write
 * (FR-020).
 */
export class AddCommand implements Command<typeof OPTIONS> {
  readonly name = "add <kind> <id>";
  readonly summary = "Write a new primitive of one kind, holding what that kind requires";
  readonly options = OPTIONS;

  async runCommand(
    { charterAuthoringApp, isAtTerminal }: Context,
    { kind, id, charter, header }: Options<typeof OPTIONS>,
  ): Promise<Outcome> {
    let charterName = charter ?? "";
    if (charter === undefined && isAtTerminal) {
      const chartersDTO = await charterAuthoringApp.listCharters();
      if (chartersDTO.type === "Fault") return reportFault(chartersDTO);
      const authoredCharterNames = chartersDTO.data.charters
        .filter((charterDTO) => !charterDTO.data.isInstalled)
        .map((charterDTO) => charterDTO.data.name);
      const charterAnswer =
        authoredCharterNames.length === 0
          ? await prompts({ type: "text", name: "charterName", message: "Which charter is it written into?" })
          : await prompts({
              type: "select",
              name: "charterName",
              message: "Which charter is it written into?",
              choices: authoredCharterNames.map((authoredCharterName) => ({
                title: authoredCharterName,
                value: authoredCharterName,
              })),
            });
      if (typeof charterAnswer.charterName !== "string")
        return reportFault(
          refuseCommand(
            "StoppedPromptFault",
            "This was stopped before it had its answers, so nothing was written.",
            'Run "cw add" again.',
          ),
        );
      charterName = charterAnswer.charterName.trim();
    }

    const primitiveRequirementsDTO = await charterAuthoringApp.listPrimitiveRequirements(kind ?? "");
    if (primitiveRequirementsDTO.type === "Fault") return reportFault(primitiveRequirementsDTO);
    const primitiveHeaders = primitiveRequirementsDTO.data.headers.map((primitiveHeader) => primitiveHeader.data);
    const listFieldNames = new Set(
      primitiveHeaders
        .filter((primitiveHeader) => primitiveHeader.shape === "list")
        .map((primitiveHeader) => primitiveHeader.field),
    );

    // Typed headers are answers already, so there is nothing left to ask: the
    // two paths reach `addPrimitive` with the same record, and what refuses a bad one is
    // the engine, in the same words whichever way it was answered. Each is read
    // as the kind holds it — a list keeps every value in the order it was typed,
    // and a line typed twice is refused naming the header (FR-007). Which of
    // them take a list is the engine's answer, and the same contract a file is
    // refused against, so nothing here holds a list of its own to fall behind a
    // kind that grows or renames a header. A name the kind never named has no
    // shape to be read by, so it goes on as a line and `addPrimitive` refuses it in the
    // words it refuses a typed-in one with (FR-011, FR-012).
    //
    // Only the required ones are asked at a terminal: a header a kind takes
    // without requiring is one an author leaves out, and a prompt for it would
    // be a question with no wrong answer.
    const headerParamsAnswer = header.length > 0 ? parseKVParams(header, "header") : undefined;
    if (headerParamsAnswer !== undefined && "faultDTO" in headerParamsAnswer)
      return reportFault(headerParamsAnswer.faultDTO);
    const typedHeaders = headerParamsAnswer?.valuesByParamKey;
    const repeatedFieldName = Object.entries(typedHeaders ?? {}).find(
      ([field, values]) => !listFieldNames.has(field) && values.length > 1,
    )?.[0];
    if (repeatedFieldName !== undefined)
      return reportFault(
        refuseCommand(
          "RepeatedHeaderFault",
          `"${repeatedFieldName}" holds one line, and was typed ${typedHeaders?.[repeatedFieldName]?.length} times.`,
          `Type "--header ${repeatedFieldName}=..." once.`,
        ),
      );
    let headerAnswers: Record<string, string | readonly string[]>;
    if (typedHeaders !== undefined)
      headerAnswers = Object.fromEntries(
        Object.entries(typedHeaders).map(([field, values]) => [
          field,
          listFieldNames.has(field) ? values : (values[0] ?? ""),
        ]),
      );
    else {
      // Every header this kind requires, answered by whoever is at the
      // terminal: one question per header, in the order the engine named them,
      // each asked as what it holds — one line of text, or a list of names
      // typed with commas between its entries, which is what the file holds it
      // as.
      //
      // Nobody at the terminal is refused rather than answered with blanks:
      // every header here is one its kind requires, so a file written without
      // them is a file the next build refuses, and writing it would leave the
      // author to find that out later (FR-035 is setup's, and this asks for
      // what nothing can default).
      const requiredHeaders = primitiveHeaders.filter((primitiveHeader) => primitiveHeader.required);
      // No charter named either is refused as that, by the engine, naming the
      // charters held (VENDOR-FR-015).
      if (!isAtTerminal && charter === undefined) {
        const refusedDTO = await charterAuthoringApp.addPrimitive(kind ?? "", id ?? "", "", {});
        if (refusedDTO.type === "Fault") return reportFault(refusedDTO);
      }
      if (!isAtTerminal)
        return reportFault(
          refuseCommand(
            "NoTerminalFault",
            `A ${kind ?? ""} requires ${requiredHeaders.map((requiredHeader) => `"${requiredHeader.field}"`).join(", ")}, and nobody is at the terminal to answer.`,
            'Run "cw add" where you can answer, or author the file under the charter yourself.',
          ),
        );
      const promptAnswers = await prompts(
        requiredHeaders.map(({ field, shape }) =>
          shape === "line"
            ? { type: "text" as const, name: field, message: `${field}?` }
            : {
                type: "list" as const,
                name: field,
                message: `${field}?`,
                // `prompts` hands an answer left empty back as [""].
                format: (entries: readonly string[]) =>
                  entries.map((answerLine) => answerLine.trim()).filter((answerLine) => answerLine !== ""),
              },
        ),
      );
      if (requiredHeaders.some((requiredHeader) => promptAnswers[requiredHeader.field] === undefined))
        return reportFault(
          refuseCommand(
            "StoppedPromptFault",
            "This was stopped before it had its answers, so nothing was written.",
            'Run "cw add" again.',
          ),
        );
      headerAnswers = promptAnswers;
    }
    const primitiveDTO = await charterAuthoringApp.addPrimitive(kind ?? "", id ?? "", charterName, headerAnswers);

    if (primitiveDTO.type === "Fault") return reportFault(primitiveDTO);
    if (primitiveDTO.type === "Faults")
      return {
        exitCode: EXIT_FAILURE,
        problemText: primitiveDTO.data.faults.map(printFault).join(""),
        answerDTO: primitiveDTO,
      };

    return {
      exitCode: EXIT_OK,
      resultText: [
        formatHeading(formatStatusLine("good", `Wrote ${formatMention(primitiveDTO.data.file)}.`)),
        // A script's author is sent to the file that runs, which was written
        // empty beside it (FR-167).
        ...(typeof primitiveDTO.data.headers.executionPath === "string"
          ? [
              `Wrote ${formatMention(primitiveDTO.data.headers.executionPath)} beside it, the file it runs: write the script there.`,
            ]
          : []),
        'Write what it has to say in the body, then run "cw build".',
        "",
      ].join("\n"),
      answerDTO: primitiveDTO,
    };
  }
}
