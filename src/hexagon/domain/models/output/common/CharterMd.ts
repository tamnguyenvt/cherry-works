import { OUT_DIRECTORY } from "../../../path.js";
import type { Projection } from "../ProjectionPolicy.js";
import type { StampedDocument } from "../StampedDocument.js";

/**
 * What an agent has to know before it reads anything else: that this repository
 * is governed by a charter, where the charter's own listing of itself is, and
 * when each kind is to be opened (FR-019).
 *
 * Orientation, and the few rules that are not worth the risk of being missed. A
 * primitive's body is opened when its activation condition is met and not
 * before, which is what the catalogue is for (FR-013) —
 * so a charter of four hundred guides compiles to the same few paragraphs as a
 * charter of four.
 *
 * The activation lines are read off the primitive classes, one per kind, each declaring
 * its own beside the headers it requires, so what a kind is and when it is
 * opened is said in one place (FR-001).
 *
 * It lands in the output folder, beside the listing it sends a reader to by
 * name. No charter here — it is handed the lines it writes, so what a kind is
 * is asked of the charter once, by the caller.
 *
 * No primitive's body reaches here, not even a guide's: this file is
 * orientation and the listings it sends a reader to. What every turn is to carry
 * is a host's to hand its agent, in that host's own kind.
 */
export class CharterMd {
  static readonly type = "charter-md" as const
  readonly type = CharterMd.type

  constructor(
    /** This file as a reader opens it: the stamp saying this engine wrote it,
     *  and the orientation itself. */
    private readonly stampedContents: StampedDocument,
  ) {}

  /** The file it is put down as: the one every host's entry file sends its
   *  agent to (FR-019, FR-051), the charter's own, written whole over whatever
   *  is there. */
  get projections(): readonly Projection[] {
    return [{ file: `${OUT_DIRECTORY}/CHARTER.md`, contents: this.stampedContents, projectionPolicy: "replace", executable: false }];
  }
}
