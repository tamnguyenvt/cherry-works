import { StampedDocument } from "./stamped-document.value-object.js";

/**
 * SPECIFICATION — a file this build, or one before it, wrote: it carries the
 * stamp. Asked of what is on disk before anything is taken away, so a build
 * deletes nothing someone wrote by hand (FR-017, FR-020).
 */
export class StampedDocumentSpec {
  isSatisfiedBy(contents: string): boolean {
    return contents.includes(StampedDocument.stampText);
  }
}
