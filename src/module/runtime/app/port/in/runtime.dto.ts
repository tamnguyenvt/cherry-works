import { z } from "zod";
import { byType, dto, StringsSchema } from "../../../../shared/module.js";

/**
 * What the runtime module answers with: the calls it forwards, the evaluations
 * it runs and their log, the sessions it reads, and what came of running the
 * sensors, `…Outcome`. Each is `{ type, data }`, `type` its name exactly as
 * `RuntimeDTOs` keys it. Zod and nothing else.
 */

/** How one evaluation case came out: its file, its prompt, the tokens the
 *  agent used, and each expectation it did not meet (EVAL-FR-025). */
const EvalCaseReportSchema = dto(
  "EvalCaseReport",
  z.object({
    suiteName: z.string(),
    prompt: z.string(),
    passed: z.boolean(),
    tokens: z.number(),
    unmetReasons: z.array(z.string()).readonly(),
    logPath: z.string().optional(),
    sessionId: z.string().optional(),
    sessionPath: z.string().optional(),
  }),
);

/** How every evaluation case came out, and the tokens of them all. */
const EvalRunReportSchema = dto(
  "EvalRunReport",
  z.object({
    agent: z.string(),
    evalCaseReports: z.array(EvalCaseReportSchema).readonly(),
    totalTokens: z.number(),
  }),
);

/** Saved promptfoo case diagnostics, including verified agent session locations. */
const EvalLogAnalysisSchema = dto("EvalLogAnalysis", z.object({
  logs: z.array(z.object({
    logPath: z.string(), createdAt: z.string(), agent: z.string(),
    prompt: z.string(), workingFolderPath: z.string(), outputPath: z.string(),
    stdoutPath: z.string(), stderrPath: z.string(), success: z.boolean(), totalTokens: z.number(),
    unmetReasons: z.array(z.string()).readonly(), answer: z.string(), toolCalls: z.array(z.string()).readonly(),
    sessionId: z.string().optional(), sessionPath: z.string().optional(), error: z.string().optional(),
  })).readonly(),
}));

/** What a call answered: the mcp origin's answer as it came, or an error answer
 *  saying why no mcp origin was reached (FR-154). */
const ToolAnswerSchema = dto("ToolAnswer", z.record(z.string(), z.unknown()));

/** The sessions kept within a span, both its days counted in (EVAL-FR-012):
 *  each once at its last stop, the largest first, how many, and their total. */
const SessionSummarySchema = dto(
  "SessionSummary",
  z.object({
    span: z.object({ since: z.string(), until: z.string() }),
    sessions: z
      .array(
        z.object({
          sessionId: z.string(),
          model: z.string(),
          lastStopAt: z.string(),
          /** Its tokens by kind at that stop, which a cost is reckoned from
           *  (EVAL-FR-014). */
          tokens: z.object({ input: z.number(), output: z.number(), cacheWrite: z.number(), cacheRead: z.number() }),
          /** Its tokens so far, subagents included (EVAL-FR-008). */
          totalTokens: z.number(),
        }),
      )
      .readonly(),
    sessionCount: z.number(),
    totalTokens: z.number(),
  }),
);

/** What reading the sessions kept back found (EVAL-FR-012, EVAL-FR-013): the
 *  folder they are kept in on this machine, their summary over the span asked
 *  for, and the summary of each day in it. */
const SessionReviewOutcomeSchema = dto(
  "SessionReviewOutcome",
  z.object({
    sessionsFolder: z.string(),
    sessionSummary: SessionSummarySchema,
    /** The summary of each day a session's last stop fell on, keyed by the
     *  day, the largest day first. */
    dailySessionSummary: z.record(z.string(), SessionSummarySchema),
  }),
);

/** What running every sensor of one signal came to, as one command
 *  (CORE-FR-177, CORE-FR-178): the exit code, the one answer for the host, and
 *  the error output it is given. */
const SensorRunOutcomeSchema = dto(
  "SensorRunOutcome",
  z.object({
    exitCode: z.number(),
    answer: z.string(),
    problem: z.string(),
  }),
);

/** What one primitive, or the charter itself, puts into an agent's main
 *  context, in tokens, as the agent itself counted it; with the globs a file
 *  touched has to match, where it is loaded only then. */
const MainContextLoadSchema = dto(
  "MainContextLoad",
  z.object({
    id: z.string(),
    kind: z.string(),
    tokens: z.number(),
    globs: StringsSchema.optional(),
  }),
);

/** What a charter puts into one agent's main context, counted exactly: what
 *  is loaded when a session opens, the largest first, and their total; apart,
 *  what is loaded when a file is touched. */
const MainContextSchema = dto(
  "MainContext",
  z.object({
    agent: z.string(),
    isExact: z.boolean(),
    sessionLoads: z.array(MainContextLoadSchema).readonly(),
    fileLoads: z.array(MainContextLoadSchema).readonly(),
    totalTokens: z.number(),
  }),
);

/** The main context of every agent the repository compiles for. */
const MainContextsSchema = dto(
  "MainContexts",
  z.object({
    contexts: z.array(MainContextSchema).readonly(),
  }),
);

/** Every schema of this module's DTOs, under its name — the name it carries
 *  as `type` — in alphabetical order. */
export const RuntimeDTOs = byType(
  EvalCaseReportSchema,
  EvalLogAnalysisSchema,
  EvalRunReportSchema,
  MainContextSchema,
  MainContextLoadSchema,
  MainContextsSchema,
  SensorRunOutcomeSchema,
  SessionReviewOutcomeSchema,
  SessionSummarySchema,
  ToolAnswerSchema,
);

/** Every DTO's type, under its name: what its schema infers. */
export namespace RuntimeDTOs {
  export type EvalCaseReport = z.infer<typeof RuntimeDTOs.EvalCaseReport>;
  export type EvalLogAnalysis = z.infer<typeof RuntimeDTOs.EvalLogAnalysis>;
  export type EvalRunReport = z.infer<typeof RuntimeDTOs.EvalRunReport>;
  export type MainContext = z.infer<typeof RuntimeDTOs.MainContext>;
  export type MainContextLoad = z.infer<typeof RuntimeDTOs.MainContextLoad>;
  export type MainContexts = z.infer<typeof RuntimeDTOs.MainContexts>;
  export type SensorRunOutcome = z.infer<typeof RuntimeDTOs.SensorRunOutcome>;
  export type SessionReviewOutcome = z.infer<typeof RuntimeDTOs.SessionReviewOutcome>;
  export type SessionSummary = z.infer<typeof RuntimeDTOs.SessionSummary>;
  export type ToolAnswer = z.infer<typeof RuntimeDTOs.ToolAnswer>;
}
