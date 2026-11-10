import type { FaultsByFile } from "../../../../shared/module.js";
import type { EvalSuite } from "./eval-suite.js";

/** One repository's evaluation files, read: every suite under the file it came
 *  from, and why each file that did not read did not. */
export class EvalRoot {
  constructor(
    /** Every suite that reads, under its path, in the order the paths sort in. */
    readonly suitesByFile: Readonly<Record<string, EvalSuite>>,
    readonly faultsByFiles: FaultsByFile,
    /** What each evaluation file is reported under, under its file: the name
     *  its store gave it. */
    readonly suiteNameByFile: Readonly<Record<string, string>>,
    /** What each evaluation file holds, under its file, whether it reads or
     *  not: what its author opens to edit. */
    readonly suiteTextByFile: Readonly<Record<string, string>>,
  ) {}

  /** Whether an evaluation file is under this name, whether it reads or not.
   *  A name no store gave is no name of one. */
  hasEvalSuiteNamed(name: string): boolean {
    return Object.values(this.suiteNameByFile).includes(name);
  }

  /** What a new evaluation file is named: `untitled-<n>.json` for the first
   *  `n` no evaluation file has, as a new test file is (FR-091). */
  get untitledName(): string {
    let untitledNumber = 1;
    while (this.hasEvalSuiteNamed(`untitled-${untitledNumber}.json`)) untitledNumber++;
    return `untitled-${untitledNumber}.json`;
  }

  /** No suite read and none refused: nothing was written to evaluate. */
  get isEmpty(): boolean {
    return Object.keys(this.suitesByFile).length === 0 && this.faultsByFiles.isEmpty;
  }
}
