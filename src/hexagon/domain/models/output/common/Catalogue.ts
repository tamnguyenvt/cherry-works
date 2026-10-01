import type { ProjectionPolicy } from "../ProjectionPolicy.js";

/**
 * What a charter holds, listed for whoever reads it (FR-011, FR-013).
 *
 * Output, not charter: nothing here was authored and nothing here is read back,
 * and nothing here knows what a primitive is — reading one into an entry is the
 * service's, and this is handed the list (plan §2.6).
 *
 * What it is written as, and into which file, is the projector's.
 *
 * Ordered by identity rather than by the order the files happened to be read, so
 * the same charter catalogues byte for byte the same and a committed catalogue
 * changes only when the charter does (SC-007).
 *
 * No bodies. What a primitive says is read from the file it names,
 * when the thing it applies to comes up and not before (FR-013).
 */
export class Catalogue {
  /** Entries in the order they are to be listed: by identity (SC-007). */
  constructor(private readonly entries: readonly CatalogueEntry[]) {}

  /** This listing is the charter's own file: it says what the charter holds now,
   *  and nothing else has anything to say in it. */
  readonly projection: ProjectionPolicy = "replace";

  /**
   * The same listing, narrowed to the primitives of one kind (FR-011).
   *
   * A narrowed listing is a listing: what comes back answers `full` the way
   * this does, so whoever reads it never has to ask whether it was narrowed. Nothing is re-sorted — the entries keep the order they were
   * put in, which is the order by identity they were made in.
   */
  filterByKind(kind: string): Catalogue {
    return new Catalogue(this.entries.filter((one) => one.kind === kind));
  }

  /** Every primitive, with the file its body is in (FR-011). */
  get full(): readonly CatalogueEntry[] {
    return this.entries;
  }
}

/**
 * One primitive as the listing records it: what it is called, what it is for,
 * the files it applies to, and the file its body is in (FR-011). Its identity
 * already says its id, and every other header is read from that file.
 *
 * Globs nobody wrote are left out rather than recorded as nothing.
 */
export interface CatalogueEntry {
  readonly identity: string;
  readonly kind: string;
  readonly description: string;
  /** Where the body is, from the repository holding the charter — the one path
   *  that reads the same on every machine that checks it out. The compiled
   *  primitive, in what a build writes; the authored file, in what a person is
   *  listed (FR-140). */
  readonly file: string;
  readonly globs?: readonly string[];
}
