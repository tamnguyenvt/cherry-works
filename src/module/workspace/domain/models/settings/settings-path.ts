/**
 * Where `cw`'s own store keeps what a repository configured itself with, from
 * its root (CORE-FR-231), and the ignore file of the workspace beside it, with
 * the line of it that keeps the log out of version control (CORE-FR-225).
 */
export class SettingsPath {
  /** The workspace's folder, from the repository's root: everything `cw`
   *  reads and writes is under it. */
  readonly workspaceFolderPath = ".cw";

  /** The settings file, from the repository's root. */
  readonly settingsFilePath = `${this.workspaceFolderPath}/settings.json`;

  /** The workspace's ignore file, from the repository's root. */
  readonly gitignoreFilePath = `${this.workspaceFolderPath}/.gitignore`;

  /** The workspace's README, saying what each folder of it holds, from the
   *  repository's root. */
  readonly readmeFilePath = `${this.workspaceFolderPath}/README.md`;

  /** The line of the ignore file that keeps the log out of version control. */
  readonly logIgnoreLine = "log/";
}
