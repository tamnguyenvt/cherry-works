import { ProviderComponent } from "../../app/port/out/managing-local-agent-output.port.js";

/** Instructions kept inside the repository's own entry file, at its root or
 *  in the folder a guide's globs name. */
export class CodexEntryFile extends ProviderComponent {
  readonly kind = "entry-file";

  /** The folder it is for, from the repository's root; the root's is `""`. */
  get folder(): string {
    return this.id;
  }
}
