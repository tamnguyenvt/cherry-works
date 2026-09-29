import { OUT_DIRECTORY } from "../../../path.js";
import type { ScopedPrimitive } from "../../charter/CharterRoot.js";
import type { ProjectionPolicy } from "../ProjectionPolicy.js";
import { stamp, type StampedDocument } from "../StampedDocument.js";

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
 */
export class CompiledPrimitive {
  static of(one: ScopedPrimitive, document: string): CompiledPrimitive {
    return new CompiledPrimitive(one.identity, `${OUT_DIRECTORY}/${one.primitive.kind}/${one.primitive.headers.id}.md`, document);
  }

  /** Generated, and the charter's alone: written whole over whatever is there,
   *  and gone with the primitive it was compiled from. */
  readonly projection: ProjectionPolicy = "replace";

  /** This document as a reader opens it, with the stamp saying where to change
   *  it instead. */
  toStampedDocument(): StampedDocument {
    return stamp(this.document);
  }

  private constructor(
    /** Which primitive this is: what the catalogue entry naming its file is
     *  found by. */
    readonly identity: string,
    /** Where it lands, from the repository: `.cw/out/<kind>/<id>.md`. */
    readonly file: string,
    readonly document: string,
  ) {}
}
