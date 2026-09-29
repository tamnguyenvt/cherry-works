import type { ProjectionPolicy } from "../ProjectionPolicy.js";

/**
 * What a charter holds, listed for whoever reads it (FR-011 – FR-013).
 *
 * Output, not charter: nothing here was authored and nothing here is read back,
 * and nothing here knows what a primitive is — reading one into an entry is the
 * service's, and this is handed the list (plan §2.6).
 *
 * One listing held twice over, not two listings: the same entries, read down to
 * what each reader needs. So the two cannot come to say different things about
 * one primitive, and neither can be had without the other (SC-004). What each is
 * written as — indented or not, and into which file — is the compiler's and the
 * projector's.
 *
 * Ordered by identity rather than by the order the files happened to be read, so
 * the same charter catalogues byte for byte the same and a committed catalogue
 * changes only when the charter does (SC-007).
 *
 * No bodies, in either. What a primitive says is read from the file it names,
 * when the thing it applies to comes up and not before (FR-013).
 */
export class Catalogue {
  static of(entries: readonly CatalogueFull[]): Catalogue {
    return new Catalogue(
      [...entries].sort((one, another) => (one.identity < another.identity ? -1 : one.identity > another.identity ? 1 : 0)),
    );
  }

  private constructor(private readonly entries: readonly CatalogueFull[]) {}

  /** This listing is the charter's own file: it says what the charter holds now,
   *  and nothing else has anything to say in it. */
  readonly projection: ProjectionPolicy = "replace";

  /**
   * The same listing, narrowed to the primitives of one kind (FR-011).
   *
   * A narrowed listing is a listing: what comes back answers `full` and
   * `compact` the way this does, so whoever reads it never has to ask whether it
   * was narrowed. Nothing is re-sorted — the entries keep the order they were
   * put in, which is the order by identity `of` gave them.
   */
  filterByKind(kind: string): Catalogue {
    return new Catalogue(this.entries.filter((one) => one.kind === kind));
  }

  /** Everything every primitive's headers declare about it, and the file its body
   *  is in (FR-011). */
  get full(): readonly CatalogueFull[] {
    return this.entries;
  }

  /**
   * The same primitives as an agent surveys them: what each is, what it is
   * called, and the one line saying what it is for (FR-012).
   *
   * This is what an agent reads first, so it holds nothing an agent surveying the
   * charter would not use — no globs, no tags, and no file. Having found what it
   * wants here, it asks `full` where that identity lives.
   */
  get compact(): readonly CatalogueCompact[] {
    return this.entries.map(({ identity, kind, id, description }) => ({ identity, kind, id, description }));
  }}

/** One primitive as the compact listing records it. */
export interface CatalogueCompact {
  readonly identity: string;
  readonly kind: string;
  readonly id: string;
  readonly description: string;
}

/**
 * One primitive as the full listing records it: everything its headers declare
 * about it, and the file its body is in (FR-011).
 *
 * A header nobody wrote is left out rather than recorded as nothing: a catalogue
 * says what the author declared.
 */
export interface CatalogueFull extends CatalogueCompact {
  /** Where the body is, from the repository holding the charter — the one path
   *  that reads the same on every machine that checks it out. The compiled
   *  primitive, in what a build writes; the authored file, in what a person is
   *  listed (FR-140). */
  readonly file: string;
  readonly tags?: readonly string[];
  readonly globs?: readonly string[];
  readonly rationale?: string;
  readonly mixins?: readonly string[];
}
