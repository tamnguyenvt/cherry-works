import { BUILTIN_SCOPE, Fault } from "#hexagon/port/driver/ForManagingCharter.js";
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

/** What `cw edit` takes: the identity whose file is opened. */
const OPTIONS = {
  identity: {
    type: "string",
    describe: 'What the primitive is named by across the whole charter: "guide:no-any"',
  },
} as const satisfies OptionSpec;

/**
 * `cw edit`: the author's own editor on the file declaring one identity
 * (FR-075, FR-109; plan §13).
 *
 * It writes nothing: the engine is asked which file declares the identity, and
 * whoever saves in the editor is the one who wrote it. So there is no revision
 * to check here, and a vendored primitive opens like any other — the next
 * `cw doctor` names an edit there as drift. What the engine brings has no file,
 * and is refused.
 *
 * The editor is `$VISUAL`, else `$EDITOR`, as `editInEditor` runs it.
 */
export class EditCommand implements Command<typeof OPTIONS> {
  readonly name = "edit <identity>";
  readonly summary = "Open the file of one primitive in your editor";
  readonly options = OPTIONS;

  async run({ cwd, charterAuthoringApp }: Context, { identity }: Options<typeof OPTIONS>): Promise<Outcome> {
    const { scopedPrimitive } = (await charterAuthoringApp.open(identity ?? "")).data;
    if (scopedPrimitive.data.scope === BUILTIN_SCOPE)
      throw new Fault(
        `${scopedPrimitive.data.identity} is built into cw, and there is no file of it in this repository to edit.`,
        `To differ from it, run "cw add" for a primitive of your own under an identity of its own.`,
      );

    const problem = await editInEditor(cwd, scopedPrimitive.data.file);
    if (problem !== undefined) return { code: EXIT_FAILURE, problem };

    return {
      code: EXIT_OK,
      result: [`Closed ${scopedPrimitive.data.file}.`, 'Run "cw doctor" to see that the charter still holds, then "cw build".', ""].join("\n"),
    };
  }
}
