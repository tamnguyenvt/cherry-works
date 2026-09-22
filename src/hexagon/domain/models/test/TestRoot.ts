import { TEST_DIRECTORY } from "../../path.js";
import { Fault, FaultsByFile } from "../Fault.js";
import { testSuiteOf, type TestSuite } from "./TestSuite.js";

/** One file under `.cw/test/`, at the path a user would name it by, and what it
 *  holds. Only the file: what it says is `testRootOf`'s to read, and where the
 *  folder is on disk is the service's business. */
export interface TestSuiteFile {
  readonly path: string;
  readonly contents: string;
}

/** What a test file is asked for by: its path under `.cw/test/`, as in
 *  `untitled-1.json` (FR-124). */
export function testSuiteNameOf(path: string): string {
  return path.slice(`${TEST_DIRECTORY}/`.length);
}

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
    readonly suitesByFile: Readonly<Record<string, TestSuite>>,
    /** The files that were meant to be suites and could not be read as one,
     *  and why. Held rather than raised: a run is refused for them, and a
     *  listing still shows them (FR-088). */
    readonly faultsByFiles: FaultsByFile,
  ) {}

  /** Whether a test file is under this name, whether it reads or not. A name
   *  reaching outside `.cw/test/` is no name of one. */
  hasTestSuiteNamed(name: string): boolean {
    const path = `${TEST_DIRECTORY}/${name}`;
    return path in this.suitesByFile || path in this.faultsByFiles.files;
  }

  /** What a new test file is named: `untitled-<n>.json` for the first `n` no
   *  test file has (FR-091). */
  get untitledName(): string {
    let untitledNumber = 1;
    while (this.hasTestSuiteNamed(`untitled-${untitledNumber}.json`)) untitledNumber++;
    return `untitled-${untitledNumber}.json`;
  }
}

/**
 * The one way the tests are read (FR-047): every use case asking about them
 * comes through here, so a test file is parsed in one place and one way.
 *
 * What reads as a suite is held under the file it came from; what does not
 * leaves its fault under that same file. So the tests always come back, and one
 * read names every bad file rather than the first (FR-009).
 */
export function testRootOf(testSuiteFiles: readonly TestSuiteFile[]): TestRoot {
  const suitesByFile: Record<string, TestSuite> = {};
  const faultsByFiles: Record<string, readonly Fault[]> = {};

  // Read in the order the paths sort in, whatever order they arrived in, so two
  // runs over one repository report in the same order (SC-007).
  for (const { path, contents } of [...testSuiteFiles].sort((one, another) => one.path.localeCompare(another.path))) {
    try {
      suitesByFile[path] = testSuiteOf(contents);
    } catch (raised) {
      // A file not reading is this file being wrong; anything else is not ours
      // to swallow.
      if (!(raised instanceof Fault)) throw raised;
      faultsByFiles[path] = [raised];
    }
  }

  return new TestRoot(suitesByFile, new FaultsByFile(faultsByFiles));
}
