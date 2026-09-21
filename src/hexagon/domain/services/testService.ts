import type { CharterRoot } from "../models/charter/CharterRoot.js";
import { TestCaseFault } from "../models/Fault.js";
import type { TestCase, TestSuite } from "../models/TestSuite.js";
import { matches } from "../../utils/globs.js";

/**
 * How one case came out: the situation it put, said as a line, and why the
 * charter did not answer it where it did not (FR-048).
 *
 * A case passes when there is nothing unmet, so it is asked of the outcome
 * rather than worked out again by whoever reports it. There is one fault and not
 * a list, because a case expects one thing of one situation — and it is a fault
 * like any other, saying what is wrong and what the next move is, so a failing
 * case reads the way every other thing this engine refuses reads (SC-003).
 */
export class TestCaseReport {
  constructor(
    readonly situation: string,
    readonly unmet?: TestCaseFault,
  ) {}

  get passed(): boolean {
    return this.unmet === undefined;
  }}

/** How every case one repository wrote down came out, in the order its files
 *  and their cases were read (FR-050). */
export class TestRunReport {
  constructor(readonly testCaseReports: readonly TestCaseReport[]) {}
}

/**
 * Every case of one suite, resolved against this charter (FR-048).
 *
 * Nothing is run, nothing is fetched and no agent is asked: each of the three
 * questions a case may put is decided by matching what an author declared
 * against what the situation holds (FR-049).
 */
export function runSuite(charter: CharterRoot, suite: TestSuite): readonly TestCaseReport[] {
  return suite.cases.map((one) => runCase(charter, one));
}

/** One case, resolved: the situation put to the charter, and what it made of
 *  it. Which of the three it is falls out of what it holds — a touched file or
 *  a raised event, an activation or a permission — which is what the file it
 *  was written in holds too. */
export function runCase(charter: CharterRoot, one: TestCase): TestCaseReport {
  const written = one.written;
  if ("when" in written) {
    return new TestCaseReport(one.describe(), assertScriptRun(charter, written.when, written.expect.run));
  }

  if ("do" in written) {
    const { touchFile } = written.do;
    if ("activate" in written.expect) {
      return new TestCaseReport(one.describe(), assertPrimitiveActivated(charter, touchFile, written.expect.activate));
    }
    if ("allow" in written.expect) {
      return new TestCaseReport(one.describe(), assertAllowed(charter, touchFile, written.expect.allow));
    }
  }

  throw new Error(`Never happen`)
}

/** Why a touched file did not bring this guide up, or nothing where it did.
 *
 *  Activating on a touched file is a guide's own rule, so an identity of any
 *  other kind is the case asking the charter for something that kind never
 *  does — said as that rather than as a glob that did not match (FR-004). */
function assertPrimitiveActivated(charter: CharterRoot, file: string, identity: string): TestCaseFault | undefined {
  const declared = charter.primitiveById.get(identity);
  if (declared === undefined) return primitiveNotFound(identity);
  if (declared.primitive.kind !== "guide")
    return new TestCaseFault(
      `Coming up when a file is touched is a guide's rule, and "${identity}" is a ${declared.primitive.kind}.`,
      `Expect a guide here, or put the situation that kind answers.`,
    );

  const { globs = [] } = declared.primitive.headers;
  if (globs.length === 0)
    return new TestCaseFault(
      `"${identity}" names no files, so touching one never brings it up.`,
      `Give that guide "globs", or expect nothing of it here.`,
    );
  return globs.some((glob) => matches(glob, file))
    ? undefined
    : new TestCaseFault(
        `This file matches none of the globs "${identity}" speaks about: ${globs.join(", ")}.`,
        `Widen that guide's "globs", or touch a file it already speaks about.`,
      );
}

/**
 * Why the charter does not treat this file as the case expected, or nothing
 * where it does.
 *
 * A path is allowed unless a posture denies it: what a charter says nothing
 * about is left to the repository, and denial is the thing a posture is written
 * to say. So the question is asked of every posture at once — what may not be
 * touched here is what all of them deny between them — and a case expecting a
 * denial is told which one is missing, while a case expecting a file to be left
 * alone is told which posture took it.
 */
function assertAllowed(charter: CharterRoot, file: string, expected: boolean): TestCaseFault | undefined {
  const denying = charter.primitives.filter(
    ({ primitive }) => primitive.kind === "posture" && primitive.headers.deny.some((glob) => matches(glob, file)),
  );
  if (expected)
    return denying.length === 0
      ? undefined
      : new TestCaseFault(
          `${denying.map((one) => `"${one.identity}"`).join(", ")} denies this file.`,
          `Drop it from that posture's "deny", or expect "allow": false.`,
        );

  const postures = charter.primitives.filter(({ primitive }) => primitive.kind === "posture");
  if (postures.length === 0)
    return new TestCaseFault(
      `This charter holds no posture, so it refuses nothing.`,
      `Author a posture denying this file, or expect "allow": true.`,
    );
  return denying.length > 0
    ? undefined
    : new TestCaseFault(
        `No posture denies this file.`,
        `Add it to a posture's "deny", or expect "allow": true.`,
      );
}

/** Why a raised event did not run this sensor, or nothing where it did. */
function assertScriptRun(charter: CharterRoot, event: string, identity: string): TestCaseFault | undefined {
  const declared = charter.primitiveById.get(identity);
  if (declared === undefined) return primitiveNotFound(identity);
  if (declared.primitive.kind !== "sensor")
    return new TestCaseFault(
      `Running when an event is raised is a sensor's rule, and "${identity}" is a ${declared.primitive.kind}.`,
      `Expect a sensor here, or put the situation that kind answers.`,
    );

  const { signal } = declared.primitive.headers;
  return signal === event
    ? undefined
    : new TestCaseFault(
        `"${identity}" fires on ${signal}, not on ${event}.`,
        `Raise the event it names, or declare the "signal" this case raises.`,
      );
}

/**
 * An identity the charter holds nothing of, which is unmet rather than passed
 * over.
 *
 * The half of a case's correctness the format left open (FR-047): whether a
 * case is written as a case is the file's own business, and whether the names
 * in it answer to anything takes the whole charter. An expectation about a
 * primitive that is not there would otherwise be an expectation about nothing —
 * which is the one way a test goes quiet exactly when the charter changed under
 * it.
 */
function primitiveNotFound(identity: string): TestCaseFault {
  return new TestCaseFault(
    `This charter holds no primitive called "${identity}".`,
    `Author it, or correct the name. "cw list --min" says every identity this charter does hold.`,
  );
}

