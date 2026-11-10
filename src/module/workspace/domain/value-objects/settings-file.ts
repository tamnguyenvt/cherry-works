/** Where a repository keeps what it configured itself with, from its root
 *  (CORE-FR-231), and the ignore file of the workspace beside it, with the
 *  line of it that keeps the log out of version control (CORE-FR-225). */
export class SettingsFile {
  static readonly path = ".cw/settings.json";
  static readonly gitignorePath = ".cw/.gitignore";
  static readonly logLine = "log/";
}
