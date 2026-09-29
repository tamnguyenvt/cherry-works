import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { DrivenFault, type ForVCS } from "#hexagon/port/zdriven/ForVCS.js";
import type { ForReadingFiles } from "#hexagon/port/zdriven/ForReadingFiles.js";

const run = promisify(execFile);

/**
 * DRIVEN ADAPTER: git, as the command everyone already has.
 *
 * `rev-parse --git-dir` is the question asked, because it is the one git
 * answers about the folder rather than about the process: it walks up from the
 * folder given, so a repository's subdirectory is inside version control and
 * says so. Anything git refuses — no repository above this folder, no such
 * folder — is a folder that is not versioned, which is all this port promises
 * to tell apart.
 */
export class Git implements ForVCS {
  /** How it looks at a folder. Reading files is somebody else's port, and this
   *  asks it rather than reaching for the filesystem itself. */
  constructor(private readonly fileReader: ForReadingFiles) {}

  async isInstalled(folder: URL): Promise<boolean> {
    try {
      await run("git", ["rev-parse", "--git-dir"], { cwd: fileURLToPath(folder) });
      return true;
    } catch {
      return false;
    }
  }

  /** `git status --porcelain`: nothing said is nothing staged and nothing
   *  modified. A folder git refuses to answer about is not clean either — there
   *  is no repository there to have anything in hand. */
  async isClean(folder: URL): Promise<boolean> {
    try {
      const { stdout } = await run("git", ["status", "--porcelain"], { cwd: fileURLToPath(folder) });
      return stdout.trim() === "";
    } catch {
      return false;
    }
  }

  /**
   * `git status --porcelain` narrowed to one folder, with every untracked file
   * named rather than the folder holding them: what a vendor folder holds that
   * the commit it arrived in does not (FR-040).
   *
   * The path comes off each line after the two status letters and the space
   * following them; a rename says `old -> new`, and what is there now is the
   * half that matters. A folder git refuses to answer about has nothing
   * changed under it, for the reason a folder outside version control is not
   * clean: there is nothing recorded to differ from.
   */
  async changedUnder(repo: URL, subFolder: string): Promise<readonly string[]> {
    try {
      const { stdout } = await run("git", ["status", "--porcelain", "--untracked-files=all", "--", subFolder], {
        cwd: fileURLToPath(repo),
      });
      return stdout
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => line.slice(3).trim())
        .map((path) => path.split(" -> ").at(-1) ?? path);
    } catch {
      return [];
    }
  }

  /**
   * `git subtree`, handed the source exactly as it was written: `add` where the
   * folder is not there yet and `pull` where it is, so installing a source and
   * bringing it up to date are one call (FR-023, FR-030).
   *
   * Which transport it is, whether the credentials are there, whether the
   * version exists: git answers all three, and what it says is what the user
   * reads (FR-031).
   *
   * `--squash` because what is installed is content to read and not a history
   * to walk: one commit lands, holding the source's files under the folder
   * given (FR-028). `HEAD` where no version is named, which is what the source
   * calls its own default.
   */
  async subtreeAdd(source: string, repo: URL, intoSubFolder: string, version?: string): Promise<void> {
    const cwd = fileURLToPath(repo);
    // A folder with files in it is one a subtree was already added to, and
    // `pull` is what brings it up to date.
    const targetFolder = new URL(`${intoSubFolder}/`, repo);
    const targetFolderExist = (await this.fileReader.readFilesRecursively(targetFolder)).length > 0;
    try {
      await run(
        "git",
        ["subtree", targetFolderExist ? "pull" : "add", `--prefix=${intoSubFolder}`, "--squash", "--", source, version ?? "HEAD"],
        { cwd },
      );
    } catch (raised) {
      throw new DrivenFault(
        `${raised}`,
        version === undefined
          ? "Check the address, and that you can reach it from here."
          : `Check the address, and that "${version}" is a tag or branch it has.`,
      );
    }
  }

  /** `git rm -r` and a commit of its own: the folder is gone from the working
   *  tree and from the history from here on, the way adding it put it into
   *  both. */
  async removeSubFolder(repo: URL, subFolder: string): Promise<void> {
    const cwd = fileURLToPath(repo);
    try {
      await run("git", ["rm", "-r", "--quiet", "--", subFolder], { cwd });
      await run("git", ["commit", "-qm", `Remove ${subFolder}`], { cwd });
    } catch (raised) {
      throw new DrivenFault(`${raised}`, `Check that "${subFolder}" is a folder this repository holds.`);
    }
  }
}
