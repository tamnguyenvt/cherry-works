import { BUILTIN_LAYER_NAME } from "#module/charter/module.js";
import {
  type Command,
  type Context,
  EXIT_OK,
  type OptionSpec,
  type Options,
  type Outcome,
} from "./command.interface.js";
import { editInEditor, formatHeading, formatMention, formatStatusLine, refuseCommand, reportFault } from "./helper.js";

/** What `cw edit` takes: the id whose file is opened. */
const OPTIONS = {
  id: {
    type: "string",
    describe: 'What the primitive is named by across the whole charter, its id: "no-any"',
  },
} as const satisfies OptionSpec;

/**
 * `cw edit`: the author's own editor on the file declaring one id
 * (FR-075, FR-109; plan §13).
 *
 * It writes nothing: the engine is asked which file declares the id, and
 * whoever saves in the editor is the one who wrote it. So there is no revision
 * to check here, and a vendored primitive opens like any other. What the engine
 * brings has no file, and is refused.
 *
 * The editor is `$VISUAL`, else `$EDITOR`, as `editInEditor` runs it.
 */
export class EditCommand implements Command<typeof OPTIONS> {
  readonly name = "edit <id>";
  readonly summary = "Open the file of one primitive in your editor";
  readonly options = OPTIONS;

  async runCommand(
    { cwd, charterAuthoringApp, isJsonAnswer }: Context,
    { id }: Options<typeof OPTIONS>,
  ): Promise<Outcome> {
    const primitiveDTO = await charterAuthoringApp.openPrimitive(id ?? "");
    if (primitiveDTO.type === "Fault") return reportFault(primitiveDTO);
    const primitive = primitiveDTO.data;
    if (primitive.layerName === BUILTIN_LAYER_NAME)
      return reportFault(
        refuseCommand(
          "BuiltinPrimitiveFault",
          `${primitive.id} is built into cw, and there is no file of it in this repository to edit.`,
          `To differ from it, run "cw add" for a primitive of your own under an id of its own.`,
        ),
      );

    const editorOutcome = await editInEditor(cwd, primitive.file, isJsonAnswer);
    if (editorOutcome !== undefined) return editorOutcome;

    return {
      exitCode: EXIT_OK,
      resultText: [
        formatHeading(formatStatusLine("good", `Closed ${formatMention(primitive.file)}.`)),
        'Run "cw doctor" to see that the charter still holds, then "cw build".',
        "",
      ].join("\n"),
      answerDTO: primitiveDTO,
    };
  }
}
