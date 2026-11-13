import { z } from "#module/shared/module.js";
import { TestCase } from "./test-case.js";

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
const TestSuiteSchema = z.strictObject({
  description: z.string().min(1).optional(),
  cases: z.array(TestCase.schema.transform((writtenCase) => new TestCase(writtenCase))).min(1),
});

/** One test file, as `TestSuiteSchema` read it (FR-047): what it is about, the
 *  cases it pins down, and the body it was read from, as its author wrote it
 *  and the editor shows it (FR-124). Made by `TestSuiteFactory.create` and by
 *  nothing else. */
export class TestSuite {
  static get schema(): typeof TestSuiteSchema {
    return TestSuiteSchema;
  }

  static get defaultBody(): typeof DEFAULT_TEST_SUITE_BODY {
    return DEFAULT_TEST_SUITE_BODY;
  }

  /** A suite that reads, said on one line: what a file the schema refused is
   *  shown. */
  static get sampleText(): typeof SAMPLE {
    return SAMPLE;
  }

  constructor(
    readonly description: string | undefined,
    readonly cases: readonly TestCase[],
    readonly body: string,
  ) {}
}

/** What a file that reads holds, shown rather than described: the three shapes
 *  a case takes, which is the whole of what an author has to get right. A file
 *  the schema refused is handed this instead of a reading of what went wrong —
 *  the shapes are few enough that seeing one is the correction. */
const SAMPLE_CASES = [
  { do: { touchFile: "src/one.ts" }, expect: { activate: "no-any" } },
  { do: { touchFile: ".env" }, expect: { allow: false } },
  { when: "PreToolUse", expect: { run: "no-secrets" } },
];
// Said on one line, spaced as a person writes it.
const SAMPLE = JSON.stringify({ cases: SAMPLE_CASES }, undefined, 1).replace(/\n\s*/g, " ");

/** What a new test file holds: a description and the first case of the sample,
 *  so it reads as a suite from the start and its author edits rather than
 *  looks the format up (FR-091). */
const DEFAULT_TEST_SUITE_BODY = `${JSON.stringify({ description: "What these cases pin down.", cases: [SAMPLE_CASES[0]] }, null, 2)}\n`;
