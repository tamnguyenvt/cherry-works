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

/** What is read of a model holds several faults at once, carried as its
 *  cause: what a caller reading a whole model collects and names every one
 *  of (FR-009). */
export class UnsoundModelFault extends DomainFault {
  /** Every fault it carries, in the order they were found. */
  get faults(): readonly DomainFault[] {
    return this.cause as readonly DomainFault[];
  }
}

/** Something raised that was no fault — a bug, or what a library threw — made
 *  a fault of the system's own, carrying it as its cause (SDK-FR-004). */
export class UnfaultedRaiseFault extends DomainFault {}

// What the kernel's libraries raise when a notation will not read or write:
// the person's to correct, the text they wrote being the text that is wrong.

/** TOML text that does not parse, an agent's configuration file among it. */
export class UnreadableTomlFault extends DomainFault {}

/** A table holding a value TOML cannot write. */
export class UnwritableTomlFault extends DomainFault {}

/** YAML text that does not parse. */
export class UnreadableYamlFault extends DomainFault {}

/** YAML text that parses to a bare value or a list, not to named fields. */
export class UnmappedYamlFault extends DomainFault {}
