import { z } from "zod";
import { CommonHeadersSchema } from "../charter/primitive/BasePrimitive.js";
import { DomainFault, EvalSuiteFault, FaultsByFile } from "../DomainFault.js";
import { EVAL_DIRECTORY } from "../../path.js";

/** The id a case expects, written as a primitive declares it (FR-172). */
const ExpectedIdSchema = CommonHeadersSchema.shape.id;

/**
 * What one evaluation case may say (EVAL-FR-020): a prompt put to the agent,
 * and what is expected of it — a skill invoked, a guide followed, at most a
 * number of tokens — at least one of the three.
 */
export const EvalCaseSchema = z.strictObject({
  prompt: z.string().min(1),
  expect: z
    .strictObject({
      invoke: ExpectedIdSchema.optional(),
      follow: ExpectedIdSchema.optional(),
      maxTokens: z.number().int().positive().optional(),
    })
    .refine(({ invoke, follow, maxTokens }) => invoke !== undefined || follow !== undefined || maxTokens !== undefined),
});

/** One case, as `EvalCaseSchema` read it. */
export type EvalCase = z.infer<typeof EvalCaseSchema>;

/** What an evaluation file may hold: what it is about, and its cases. JSON, as
 *  a test file is: nothing reads it but `cw eval`. Not a primitive, and a
 *  vendor's are not installed with it (EVAL-FR-020). */
export const EvalSuiteSchema = z.strictObject({
  description: z.string().min(1).optional(),
  cases: z.array(EvalCaseSchema).min(1),
});

/** One evaluation file, read. */
export type EvalSuite = z.infer<typeof EvalSuiteSchema>;

/** What a file that reads holds, shown rather than described. */
const SAMPLE = JSON.stringify({
  cases: [{ prompt: "plan this feature: export a report", expect: { invoke: "sdd-plan", follow: "plain-names", maxTokens: 200000 } }],
});

/** The suite one evaluation file holds, or raised why it does not read. */
export function evalSuiteOf(text: string): EvalSuite {
  let evalSuiteJson: unknown;
  try {
    evalSuiteJson = JSON.parse(text);
  } catch {
    throw new EvalSuiteFault(`This file is not JSON, so nothing can read the cases it was meant to hold.`, `Write it as ${SAMPLE}`);
  }
  const evalSuiteParse = EvalSuiteSchema.safeParse(evalSuiteJson);
  if (!evalSuiteParse.success)
    throw new EvalSuiteFault(`This file is not written as a suite of evaluation cases.`, `Write it as ${SAMPLE}`);
  return evalSuiteParse.data;
}

/** One file under `.cw/eval/`, at its path from the repository, and what it
 *  holds. */
export interface EvalSuiteFile {
  readonly path: string;
  readonly contents: string;
}

/** What an evaluation file is reported under: its path under `.cw/eval/`. */
export function evalSuiteNameOf(path: string): string {
  return path.slice(`${EVAL_DIRECTORY}/`.length);
}

/** One repository's evaluation files, read: every suite under the file it came
 *  from, and why each file that did not read did not. */
export class EvalRoot {
  constructor(
    /** Every suite that reads, under its path, in the order the paths sort in. */
    readonly suitesByFile: Readonly<Record<string, EvalSuite>>,
    readonly faultsByFiles: FaultsByFile,
  ) {}
}

/** The one way the evaluation files are read: each one that reads under its
 *  path, each one that does not with its fault, so one read names every bad
 *  file (FR-009). */
export function evalRootOf(evalSuiteFiles: readonly EvalSuiteFile[]): EvalRoot {
  const suitesByFile: Record<string, EvalSuite> = {};
  const faultsByFiles: Record<string, readonly DomainFault[]> = {};
  for (const { path, contents } of [...evalSuiteFiles].sort((one, another) => one.path.localeCompare(another.path))) {
    try {
      suitesByFile[path] = evalSuiteOf(contents);
    } catch (raised) {
      if (!(raised instanceof DomainFault)) throw raised;
      faultsByFiles[path] = [raised];
    }
  }
  return new EvalRoot(suitesByFile, new FaultsByFile(faultsByFiles));
}
