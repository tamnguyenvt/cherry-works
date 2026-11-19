import { z } from "#module/shared/module.js";
import { EvalCase } from "./eval-case.value-object.js";

/** What an evaluation file may hold: what it is about, and its cases. JSON, as
 *  a test file is: nothing reads it but `cw eval`. Not a primitive
 *  (EVAL-FR-020). */
const EvalSuiteSchema = z.strictObject({
  description: z.string().min(1).optional(),
  cases: z.array(EvalCase.schema.transform((writtenCase) => new EvalCase(writtenCase))).min(1),
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
