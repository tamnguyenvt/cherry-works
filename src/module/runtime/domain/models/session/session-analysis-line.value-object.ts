import { z } from "#module/shared/module.js";

/** One stop of one session, as `cw-session-tokens-counter` keeps it on a line of
 *  its own (EVAL-FR-008, EVAL-FR-009): when, which repository and model, and
 *  its tokens by kind so far, its subagents' included, and their total. */
const SessionAnalysisLineSchema = z.object({
  time: z.string().refine((timeText) => !Number.isNaN(Date.parse(timeText))),
  sessionId: z.string(),
  repository: z.string(),
  model: z.string(),
  tokens: z.object({
    input: z.number(),
    output: z.number(),
    cacheWrite: z.number(),
    cacheRead: z.number(),
  }),
  total: z.number(),
});

/** One stop of one session, as `SessionAnalysisLineSchema` read it off a line
 *  of its log: a value the sessions' analysis holds, made where the log is
 *  read and by nothing else. */
export class SessionAnalysisLine {
  /** When the session stopped, as the line keeps it under its `time` key. */
  readonly stopTimeText: string;
  readonly sessionId: string;
  readonly repository: string;
  readonly model: string;
  readonly tokens: z.infer<typeof SessionAnalysisLineSchema>["tokens"];
  readonly total: number;

  constructor(sessionAnalysisLine: z.infer<typeof SessionAnalysisLineSchema>) {
    this.stopTimeText = sessionAnalysisLine.time;
    this.sessionId = sessionAnalysisLine.sessionId;
    this.repository = sessionAnalysisLine.repository;
    this.model = sessionAnalysisLine.model;
    this.tokens = sessionAnalysisLine.tokens;
    this.total = sessionAnalysisLine.total;
  }

  static get schema(): typeof SessionAnalysisLineSchema {
    return SessionAnalysisLineSchema;
  }
}
