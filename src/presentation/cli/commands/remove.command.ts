import prompts from "prompts";
import { REPO_LAYER_NAME } from "#module/charter/module.js";
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

/** What `cw remove` takes: the id whose file goes, and whether the
 *  question before it is already answered. */
const OPTIONS = {
  id: {
    type: "string",
    describe: 'What the primitive is named by across the whole charter, its id: "no-any"',
  },
  yes: {
    type: "boolean",
    alias: "y",
    default: false,
    describe: "Remove it without asking first, as a run with nobody at the terminal must",
  },
} as const satisfies OptionSpec;

/**
 * `cw remove`: take one primitive this repository authored away (FR-076,
 * FR-109).
 *
 * Its file goes and nothing else does: what still names it is left for the next
 * `cw doctor` to report, and nothing is compiled. Whoever is at the terminal is
 * asked first, naming the file, since what goes is what somebody authored;
 * `--yes` is that answer given ahead, and with nobody to ask and no `--yes`
 * nothing is removed. A vendored or builtin primitive, and an id the
 * charter holds nothing of, are refused by the engine before anything is asked
 * (FR-077).
 */
export class RemoveCommand implements Command<typeof OPTIONS> {
  readonly name = "remove <id>";
  readonly summary = "Delete the file of one primitive this repository authored";
  readonly options = OPTIONS;

  async runCommand(
    { charterAuthoringApp }: Context,
    { id, yes: isAnsweredYes }: Options<typeof OPTIONS>,
  ): Promise<Outcome> {
    const openedPrimitiveDTO = await charterAuthoringApp.openPrimitive(id ?? "");
    if (openedPrimitiveDTO.type === "Fault")
      return { exitCode: EXIT_FAILURE, problemText: printFault(openedPrimitiveDTO) };
    const primitive = openedPrimitiveDTO.data;

    // Only what this repository authored is asked about: anything else is
    // refused by `removePrimitive` itself, and a question before a refusal asks nothing.
    if (!isAnsweredYes && primitive.layerName === REPO_LAYER_NAME) {
      if (!process.stdin.isTTY)
        return {
          exitCode: EXIT_FAILURE,
          problemText: `Removing ${primitive.file} is asked first, and nobody is at the terminal to answer.\n  Run "cw remove ${primitive.id} --yes" to remove it without asking.\n`,
        };
      const { isConfirmed } = await prompts({
        type: "confirm",
        name: "isConfirmed",
        message: `Remove ${primitive.file}?`,
        initial: false,
      });
      if (isConfirmed !== true) return { exitCode: EXIT_OK, resultText: "Nothing was removed.\n" };
    }

    const primitiveDTO = await charterAuthoringApp.removePrimitive(primitive.id);
    if (primitiveDTO.type === "Fault") return { exitCode: EXIT_FAILURE, problemText: printFault(primitiveDTO) };
    return {
      exitCode: EXIT_OK,
      resultText: [
        `Removed ${primitiveDTO.data.file}.`,
        'Run "cw doctor" to see what still names it, then "cw build".',
        "",
      ].join("\n"),
    };
  }
}
