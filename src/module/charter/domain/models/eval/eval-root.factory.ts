import { EvalRoot } from "./eval-root.js";
import type { EvalSuite } from "./eval-suite.js";
import type { RawEvalSuite } from "./raw-eval-suite.js";
import { DomainFault, FaultsByFile } from "../../../../shared/module.js";
import { EvalSuiteFactory } from "./eval-suite.factory.js";

/** Makes a repository's evaluation cases out of the suites it keeps. */
export class EvalRootFactory {
  /** The one way the evaluation files are read: each one that reads under its
   *  path, each one that does not with its fault, so one read names every bad
   *  file (FR-009). */
  static create(rawEvalSuites: readonly RawEvalSuite[]): EvalRoot {
    const suitesByFile: Record<string, EvalSuite> = {};
    const faultsByFile: Record<string, readonly DomainFault[]> = {};
    const suiteNameByFile = Object.fromEntries(rawEvalSuites.map(({ uri, name }) => [uri, name]));
    const suiteTextByFile = Object.fromEntries(rawEvalSuites.map(({ uri, text }) => [uri, text]));
    for (const { uri, text } of [...rawEvalSuites].sort((leftEvalSuite, rightEvalSuite) => leftEvalSuite.uri.localeCompare(rightEvalSuite.uri))) {
      try {
        suitesByFile[uri] = EvalSuiteFactory.create(text);
      } catch (suiteError) {
        if (!(suiteError instanceof DomainFault)) throw suiteError;
        faultsByFile[uri] = [suiteError];
      }
    }
    return new EvalRoot(suitesByFile, new FaultsByFile(faultsByFile), suiteNameByFile, suiteTextByFile);
  }

  private constructor() {}
}
