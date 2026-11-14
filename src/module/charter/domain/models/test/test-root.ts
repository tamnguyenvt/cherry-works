import type { FaultsByFile } from "../../../../shared/module.js";
import type { TestSuite } from "./test-suite.js";

/**
 * One repository's self-regression tests, read: every suite under the file it
 * came from, and why each file that did not read did not.
 *
 * Every question about the tests as a whole is asked of it here — which names
 * are taken, which name a new file takes — so nothing outside works a name out
 * of a path by hand.
 */
export class TestRoot {
  constructor(
    /** Every suite that reads, under its file, in the order their paths sort
     *  in. */
    readonly testSuiteByFile: Readonly<Record<string, TestSuite>>,
    /** The files that were meant to be suites and could not be read as one,
     *  and why. Held rather than raised: a run is refused for them, and a
     *  listing still shows them (FR-088). */
    readonly faultsByFiles: FaultsByFile,
    /** What each test file is asked for by, under its file, whether it reads
     *  or not: the name its store gave it, never one worked out here. */
    readonly suiteNameByFile: Readonly<Record<string, string>>,
  ) {}

  /** Whether a test file is under this name, whether it reads or not. A name
   *  no store gave, one reaching outside the tests among them, is no name of
   *  one. */
  hasTestSuiteNamed(name: string): boolean {
    return Object.values(this.suiteNameByFile).includes(name);
  }

  /** What a new test file is named: `untitled-<n>.json` for the first `n` no
   *  test file has (FR-091). */
  get untitledName(): string {
    let untitledNumber = 1;
    while (this.hasTestSuiteNamed(`untitled-${untitledNumber}.json`)) untitledNumber++;
    return `untitled-${untitledNumber}.json`;
  }
}
