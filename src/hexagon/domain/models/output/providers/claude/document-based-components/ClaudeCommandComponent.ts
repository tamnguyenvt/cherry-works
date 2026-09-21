import { DocumentBasedComponent } from "./DocumentBasedComponent.js";

/** A slash command's frontmatter: the one line this host lists it by and
 *  decides to load it on. No name: this host reads that off the filename. */
export interface ClaudeCommandHeaders {
  readonly description: string;
}

/**
 * A slash command: claude lists what is under `commands/` by filename and by
 * the one line each of them describes itself with, and loads the whole file
 * when someone types that name or asks for what it describes.
 *
 * A charter `command` and nothing else compiles to one — it is the one charter
 * kind this host already has the same idea of. The description is the whole of
 * its frontmatter, because it is the whole of what this host reads before
 * deciding to load it.
 */
export class ClaudeCommandComponent extends DocumentBasedComponent<ClaudeCommandHeaders> {
  static readonly kind = "command" as const;
  readonly kind = ClaudeCommandComponent.kind;

  static of(name: string, headers: ClaudeCommandHeaders, body: string): ClaudeCommandComponent {
    return new ClaudeCommandComponent(name, headers, body);
  }
}
