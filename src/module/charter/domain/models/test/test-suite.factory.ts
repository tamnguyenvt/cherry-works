import { InvalidTestSuiteFault } from "../charter.fault.js";
import { TestSuite } from "./test-suite.js";

/** Makes the suite one test file holds. */
export class TestSuiteFactory {
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
  static create(text: string): TestSuite {
    let parsedJson: unknown;
    try {
      // JSON is the language's own, so the hexagon reads it without a library and
      // without a port.
      parsedJson = JSON.parse(text);
    } catch {
      throw new InvalidTestSuiteFault(
        `This file is not JSON, so nothing can read the cases it was meant to hold.`,
        `Write it as ${TestSuite.sampleText}`,
        { internal: false },
      );
    }

    const testSuiteParse = TestSuite.schema.safeParse(parsedJson);
    if (!testSuiteParse.success)
      throw new InvalidTestSuiteFault(
        `This file is not written as a suite of cases.`,
        `Write it as ${TestSuite.sampleText}`,
        {
          internal: false,
        },
      );

    return new TestSuite(testSuiteParse.data.description, testSuiteParse.data.cases, text);
  }

  private constructor() {}
}
