import { ProviderComponent } from "../../app/port/out/managing-local-agent-output.port.js";

/** Instructions kept inside the repository's own entry file, at its root or
 *  in the folder a guide's globs name. */
export class CodexEntryFile extends ProviderComponent {
  static readonly kind = "entry-file" as const;
  readonly kind = CodexEntryFile.kind;

  /** The folder it is for, from the repository's root; the root's is `""`. */
  get folderPath(): string {
    return this.id;
  }
}
