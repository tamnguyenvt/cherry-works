import { DomainFault, type Faults, type FaultsByFile } from "../domain/models/domain.fault.js";
import { DomainFaultFactory } from "../domain/models/domain-fault.factory.js";
import { FaultDTOs } from "./port/in/fault.dto.js";
import type { ForReportingProgress } from "./port/out/reporting-progress.port.js";

/**
 * The base of every use case: the application service of one driver port.
 *
 * It holds where an internal fault is logged for whoever runs the system, and
 * every operation of the port answers through `answerWithFaultDTO`, so nothing
 * it raises reaches the caller (SDK-FR-004).
 */
export abstract class ApplicationService {
  /** The fault a caller is told for a failure the system did not mean to say,
   *  in place of one that says how the system is set up: the same four fields
   *  wherever an internal fault is answered (SDK-FR-018). */
  static get internalFaultDTO(): FaultDTOs.Fault {
    return FaultDTOs.Fault.of({
      name: "InternalFault",
      message: "Something went wrong on our side.",
      fix: "Try again in a moment. If it keeps happening, tell whoever runs this system.",
      severity: "error",
    });
  }

  /** Where an internal fault is logged for whoever runs the system, before
   *  the caller is answered in the system's own words (SDK-FR-017). */
  protected readonly progressReporter: ForReportingProgress;

  constructor(progressReporter: ForReportingProgress) {
    this.progressReporter = progressReporter;
  }

  /** What one operation of the driver port answers, or the fault DTO of
   *  whatever stopped it: nothing it raises reaches the caller (SDK-FR-004).
   *  An internal fault is logged first, and answered in the system's own words
   *  (SDK-FR-017, SDK-FR-018). */
  protected async answerWithFaultDTO<Answer>(
    operationName: string,
    operationAnswer: () => Promise<Answer>,
  ): Promise<Answer | FaultDTOs.Fault> {
    try {
      return await operationAnswer();
    } catch (raisedValue) {
      const fault = DomainFaultFactory.create(raisedValue);
      // A reporter that fails is a driven adapter failing too: the caller is
      // answered all the same, and nothing escapes (SDK-FR-004).
      // The person's own faults are theirs, and are not logged.
      try {
        if (fault.internal) {
          // The operation by its name, the fault's stack and fix, and every cause
          // under it; never the arguments the use case was called with (SDK-FR-017).
          const causeTexts: string[] = [];
          // A cause seen before ends the chain: one that leads back to itself would
          // otherwise never let the caller be answered (SDK-FR-004).
          const seenCauses = new Set<unknown>([fault]);
          for (
            let cause = fault.cause;
            cause !== undefined && !seenCauses.has(cause);
            cause = cause instanceof Error ? cause.cause : undefined
          ) {
            seenCauses.add(cause);
            causeTexts.push(
              `Caused by: ${cause instanceof Error ? (cause.stack ?? `${cause.name}: ${cause.message}`) : String(cause)}\n`,
            );
          }
          this.progressReporter.problem(
            `${operationName} stopped on an internal fault.\n${fault.stack ?? `${fault.name}: ${fault.message}`}\n  ${fault.fix}\n${causeTexts.join("")}`,
          );
        }
      } catch {}
      return fault.internal ? ApplicationService.internalFaultDTO : this.findingDTOOf(fault);
    }
  }

  /** What the other module's application answered, a fault among it raised
   *  again here: the person's as theirs, and the system's own as the system's,
   *  in the words the module answering said it in (CORE-FR-229, SDK-FR-017). */
  protected answeredDTOOf<Answer extends { readonly type: string }>(
    moduleAnswer: Answer | FaultDTOs.Fault,
  ): Exclude<Answer, FaultDTOs.Fault> {
    if (moduleAnswer.type !== "Fault") return moduleAnswer as Exclude<Answer, FaultDTOs.Fault>;
    const { name, message, fix, severity } = (moduleAnswer as FaultDTOs.Fault).data;
    throw new DomainFault(message, fix, { severity, internal: name === ApplicationService.internalFaultDTO.data.name });
  }

  /** One fault as it is, without the `Error` it was raised as — an `Error`
   *  does not survive being sent, and these four do. A finding about what was
   *  handed in or read is data about a file or an answer, never a failure of
   *  the system, so nothing of it is withheld whoever raised it (SDK-FR-004). */
  protected findingDTOOf({ name, message, fix, severity }: DomainFault): FaultDTOs.Fault {
    return FaultDTOs.Fault.of({ name, message, fix, severity });
  }

  /** Every fault under the file it is wrong with, each file named by its path
   *  from the repository — the path an author would type. */
  protected faultsByFileDTOOf(faultsByFile: FaultsByFile): FaultDTOs.FaultsByFile {
    return FaultDTOs.FaultsByFile.of({
      files: Object.fromEntries(
        Object.entries(faultsByFile.files).map(([file, faults]) => [
          file,
          faults.map((fault) => this.findingDTOOf(fault)),
        ]),
      ),
    });
  }

  /** Faults under no file yet, every one of them. */
  protected faultsDTOOf(faults: Faults): FaultDTOs.Faults {
    return FaultDTOs.Faults.of({ faults: faults.faults.map((fault) => this.findingDTOOf(fault)) });
  }
}
