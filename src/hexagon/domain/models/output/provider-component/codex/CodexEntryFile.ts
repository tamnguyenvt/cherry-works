import { CODEX_ENTRY_FILE } from "../../../../path.js";
import { ProviderComponent } from "../ProviderComponent.js";
import { stamp } from "../../StampedDocument.js";

/** Instructions kept inside the repository's own AGENTS.md. */
export class CodexEntryFile extends ProviderComponent {
  readonly kind = "entry-file";

  static of(document: string, path = CODEX_ENTRY_FILE): CodexEntryFile {
    const sectionText = path === CODEX_ENTRY_FILE ? document : stamp(document).trimEnd();
    return new CodexEntryFile(path, `<!-- CHERRYWORKS START -->\n${sectionText}\n<!-- CHERRYWORKS END -->\n`, "upsertWithMarker");
  }

}
