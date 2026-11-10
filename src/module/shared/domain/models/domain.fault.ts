/**
 * One thing wrong, said without saying which file it is wrong with: what reads
 * one primitive's headers is handed the headers and nothing else, so it says
 * what is wrong and leaves the file to whoever opened it.
 *
 * An error and a value at once. Faults are collected as often as they are
 * thrown — a run names every one it finds where an exception would name the
 * first and hide the rest (FR-009) — and being an `Error` either way, there is
 * one thing to construct and one shape to report.
 *
 * The constructor is where the things a fault owes an author are asked for,
 * so none of them can be left out (SC-003). Every error this domain raises
 * extends this and adds no constructor of its own.
 *
 * A fault is the system's own, `internal`, unless it is raised with
 * `{ internal: false }`: an internal one says how the system is set up, so a
 * use case logs it and answers a message of its own in its place. Only the
 * person's faults reach them as they are (SDK-FR-017, SDK-FR-018).
 */
export class DomainFault extends Error {
  static readonly throwAggregate: typeof throwAggregateError = throwAggregateError;

  /** An `error` fails validation; a `warn` is reported and lets the build
   *  through — worth saying and not worth stopping on, so the charter still
   *  holds and the author still knows (spec Assumptions, FR-005). */
  readonly severity: "error" | "warn";
  /** The system's own fault, not the person's: never shown to a caller as it is. */
  readonly internal: boolean;

  constructor(
    /** What is wrong with this file, never that something is wrong. */
    message: string,
    /** The next move: the person's, or, for an internal fault, whoever runs the system. */
    readonly fix: string,
    options: { readonly severity?: "error" | "warn"; readonly internal?: boolean; readonly cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.severity = options.severity ?? "error";
    this.internal = options.internal ?? true;
  }
}

/** Throws every fault at once: what is wrong is said once and in full rather
 *  than one exception at a time, so a caller reading a whole charter can name
 *  them all (FR-009). `AggregateError` is what the language already has for
 *  this, and what it carries is the faults themselves.
 *
 *  It asks for faults and not for a class of them: anything that is a fault can
 *  be thrown this way. */
function throwAggregateError(faults: readonly DomainFault[]): never {
  throw new AggregateError(faults, faults.map((fault) => fault.message).join(" "));
}

/** What is wrong, under the file it is wrong with. A file nothing is wrong with
 *  is not in here at all. The one shape everything that reads a workspace
 *  answers in, so what a charter got wrong and what its settings did are read
 *  together without either being unwrapped first (FR-009). */
export class FaultsByFile {
  /** Nothing wrong with any file. */
  static readonly none = new FaultsByFile({});

  readonly #files: Readonly<Record<string, readonly DomainFault[]>>;

  constructor(files: Readonly<Record<string, readonly DomainFault[]>>) {
    this.#files = files;
  }

  /** Every fault, under the file it is wrong with. */
  get files(): Readonly<Record<string, readonly DomainFault[]>> {
    return this.#files;
  }

  /** Is no file wrong at all? */
  get isEmpty(): boolean {
    return Object.keys(this.#files).length === 0;
  }

  /** These and the other's together, a file both name holding the faults of
   *  both. */
  with(other: FaultsByFile): FaultsByFile {
    const files: Record<string, readonly DomainFault[]> = { ...this.#files };
    for (const [file, faults] of Object.entries(other.#files)) files[file] = [...(files[file] ?? []), ...faults];
    return new FaultsByFile(files);
  }

  /** What is wrong badly enough to stop a build, under the file that has to
   *  change. A file whose every fault is a warning is not in here at all
   *  (FR-005). */
  errors(): FaultsByFile {
    return new FaultsByFile(
      Object.fromEntries(
        Object.entries(this.#files)
          .map(([file, faults]) => [file, faults.filter((fileFault) => fileFault.severity === "error")] as const)
          .filter(([, faults]) => faults.length > 0),
      ),
    );
  }
}

/** Faults under no file yet: what an author's answers were refused for before
 *  anything was written, every one of them rather than the first (FR-004,
 *  FR-009). */
export class Faults {
  constructor(readonly faults: readonly DomainFault[]) {}
}
