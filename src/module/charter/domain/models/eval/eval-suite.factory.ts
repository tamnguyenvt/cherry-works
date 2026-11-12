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
