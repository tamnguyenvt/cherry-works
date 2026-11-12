import type { DomainFault } from "../domain.fault.js";

/** What is wrong, under the file it is wrong with. A file nothing is wrong with
 *  is not in here at all. The one shape everything that reads a workspace
 *  answers in, so what a charter got wrong and what its settings did are read
 *  together without either being unwrapped first (FR-009). */
export class FaultsByFile {
  /** Nothing wrong with any file. */
  static readonly none = new FaultsByFile({});

  readonly #faultsByFilePath: Readonly<Record<string, readonly DomainFault[]>>;

  constructor(faultsByFilePath: Readonly<Record<string, readonly DomainFault[]>>) {
    this.#faultsByFilePath = faultsByFilePath;
  }

  /** Every fault, under the file it is wrong with. */
  get faultsByFilePath(): Readonly<Record<string, readonly DomainFault[]>> {
    return this.#faultsByFilePath;
  }

  /** Is no file wrong at all? */
  get isEmpty(): boolean {
    return Object.keys(this.#faultsByFilePath).length === 0;
  }

  /** These and the other ones together, a file both name holding the faults of
   *  both. */
  mergeWith(otherFaultsByFile: FaultsByFile): FaultsByFile {
    const faultsByFilePath: Record<string, readonly DomainFault[]> = { ...this.#faultsByFilePath };
    for (const [filePath, faults] of Object.entries(otherFaultsByFile.#faultsByFilePath))
      faultsByFilePath[filePath] = [...(faultsByFilePath[filePath] ?? []), ...faults];
    return new FaultsByFile(faultsByFilePath);
  }

  /** What is wrong badly enough to stop a build, under the file that has to
   *  change. A file whose every fault is a warning is not in here at all
   *  (FR-005). */
  filterErrors(): FaultsByFile {
    return new FaultsByFile(
      Object.fromEntries(
        Object.entries(this.#faultsByFilePath)
          .map(
            ([filePath, faults]) => [filePath, faults.filter((fileFault) => fileFault.severity === "error")] as const,
          )
          .filter(([, faults]) => faults.length > 0),
      ),
    );
  }
}
