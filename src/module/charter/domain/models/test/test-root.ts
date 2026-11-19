import { FaultsByFile } from "../../../../shared/module.js";
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
    /** What each test file is asked for by in its charter, under its file,
     *  whether it reads or not: the name its store gave it, never one worked
     *  out here. */
    readonly suiteNameByFile: Readonly<Record<string, string>>,
    /** The charter each test file is kept in, under its file (VENDOR-FR-009). */
    readonly suiteCharterByFile: Readonly<Record<string, string>>,
  ) {}

  /** Whether a test file is under this name in this charter, whether it reads
   *  or not. A name no store gave, one reaching outside the tests among them,
   *  is no name of one. */
  hasTestSuiteNamed(charterName: string, name: string): boolean {
    return Object.keys(this.suiteNameByFile).some(
      (suiteUri) => this.suiteNameByFile[suiteUri] === name && this.suiteCharterByFile[suiteUri] === charterName,
    );
  }

  /** The same tests, but for the files kept in this charter (VENDOR-FR-024). */
  filterByCharter(charterName: string): TestRoot {
    const isInCharter = (suiteUri: string) => this.suiteCharterByFile[suiteUri] === charterName;
    const pickInCharter = <Value>(valueByFile: Readonly<Record<string, Value>>) =>
      Object.fromEntries(Object.entries(valueByFile).filter(([suiteUri]) => isInCharter(suiteUri)));
    return new TestRoot(
      pickInCharter(this.testSuiteByFile),
      new FaultsByFile(pickInCharter(this.faultsByFiles.faultsByFilePath)),
      pickInCharter(this.suiteNameByFile),
      pickInCharter(this.suiteCharterByFile),
    );
  }

  /** What a test file is reported under: its name in its charter, after the
   *  charter's (VENDOR-FR-009). */
  reportedNameOf(suiteUri: string): string {
    return `${this.suiteCharterByFile[suiteUri] ?? ""}/${this.suiteNameByFile[suiteUri] ?? suiteUri}`;
  }

  /** What a new test file of this charter is named: `untitled-<n>.json` for the
   *  first `n` no test file of it has (FR-091). */
  findUntitledName(charterName: string): string {
    let untitledNumber = 1;
    while (this.hasTestSuiteNamed(charterName, `untitled-${untitledNumber}.json`)) untitledNumber++;
    return `untitled-${untitledNumber}.json`;
  }
}
