/** What every path into a build's output starts with: where the output
 *  lands is no part of the engine's, so it is written as this, and whoever
 *  lays or reads the output says where that is (CORE-FR-221). */
const OUT_FOLDER_TOKEN = "$CW_OUT";

/**
 * One part of what a build compiles to, known by what it is: the part it
 * plays, the kind of the primitive it was compiled from, or `charter` where it
 * is the whole charter's, its id there, and its path inside the build's
 * output (CORE-FR-220).
 *
 * Where the output lands is the projection's to decide (CORE-FR-221). A part's
 * text naming another names it by `linkOf`: its path inside the output, under
 * `$CW_OUT/`.
 */
export class OutputPart {
  constructor(
    readonly part: string,
    readonly kind: string,
    readonly id: string,
    /** Where it lands inside the build's output: `guide/no-any/index.md`. */
    readonly path: string,
  ) {}

  /** What every path into the output starts with, in place of the folder it
   *  lands in. */
  static get outFolderToken(): typeof OUT_FOLDER_TOKEN {
    return OUT_FOLDER_TOKEN;
  }

  /** A part of the whole charter: its id is the part it plays. */
  static ofCharter(part: string, path: string): OutputPart {
    return new OutputPart(part, "charter", part, path);
  }

  /** One primitive's compiled document, every host's. */
  static ofPrimitive(kind: string, id: string): OutputPart {
    return new OutputPart("primitive", kind, id, `${kind}/${id}/index.md`);
  }

  /**
   * This part named in another's text: `$CW_OUT/` and its path inside the
   * output, then on by `suffix`, a path from this part's own folder, where one
   * is given: `./` or `../` before it read as a link reads it, every character
   * of it a URL's, a file's name beside it otherwise.
   */
  linkOf(suffix = ""): string {
    const partFolder = this.path.slice(0, this.path.lastIndexOf("/") + 1);
    if (/^\.{1,2}\//.test(suffix)) {
      // The folder this names is written as it is named.
      const resolvedUrl = new URL(suffix, `https://charter.invalid/${this.path}`);
      const encodedFolder = new URL(".", `https://charter.invalid/${this.path}`).pathname;
      const resolvedPath = resolvedUrl.pathname.startsWith(encodedFolder)
        ? `${partFolder}${resolvedUrl.pathname.slice(encodedFolder.length)}`
        : resolvedUrl.pathname.slice(1);
      return `${OUT_FOLDER_TOKEN}/${resolvedPath}${resolvedUrl.search}${resolvedUrl.hash}`;
    }
    return `${OUT_FOLDER_TOKEN}/${suffix === "" ? this.path : `${partFolder}${suffix}`}`;
  }
}
