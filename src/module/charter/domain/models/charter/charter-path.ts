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

  /** The charter itself, the only part of the workspace a person authors: its
   *  primitives, its tests, its eval cases and its vendors, each in a folder of
   *  its own under it (CORE-FR-224). */
  readonly charterFolderPath = `${this.workspaceFolderPath}/charter`;

  /** The folder a charter keeps its primitives in, one folder per kind under
   *  it: the repository's own under the charter, and each vendor's under its
   *  own folder, laid out as the repository's (CORE-FR-196, CORE-FR-224). */
  readonly primitivesFolderName = "primitive";

  /** The repository's own primitives, a folder per kind, under the charter
   *  (CORE-FR-224). */
  readonly primitivesFolderPath = `${this.charterFolderPath}/${this.primitivesFolderName}`;

  /** The situations this repository pins its charter down with, one file of
   *  cases each (FR-047), under the charter (CORE-FR-224). Apart from the
   *  primitives: a test is not a primitive, nothing compiles it and no agent is
   *  instructed by it, so it is read only when tests run. */
  readonly testFolderPath = `${this.charterFolderPath}/test`;

  /** The cases this repository evaluates its charter by against the real
   *  agent, one file of cases each (EVAL-FR-020), under the charter
   *  (CORE-FR-224). Beside the tests rather than inside them: a test is
   *  resolved offline, and an evaluation spends a key. */
  readonly evalFolderPath = `${this.charterFolderPath}/eval`;

  /** What this repository installed from someone else, one folder per vendor,
   *  `<owner>/<repository>` (FR-023, FR-024, FR-050), under the charter
   *  (CORE-FR-224). Apart from the primitives: what a vendor published is
   *  read-only, and what this repository authored is not. */
  readonly vendorsFolderPath = `${this.charterFolderPath}/vendor`;
}
