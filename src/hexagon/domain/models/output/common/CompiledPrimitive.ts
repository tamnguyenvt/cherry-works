import type { ProjectionPolicy } from "../ProjectionPolicy.js";
import type { StampedDocument } from "../StampedDocument.js";

/**
 * One primitive as an agent opens it: the headers its author wrote, and below
 * them the whole of what it says — the bodies of the mixins it pulls in, then its
 * own (FR-139).
 *
 * Every layer's primitive compiles to one of these, so what the catalogue sends
 * an agent to is a file in the output folder for all of them, the engine's own
 * included. The document is handed in whole: reading a primitive into it is the
 * compiler's. Where it lands is said here, once: the file the catalogue names
 * for it and a host's document points to (FR-140).
 *
 * A script and a template are the file they stand for: their body alone, under
 * the extension they declare, with no stamp, since a stamp would be a line of
 * the file (FR-159). A script is run by its path (FR-160).
 */
export class CompiledPrimitive {
  /** Generated, and the charter's alone: written whole over whatever is there,
   *  and gone with the primitive it was compiled from. */
  readonly projection: ProjectionPolicy = "replace";

  constructor(
    /** Which primitive this is: what the catalogue entry naming its file is
     *  found by. */
    readonly identity: string,
    /** Where it lands, from the repository: `.cw/out/<kind>/<id>.<extension>`. */
    readonly file: string,
    /** What the file holds: stamped with where to change it instead, or a
     *  script's or a template's body alone. */
    readonly document: StampedDocument | string,
    /** Run by its path once it is down: a script (FR-160). */
    readonly executable: boolean,
  ) {}
}
