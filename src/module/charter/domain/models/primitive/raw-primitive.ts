import { MissingIndexTextFault } from "../charter.fault.js";
import type { AssetFile } from "./asset-file.js";
import type { PrimitiveLayer } from "./primitive-layer.value-object.js";

/** One primitive as it is handed in, raw — kept, or answered by an author —
 *  before the engine reads it: its layer, the kind and id it is kept under, its index.md as text or as
 *  the bytes kept, every file kept with it (FR-168), and where it is kept, in
 *  that keeper's own scheme. The engine reads the text and checks it against
 *  the kind and id; it never reads the uri, which it only says back
 *  (CORE-FR-213). */
export class RawPrimitive {
  constructor(
    readonly layer: PrimitiveLayer,
    readonly kind: string,
    readonly id: string,
    /** Its index.md, as text, or as bytes kept as they are (CORE-FR-207); or
     *  the headers and body an author answered, where no file is written yet
     *  (FR-011). */
    readonly contents:
      | string
      | Uint8Array
      | { readonly headers: Readonly<Record<string, unknown>>; readonly body: string },
    readonly assets: readonly AssetFile[],
    readonly uri: string,
    /** Whether it is kept as a primitive is, apart with its assets: a
     *  markdown file kept on its own is how an earlier version kept one
     *  (FR-141). */
    readonly isKeptApart: boolean = true,
    /** Where its keeper would keep a primitive of this kind and id, as the
     *  uri of its folder, for a fault to say where to move it (FR-141); the
     *  engine says it back and never reads it. */
    readonly folderUriOf?: (kind: string, id: string) => string,
  ) {}

  /** Its index.md as text, a leading BOM kept as a file read as text keeps it
   *  (CORE-FR-207). */
  get text(): string {
    if (typeof this.contents === "string") return this.contents;
    if (this.contents instanceof Uint8Array) return new TextDecoder("utf-8", { ignoreBOM: true }).decode(this.contents);
    throw new MissingIndexTextFault("Answers hold no index.md to read as text.", "Read the headers and body answered.");
  }
}
