import prompts from "prompts";
import { DomainFault, REPO_SCOPE } from "#hexagon/port/driver/ForManagingCharter.js";
import { EXIT_OK, type Command, type Context, type OptionSpec, type Options, type Outcome } from "./Command.js";

/** What `cw remove` takes: the identity whose file goes, and whether the
 *  question before it is already answered. */
const OPTIONS = {
  identity: {
    type: "string",
    describe: 'What the primitive is named by across the whole charter: "guide:no-any"',
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
 * nothing is removed. A vendored or builtin primitive, and an identity the
 * charter holds nothing of, are refused by the engine before anything is asked
 * (FR-077).
 */
export class RemoveCommand implements Command<typeof OPTIONS> {
  readonly name = "remove <identity>";
  readonly summary = "Delete the file of one primitive this repository authored";
  readonly options = OPTIONS;

  async run({ charterAuthoringApp }: Context, { identity, yes }: Options<typeof OPTIONS>): Promise<Outcome> {
    const { scopedPrimitive } = (await charterAuthoringApp.open(identity ?? "")).data;

    // Only what this repository authored is asked about: anything else is
    // refused by `remove` itself, and a question before a refusal asks nothing.
    if (!yes && scopedPrimitive.data.scope === REPO_SCOPE) {
      if (!process.stdin.isTTY)
        throw new DomainFault(
          `Removing ${scopedPrimitive.data.file} is asked first, and nobody is at the terminal to answer.`,
          `Run "cw remove ${scopedPrimitive.data.identity} --yes" to remove it without asking.`,
        );
      const { confirmed } = await prompts({
        type: "confirm",
        name: "confirmed",
        message: `Remove ${scopedPrimitive.data.file}?`,
        initial: false,
      });
      if (confirmed !== true) return { code: EXIT_OK, result: "Nothing was removed.\n" };
    }

    const scopedPrimitiveDTO = await charterAuthoringApp.remove(scopedPrimitive.data.identity);
    return {
      code: EXIT_OK,
      result: [
        `Removed ${scopedPrimitiveDTO.data.file}.`,
        'Run "cw doctor" to see what still names it, then "cw build".',
        "",
      ].join("\n"),
    };
  }
}
