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
 * The constructor is where the three things a fault owes an author are asked
 * for, so none of them can be left out (SC-003). Every error this domain raises
 * extends this and adds no constructor of its own.
 */
export class DomainFault extends Error {
  constructor(
    /** What is wrong with this file, never that something is wrong. */
    message: string,
    /** The next move. */
    readonly fix: string,
    /** An `error` fails validation; a `warn` is reported and lets the build
     *  through — worth saying and not worth stopping on, so the charter still
     *  holds and the author still knows (spec Assumptions, FR-005). */
    readonly severity: "error" | "warn" = "error",
  ) {
    super(message);
    this.name = new.target.name;
  }}

/**
 * One thing wrong with a charter taken as a whole.
 *
 * What it says needs more than one file to be seen: two files claiming one
 * identity, a mixin nothing answers to, a rationale citing a corpus that is not
 * there. Collected under the file that has to change rather than thrown, so one
 * reading names every one of them (FR-009).
 */
export class CharterRootFault extends DomainFault {}

/**
 * One thing wrong with what a repository configured itself with: settings that
 * are not JSON, that hold something other than a set of fields, or that write a
 * field as something it cannot be read as (FR-037).
 *
 * Its own file is the file that has to change, and that file is nobody's
 * primitive — which is what tells it apart from the two below.
 */
export class SettingsFault extends DomainFault {}

/**
 * One thing wrong inside one primitive file: a header its kind requires and did
 * not get, a kind nothing knows, frontmatter that does not parse (FR-002,
 * FR-004).
 *
 * Its own file is enough to know it is wrong, which is what tells it apart from
 * a `CharterRootFault`. A file usually has more than one, and an author wants
 * them all in one go, so reading throws them together rather than one at a time
 * (FR-009).
 */
export class CharterPrimitiveFault extends DomainFault {}

/**
 * One thing wrong with one test file: a case naming no file, a field nothing
 * reads, an expectation that is not an identity (FR-047).
 *
 * Its own file is the file that has to change, which is what tells it apart from
 * a `CharterRootFault` — and it is no primitive's fault either, because a test
 * is not a primitive: nothing compiles it, and an agent is instructed by none of
 * it.
 */
export class TestSuiteFault extends DomainFault {}

/**
 * One expectation the charter did not meet (FR-048).
 *
 * Nothing is wrong with the file it was written in — it reads, and what it puts
 * is a fair question — so this is not a `TestSuiteFault`: what has to change is
 * the charter, or the expectation about it, and the fix says which of the two an
 * author is likelier to have meant.
 */
export class TestCaseFault extends DomainFault {}

/** A vendor source whose address names no folder to land in (FR-044). */
export class VendorFault extends DomainFault {}

/** Throws every fault at once: what is wrong is said once and in full rather
 *  than one exception at a time, so a caller reading a whole charter can name
 *  them all (FR-009). `AggregateError` is what the language already has for
 *  this, and what it carries is the faults themselves.
 *
 *  It asks for faults and not for a class of them: anything that is a fault can
 *  be thrown this way. */
export function throwAggregateError(faults: readonly DomainFault[]): never {
  throw new AggregateError(faults, faults.map((one) => one.message).join(" "));
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
          .map(([file, faults]) => [file, faults.filter((one) => one.severity === "error")] as const)
          .filter(([, faults]) => faults.length > 0),
      ),
    );
  }

  /** The same faults, each file named the way an author would type it: where
   *  it sits under the repository they ran in, where the file is the `href` it
   *  was read from. */
  namedFrom(repo: URL): FaultsByFile {
    return new FaultsByFile(Object.fromEntries(Object.entries(this.#files).map(([file, faults]) => [nameOf(file, repo), faults])));
  }}

/** Faults under no file yet: what an author's answers were refused for before
 *  anything was written, every one of them rather than the first (FR-004,
 *  FR-009). */
export class Faults {
  constructor(readonly faults: readonly DomainFault[]) {}
}

/** The file as the author would name it: where it sits under the repository
 *  they ran in. */
function nameOf(file: string, repo: URL): string {
  const at = `${repo.href.replace(/\/$/, "")}/`;
  return decodeURIComponent(file.startsWith(at) ? file.slice(at.length) : file);
}
