import { z } from "zod";
import { BasePrimitive } from "../primitive/base-primitive.js";

/** The id a case expects, written as a primitive declares it (FR-172). */
const ExpectedIdSchema = BasePrimitive.headersSchema().shape.id;

/**
 * What one evaluation case may say (EVAL-FR-020): a prompt put to the agent,
 * and what is expected of it — a skill invoked, a guide followed, at most a
 * number of tokens, or a file read — at least one expectation.
 */
const EvalCaseSchema = z.strictObject({
  prompt: z.string().min(1),
  expect: z
    .strictObject({
      invoke: ExpectedIdSchema.optional(),
      follow: ExpectedIdSchema.optional(),
      read: z
        .string()
        .min(1)
        .refine(
          (filePath) =>
            !filePath.startsWith("/") &&
            !filePath.includes("\\") &&
            !/^[A-Za-z]:/.test(filePath) &&
            filePath.split("/").every((part) => part.length > 0 && part !== "." && part !== "..") &&
            // biome-ignore lint/suspicious/noControlCharactersInRegex: a control character in a path is what this refuses.
            !/[\x00-\x1f{}]/.test(filePath),
          "Use a repository-relative file path without traversal or template delimiters.",
        )
        .optional(),
      maxTokens: z.number().int().positive().optional(),
    })
    .refine(
      ({ invoke, follow, read, maxTokens }) =>
        invoke !== undefined || follow !== undefined || read !== undefined || maxTokens !== undefined,
    ),
});

/** One case, as `EvalCaseSchema` read it. */
export type EvalCase = z.infer<typeof EvalCaseSchema>;

/** What an evaluation file may hold: what it is about, and its cases. JSON, as
 *  a test file is: nothing reads it but `cw eval`. Not a primitive, and a
 *  vendor's are not installed with it (EVAL-FR-020). */
const EvalSuiteSchema = z.strictObject({
  description: z.string().min(1).optional(),
  cases: z.array(EvalCaseSchema).min(1),
});

/** One evaluation file, as `EvalSuiteSchema` read it: what it is about, the
 *  cases it evaluates, and the body it was read from, as its author wrote it. Made by `EvalSuiteFactory.create` and by nothing
 *  else. */
export class EvalSuite {
  static get schema(): typeof EvalSuiteSchema {
    return EvalSuiteSchema;
  }

  static get defaultBody(): typeof DEFAULT_EVAL_SUITE_BODY {
    return DEFAULT_EVAL_SUITE_BODY;
  }

  constructor(
    readonly description: string | undefined,
    readonly cases: readonly EvalCase[],
    readonly body: string,
  ) {}
}

/** What a new evaluation file holds: one case that reads, so its author edits
 *  rather than looks the format up, as a new test file does (FR-091). */
const DEFAULT_EVAL_SUITE_BODY = `${JSON.stringify({ description: "What these cases evaluate.", cases: [{ prompt: "plan this feature: export a report", expect: { invoke: "sdd-plan" } }] }, null, 2)}\n`;
