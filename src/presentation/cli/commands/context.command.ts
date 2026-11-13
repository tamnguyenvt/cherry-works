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

const OPTIONS = {
  exact: {
    type: "boolean",
    describe: "Count exactly, through the agent's own command line, and estimate too: with --agent",
    default: false,
  },
  agent: {
    type: "string",
    describe: "The agent to count for: the one counted exactly with --exact, the one estimated alone without it",
  },
} as const satisfies OptionSpec;

/**
 * `cw context`: what the charter puts into each agent's main context when a
 * session opens, before anything is asked (EVAL-FR-001 – EVAL-FR-004).
 *
 * One line per primitive, the largest first, then the total, said to be an
 * estimate; below, apart and outside the total, every guide loaded only when
 * a file it names is touched, with its globs. `--agent` narrows it to one
 * agent the repository compiles for. What the portal shows is the same answer
 * (EVAL-FR-007).
 *
 * With `--exact --agent=<agent>`, each line is the estimate, the agent's own
 * exact count and how far apart they are, as a share of the exact count, then
 * the totals; a warning is said, and the count still succeeds, where the
 * totals are further apart than EVAL-SC-002 allows. `--exact` with no agent
 * named is refused, and nothing is counted.
 */
export class ContextCommand implements Command<typeof OPTIONS> {
  readonly name = "context";
  readonly summary = "Say how many tokens the charter puts into the agent's main context";
  readonly options = OPTIONS;

  async runCommand(
    { charterBuildingApp, charterRuntimeApp }: Context,
    { exact: isExactAsked, agent: requestedAgent }: Options<typeof OPTIONS>,
  ): Promise<Outcome> {
    if (isExactAsked && requestedAgent === undefined)
      return {
        exitCode: EXIT_FAILURE,
        problemText:
          'Counting exactly needs the agent to count through named, and none was. Nothing was counted.\n  Run "cw context --exact --agent=<agent>", or "cw context" for the estimate, which needs nothing.\n',
      };
    const mainContextAnswer =
      isExactAsked && requestedAgent !== undefined
        ? await charterRuntimeApp.countMainContext(requestedAgent)
        : await charterBuildingApp.predictMainContext();
    if (mainContextAnswer.type === "Fault")
      return { exitCode: EXIT_FAILURE, problemText: printFault(mainContextAnswer) };
    if (mainContextAnswer.type === "FaultsByFile") {
      const noOfFiles = Object.keys(mainContextAnswer.data.files).length;
      return {
        exitCode: EXIT_FAILURE,
        problemText: `Nothing was counted: ${noOfFiles} file${noOfFiles === 1 ? " has" : "s have"} errors.\nRun "cw doctor" to see what is wrong with them.\n`,
      };
    }

    if (mainContextAnswer.type === "MainContext") {
      const {
        agent,
        sessionLoads,
        fileLoads,
        totalTokens,
        estimatedTotalTokens,
        totalDifferenceRatio,
        accuracyLimit,
        isPastAccuracyLimit,
      } = mainContextAnswer.data;
      const formatDifferenceRatio = (differenceRatio: number | undefined) =>
        differenceRatio === undefined
          ? "n/a"
          : `${differenceRatio > 0 ? "+" : ""}${(differenceRatio * 100).toFixed(1)}%`;
      const loadCountLineOf = ({
        data: { tokens, estimatedTokens, differenceRatio, kind, id, globs },
      }: (typeof sessionLoads)[number]) =>
        [
          `  ${estimatedTokens.toLocaleString("en-US").padStart(9)}  ${tokens.toLocaleString("en-US").padStart(9)}  ${formatDifferenceRatio(differenceRatio).padStart(10)}  ${kind.padEnd(8)} ${id}`,
          ...(globs === undefined ? [] : [`  ${globs.join(", ")}`]),
        ].join("");
      const accuracyLimitText = `${Math.round(accuracyLimit * 100)}% EVAL-SC-002 allows`;
      return {
        exitCode: EXIT_OK,
        resultText: [
          `${agent} opens a session with, estimated and counted exactly by ${agent}:`,
          `  ${"estimated".padStart(9)}  ${"exact".padStart(9)}  ${"difference".padStart(10)}  primitive`,
          ...sessionLoads.map(loadCountLineOf),
          `  ${estimatedTotalTokens.toLocaleString("en-US").padStart(9)}  ${totalTokens.toLocaleString("en-US").padStart(9)}  ${formatDifferenceRatio(totalDifferenceRatio).padStart(10)}  in all`,
          ...(isPastAccuracyLimit ? [] : [`Within the ${accuracyLimitText}.`]),
          ...(fileLoads.length === 0
            ? []
            : ["", "Loaded when a file it names is touched, not in the total:", ...fileLoads.map(loadCountLineOf)]),
          "",
        ].join("\n"),
        ...(isPastAccuracyLimit
          ? {
              problemText:
                totalDifferenceRatio === undefined
                  ? `The exact count is none and the estimate is not, past the ${accuracyLimitText}.\n`
                  : `The estimate is ${Math.abs(totalDifferenceRatio * 100).toFixed(1)}% from the exact count, past the ${accuracyLimitText}.\n`,
            }
          : {}),
      };
    }

    const { contexts: compiledContexts } = mainContextAnswer.data;
    if (compiledContexts.length === 0)
      return {
        exitCode: EXIT_OK,
        resultText: 'No agent is chosen, so no agent loads anything of the charter. Run "cw init" to choose one.\n',
      };
    const contexts =
      requestedAgent === undefined
        ? compiledContexts
        : compiledContexts.filter(({ data: { agent } }) => agent === requestedAgent);
    if (contexts.length === 0)
      return {
        exitCode: EXIT_FAILURE,
        problemText: `The repository does not compile for ${requestedAgent}, so nothing of it is loaded.\n  Name one it compiles for: ${compiledContexts.map(({ data: { agent } }) => agent).join(", ")}.\n`,
      };

    const loadLineOf = ({
      data: { tokens, kind, id, globs },
    }: (typeof contexts)[number]["data"]["sessionLoads"][number]) =>
      [
        `  ${tokens.toLocaleString("en-US").padStart(7)}  ${kind.padEnd(8)} ${id}`,
        ...(globs === undefined ? [] : [`  ${globs.join(", ")}`]),
      ].join("");

    return {
      exitCode: EXIT_OK,
      resultText: contexts
        .flatMap(({ data: { agent, sessionLoads, fileLoads, totalTokens } }) => [
          `${agent} opens a session with:`,
          ...sessionLoads.map(loadLineOf),
          `  ${totalTokens.toLocaleString("en-US")} tokens in all, estimated.`,
          ...(fileLoads.length === 0
            ? []
            : ["", "Loaded when a file it names is touched, not in the total:", ...fileLoads.map(loadLineOf)]),
          "",
        ])
        .join("\n"),
    };
  }
}
