import { InvalidEvalSuiteFault } from "../charter.fault.js";
import { EvalSuite } from "./eval-suite.js";

/** What a file that reads holds, shown rather than described. */
const SAMPLE = JSON.stringify({
  cases: [
    {
      prompt: "plan this feature: export a report",
      expect: { invoke: "sdd-plan", follow: "plain-names", maxTokens: 200000 },
    },
  ],
});

/** Makes one evaluation file's suite out of the text it holds. */
export class EvalSuiteFactory {
  /** The suite one evaluation file holds, or raised why it does not read. */
  static create(text: string): EvalSuite {
    let evalSuiteJson: unknown;
    try {
      evalSuiteJson = JSON.parse(text);
    } catch {
      throw new InvalidEvalSuiteFault(
        `This file is not JSON, so nothing can read the cases it was meant to hold.`,
        `Write it as ${SAMPLE}`,
        { internal: false },
      );
    }
    const evalSuiteParse = EvalSuite.schema.safeParse(evalSuiteJson);
    // A file expected read is refused naming it, before any case runs
    // (EVAL-FR-039).
    const readPathIssue = evalSuiteParse.error?.issues.find(({ path }) => path.at(-1) === "read");
    if (readPathIssue !== undefined) {
      const refusedReadPath = readPathIssue.path.reduce<unknown>(
        (jsonValue, pathKey) => (jsonValue as Record<PropertyKey, unknown>)[pathKey],
        evalSuiteJson,
      );
      throw new InvalidEvalSuiteFault(
        `A case expects ${JSON.stringify(refusedReadPath)} read, and it is no path of a file of this repository: one from its root, not empty, not absolute, never leaving it, with no control character, "\\", "{" or "}".`,
        `Name the file by its path from the repository's root, as in {"expect":{"read":"docs/guide.md"}}.`,
        { internal: false },
      );
    }
    if (!evalSuiteParse.success)
      throw new InvalidEvalSuiteFault(
        `This file is not written as a suite of evaluation cases.`,
        `Write it as ${SAMPLE}`,
        {
          internal: false,
        },
      );
    return new EvalSuite(evalSuiteParse.data.description, evalSuiteParse.data.cases, text);
  }

  private constructor() {}
}
