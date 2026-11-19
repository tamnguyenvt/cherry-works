/**
 * Where `cw`'s own store keeps a repository's charter, each folder by its path
 * from the repository's root, and nothing of where the repository is
 * (CORE-FR-217, CORE-FR-224). The one place that layout is known, as
 * `OutputPath` is the output's: a store of an integrator's own keeps the
 * charter in a layout of its own, and says where an author edits it
 * (SDK-FR-020, CORE-FR-213).
 */
export class CharterPath {
  /** Where a repository keeps everything this engine reads and writes (plan
   *  §3): what it configured itself with, the charter it authored, and what
   *  the charter compiles to, so the three are under one folder rather than
   *  three that drift. */
  readonly workspaceFolderPath = ".cw";

  /** The charter root, the only part of the workspace a person authors: one
   *  folder per charter, `.cw/charter/<charter>/`, each holding its
   *  primitives, test cases and eval cases (CORE-FR-224, VENDOR-FR-009). */
  readonly charterFolderPath = `${this.workspaceFolderPath}/charter`;

  /** Where the charters of a source are checked out before any charter the
   *  charter root holds is replaced, so a source refused while copied
   *  replaces nothing; taken away once the install is over (VENDOR-FR-017). */
  readonly installingFolderPath = `${this.workspaceFolderPath}/installing`;

  /** The folder of a charter holding its primitives, a folder per kind:
   *  `.cw/charter/<charter>/primitive/<kind>/<id>/` (VENDOR-FR-009). */
  readonly primitivesFolderName = "primitive";

  /** The file that makes a charter installed, read-only: where it came from
   *  (VENDOR-FR-010). */
  readonly installedCharterRecordFileName = "cw-package.json";

  /** The folder of a charter holding its test cases, one file of cases each
   *  (VENDOR-FR-009). */
  readonly testFolderName = "test";

  /** The folder an older layout kept installed charters in, right under the workspace
   *  or the charter root: refused where it is still held (VENDOR-FR-011). */
  readonly oldInstalledChartersFolderName = "vendor";

  /** The folder of a charter holding its eval cases, one file of cases each
   *  (VENDOR-FR-009). */
  readonly evalFolderName = "eval";
}
