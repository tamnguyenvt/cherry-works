import { CharterOutputItem } from "./charter-output-item.js";
import type { StampedDocument } from "./stamped-document.value-object.js";

/** One asset of a compiled primitive: its path in the primitive's folder,
 *  what it holds, and whether it is run by its path (FR-160, FR-168). */
export class CompiledAsset {
  constructor(
    readonly assetPath: string,
    readonly contents: Uint8Array,
    readonly isExecutable: boolean,
  ) {}
}

/**
 * One primitive as an agent opens it: the headers its author wrote, and below
 * them the whole of what it says — the bodies of the mixins it pulls in, then its
 * own (FR-139) — with its assets beside it (FR-168).
 *
 * Every layer's primitive compiles to one of these, so what the catalogue sends
 * an agent to is a file in the compiled output for all of them, the engine's own
 * included. The document is handed in whole: reading a primitive into it is the
 * compiler's. Where it and its assets land is the projection's (CORE-FR-221).
 */
export class CompiledPrimitive extends CharterOutputItem {
  constructor(
    /** The kind of the primitive it was compiled from. */
    readonly kind: string,
    /** That primitive's id: `team/review`. */
    readonly id: string,
    /** What its document holds, stamped with where to change it instead. */
    private readonly stampedDocument: StampedDocument,
    /** Its assets, laid beside its document: the path each has in its
     *  folder, what it holds, and whether it is run by its path — the one a
     *  script says to run (FR-160, FR-168). */
    readonly assets: readonly CompiledAsset[] = [],
  ) {
    super();
  }

  /** Its document as an agent opens it: generated, and the charter's alone
   *  (FR-140). */
  get text(): string {
    return this.stampedDocument.text;
  }
}
