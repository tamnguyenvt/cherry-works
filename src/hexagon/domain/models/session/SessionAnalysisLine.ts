import { z } from "zod";

/** One stop of one session, as `session-tokens-counter` keeps it on a line of
 *  its own (EVAL-FR-008, EVAL-FR-009): when, which repository and model, and
 *  its tokens by kind so far, its subagents' included, and their total. */
export const SessionAnalysisLineSchema = z.object({
  time: z.string().refine((time) => !Number.isNaN(Date.parse(time))),
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

export type SessionAnalysisLine = z.infer<typeof SessionAnalysisLineSchema>;
