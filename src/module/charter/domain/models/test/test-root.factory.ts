import { DomainFault, FaultsByFile } from "../../../../shared/module.js";
import type { RawTestSuite } from "./raw-test-suite.js";
import { TestRoot } from "./test-root.js";
import { TestSuiteFactory } from "./test-suite.factory.js";
import type { TestSuite } from "./test-suite.js";

/** Makes one repository's self-regression tests out of the suites it keeps. */
export class TestRootFactory {
  /**
   * The one way the tests are read (FR-047): every use case asking about them
   * comes through here, so a test file is parsed in one place and one way.
   *
   * What reads as a suite is held under where it is kept; what does not
   * leaves its fault under that same place. So the tests always come back, and one
   * read names every bad file rather than the first (FR-009).
   */
  static create(rawTestSuites: readonly RawTestSuite[]): TestRoot {
    const testSuiteByFile: Record<string, TestSuite> = {};
    const faultsByFile: Record<string, readonly DomainFault[]> = {};

    const suiteNameByFile = Object.fromEntries(rawTestSuites.map(({ uri, name }) => [uri, name]));
    // Read in the order the paths sort in, whatever order they arrived in, so two
    // runs over one repository report in the same order (SC-007).
    for (const { uri, text } of [...rawTestSuites].sort((leftTestSuite, rightTestSuite) =>
      leftTestSuite.uri.localeCompare(rightTestSuite.uri),
    )) {
      try {
        testSuiteByFile[uri] = TestSuiteFactory.create(text);
      } catch (raisedValue) {
        // A file not reading is this file being wrong; anything else is not ours
        // to swallow.
        if (!(raisedValue instanceof DomainFault)) throw raisedValue;
        faultsByFile[uri] = [raisedValue];
      }
    }

    return new TestRoot(testSuiteByFile, new FaultsByFile(faultsByFile), suiteNameByFile);
  }

  private constructor() {}
}
