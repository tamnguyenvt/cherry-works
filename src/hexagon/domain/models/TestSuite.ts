import { z } from "zod";
import { SIGNALS } from "./charter/primitive/SensorPrimitive.js";
import { PRIMITIVE_IDENTITY_SCHEMA, type PrimitiveIdentity } from "./charter/primitive/Primitive.js";
import { TestSuiteFault } from "./Fault.js";

/**
 * What a case may say (FR-047).
 *
 * Three shapes, and only three, because only three things about a charter are
 * decided without an agent: a touched file matches a guide's globs, a raised
 * event is the one a sensor names, and a touched file is denied by a posture.
 * Everything else a charter holds — which skill a request wants, which agent
 * gets delegated to — is the agent's reading of words and not this engine's, so
 * it is not something a test here can assert (FR-049).
 *
 * An identity is `kind:id`, the way the whole charter names a primitive
 * (FR-014) — checked here against what an author typed rather than against what
 * a primitive declared. Every object is strict, and that is what closes the
 * set: a case holding both a `do` and a `when` is no branch of this union, and
 * neither is one raising an event and expecting a permission — an event touches no file for the charter
 * to allow or refuse. So the shapes nothing could ever answer do not exist to
 * be handled.
 */
export const TEST_CASE_SCHEMA = z.union([
  z.strictObject({
    do: z.strictObject({ touchFile: z.string().min(1) }),
    expect: z.union([
      z.strictObject({ activate: PRIMITIVE_IDENTITY_SCHEMA }),
      z.strictObject({ allow: z.boolean() }),
    ]),
  }),
  z.strictObject({
    when: z.enum(SIGNALS),
    expect: z.strictObject({ run: PRIMITIVE_IDENTITY_SCHEMA }),
  }),
]);

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
export const TEST_SUITE_SCHEMA = z.strictObject({
  description: z.string().min(1).optional(),
  cases: z.array(TEST_CASE_SCHEMA.transform((written) => new TestCase(written))).min(1),
});

/**
 * One situation a test pins down, and what the charter is expected to make of
 * it (FR-047).
 *
 * A class rather than the record the schema read, because two things are asked
 * of a case wherever one turns up — the situation it puts, which a run reports
 * it under, and the identity it names, which an explanation finds it by
 * (FR-014, FR-048) — and neither is worth working out from the three shapes
 * twice. Every case the schema reads is made one, so nothing downstream meets
 * the record on its own.
 *
 * What was written is kept as it was read: which of the three shapes a case is
 * decides how it resolves, and that is the resolver's question to ask of it.
 */
export class TestCase {
  constructor(readonly written: z.infer<typeof TEST_CASE_SCHEMA>) {}

  /** The situation it puts, said as a line: what a run reports it under, and
   *  what an explanation names it by (FR-048, FR-014). */
  describe(): string {
    const written = this.written;
    if ("when" in written) return `firing event ${written.when} runs ${written.expect.run}`;
    const { touchFile } = written.do;
    if ("activate" in written.expect) return `touching ${touchFile} activates ${written.expect.activate}`;
    return `touching ${touchFile} is ${written.expect.allow ? "allowed" : "denied"}`;
  }

  /**
   * Which primitive this case expects to be activated: the sensor a raised event
   * is expected to run, or the guide a touched file is expected to bring up
   * (FR-014).
   *
   * Nothing for the third shape. That one expects a touched file to be allowed
   * or denied, which every posture in the charter answers between them, so it
   * activates no one primitive by name.
   */
  get activatedIdentity(): PrimitiveIdentity | undefined {
    if ("when" in this.written) return this.written.expect.run;
    if ("activate" in this.written.expect) return this.written.expect.activate;
    return undefined;
  }
}

/** One test file, as `TEST_SUITE_SCHEMA` read it (FR-047): what it is about, and the
 *  cases it pins down. Made by `testSuiteOf` and by nothing else. */
export class TestSuite {
  constructor(
    readonly description: string | undefined,
    readonly cases: readonly TestCase[],
  ) {}}

/** What a file that reads holds, shown rather than described: the three shapes
 *  a case takes, which is the whole of what an author has to get right. A file
 *  the schema refused is handed this instead of a reading of what went wrong —
 *  the shapes are few enough that seeing one is the correction. */
const SAMPLE = `{ "cases": [ { "do": { "touchFile": "src/one.ts" }, "expect": { "activate": "guide:no-any" } }, { "do": { "touchFile": ".env" }, "expect": { "allow": false } }, { "when": "PreToolUse", "expect": { "activate": "sensor:no-secrets" } } ] }`;

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

  const read = TEST_SUITE_SCHEMA.safeParse(written);
  if (!read.success) throw new TestSuiteFault(`This file is not written as a suite of cases.`, `Write it as ${SAMPLE}`);

  return new TestSuite(read.data.description, read.data.cases);
}
