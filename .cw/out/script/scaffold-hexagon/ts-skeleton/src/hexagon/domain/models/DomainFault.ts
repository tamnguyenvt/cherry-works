/**
 * DOMAIN FAULT — one thing wrong: what is wrong, and the next move. Every
 * fault of the hexagon extends this — the domain's below, the use cases' in
 * `ApplicationFault`, the adapters' in `AdapterFault` — and adds no
 * constructor of its own, so each one owes both.
 *
 * A fault is the system's own, `internal`, unless it is raised with
 * `{ internal: false }`: an internal one says how the system is set up, so a
 * use case logs it and sends a message of its own in its place. Only the
 * person's faults reach them as they are.
 */
export class DomainFault extends Error {
  /** The system's own fault, not the person's: never shown to a client as it is. */
  readonly internal: boolean;

  constructor(
    /** What is wrong, never only that something is. */
    message: string,
    /** The next move: the person's, or, for an internal fault, whoever runs the system. */
    readonly fix: string,
    options: { readonly internal?: boolean; readonly cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.internal = options.internal ?? true;
  }
}
// @example-start

/** A visitor greeted with no name — theirs to fix, so not internal. */
export class NamelessVisitorFault extends DomainFault {}
// @example-end
