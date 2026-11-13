import { FolderAddress, type FolderURL, type ForReadingFiles } from "../../shared/module.js";
import { type ForLoadingSessionAnalysis, SessionLogs } from "../app/port/out/loading-session-analysis.port.js";

/** Reads the session logs kept as files, a folder per session. */
export class FileSessionAnalysisRepository implements ForLoadingSessionAnalysis {
  readonly #fileReaderAt: (rootFolder: URL) => ForReadingFiles;
  readonly #repoFolder: FolderURL;
  readonly #homeFolder: FolderURL;
  readonly #sessionAnalysisFolder: string | undefined;

  constructor(
    /** What reads files under a folder, set up on the root of the home's
     *  address when the sessions are read, so a folder the settings name
     *  anywhere under it is reached and no reader set up anywhere else is
     *  handed in. */
    fileReaderAt: (rootFolder: URL) => ForReadingFiles,
    /** The repository whose sessions are read, which names the folder they are
     *  kept in where its settings name none. */
    repoFolder: URL,
    /** The developer's home folder, which the sessions are kept under unless
     *  the repository names a folder of its own. Each refused here unless it
     *  names a folder (SDK-FR-010). */
    homeFolder: URL,
    /** The folder the repository's settings keep its sessions in, an absolute
     *  path or one under `~/`; none for the one under the home named after
     *  the repository. An integrator setting this store up hands it the
     *  folder the settings name: the engine hands the store none. */
    sessionAnalysisFolder?: string,
  ) {
    this.#repoFolder = FolderAddress.parseFolderUrl(repoFolder);
    this.#homeFolder = FolderAddress.parseFolderUrl(homeFolder);
    this.#sessionAnalysisFolder = sessionAnalysisFolder;
    this.#fileReaderAt = fileReaderAt;
  }

  async loadSessionLogs(writtenFromMs: number, writtenUntilMs: number): Promise<SessionLogs> {
    const fileReader = this.#fileReaderAt(new URL("/", this.#homeFolder));
    const sessionsFolder = SessionsFolder.of(this.#repoFolder, this.#homeFolder, this.#sessionAnalysisFolder).url;
    const sessionsFolderPath = decodeURIComponent(
      sessionsFolder.href.slice(new URL("/", this.#homeFolder).href.length),
    ).replace(/\/$/, "");
    // Each session keeps one folder of its own, its log directly in it: only
    // those are looked in, whatever else the folder holds.
    const listedLogFiles = (
      await Promise.all(
        (
          await fileReader.listFolders(sessionsFolderPath)
        ).map((sessionFolderPath) => fileReader.listFiles(sessionFolderPath)),
      )
    ).flat();
    const logTexts = await Promise.all(
      listedLogFiles
        .filter(
          ({ path, modifiedAt }) =>
            path.endsWith(`/${SessionsFolder.logFile}`) &&
            modifiedAt.getTime() >= writtenFromMs &&
            modifiedAt.getTime() <= writtenUntilMs,
        )
        .map(({ path }) => fileReader.readIfThere(path)),
    );
    return new SessionLogs(
      // A folder on this machine's disk is named by its path, as it was; any other by its whole address (SDK-FR-011).
      FolderAddress.findLocalPath(sessionsFolder) ?? FolderAddress.cleanFolderAddress(sessionsFolder).href,
      logTexts.map((logText) => logText ?? ""),
    );
  }
}

/** The longest name a repository's sessions folder is given, under the 255
 *  bytes a disk takes for one. */
const REPO_NAME_LIMIT = 200;

/** The folder one repository's sessions are kept in on this machine, a
 *  folder per session id under it. */
class SessionsFolder {
  /** What each session's folder keeps its stops in, one line each (EVAL-FR-009). */
  static readonly logFile = "session-analysis.jsonl";

  private constructor(readonly url: FolderURL) {}

  /**
   * The folder one repository's sessions are kept in on this machine, a folder
   * per session id under it, as `cw-session-tokens-counter` keeps them
   * (EVAL-FR-009): the `sessionAnalysisFolder` the repository set, an absolute
   * path or one under `~/`, both under the home's scheme, unless it is inside
   * the repository (EVAL-FR-042), or else
   * `~/.cherry-works/` and the repository's path, each character that is not a
   * letter or a digit a dash. The counter names it the same way, from the folder
   * the agent ran in. A repository at any other address than a `file:` one with
   * no host is named by its `FolderAddress.cleanFolderAddress` instead, each character that is
   * not a letter or a digit `_` and its code in hex, so two naming different
   * folders keep folders of their own (SDK-FR-011); past `REPO_NAME_LIMIT`, cut
   * and ended with a hash of the address.
   */
  static of(repoFolder: FolderURL, homeFolder: FolderURL, sessionAnalysisFolder?: string): SessionsFolder {
    if (sessionAnalysisFolder === undefined) {
      const repoPath = FolderAddress.findLocalPath(repoFolder);
      if (repoPath !== undefined)
        return new SessionsFolder(
          FolderAddress.parseFolderUrl(
            new URL(`.cherry-works/${repoPath.replace(/\/$/, "").replace(/[^A-Za-z0-9]/g, "-")}/`, homeFolder),
          ),
        );
      const repoAddress = FolderAddress.cleanFolderAddress(repoFolder).href.replace(/\/$/, "");
      // A serialised URL is ASCII, so two hex digits a character keep any two addresses apart, where a dash would not.
      const repoName = repoAddress.replace(
        /[^A-Za-z0-9]/g,
        (character) => `_${character.charCodeAt(0).toString(16).padStart(2, "0")}`,
      );
      if (repoName.length <= REPO_NAME_LIMIT)
        return new SessionsFolder(FolderAddress.parseFolderUrl(new URL(`.cherry-works/${repoName}/`, homeFolder)));
      // Past what a disk takes for a folder name, the name is cut and an FNV-1a hash of the whole address keeps it apart.
      let repoAddressHash = 0xcbf29ce484222325n;
      for (const character of repoAddress)
        repoAddressHash = BigInt.asUintN(64, (repoAddressHash ^ BigInt(character.charCodeAt(0))) * 0x100000001b3n);
      return new SessionsFolder(
        FolderAddress.parseFolderUrl(
          new URL(
            `.cherry-works/${repoName.slice(0, REPO_NAME_LIMIT - 17)}_${repoAddressHash.toString(16).padStart(16, "0")}/`,
            homeFolder,
          ),
        ),
      );
    }
    const sessionsFolderPath = sessionAnalysisFolder.endsWith("/")
      ? sessionAnalysisFolder
      : `${sessionAnalysisFolder}/`;
    const namedSessionsFolder = FolderAddress.parseFolderUrl(
      sessionsFolderPath.startsWith("~/")
        ? new URL(sessionsFolderPath.slice(2).split("/").map(encodeURIComponent).join("/"), homeFolder)
        : new URL(`.${sessionsFolderPath.split("/").map(encodeURIComponent).join("/")}`, new URL("/", homeFolder)),
    );
    // A folder inside the repository is refused, as the counter refuses it,
    // and the sessions read from the default it kept them in (EVAL-FR-042).
    return namedSessionsFolder.href.startsWith(repoFolder.href)
      ? SessionsFolder.of(repoFolder, homeFolder)
      : new SessionsFolder(namedSessionsFolder);
  }
}
