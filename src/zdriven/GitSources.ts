import { execFile } from "node:child_process";
import { cp, lstat, mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { devNull, tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { AdapterFault, type ForFetchingSources } from "#hexagon/port/zdriven/ForFetchingSources.js";

const runGit = promisify(execFile);

/** What every other question of a fetch reads: what `git fetch` left there. */
const FETCHED_REF = "FETCH_HEAD";

/**
 * DRIVEN ADAPTER: git, as the command everyone already has.
 *
 * Each fetch lands in a store of its own, a temporary bare repository, so the
 * folder installed into need not be a repository and its own object store and
 * index are never touched, if it is one. That store's folder is the commit this
 * adapter answers: it holds the one commit fetched, under `FETCH_HEAD`. The
 * fetch still reads the repository's own git config, where the folder is in one,
 * so a source is reached as `git fetch` run there would reach it (CORE-FR-205).
 * Handing it over takes git 2.31 or later.
 */
export class GitSources implements ForFetchingSources {
  /** `git init --bare` first, as nothing else needs a folder: a refusal with
   *  no such command is a machine without git, not a source out of reach. */
  async fetchCommit(source: string, repo: URL, version?: string): Promise<string> {
    const storeFolder = await mkdtemp(join(tmpdir(), "cw-source-")).catch((storeError: unknown) => {
      throw new AdapterFault(`${storeError}`, "Check that the temporary folder can be written.");
    });
    try {
      await runGit("git", ["init", "--quiet", "--bare", storeFolder]);
    } catch (gitError) {
      await rm(storeFolder, { recursive: true, force: true });
      if ((gitError as NodeJS.ErrnoException).code === "ENOENT") throw new AdapterFault(`${gitError}`, "Reaching a source needs git: install it, and run this again.");
      throw new AdapterFault(`${gitError}`, "Check that the temporary folder can be written.");
    }
    try {
      const repoFolder = fileURLToPath(repo);
      // Read where the repository is, so what only applies there applies, every
      // scope at once and includes already expanded: a key with no value is a
      // `true`, and what says how a repository is laid out is the store's own.
      const { stdout: repoConfigText } = await runGit("git", ["config", "--list", "--null"], { cwd: repoFolder }).catch((configError: unknown) => {
        throw new AdapterFault(`${configError}`, "Check this repository's git config, and run this again.");
      });
      const repoConfigEntries = repoConfigText
        .split("\0")
        .filter((configEntry) => configEntry !== "")
        .map((configEntry) => (configEntry.includes("\n") ? [configEntry.slice(0, configEntry.indexOf("\n")), configEntry.slice(configEntry.indexOf("\n") + 1)] : [configEntry, "true"]))
        .filter(([configKey]) => !/^(core\.(bare|worktree)|extensions\.|include\.|includeif\.)/i.test(configKey ?? ""));
      const repoConfigEnv = Object.fromEntries(repoConfigEntries.flatMap(([configKey, configValue], index) => [[`GIT_CONFIG_KEY_${index}`, configKey], [`GIT_CONFIG_VALUE_${index}`, configValue]]));
      await runGit("git", ["fetch", "--quiet", "--no-tags", "--", source, version ?? "HEAD"], { cwd: repoFolder, env: { ...process.env, ...repoConfigEnv, GIT_CONFIG_COUNT: String(repoConfigEntries.length), GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: devNull, GIT_DIR: storeFolder } });
      return storeFolder;
    } catch (gitError) {
      await rm(storeFolder, { recursive: true, force: true });
      if (gitError instanceof AdapterFault) throw gitError;
      throw new AdapterFault(
        `${source} could not be fetched: ${gitError}`,
        version === undefined
          ? "Check the address, and that you can reach it from here."
          : `Check the address, and that "${version}" is a tag or branch it has.`,
      );
    }
  }

  /** `git ls-tree -r`, the paths split on the NUL `-z` ends each with, so a
   *  path holding a newline or a quote is read as it is. */
  async listFilesAt(storeFolder: string): Promise<readonly string[]> {
    try {
      const { stdout } = await runGit("git", ["ls-tree", "-r", "-z", "--name-only", FETCHED_REF], { cwd: storeFolder, env: { ...process.env, GIT_DIR: storeFolder }, maxBuffer: 64 * 1024 * 1024 });
      return stdout.split("\0").filter((path) => path !== "");
    } catch (gitError) {
      throw new AdapterFault(`${gitError}`, "Fetch the source again, and check it can be read.");
    }
  }

  /** `git show FETCH_HEAD:<path>`. */
  async readFileAt(storeFolder: string, path: string): Promise<string> {
    try {
      return (await runGit("git", ["show", `${FETCHED_REF}:${path}`], { cwd: storeFolder, env: { ...process.env, GIT_DIR: storeFolder }, maxBuffer: 64 * 1024 * 1024 })).stdout;
    } catch (gitError) {
      throw new AdapterFault(`${gitError}`, `Check that the source holds "${path}", and that it is under 64 MiB.`);
    }
  }

  /** `git read-tree --prefix` into an index of the store's, and `checkout-index`
   *  into a work tree of the store's, then a copy beside the folder, swapped with
   *  it once whole, the folder put back if the swap fails. The
   *  repository's own index, and what is staged in it, is never read from or
   *  written to. */
  async checkoutFolderAt(repo: URL, storeFolder: string, fromFolder: string, intoSubFolder: string): Promise<void> {
    const repoFolder = fileURLToPath(repo);
    const checkoutFolder = join(storeFolder, "cw-checkout");
    const intoFolder = join(repoFolder, intoSubFolder);
    const copyFolder = `${intoFolder}.cw-checkout`;
    const previousFolder = `${intoFolder}.cw-previous`;
    // A link a source put on the way here would carry all that follows out of its folder (CORE-FR-044).
    const intoFolderNames = intoSubFolder.split("/");
    for (const [index] of intoFolderNames.entries()) {
      const stepPath = intoFolderNames.slice(0, index + 1).join("/");
      const stepStats = await lstat(join(repoFolder, stepPath)).catch(() => undefined);
      if (stepStats === undefined) break;
      if (stepStats.isSymbolicLink()) throw new AdapterFault(`"${stepPath}" is a link, and nothing is written through one.`, `Delete "${stepPath}", and run this again.`);
    }
    const checkoutEnv = { ...process.env, GIT_DIR: storeFolder, GIT_WORK_TREE: checkoutFolder, GIT_INDEX_FILE: join(storeFolder, "cw-checkout-index") };
    try {
      for (const staleFolder of [checkoutFolder, copyFolder, previousFolder]) await rm(staleFolder, { recursive: true, force: true });
      await rm(checkoutEnv.GIT_INDEX_FILE, { force: true });
      await mkdir(checkoutFolder);
      await runGit("git", ["read-tree", `--prefix=${intoSubFolder}/`, fromFolder === "" ? FETCHED_REF : `${FETCHED_REF}:${fromFolder}`], { cwd: checkoutFolder, env: checkoutEnv });
      await runGit("git", ["checkout-index", "--all", "--force"], { cwd: checkoutFolder, env: checkoutEnv });
      await cp(join(checkoutFolder, intoSubFolder), copyFolder, { recursive: true, verbatimSymlinks: true });
      await rename(intoFolder, previousFolder).catch((renameError: NodeJS.ErrnoException) => {
        if (renameError.code !== "ENOENT") throw renameError;
      });
      await rename(copyFolder, intoFolder);
    } catch (checkoutError) {
      await rm(copyFolder, { recursive: true, force: true });
      await rename(previousFolder, intoFolder).catch((renameError: NodeJS.ErrnoException) => {
        if (renameError.code !== "ENOENT") throw new AdapterFault(`${renameError}`, `What "${intoSubFolder}" held is in "${intoSubFolder}.cw-previous": put it back by hand.`);
      });
      throw new AdapterFault(`${checkoutError}`, `Check that "${intoSubFolder}" can be written, and run this again.`);
    }
    await rm(previousFolder, { recursive: true, force: true }).catch((rmError: unknown) => {
      throw new AdapterFault(`${rmError}`, `"${intoSubFolder}" is in place: delete "${intoSubFolder}.cw-previous" beside it.`);
    });
  }

  /** A store left behind is only a temporary folder, and never worth reporting
   *  a source that landed as one that failed. */
  async forgetCommit(storeFolder: string): Promise<void> {
    await rm(storeFolder, { recursive: true, force: true }).catch(() => undefined);
  }
}
