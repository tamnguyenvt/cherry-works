/**
 * How a source the charter installs vendors from is laid out, each folder by
 * its path from the source's root: the one place that layout is known, as
 * `CharterPath` is the charter's (CORE-FR-185, CORE-FR-195). A source is no
 * store of `cw`'s, so this is the adapters' to read through their port, and
 * not a value the package lends; the folder a vendor keeps its primitives in
 * is the store's, `CharterPath`'s.
 */
export class VendorSourcePath {
  /** The folder a source of many charters keeps them in, one folder each named
   *  by it, laid out as a single-charter source holds its one:
   *  `charters/<name>/.cw/charter/` (CORE-FR-195). */
  readonly chartersFolderPath = "charters";

  /** The folder each charter under `charters/<name>/` keeps its charter in,
   *  as a repository set up by `cw` keeps one. The one at the source's root
   *  is its authors' own, and never read (CORE-FR-193). */
  readonly ownCharterFolderPath = ".cw/charter";

  /** The name the skills taken from a source are installed under, beside the
   *  charters picked from it. */
  readonly ownCharterName = "root";

  /** The folder a skills repository keeps the skills it publishes in, the one
   *  `npx skills` looks in first; a `SKILL.md` anywhere else — a copy kept for
   *  the repository's own agent under `.claude/skills/`, say — is none of them
   *  (CORE-FR-185). */
  readonly skillsFolderPath = "skills";

  /** The file a skills repository keeps each skill in, the way `npx skills add`
   *  reads one (CORE-FR-185). */
  readonly skillFileName = "SKILL.md";
}
