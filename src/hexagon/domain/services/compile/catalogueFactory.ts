import type { CharterRoot, ScopedPrimitive } from "../../models/charter/CharterRoot.js";
import { Catalogue } from "../../models/output/common/Catalogue.js";

/**
 * Every primitive of the charter, listed under the file a reader is sent to for
 * its body (FR-011).
 *
 * Two readers, two files. The catalogue a build writes sends an agent to the
 * compiled primitive; the listing a person asks for sends them to the file they
 * would edit, which is also what says which layer it came from (FR-140). Which
 * is the caller's to say, and everything else an entry holds is the same.
 *
 * Globs nobody wrote are left out rather than listed as nothing. Every other
 * header is read from the file the entry names.
 */
export function catalogueOf(charter: CharterRoot, fileOf: (one: ScopedPrimitive) => string): Catalogue {
  return new Catalogue(
    // Ordered by identity rather than by the order the files happened to be
    // read, so the same charter catalogues byte for byte the same (SC-007).
    [...charter.primitives].sort((one, another) => (one.identity < another.identity ? -1 : one.identity > another.identity ? 1 : 0)).map((one) => {
      const { description, globs } = one.primitive.headers;
      return {
        identity: one.identity,
        kind: one.primitive.kind,
        description,
        file: fileOf(one),
        ...(globs === undefined ? {} : { globs }),
      };
    }),
  );
}
