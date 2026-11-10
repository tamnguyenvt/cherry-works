import { ProviderComponent, StampedDocument } from "#module/charter/module.js";

/** Instructions kept inside the repository's own entry file, at its root or
 *  in the folder a guide's globs name. */
export class CodexEntryFile extends ProviderComponent {
  readonly kind = "entry-file";

  /** The section for `folder`, from the repository's root; the root's is
   *  `""`. One in a folder is the build's alone, and stamped so. */
  static of(document: string, folder = ""): CodexEntryFile {
    const sectionText = folder === "" ? document : new StampedDocument(document).text.trimEnd();
    return new CodexEntryFile("codex", "charter", folder, `<!-- CHERRYWORKS START -->\n${sectionText}\n<!-- CHERRYWORKS END -->\n`);
  }

  /** The folder it is for, from the repository's root; the root's is `""`. */
  get folder(): string {
    return this.id;
  }

}
