import type { CharterRoot } from "../models/charter/CharterRoot.js";
import { BUILTIN_LAYER } from "../models/charter/PrimitiveLayer.js";
import { FaultsByFile, TestCaseFault, type DomainFault } from "../models/DomainFault.js";
import type { TestCase } from "../models/test/TestCase.js";
import type { TestSuite } from "../models/test/TestSuite.js";
import type { TestRoot } from "../models/test/TestRoot.js";
import { matches } from "../../utils/globs.js";

/**
 * How one case came out: the test file it is in, the situation it put, said as
 * a line, and why the charter did not answer it where it did not (FR-048).
 *
 * A case passes when there is nothing unmet, so it is asked of the outcome
 * rather than worked out again by whoever reports it. There is one fault and not
 * a list, because a case expects one thing of one situation — and it is a fault
 * like any other, saying what is wrong and what the next move is, so a failing
 * case reads the way every other thing this engine refuses reads (SC-003).
 */
export class TestCaseReport {
  constructor(
    readonly suiteName: string,
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
 * Every case of one suite, resolved against this charter, each under the name
 * of the file it is in (FR-048).
 *
 * Nothing is run, nothing is fetched and no agent is asked: each of the three
 * questions a case may put is decided by matching what an author declared
 * against what the situation holds (FR-049).
 */
export function runSuite(charter: CharterRoot, suiteName: string, suite: TestSuite): readonly TestCaseReport[] {
  return suite.cases.map((one) => runCase(charter, suiteName, one));
}

/**
 * Every guide and sensor no case names, each a warning under its own file
 * (FR-014): a rule nothing pins down is one that can stop doing what it did
 * without a run noticing.
 *
 * Named is what a case's `activatedId` says, whichever layer the
 * primitive came from. A posture is not asked about: a case putting whether a
 * file is allowed names none, and a `deny` may name a command no case can
 * touch.
 */
export function validateTestRoot(charter: CharterRoot, testRoot: TestRoot): FaultsByFile {
  const testedIds = new Set<string | undefined>(Object.values(testRoot.suitesByFile).flatMap((testSuite) => testSuite.cases.map((one) => one.activatedId)));
  const faultsByFiles: Record<string, readonly DomainFault[]> = {};
  for (const primitive of charter.primitives) {
    const { file } = primitive;
    const { id } = primitive.headers;
    // The engine's own are tested where the engine is, as a vendor's are in its
    // own repository.
    if ((primitive.kind !== "guide" && primitive.kind !== "sensor") || testedIds.has(id) || primitive.layerName === BUILTIN_LAYER) continue;
    faultsByFiles[file] = [
      new TestCaseFault(
        `No test case names "${id}", so nothing notices when it stops coming up where it should.`,
        primitive.kind === "guide"
          ? `Add a case to a file under .cw/test/: { "do": { "touchFile": "<a file it speaks about>" }, "expect": { "activate": "${id}" } }.`
          : `Add a case to a file under .cw/test/: { "when": "${primitive.headers.signal}", "expect": { "run": "${id}" } }.`,
        "warn",
      ),
    ];
  }
  return new FaultsByFile(faultsByFiles);
}

/** One case, resolved: the situation put to the charter, and what it made of
 *  it. Which of the three it is falls out of what it holds — a touched file or
 *  a raised event, an activation or a permission — which is what the file it
 *  was written in holds too. */
export function runCase(charter: CharterRoot, suiteName: string, one: TestCase): TestCaseReport {
  const written = one.written;
  if ("when" in written) {
    return new TestCaseReport(suiteName, one.describe(), assertScriptRun(charter, written.when, written.expect.run));
  }

  if ("do" in written) {
    const { touchFile } = written.do;
    if ("activate" in written.expect) {
      return new TestCaseReport(suiteName, one.describe(), assertPrimitiveActivated(charter, touchFile, written.expect.activate));
    }
    if ("allow" in written.expect) {
      return new TestCaseReport(suiteName, one.describe(), assertAllowed(charter, touchFile, written.expect.allow));
    }
  }

  throw new Error(`Never happen`)
}

/** Why a touched file did not bring this guide up, or nothing where it did.
 *
 *  Activating on a touched file is a guide's own rule, so an id of any
 *  other kind is the case asking the charter for something that kind never
 *  does — said as that rather than as a glob that did not match (FR-004).
 *  A guide naming no files comes up every turn, so any file brings it up. */
function assertPrimitiveActivated(charter: CharterRoot, file: string, id: string): TestCaseFault | undefined {
  const declared = charter.primitiveById.get(id);
  if (declared === undefined) return primitiveNotFound(id);
  if (declared.kind !== "guide")
    return new TestCaseFault(
      `Coming up when a file is touched is a guide's rule, and "${id}" is a ${declared.kind}.`,
      `Expect a guide here, or put the situation that kind answers.`,
    );

  const { globs = [] } = declared.headers;
  if (globs.length === 0) return undefined;
  return globs.some((glob) => matches(glob, file))
    ? undefined
    : new TestCaseFault(
        `This file matches none of the globs "${id}" speaks about: ${globs.join(", ")}.`,
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
    (primitive) => primitive.kind === "posture" && primitive.headers.deny.some((glob) => matches(glob, file)),
  );
  if (expected)
    return denying.length === 0
      ? undefined
      : new TestCaseFault(
          `${denying.map((one) => `"${one.headers.id}"`).join(", ")} denies this file.`,
          `Drop it from that posture's "deny", or expect "allow": false.`,
        );

  const postures = charter.primitives.filter((primitive) => primitive.kind === "posture");
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
function assertScriptRun(charter: CharterRoot, event: string, id: string): TestCaseFault | undefined {
  const declared = charter.primitiveById.get(id);
  if (declared === undefined) return primitiveNotFound(id);
  if (declared.kind !== "sensor")
    return new TestCaseFault(
      `Running when an event is raised is a sensor's rule, and "${id}" is a ${declared.kind}.`,
      `Expect a sensor here, or put the situation that kind answers.`,
    );

  const { signal } = declared.headers;
  return signal === event
    ? undefined
    : new TestCaseFault(
        `"${id}" fires on ${signal}, not on ${event}.`,
        `Raise the event it names, or declare the "signal" this case raises.`,
      );
}

/**
 * An id the charter holds nothing of, which is unmet rather than passed
 * over.
 *
 * The half of a case's correctness the format left open (FR-047): whether a
 * case is written as a case is the file's own business, and whether the names
 * in it answer to anything takes the whole charter. An expectation about a
 * primitive that is not there would otherwise be an expectation about nothing —
 * which is the one way a test goes quiet exactly when the charter changed under
 * it.
 */
function primitiveNotFound(id: string): TestCaseFault {
  return new TestCaseFault(
    `This charter holds no primitive called "${id}".`,
    `Author it, or correct the name. "cw list --min" says every id this charter does hold.`,
  );
}

