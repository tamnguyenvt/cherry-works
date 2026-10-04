import { EXIT_FAILURE, EXIT_OK, type Command, type Context, type OptionSpec, type Options, type Outcome } from "./Command.js";

const OPTIONS = {
  exact: {
    type: "boolean",
    describe: "Count exactly, through the agent's own command line, rather than estimate",
    default: false,
  },
} as const satisfies OptionSpec;

/**
 * `cw context`: what the charter puts into each agent's main context when a
 * session opens, before anything is asked (EVAL-FR-001 – EVAL-FR-004).
 *
 * One line per primitive, the largest first, then the total, said to be an
 * estimate unless it was counted exactly; below, apart and outside the total,
 * every guide loaded only when a file it names is touched, with its globs.
 * What the portal shows is the same answer (EVAL-FR-007).
 */
export class ContextCommand implements Command<typeof OPTIONS> {
  readonly name = "context";
  readonly summary = "Say how many tokens the charter puts into the agent's main context";
  readonly options = OPTIONS;

  async run({ charterAuthoringApp }: Context, { exact: isExactAsked }: Options<typeof OPTIONS>): Promise<Outcome> {
    const mainContextsDTO = await charterAuthoringApp.predictMainContext(isExactAsked);

    if (mainContextsDTO.type === "FaultsByFile") {
      const noOfFiles = Object.keys(mainContextsDTO.data.files).length;
      return {
        code: EXIT_FAILURE,
        problem: `Nothing was counted: ${noOfFiles} file${noOfFiles === 1 ? " has" : "s have"} errors.\nRun "cw doctor" to see what is wrong with them.\n`,
      };
    }

    const { contexts } = mainContextsDTO.data;
    if (contexts.length === 0)
      return { code: EXIT_OK, result: 'No agent is chosen, so no agent loads anything of the charter. Run "cw init" to choose one.\n' };

    const loadLineOf = ({ data: { tokens, kind, id, globs } }: (typeof contexts)[number]["data"]["sessionLoads"][number]) =>
      [`  ${tokens.toLocaleString("en-US").padStart(7)}  ${kind.padEnd(8)} ${id}`, ...(globs === undefined ? [] : [`  ${globs.join(", ")}`])].join("");

    return {
      code: EXIT_OK,
      result: contexts
        .flatMap(({ data: { agent, isExact, sessionLoads, fileLoads, totalTokens } }) => [
          `${agent} opens a session with:`,
          ...sessionLoads.map(loadLineOf),
          `  ${totalTokens.toLocaleString("en-US")} tokens in all, ${isExact ? `counted exactly by ${agent}` : "estimated"}.`,
          ...(fileLoads.length === 0 ? [] : ["", "Loaded when a file it names is touched, not in the total:", ...fileLoads.map(loadLineOf)]),
          "",
        ])
        .join("\n"),
    };
  }
}
