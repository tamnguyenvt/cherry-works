import { z } from "zod";
import { TestCaseSchema, TestCase } from "./TestCase.js";
import { TestSuiteFault } from "../DomainFault.js";

/**
 * What a test file may hold, as the one shape everything else reads it through
 * (FR-047).
 *
 * Not a primitive, and nothing compiles it. A charter is what an agent is
 * instructed by; this is what says the charter still does what it did, so it
 * lives beside the charter rather than in it and is read only when tests run.
 * That is why it is JSON and not a document with frontmatter: nobody reads it
 * but `cw test`, and there is no body for an agent to open.
 */
export const TestSuiteSchema = z.strictObject({
  description: z.string().min(1).optional(),
  cases: z.array(TestCaseSchema.transform((written) => new TestCase(written))).min(1),
});

/** One test file, as `TestSuiteSchema` read it (FR-047): what it is about, the
 *  cases it pins down, and the body it was read from, as its author wrote it
 *  and the editor shows it (FR-124). Made by `testSuiteOf` and by nothing
 *  else. */
export class TestSuite {
  constructor(
    readonly description: string | undefined,
    readonly cases: readonly TestCase[],
    readonly body: string,
  ) {}}

/** What a file that reads holds, shown rather than described: the three shapes
 *  a case takes, which is the whole of what an author has to get right. A file
 *  the schema refused is handed this instead of a reading of what went wrong —
 *  the shapes are few enough that seeing one is the correction. */
const SAMPLE_CASES = [
  { do: { touchFile: "src/one.ts" }, expect: { activate: "guide:no-any" } },
  { do: { touchFile: ".env" }, expect: { allow: false } },
  { when: "PreToolUse", expect: { run: "sensor:no-secrets" } },
];
// Said on one line, spaced as a person writes it.
const SAMPLE = JSON.stringify({ cases: SAMPLE_CASES }, undefined, 1).replace(/\n\s*/g, " ");

/** What a new test file holds: a description and the first case of the sample,
 *  so it reads as a suite from the start and its author edits rather than
 *  looks the format up (FR-091). */
export const DEFAULT_TEST_SUITE_BODY = `${JSON.stringify({ description: "What these cases pin down.", cases: [SAMPLE_CASES[0]] }, null, 2)}\n`;

/**
 * The suite one test file holds (FR-047).
 *
 * Returns one, or raises why it did not read: a suite or nothing, never a half
 * of one beside a list of what is wrong.
 *
 * A file the schema refused is shown a suite that reads rather than told which
 * field of which case went wrong: a case is three shapes and a handful of
 * fields, so the sample is the correction, and there is no second description
 * of the format to keep in step with the schema.
 *
 * Whether the charter does what a case expects is not asked here. That takes
 * the whole charter, and comes of resolving the case.
 */
export function testSuiteOf(text: string): TestSuite {
  let written: unknown;
  try {
    // JSON is the language's own, so the hexagon reads it without a library and
    // without a port.
    written = JSON.parse(text);
  } catch {
    throw new TestSuiteFault(
      `This file is not JSON, so nothing can read the cases it was meant to hold.`,
      `Write it as ${SAMPLE}`,
    );
  }

  const read = TestSuiteSchema.safeParse(written);
  if (!read.success) throw new TestSuiteFault(`This file is not written as a suite of cases.`, `Write it as ${SAMPLE}`);

  return new TestSuite(read.data.description, read.data.cases, text);
}
