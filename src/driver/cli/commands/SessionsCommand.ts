import { EXIT_OK, type Command, type Context, type OptionSpec, type Options, type Outcome } from "./Command.js";

const OPTIONS = {
  since: {
    type: "string",
    describe: "Count the sessions whose last stop is on or after this day, YYYY-MM-DD; 31 days from it unless --until says",
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
 * summary as it was answered, each session's tokens by kind included, for
 * `cw-session-cost` to price (EVAL-FR-014).
 */
export class SessionsCommand implements Command<typeof OPTIONS> {
  readonly name = "sessions";
  readonly summary = "Sum up the tokens of the sessions kept on this machine, by day and by session";
  readonly options = OPTIONS;

  async run({ sessionReviewingApp }: Context, { since, until, json: isJson }: Options<typeof OPTIONS>): Promise<Outcome> {
    const sessionReviewOutcome = await sessionReviewingApp.sessionSummary(since, until);
    if (isJson) return { code: EXIT_OK, result: `${JSON.stringify(sessionReviewOutcome, null, 2)}\n` };

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
    } = sessionReviewOutcome;

    if (sessionCount === 0)
      return {
        code: EXIT_OK,
        result: `No session has been kept for this repository from ${sinceDay} until ${untilDay}, in ${sessionsFolder}.\nOne is kept each time the agent stops, once "cw build" has built the charter for claude.\n`,
      };

    const tokensText = (tokenCount: number) => tokenCount.toLocaleString("en-US");
    return {
      code: EXIT_OK,
      result: [
        ...Object.entries(dailySessionSummary).flatMap(([day, { data: { sessions: daySessions, sessionCount: daySessionCount, totalTokens: dayTokens } }]) => [
          `${day}  ${tokensText(dayTokens)} tokens, ${daySessionCount} session${daySessionCount === 1 ? "" : "s"}`,
          ...daySessions.map(({ sessionId, lastStopAt, model, totalTokens: sessionTokens }) => {
            const stopDate = new Date(lastStopAt);
            const stopTime = `${String(stopDate.getHours()).padStart(2, "0")}:${String(stopDate.getMinutes()).padStart(2, "0")}`;
            return `  ${tokensText(sessionTokens).padStart(11)}  ${model}  ${sessionId}  last stop ${stopTime}`;
          }),
        ]),
        `${tokensText(totalTokens)} tokens in all, ${sessionCount} session${sessionCount === 1 ? "" : "s"}, from ${sinceDay} until ${untilDay}.`,
        "",
      ].join("\n"),
    };
  }
}
