import type { CharterRoot } from "../models/charter/charter-root.js";
import { FaultsByFile, type DomainFault } from "../../../shared/module.js";
import type { EvalRoot } from "../models/eval/eval-root.js";
import { EvalSuiteFault } from "../models/charter.fault.js";

/** Checks the evaluation cases against a charter. */
export class EvalService {
  /**
   * Every case naming what the charter does not hold, under the file it is in
   * (EVAL-FR-026): a skill to invoke that is no skill or playbook — a playbook is
   * invoked the way a skill is — and a guide to follow that is no guide. Asked
   * before any case runs, so a run spends nothing on a case that cannot pass.
   */
  static validateEvalRoot(charter: CharterRoot, evalRoot: EvalRoot): FaultsByFile {
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
                  ? new EvalSuiteFault(`This charter holds no skill or playbook called "${skillId}".`, `Author it, or correct the name. "cw list skill" says every skill this charter holds.`, { internal: false })
                  : new EvalSuiteFault(`"${skillId}" is a ${skillPrimitive.kind}, and a case invokes a skill or a playbook.`, `Name a skill or a playbook under "invoke".`, { internal: false }),
              ]),
          ...(guideId === undefined || guidePrimitive?.kind === "guide"
            ? []
            : [
                guidePrimitive === undefined
                  ? new EvalSuiteFault(`This charter holds no guide called "${guideId}".`, `Author it, or correct the name. "cw list guide" says every guide this charter holds.`, { internal: false })
                  : new EvalSuiteFault(`"${guideId}" is a ${guidePrimitive.kind}, and a case follows a guide.`, `Name a guide under "follow".`, { internal: false }),
              ]),
        ];
      });
      if (faults.length > 0) faultsByFiles[path] = faults;
    }
    return new FaultsByFile(faultsByFiles);
  }

  /** Resolve a run's agent before any case can spend tokens. */
}
