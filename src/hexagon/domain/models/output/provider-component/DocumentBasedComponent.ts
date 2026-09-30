import { stamp } from "../StampedDocument.js";
import { ProviderComponent } from "./ProviderComponent.js";
import { formatFrontmatterValue } from "../../helper.js";

/** A document this host reads no frontmatter of: the file it loads whole,
 *  whatever is in it. Its whole content is the body. */
export type NoHeaders = Record<string, never>;

/**
 * One file a host reads as a document: frontmatter, then a body (FR-018).
 *
 * The other side of the compilation. A charter is what an author wrote — the
 * kinds, in the charter's words; this is what one host reads — its kinds, in
 * its words. Between the two sits a compiler, and the two never meet anywhere
 * else: a `guide` becomes a claude skill there and nowhere in the charter, and
 * the charter does not know this file exists.
 *
 * A document is frontmatter this host reads first and a body it opens once that
 * frontmatter says to. A kind of this host that is one is a class extending this,
 * declaring — in an interface of its own — what its frontmatter holds; a kind
 * whose file this host reads whole declares none and is body alone.
 *
 * A document carries what it is called, since that is part of what it is. Where
 * it goes and which primitive it was compiled from is what the compiler knows,
 * and it is the compiler that asks for the text (plan §2.6).
 */
export abstract class DocumentBasedComponent<Headers extends object = NoHeaders> extends ProviderComponent {
  protected constructor(
    /** What this host calls this one: the charter identity with the separators a
     *  filename does not carry replaced, so `acme/skill:review` is
     *  `acme-skill-review` and two charter kinds landing in one directory of this
     *  host cannot be taken for each other (FR-014). Every document has one,
     *  whether or not that host reads it out of the frontmatter: it is what the
     *  file is called. */
    readonly name: string,
    path: string,
    /** What this host reads before the body, as the kind's own interface has
     *  it. Typed by whichever kind this is, so nothing reads a field of one
     *  kind's frontmatter off another's. */
    readonly headers: Headers,
    /** What the primitive says, with the mixins it pulls in already written
     *  into it (FR-006). */
    readonly body: string,
  ) {
    // The file this host reads: its frontmatter, its body, and the stamp
    // saying this engine wrote it. Every one of them carries the stamp, which
    // is what a reader is told and what a build reads back before taking a
    // file away — a document without it is someone's own and is left alone
    // (FR-017, FR-020). A document is this primitive's alone, so putting it
    // down replaces whatever is there.
    const headerEntries = Object.entries(headers);
    const stampedDocument = stamp(
      [
        // A kind whose file this host reads whole declares no frontmatter, and
        // gets none: an empty block would be this engine writing a field for
        // this host to read, and there is none to write.
        ...(headerEntries.length === 0
          ? []
          : [["---", ...headerEntries.map(([field, value]) => `${field}: ${formatFrontmatterValue(value)}`), "---"].join("\n")]),
        body,
      ]
        .filter((block) => block !== "")
        .join("\n\n"),
    );
    super(path, stampedDocument, "replace");
  }
}
