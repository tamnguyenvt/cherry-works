import type { EvalCase } from "../domain/models/eval/EvalSuite.js";
import { EvalCaseReport } from "../domain/services/evalService.js";
import type { ForRunningPromptfoo, PromptfooAssertion } from "../port/zdriven/ForRunningPromptfoo.js";

/**
 * How one case came out, run and graded by promptfoo in this working folder
 * (EVAL-FR-020 – EVAL-FR-024): the case said as a promptfoo test — a skill as
 * `skill-used`, a guide as an `agent-rubric` an agent grader holds what the
 * agent did to, at most a number of tokens as a JavaScript check of the
 * tokens the agent used — and what promptfoo graded read back as the case's
 * report. Nothing is graded here.
 */
export async function runWithPromptfoo(
  promptfooRunner: ForRunningPromptfoo,
  workingFolder: URL,
  suiteName: string,
  evalCase: EvalCase,
  guideBody: string | undefined,
): Promise<EvalCaseReport> {
  const { invoke: skillId, follow: guideId, maxTokens } = evalCase.expect;
  const assertions: PromptfooAssertion[] = [
    ...(skillId === undefined ? [] : [{ type: "skill-used" as const, value: skillId }]),
    ...(guideId === undefined || guideBody === undefined
      ? []
      : [
          {
            type: "agent-rubric" as const,
            // promptfoo renders an assertion's value as a nunjucks template, so
            // the guide goes in raw: what reads as a template in it is text.
            value: `The agent followed the guide "${guideId}" in what it did and in every file it wrote:\n\n{% raw %}${guideBody.trim()}{% endraw %}`,
          },
        ]),
    ...(maxTokens === undefined
      ? []
      : [
          {
            type: "javascript" as const,
            value: [
              "const total = context.providerResponse?.tokenUsage?.total ?? 0;",
              `const isWithin = total <= ${maxTokens};`,
              `return { pass: isWithin, score: isWithin ? 1 : 0, reason: isWithin ? "The agent used " + total.toLocaleString("en-US") + " tokens." : "The agent used " + total.toLocaleString("en-US") + " tokens, more than the ${maxTokens.toLocaleString("en-US")} this case allows." };`,
            ].join("\n"),
          },
        ]),
  ];
  const { success, totalTokens, componentResults, error } = await promptfooRunner.evaluate({
    description: `${suiteName}: ${evalCase.prompt}`,
    prompt: evalCase.prompt,
    workingFolder,
    assertions,
  });
  const unmetReasons = componentResults
    .filter(({ pass }) => !pass)
    .map(({ assertionType, reason }) => (assertionType === "agent-rubric" ? `"${guideId}" was not followed: ${reason}` : reason));
  // A case promptfoo could not run has no grading to say: its error is why.
  if (!success && unmetReasons.length === 0) unmetReasons.push(error ?? "promptfoo failed this case without saying why.");
  return new EvalCaseReport(suiteName, evalCase.prompt, totalTokens, unmetReasons);
}
