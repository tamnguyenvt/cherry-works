import type { CharterRoot } from "../models/charter/CharterRoot.js";
import { EvalSuiteFault, FaultsByFile, type DomainFault } from "../models/DomainFault.js";
import type { EvalRoot } from "../models/eval/EvalSuite.js";

/** How one evaluation case came out: the file it is in, its prompt, the tokens
 *  the agent used, and every expectation it did not meet, said (EVAL-FR-025). */
export class EvalCaseReport {
  constructor(
    readonly suiteName: string,
    readonly prompt: string,
    readonly tokens: number,
    readonly unmetReasons: readonly string[],
  ) {}

  get passed(): boolean {
    return this.unmetReasons.length === 0;
  }
}

/** How every case came out, in the order their files and cases were read, and
 *  the tokens of them all (EVAL-FR-025). */
export class EvalRunReport {
  constructor(readonly evalCaseReports: readonly EvalCaseReport[]) {}

  get totalTokens(): number {
    return this.evalCaseReports.reduce((tokens, evalCaseReport) => tokens + evalCaseReport.tokens, 0);
  }
}

/**
 * Every case naming what the charter does not hold, under the file it is in
 * (EVAL-FR-026): a skill to invoke that is no skill or playbook — a playbook is
 * invoked the way a skill is — and a guide to follow that is no guide. Asked
 * before any case runs, so a run spends nothing on a case that cannot pass.
 */
export function validateEvalRoot(charter: CharterRoot, evalRoot: EvalRoot): FaultsByFile {
  const faultsByFiles: Record<string, readonly DomainFault[]> = {};
  for (const [path, evalSuite] of Object.entries(evalRoot.suitesByFile)) {
    const faults = evalSuite.cases.flatMap(({ expect: { invoke: skillId, follow: guideId } }) => {
      const skillPrimitive = skillId === undefined ? undefined : charter.primitiveById.get(skillId);
      const guidePrimitive = guideId === undefined ? undefined : charter.primitiveById.get(guideId);
      return [
        ...(skillId === undefined || skillPrimitive?.kind === "skill" || skillPrimitive?.kind === "playbook"
          ? []
          : [
              skillPrimitive === undefined
                ? new EvalSuiteFault(`This charter holds no skill or playbook called "${skillId}".`, `Author it, or correct the name. "cw list skill" says every skill this charter holds.`)
                : new EvalSuiteFault(`"${skillId}" is a ${skillPrimitive.kind}, and a case invokes a skill or a playbook.`, `Name a skill or a playbook under "invoke".`),
            ]),
        ...(guideId === undefined || guidePrimitive?.kind === "guide"
          ? []
          : [
              guidePrimitive === undefined
                ? new EvalSuiteFault(`This charter holds no guide called "${guideId}".`, `Author it, or correct the name. "cw list guide" says every guide this charter holds.`)
                : new EvalSuiteFault(`"${guideId}" is a ${guidePrimitive.kind}, and a case follows a guide.`, `Name a guide under "follow".`),
            ]),
      ];
    });
    if (faults.length > 0) faultsByFiles[path] = faults;
  }
  return new FaultsByFile(faultsByFiles);
}
