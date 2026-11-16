import {
  type Command,
  type Context,
  EXIT_FAILURE,
  EXIT_OK,
  type OptionSpec,
  type Options,
  type Outcome,
} from "./command.interface.js";
import { formatHeading, formatMention, layAnswerRows, printFault } from "./helper.js";

const OPTIONS = {
  since: {
    type: "string",
    describe:
      "Count the sessions whose last stop is on or after this day, YYYY-MM-DD; 31 days from it unless --until says",
  },
  until: {
    type: "string",
    describe: "Count the sessions whose last stop is on or before this day, YYYY-MM-DD; today unless --since says",
  },
  json: {
    type: "boolean",
    describe: "Print the summary as JSON, each session's tokens by kind included",
    default: false,
  },
} as const satisfies OptionSpec;

/**
 * `cw sessions`: the sessions kept on this machine for this repository, summed
 * up by day and by session, in tokens, the largest first, over 31 days at
 * most (EVAL-FR-012, EVAL-FR-013, EVAL-FR-030).
 *
 * One line per day, its sessions under it, each with its model, its id and
 * the time of its last stop on this machine's clock; then the total. With none
 * kept, it says so, where it looked, and how one starts. With `--json`, the
 * summary as it was answered, each session's tokens by kind included
 * (EVAL-FR-008).
 */
export class SessionsCommand implements Command<typeof OPTIONS> {
  readonly name = "sessions";
  readonly summary = "Sum up the tokens of the sessions kept on this machine, by day and by session";
  readonly options = OPTIONS;

  async runCommand(
    { charterRuntimeApp }: Context,
    { since, until, json: isJson }: Options<typeof OPTIONS>,
  ): Promise<Outcome> {
    const sessionReviewOutcomeDTO = await charterRuntimeApp.summarizeSessions(since, until);
    if (sessionReviewOutcomeDTO.type === "Fault")
      return { exitCode: EXIT_FAILURE, problemText: printFault(sessionReviewOutcomeDTO) };
    if (isJson) return { exitCode: EXIT_OK, resultText: `${JSON.stringify(sessionReviewOutcomeDTO, null, 2)}\n` };

    const {
      data: {
        sessionsFolder,
        sessionSummary: {
          data: {
            span: { since: sinceDay, until: untilDay },
            sessionCount,
            totalTokens,
          },
        },
        dailySessionSummary,
      },
    } = sessionReviewOutcomeDTO;

    if (sessionCount === 0)
      return {
        exitCode: EXIT_OK,
        resultText: `No session has been kept for this repository from ${sinceDay} until ${untilDay}, in ${formatMention(sessionsFolder)}.\nOne is kept each time the agent stops, once "cw build" has built the charter for claude.\n`,
      };

    const formatTokenCount = (tokenCount: number) => tokenCount.toLocaleString("en-US");
    return {
      exitCode: EXIT_OK,
      resultText: [
        ...Object.entries(dailySessionSummary).flatMap(
          ([
            day,
            {
              data: { sessions: daySessions, sessionCount: daySessionCount, totalTokens: dayTokenCount },
            },
          ]) => [
            formatHeading(
              `${day}  ${formatTokenCount(dayTokenCount)} tokens, ${daySessionCount} session${daySessionCount === 1 ? "" : "s"}`,
            ),
            // The tokens and the model in one column, the session and when it
            // last stopped in another.
            ...layAnswerRows(
              daySessions.map(({ sessionId, lastStopAt, model, totalTokens: sessionTokenCount }) => {
                const stopDate = new Date(lastStopAt);
                const stopTime = `${String(stopDate.getHours()).padStart(2, "0")}:${String(stopDate.getMinutes()).padStart(2, "0")}`;
                return [
                  `${formatTokenCount(sessionTokenCount).padStart(11)}  ${model}`,
                  `${formatMention(sessionId)}  last stop ${stopTime}`,
                ] as const;
              }),
            ),
          ],
        ),
        `${formatTokenCount(totalTokens)} tokens in all, ${sessionCount} session${sessionCount === 1 ? "" : "s"}, from ${sinceDay} until ${untilDay}.`,
        "",
      ].join("\n"),
    };
  }
}
