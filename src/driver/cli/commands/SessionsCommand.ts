import { EXIT_OK, type Command, type Context, type OptionSpec, type Options, type Outcome } from "./Command.js";

const SPAN = {
  since: {
    type: "string",
    describe: "Count the sessions whose last stop is on or after this day, YYYY-MM-DD; 31 days from it unless --until says",
  },
  until: {
    type: "string",
    describe: "Count the sessions whose last stop is on or before this day, YYYY-MM-DD; today unless --since says",
  },
} as const satisfies OptionSpec;

type Span = typeof SPAN;

/**
 * `cw sessions`: the sessions kept on this machine for this repository, summed
 * up by day and by session, in tokens, the largest first, over 31 days at
 * most (EVAL-FR-012, EVAL-FR-013, EVAL-FR-030).
 *
 * One line per day, its sessions under it, each with its model, its id and
 * the time of its last stop on this machine's clock; then the total. With none
 * kept, it says so, where it looked, and how one starts.
 */
export class SessionsCommand implements Command<Span> {
  readonly name = "sessions";
  readonly summary = "Sum up the tokens of the sessions kept on this machine, by day and by session";
  readonly options = SPAN;

  async run({ sessionReviewingApp }: Context, { since, until }: Options<Span>): Promise<Outcome> {
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
    } = await sessionReviewingApp.sessionSummary(since, until);

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
