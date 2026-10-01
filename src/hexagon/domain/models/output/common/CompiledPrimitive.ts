import { OUT_DIRECTORY } from "../../../path.js";
import type { Projection } from "../ProjectionPolicy.js";
import type { StampedDocument } from "../StampedDocument.js";

/**
 * One primitive as an agent opens it: the headers its author wrote, and below
 * them the whole of what it says — the bodies of the mixins it pulls in, then its
 * own (FR-139) — with its assets beside it (FR-168).
 *
 * Every layer's primitive compiles to one of these, so what the catalogue sends
 * an agent to is a file in the output folder for all of them, the engine's own
 * included. The document is handed in whole: reading a primitive into it is the
 * compiler's. Where each of its files lands is said here, once (FR-140).
 */
export class CompiledPrimitive {
  constructor(
    /** The kind of the primitive it was compiled from. */
    readonly kind: string,
    /** That primitive's id: `team/review`. */
    readonly id: string,
    /** What its document holds, stamped with where to change it instead. */
    private readonly stampedContents: StampedDocument,
    /** Its assets, put down beside its document: the path each has in its
     *  folder, what it holds, and whether it is run by its path — the one a
     *  script says to run (FR-160, FR-168). */
    private readonly assetFiles: readonly { readonly file: string; readonly contents: string; readonly executable: boolean }[] = [],
  ) {}

  /** Every file it puts down, from the repository: its document first, then
   *  its assets beside it, the one a script runs marked executable (FR-140,
   *  FR-160, FR-168). Generated, and the charter's alone: each is written whole
   *  over whatever is there, and goes with the primitive it was compiled from. */
  get projections(): readonly Projection[] {
    // Its folder in the output: its kind, then each segment of its id (FR-141).
    const outFolder = `${OUT_DIRECTORY}/${this.kind}/${this.id}`;
    return [
      { file: `${outFolder}/index.md`, contents: this.stampedContents, projectionPolicy: "replace", executable: false },
      ...this.assetFiles.map(({ file, contents, executable }) => ({ file: `${outFolder}/${file}`, contents, projectionPolicy: "replace" as const, executable })),
    ];
  }
}
