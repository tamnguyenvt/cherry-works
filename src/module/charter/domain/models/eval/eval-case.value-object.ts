import { z } from "#module/shared/module.js";
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
            filePath
              .split("/")
              .every((pathSegment) => pathSegment.length > 0 && pathSegment !== "." && pathSegment !== "..") &&
            // biome-ignore lint/suspicious/noControlCharactersInRegex: a control character in a path is what this refuses.
            !/[\x00-\x1f\x7f-\x9f{}]/.test(filePath),
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

/** One case of an evaluation file, as `EvalCaseSchema` read it: the prompt
 *  put to the agent and what is expected of it. A value the suite holds, made
 *  where the suite is read and by nothing else. */
export class EvalCase {
  readonly prompt: string;
  readonly expect: z.infer<typeof EvalCaseSchema>["expect"];

  constructor(evalCase: Pick<EvalCase, "prompt" | "expect">) {
    this.prompt = evalCase.prompt;
    this.expect = evalCase.expect;
  }

  static get schema(): typeof EvalCaseSchema {
    return EvalCaseSchema;
  }
}
