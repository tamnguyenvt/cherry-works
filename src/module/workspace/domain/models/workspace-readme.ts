
/** Where the charter's own home of Cherry Works is published. */
const CHERRY_WORKS_URL = "https://github.com/tamnguyenvt/cherry-works";

/** The README a repository's workspace is set up with: what the folder is,
 *  the `cw` that set it up, and how to start authoring the charter in it.
 *  Written once, at setup, and the repository's to change after. */
export class WorkspaceReadme {
  static readonly path = ".cw/README.md";

  constructor(
    /** The version of `cw` that set the charter up. */
    readonly cwVersion: string,
  ) {}

  get text(): string {
    return `${[
      "# Cherry Works",
      `This folder holds the charter that governs the coding agents working in this repository, kept by [Cherry Works](${CHERRY_WORKS_URL}). It was set up with \`cw\` ${this.cwVersion}.`,
      [
        "- `charter/` — the charter: `primitive/` for what this repository authors, one folder per kind; `test/` and `eval/` for its tests and eval cases; `vendor/` for charters and skills installed with `cw vendor add`, read-only.",
        "- `out/` — what `cw build` compiles the charter to; never edit it.",
        "- `settings.json` — what this repository was set up with.",
      ].join("\n"),
      "## Author it",
      [
        "- Ask your agent to run the `/cw-author` skill: it asks what a primitive needs and writes it.",
        "- Or run `cw portal` and author it in the browser.",
      ].join("\n"),
      "Then run `cw build` to lay the charter out for every agent.",
    ].join("\n\n")}\n`;
  }
}
