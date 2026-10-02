import { BUILTIN_LAYER, DomainFault } from "#hexagon/port/driver/ForManagingCharter.js";
import { editInEditor } from "./helper.js";
import {
  EXIT_FAILURE,
  EXIT_OK,
  type Command,
  type Context,
  type OptionSpec,
  type Options,
  type Outcome,
} from "./Command.js";

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
 * to check here, and a vendored primitive opens like any other — the next
 * `cw doctor` names an edit there as drift. What the engine brings has no file,
 * and is refused.
 *
 * The editor is `$VISUAL`, else `$EDITOR`, as `editInEditor` runs it.
 */
export class EditCommand implements Command<typeof OPTIONS> {
  readonly name = "edit <id>";
  readonly summary = "Open the file of one primitive in your editor";
  readonly options = OPTIONS;

  async run({ cwd, charterAuthoringApp }: Context, { id }: Options<typeof OPTIONS>): Promise<Outcome> {
    const primitive = (await charterAuthoringApp.open(id ?? "")).data;
    if (primitive.layerName === BUILTIN_LAYER)
      throw new DomainFault(
        `${primitive.id} is built into cw, and there is no file of it in this repository to edit.`,
        `To differ from it, run "cw add" for a primitive of your own under an id of its own.`,
      );

    const problem = await editInEditor(cwd, primitive.file);
    if (problem !== undefined) return { code: EXIT_FAILURE, problem };

    return {
      code: EXIT_OK,
      result: [`Closed ${primitive.file}.`, 'Run "cw doctor" to see that the charter still holds, then "cw build".', ""].join("\n"),
    };
  }
}
