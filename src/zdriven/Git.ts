import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { basename, join } from "node:path";
import { DrivenFault, type ForVCS } from "#hexagon/port/zdriven/ForVCS.js";

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
   * `git fetch`, handed the source exactly as it was written, then each path
   * asked for read into an index of its own and checked out into the folder
   * given — a folder's files at that folder's root, a file under its own name:
   * the repository's own index is never touched, so nothing is staged, nothing
   * is committed, and whatever is in hand stays as it was. A folder already
   * there is replaced, so installing a source and bringing it up to date are
   * one call (FR-023, FR-030, FR-042).
   *
   * Which transport it is, whether the credentials are there, whether the
   * version exists: git answers all three, and what it says is what the user
   * reads (FR-031). `HEAD` where no version is named, which is what the source
   * calls its own default.
   *
   * `git subtree` takes a source whole and cannot take one folder of it, so
   * each path is read straight off what was fetched. Whether the first is
   * there, and whether the refused one is, is asked of git before anything is
   * touched. What lands has no history to walk (FR-028).
   */
  async subtreeAdd(
    source: string,
    includePaths: readonly string[],
    repo: URL,
    intoSubFolder: string,
    version?: string,
    refusedIfSourceHolds?: string,
  ): Promise<string> {
    const cwd = fileURLToPath(repo);
    const ref = version ?? "HEAD";
    try {
      await run("git", ["fetch", "--quiet", "--no-tags", "--", source, ref], { cwd });
    } catch (raised) {
      throw new DrivenFault(
        `${raised}`,
        version === undefined
          ? "Check the address, and that you can reach it from here."
          : `Check the address, and that "${version}" is a tag or branch it has.`,
      );
    }
    // The commit fetched is pinned now, before anything else can move FETCH_HEAD.
    const fetchedCommit = (await run("git", ["rev-parse", "FETCH_HEAD"], { cwd })).stdout.trim();
    // `tree` for a folder, `blob` for a file, nothing for a path the source has not got.
    const objectTypeAt = (path: string) =>
      run("git", ["cat-file", "-t", `${fetchedCommit}:${path}`], { cwd }).then(
        ({ stdout }) => stdout.trim(),
        () => undefined,
      );
    const atVersion = version === undefined ? "" : ` at ${version}`;
    const [requiredPath = ""] = includePaths;
    if ((await objectTypeAt(requiredPath)) === undefined)
      throw new DrivenFault(`${source} has no "${requiredPath}"${atVersion}.`, `Check that the source holds "${requiredPath}" at the version asked for.`);
    if (refusedIfSourceHolds !== undefined && (await objectTypeAt(refusedIfSourceHolds)) === "tree")
      throw new DrivenFault(
        `${source} holds "${refusedIfSourceHolds}"${atVersion}, which this copy refuses.`,
        `Remove "${refusedIfSourceHolds}" from the source, or copy a version without it.`,
      );

    // An index of this copy's own, so the repository's index, and what is
    // staged in it, is never read from or written to.
    const vendorIndexPath = (await run("git", ["rev-parse", "--path-format=absolute", "--git-path", "cw-vendor-index"], { cwd })).stdout.trim();
    const vendorIndexEnv = { ...process.env, GIT_INDEX_FILE: vendorIndexPath };
    try {
      await rm(vendorIndexPath, { force: true });
      for (const includePath of includePaths) {
        const objectType = await objectTypeAt(includePath);
        if (objectType === "tree")
          await run("git", ["read-tree", `--prefix=${intoSubFolder}/`, `${fetchedCommit}:${includePath}`], { cwd, env: vendorIndexEnv });
        if (objectType === "blob") {
          const [fileMode = "100644", , fileHash = ""] = (await run("git", ["ls-tree", fetchedCommit, "--", includePath], { cwd })).stdout.split(/\s+/);
          await run("git", ["update-index", "--add", "--cacheinfo", `${fileMode},${fileHash},${intoSubFolder}/${basename(includePath)}`], {
            cwd,
            env: vendorIndexEnv,
          });
        }
      }
      await rm(join(cwd, intoSubFolder), { recursive: true, force: true });
      await run("git", ["checkout-index", "--all", "--force"], { cwd, env: vendorIndexEnv });
      return intoSubFolder;
    } catch (raised) {
      // Whatever was half done to that folder goes back to what was committed.
      await run("git", ["restore", "--source=HEAD", "--worktree", "--", intoSubFolder], { cwd }).catch(() => undefined);
      throw new DrivenFault(`${raised}`, `Check that "${intoSubFolder}" can be written, and run this again.`);
    } finally {
      await rm(vendorIndexPath, { force: true });
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

  /** `git worktree add --detach` at `HEAD`, forced over a record of one
   *  left at that folder by a run stopped halfway. */
  async addWorktree(repo: URL, worktreeFolder: URL): Promise<void> {
    try {
      await run("git", ["worktree", "add", "--quiet", "--detach", "--force", fileURLToPath(worktreeFolder), "HEAD"], { cwd: fileURLToPath(repo) });
    } catch (raised) {
      throw new DrivenFault(`${raised}`, "Commit what is to be evaluated first: a worktree holds the last commit.");
    }
  }

  /** `git worktree remove --force`, then the folder removed whatever git
   *  said, and `git worktree prune` for a record whose folder is gone. */
  async removeWorktree(repo: URL, worktreeFolder: URL): Promise<void> {
    const cwd = fileURLToPath(repo);
    await run("git", ["worktree", "remove", "--force", "--force", fileURLToPath(worktreeFolder)], { cwd }).catch(() => undefined);
    await rm(fileURLToPath(worktreeFolder), { recursive: true, force: true });
    await run("git", ["worktree", "prune"], { cwd });
  }
}
