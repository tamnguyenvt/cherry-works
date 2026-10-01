import { CLAUDE_ENTRY_FILE, OUT_DIRECTORY } from "../../../../path.js";
import { ProviderComponent } from "../ProviderComponent.js";

/**
 * The one line that gets the charter read at all: the section this charter keeps
 * in `CLAUDE.md`, the file this host reads before it is asked to read anything
 * (FR-051).
 *
 * Everything else this host reads is under a folder of its own, and it opens
 * none of it until something has sent it there. This is that something: where
 * the orientation is, and nothing else, so it costs the same on every turn
 * however much the charter grows (SC-005).
 *
 * That file is the repository's and not this charter's — somebody wrote it, and
 * another tool may keep a section of its own in it — so only this section is
 * written, between its first line and its last, which the next build finds it
 * by, and everything outside it is left as it was. Which is also why it carries
 * no stamp: a stamp says the whole file is generated, and this file is not.
 */
export class ClaudeEntryFile extends ProviderComponent {
  static readonly kind = "entry-file" as const;
  readonly kind = ClaudeEntryFile.kind;

  private constructor(document: string) {
    super(CLAUDE_ENTRY_FILE, document, "upsertWithMarker");
  }

  /** The section, said the same for every charter: where the orientation is,
   *  from the repository, which is where `CLAUDE.md` sits (FR-019). */
  static of(): ClaudeEntryFile {
    return new ClaudeEntryFile(
      `<!-- CHERRYWORKS START -->\n${[
        "## Charter",
        `This repository is governed by a charter. Read [CHARTER.md](./${OUT_DIRECTORY}/CHARTER.md) before anything else here, and work under what it says.`,
        "It is generated from the charter under `.cw/charter/`: do not edit it, edit the primitive behind it.",
      ].join("\n\n")}\n<!-- CHERRYWORKS END -->\n`,
    );
  }
}
