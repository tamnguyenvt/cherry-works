import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { AdapterFault, type ForVCS } from "#hexagon/port/zdriven/ForVCS.js";

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

  /** `git fetch` of one version, and `FETCH_HEAD` read at once, before
   *  anything else can move it. */
  async fetchCommit(source: string, repo: URL, version?: string): Promise<string> {
    const cwd = fileURLToPath(repo);
    try {
      await run("git", ["fetch", "--quiet", "--no-tags", "--", source, version ?? "HEAD"], { cwd });
    } catch (raised) {
      throw new AdapterFault(
        `${source} could not be fetched: ${raised}`,
        version === undefined
          ? "Check the address, and that you can reach it from here."
          : `Check the address, and that "${version}" is a tag or branch it has.`,
      );
    }
    return (await run("git", ["rev-parse", "FETCH_HEAD"], { cwd })).stdout.trim();
  }

  /** `git ls-tree -r`, the paths split on the NUL `-z` ends each with, so a
   *  path holding a newline or a quote is read as it is. */
  async listFilesAt(repo: URL, commit: string): Promise<readonly string[]> {
    const { stdout } = await run("git", ["ls-tree", "-r", "-z", "--name-only", commit], { cwd: fileURLToPath(repo), maxBuffer: 64 * 1024 * 1024 });
    return stdout.split("\0").filter((path) => path !== "");
  }

  /** `git show <commit>:<path>`. */
  async readFileAt(repo: URL, commit: string, path: string): Promise<string> {
    return (await run("git", ["show", `${commit}:${path}`], { cwd: fileURLToPath(repo), maxBuffer: 64 * 1024 * 1024 })).stdout;
  }

  /** `git read-tree --prefix` into an index of its own, then `checkout-index`
   *  over the folder emptied first: the repository's own
   *  index, and what is staged in it, is never read from or written to. */
  async checkoutFolderAt(repo: URL, commit: string, fromFolder: string, intoSubFolder: string): Promise<void> {
    const cwd = fileURLToPath(repo);
    const checkoutIndexPath = (await run("git", ["rev-parse", "--path-format=absolute", "--git-path", "cw-checkout-index"], { cwd })).stdout.trim();
    const checkoutIndexEnv = { ...process.env, GIT_INDEX_FILE: checkoutIndexPath };
    try {
      await rm(checkoutIndexPath, { force: true });
      await run("git", ["read-tree", `--prefix=${intoSubFolder}/`, fromFolder === "" ? commit : `${commit}:${fromFolder}`], { cwd, env: checkoutIndexEnv });
      await rm(join(cwd, intoSubFolder), { recursive: true, force: true });
      await run("git", ["checkout-index", "--all", "--force"], { cwd, env: checkoutIndexEnv });
    } catch (raised) {
      // Whatever was half done to that folder goes back to what was committed.
      await run("git", ["restore", "--source=HEAD", "--worktree", "--", intoSubFolder], { cwd }).catch(() => undefined);
      throw new AdapterFault(`${raised}`, `Check that "${intoSubFolder}" can be written, and run this again.`);
    } finally {
      await rm(checkoutIndexPath, { force: true });
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
      throw new AdapterFault(`${raised}`, `Check that "${subFolder}" is a folder this repository holds.`);
    }
  }

  /** `git worktree add --detach` at `HEAD`, forced over a record of one
   *  left at that folder by a run stopped halfway. */
  async addWorktree(repo: URL, worktreeFolder: URL): Promise<void> {
    try {
      await run("git", ["worktree", "add", "--quiet", "--detach", "--force", fileURLToPath(worktreeFolder), "HEAD"], { cwd: fileURLToPath(repo) });
    } catch (raised) {
      throw new AdapterFault(`${raised}`, "Commit what is to be evaluated first: a worktree holds the last commit.");
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
