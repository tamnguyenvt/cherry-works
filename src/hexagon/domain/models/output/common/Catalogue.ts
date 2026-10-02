import { OUT_DIRECTORY } from "../../../path.js";
import type { Projection } from "../ProjectionPolicy.js";

/**
 * What a charter holds, listed for whoever reads it (FR-011, FR-013).
 *
 * Output, not charter: nothing here was authored and nothing here is read back,
 * and nothing here knows what a primitive is — reading one into an entry is the
 * service's, and this is handed the list (plan §2.6).
 *
 * It says itself which file it lands in and what that file holds.
 *
 * Ordered by id rather than by the order the files happened to be read, so
 * the same charter catalogues byte for byte the same and a committed catalogue
 * changes only when the charter does (SC-007).
 *
 * No bodies. What a primitive says is read from the file it names,
 * when the thing it applies to comes up and not before (FR-013).
 */
export class Catalogue {
  /** Entries in the order they are to be listed: by id (SC-007). */
  constructor(readonly entries: readonly CatalogueEntry[]) {}

  /** The file it is put down as: beside `CHARTER.md`, which sends a reader to
   *  it by name (FR-011), and the charter's own, written whole over whatever is
   *  there. Indented, since it is committed and read in diffs, and a listing
   *  whose entries land one per line says what changed in the charter rather
   *  than that the listing changed. */
  get projections(): readonly Projection[] {
    return [
      {
        file: `${OUT_DIRECTORY}/catalog.json`,
        contents: `${JSON.stringify(this.entries, undefined, 2)}\n`,
        projectionPolicy: "replace",
        executable: false,
      },
    ];
  }

  /**
   * The same listing, narrowed to the primitives of one kind (FR-011).
   *
   * A narrowed listing is a listing: what comes back answers `entries` the way
   * this does, so whoever reads it never has to ask whether it was narrowed. Nothing is re-sorted — the entries keep the order they were
   * put in, which is the order by id they were made in.
   */
  filterByKind(kind: string): Catalogue {
    return new Catalogue(this.entries.filter((one) => one.kind === kind));
  }
}

/**
 * One primitive as the listing records it: what it is called, what it is for,
 * the files it applies to, and the file its body is in (FR-011). Its kind and
 * id are all it is known by, and every other header is read from that file.
 *
 * Globs nobody wrote are left out rather than recorded as nothing.
 */
export interface CatalogueEntry {
  readonly kind: string;
  readonly id: string;
  readonly description: string;
  /** Where the body is, from the repository holding the charter — the one path
   *  that reads the same on every machine that checks it out. The compiled
   *  primitive, in what a build writes; the authored file, in what a person is
   *  listed (FR-140). */
  readonly file: string;
  readonly globs?: readonly string[];
}
