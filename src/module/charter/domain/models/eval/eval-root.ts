import { FaultsByFile } from "../../../../shared/module.js";
import type { EvalSuite } from "./eval-suite.js";

/** One repository's evaluation files, read: every suite under the file it came
 *  from, and why each file that did not read did not. */
export class EvalRoot {
  constructor(
    /** Every suite that reads, under its path, in the order the paths sort in. */
    readonly evalSuiteByFile: Readonly<Record<string, EvalSuite>>,
    readonly faultsByFiles: FaultsByFile,
    /** What each evaluation file is reported under, under its file: the name
     *  its store gave it. */
    readonly suiteNameByFile: Readonly<Record<string, string>>,
    /** What each evaluation file holds, under its file, whether it reads or
     *  not: what its author opens to edit. */
    readonly suiteTextByFile: Readonly<Record<string, string>>,
    /** The charter each evaluation file is kept in, under its file
     *  (VENDOR-FR-009). */
    readonly suiteCharterByFile: Readonly<Record<string, string>>,
  ) {}

  /** Whether an evaluation file is under this name in this charter, whether it
   *  reads or not. A name no store gave is no name of one. */
  hasEvalSuiteNamed(charterName: string, name: string): boolean {
    return Object.keys(this.suiteNameByFile).some(
      (suiteUri) => this.suiteNameByFile[suiteUri] === name && this.suiteCharterByFile[suiteUri] === charterName,
    );
  }

  /** The same evaluation files, but for those kept in this charter
   *  (VENDOR-FR-025). */
  filterByCharter(charterName: string): EvalRoot {
    const isInCharter = (suiteUri: string) => this.suiteCharterByFile[suiteUri] === charterName;
    const pickInCharter = <Value>(valueByFile: Readonly<Record<string, Value>>) =>
      Object.fromEntries(Object.entries(valueByFile).filter(([suiteUri]) => isInCharter(suiteUri)));
    return new EvalRoot(
      pickInCharter(this.evalSuiteByFile),
      new FaultsByFile(pickInCharter(this.faultsByFiles.faultsByFilePath)),
      pickInCharter(this.suiteNameByFile),
      pickInCharter(this.suiteTextByFile),
      pickInCharter(this.suiteCharterByFile),
    );
  }

  /** What an evaluation file is reported under: its name in its charter, after
   *  the charter's (VENDOR-FR-009). */
  reportedNameOf(suiteUri: string): string {
    return `${this.suiteCharterByFile[suiteUri] ?? ""}/${this.suiteNameByFile[suiteUri] ?? suiteUri}`;
  }

  /** What a new evaluation file of this charter is named: `untitled-<n>.json`
   *  for the first `n` no evaluation file of it has, as a new test file is
   *  (FR-091). */
  findUntitledName(charterName: string): string {
    let untitledNumber = 1;
    while (this.hasEvalSuiteNamed(charterName, `untitled-${untitledNumber}.json`)) untitledNumber++;
    return `untitled-${untitledNumber}.json`;
  }

  /** No suite read and none refused: nothing was written to evaluate. */
  get isEmpty(): boolean {
    return Object.keys(this.evalSuiteByFile).length === 0 && this.faultsByFiles.isEmpty;
  }
}
