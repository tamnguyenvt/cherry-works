import { type DomainFault, FaultsByFile } from "../../../shared/module.js";
import { matches } from "../libs/globs.lib.js";
import type { CharterRoot } from "../models/charter/charter-root.js";
import { TestCaseFault } from "../models/charter.fault.js";
import { PrimitiveLayer } from "../models/primitive/primitive-layer.js";
import type { TestCase } from "../models/test/test-case.js";
import type { TestRoot } from "../models/test/test-root.js";
import { TestCaseReport } from "../models/test/test-run-report.js";
import type { TestSuite } from "../models/test/test-suite.js";

/** Resolves the self-regression cases against a charter, and checks them. */
export class TestService {
  /**
   * Every case of one suite, resolved against this charter, each under the name
   * of the file it is in (FR-048).
   *
   * Nothing is run, nothing is fetched and no agent is asked: each of the three
   * questions a case may put is decided by matching what an author declared
   * against what the situation holds (FR-049).
   */
  static runSuite(charter: CharterRoot, suiteName: string, suite: TestSuite): readonly TestCaseReport[] {
    return suite.cases.map((testCase) => TestService.runCase(charter, suiteName, testCase));
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
  static validateTestRoot(charter: CharterRoot, testRoot: TestRoot): FaultsByFile {
    const testedIds = new Set<string | undefined>(
      Object.values(testRoot.suitesByFile).flatMap((testSuite) =>
        testSuite.cases.map((testCase) => testCase.activatedId),
      ),
    );
    const faultsByFiles: Record<string, readonly DomainFault[]> = {};
    for (const primitive of charter.primitives) {
      const { uri: primitiveUri } = primitive;
      const { id } = primitive.headers;
      // The engine's own are tested where the engine is, as a vendor's are in its
      // own repository.
      if (
        (primitive.kind !== "guide" && primitive.kind !== "sensor") ||
        testedIds.has(id) ||
        primitive.layerName === PrimitiveLayer.BUILTIN.name
      )
        continue;
      faultsByFiles[primitiveUri] = [
        new TestCaseFault(
          `No test case names "${id}", so nothing notices when it stops coming up where it should.`,
          primitive.kind === "guide"
            ? `Add a case to a file under .cw/charter/test/: { "do": { "touchFile": "<a file it speaks about>" }, "expect": { "activate": "${id}" } }.`
            : `Add a case to a file under .cw/charter/test/: { "when": "${primitive.headers.signal}", "expect": { "run": "${id}" } }.`,
          { severity: "warn", internal: false },
        ),
      ];
    }
    return new FaultsByFile(faultsByFiles);
  }

  /** One case, resolved: the situation put to the charter, and what it made of
   *  it. Which of the three it is falls out of what it holds — a touched file or
   *  a raised event, an activation or a permission — which is what the file it
   *  was written in holds too. */
  static runCase(charter: CharterRoot, suiteName: string, testCase: TestCase): TestCaseReport {
    const writtenCase = testCase.written;
    if ("when" in writtenCase) {
      return new TestCaseReport(
        suiteName,
        testCase.describe(),
        TestService.#findSensorFault(charter, writtenCase.when, writtenCase.expect.run),
      );
    }

    if ("do" in writtenCase) {
      const { touchFile } = writtenCase.do;
      if ("activate" in writtenCase.expect) {
        return new TestCaseReport(
          suiteName,
          testCase.describe(),
          TestService.#findActivationFault(charter, touchFile, writtenCase.expect.activate),
        );
      }
      if ("allow" in writtenCase.expect) {
        return new TestCaseReport(
          suiteName,
          testCase.describe(),
          TestService.#findPostureFault(charter, touchFile, writtenCase.expect.allow),
        );
      }
    }

    // The schema lets no other case through; one that reached here is the engine's fault.
    throw new TestCaseFault(
      "This case puts no situation the charter answers.",
      'Write it with "do" and "expect.activate" or "expect.allow", or with "when" and "expect.run".',
    );
  }

  /** Why a touched file did not bring this guide up, or nothing where it did.
   *
   *  Activating on a touched file is a guide's own rule, so an id of any
   *  other kind is the case asking the charter for something that kind never
   *  does — said as that rather than as a glob that did not match (FR-004).
   *  A guide naming no files comes up every turn, so any file brings it up. */
  static #findActivationFault(charter: CharterRoot, file: string, id: string): TestCaseFault | undefined {
    const declaredPrimitive = charter.primitiveById.get(id);
    if (declaredPrimitive === undefined) return TestService.#createUnknownPrimitiveFault(id);
    if (declaredPrimitive.kind !== "guide")
      return new TestCaseFault(
        `Coming up when a file is touched is a guide's rule, and "${id}" is a ${declaredPrimitive.kind}.`,
        `Expect a guide here, or put the situation that kind answers.`,
        { internal: false },
      );

    const { globs = [] } = declaredPrimitive.headers;
    if (globs.length === 0) return undefined;
    return globs.some((glob) => matches(glob, file))
      ? undefined
      : new TestCaseFault(
          `This file matches none of the globs "${id}" speaks about: ${globs.join(", ")}.`,
          `Widen that guide's "globs", or touch a file it already speaks about.`,
          { internal: false },
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
  static #findPostureFault(charter: CharterRoot, file: string, expected: boolean): TestCaseFault | undefined {
    const denyingPostures = charter.primitives.filter(
      (primitive) => primitive.kind === "posture" && primitive.headers.deny.some((glob) => matches(glob, file)),
    );
    if (expected)
      return denyingPostures.length === 0
        ? undefined
        : new TestCaseFault(
            `${denyingPostures.map((posture) => `"${posture.headers.id}"`).join(", ")} denies this file.`,
            `Drop it from that posture's "deny", or expect "allow": false.`,
            { internal: false },
          );

    const postures = charter.primitives.filter((primitive) => primitive.kind === "posture");
    if (postures.length === 0)
      return new TestCaseFault(
        `This charter holds no posture, so it refuses nothing.`,
        `Author a posture denying this file, or expect "allow": true.`,
        { internal: false },
      );
    return denyingPostures.length > 0
      ? undefined
      : new TestCaseFault(`No posture denies this file.`, `Add it to a posture's "deny", or expect "allow": true.`, {
          internal: false,
        });
  }

  /** Why a raised event did not run this sensor, or nothing where it did. */
  static #findSensorFault(charter: CharterRoot, event: string, id: string): TestCaseFault | undefined {
    const declaredPrimitive = charter.primitiveById.get(id);
    if (declaredPrimitive === undefined) return TestService.#createUnknownPrimitiveFault(id);
    if (declaredPrimitive.kind !== "sensor")
      return new TestCaseFault(
        `Running when an event is raised is a sensor's rule, and "${id}" is a ${declaredPrimitive.kind}.`,
        `Expect a sensor here, or put the situation that kind answers.`,
        { internal: false },
      );

    const { signal } = declaredPrimitive.headers;
    return signal === event
      ? undefined
      : new TestCaseFault(
          `"${id}" fires on ${signal}, not on ${event}.`,
          `Raise the event it names, or declare the "signal" this case raises.`,
          { internal: false },
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
  static #createUnknownPrimitiveFault(id: string): TestCaseFault {
    return new TestCaseFault(
      `This charter holds no primitive called "${id}".`,
      `Author it, or correct the name. "cw list --min" says every id this charter does hold.`,
      { internal: false },
    );
  }
}
