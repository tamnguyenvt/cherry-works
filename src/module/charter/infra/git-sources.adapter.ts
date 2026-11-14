import { execFile } from "node:child_process";
import { cp, lstat, mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { devNull, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { FolderAddress, type FolderURL } from "../../shared/module.js";
import {
  AdapterFault,
  FailedCheckoutFault,
  type ForFetchingCharterSources,
  LeftoverFolderFault,
  LinkedFolderFault,
  MissingGitFault,
  UnreachableSourceFault,
  UnreadableFetchedSourceFault,
  UnreadableGitConfigFault,
  UnrestoredFolderFault,
  UnwritableSourceStoreFault,
} from "../app/port/out/fetching-charter-sources.port.js";

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
export class GitSources implements ForFetchingCharterSources {
  readonly #repoFolder: FolderURL;

  constructor(
    /** The repository this works in, every path it is handed from its root:
     *  refused here unless it names a folder (SDK-FR-010). */
    repoFolder: URL,
  ) {
    this.#repoFolder = FolderAddress.parseFolderUrl(repoFolder);
  }

  /** `git init --bare` first, as nothing else needs a folder: a refusal with
   *  no such command is a machine without git, not a source out of reach. */
  async fetchCommit(source: string, version?: string): Promise<string> {
    const storeFolderPath = await mkdtemp(join(tmpdir(), "cw-source-")).catch((storeError: unknown) => {
      throw new UnwritableSourceStoreFault(
        "A temporary folder for the source could not be made.",
        "Check that the temporary folder can be written.",
        { internal: false, cause: storeError },
      );
    });
    try {
      await runGit("git", ["init", "--quiet", "--bare", storeFolderPath]);
    } catch (raisedValue) {
      await rm(storeFolderPath, { recursive: true, force: true });
      if ((raisedValue as NodeJS.ErrnoException).code === "ENOENT")
        throw new MissingGitFault(
          "git is not installed here.",
          "Reaching a source needs git: install it, and run this again.",
          { internal: false, cause: raisedValue },
        );
      throw new UnwritableSourceStoreFault(
        "git could not set up a store for the source.",
        "Check that the temporary folder can be written.",
        { internal: false, cause: raisedValue },
      );
    }
    try {
      const repoFolderPath = fileURLToPath(this.#repoFolder);
      // Read where the repository is, so what only applies there applies, every
      // scope at once and includes already expanded: a key with no value is a
      // `true`, and what says how a repository is laid out is the store's own.
      const { stdout: repoConfigText } = await runGit("git", ["config", "--list", "--null"], {
        cwd: repoFolderPath,
      }).catch((configError: unknown) => {
        throw new UnreadableGitConfigFault(
          "This repository's git config could not be read.",
          "Check this repository's git config, and run this again.",
          { internal: false, cause: configError },
        );
      });
      const repoConfigEntries = repoConfigText
        .split("\0")
        .filter((configEntry) => configEntry !== "")
        .map((configEntry) =>
          configEntry.includes("\n")
            ? [configEntry.slice(0, configEntry.indexOf("\n")), configEntry.slice(configEntry.indexOf("\n") + 1)]
            : [configEntry, "true"],
        )
        .filter(([configKey]) => !/^(core\.(bare|worktree)|extensions\.|include\.|includeif\.)/i.test(configKey ?? ""));
      const repoConfigEnv = Object.fromEntries(
        repoConfigEntries.flatMap(([configKey, configValue], configIndex) => [
          [`GIT_CONFIG_KEY_${configIndex}`, configKey],
          [`GIT_CONFIG_VALUE_${configIndex}`, configValue],
        ]),
      );
      await runGit("git", ["fetch", "--quiet", "--no-tags", "--", source, version ?? "HEAD"], {
        cwd: repoFolderPath,
        env: {
          ...process.env,
          ...repoConfigEnv,
          GIT_CONFIG_COUNT: String(repoConfigEntries.length),
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_CONFIG_GLOBAL: devNull,
          GIT_DIR: storeFolderPath,
        },
      });
      return storeFolderPath;
    } catch (raisedValue) {
      await rm(storeFolderPath, { recursive: true, force: true });
      if (raisedValue instanceof AdapterFault) throw raisedValue;
      // Said without the user and password an address may carry: git's words
      // name the address, and they are sent on to whoever asked, while what git
      // said whole stays in the cause.
      const shownSource = URL.canParse(source)
        ? Object.assign(new URL(source), { username: "", password: "" }).href
        : source;
      throw new UnreachableSourceFault(
        `${shownSource} could not be fetched: ${`${raisedValue}`.replaceAll(source, shownSource)}`,
        version === undefined
          ? "Check the address, and that you can reach it from here."
          : `Check the address, and that "${version}" is a tag or branch it has.`,
        // Refused in git's own words: the source is the caller's own, and what
        // git says of it is theirs to read.
        { internal: false, cause: raisedValue },
      );
    }
  }

  /** `git ls-tree -r`, the paths split on the NUL `-z` ends each with, so a
   *  path holding a newline or a quote is read as it is. */
  async listFilesAt(commit: string): Promise<readonly string[]> {
    const storeFolderPath = commit;
    try {
      const { stdout } = await runGit("git", ["ls-tree", "-r", "-z", "--name-only", FETCHED_REF], {
        cwd: storeFolderPath,
        env: { ...process.env, GIT_DIR: storeFolderPath },
        maxBuffer: 64 * 1024 * 1024,
      });
      return stdout.split("\0").filter((path) => path !== "");
    } catch (raisedValue) {
      throw new UnreadableFetchedSourceFault(
        "The fetched source could not be listed.",
        "Fetch the source again, and check it can be read.",
        { internal: false, cause: raisedValue },
      );
    }
  }

  /** `git show FETCH_HEAD:<path>`. */
  async readFileAt(commit: string, path: string): Promise<string> {
    const storeFolderPath = commit;
    try {
      return (
        await runGit("git", ["show", `${FETCHED_REF}:${path}`], {
          cwd: storeFolderPath,
          env: { ...process.env, GIT_DIR: storeFolderPath },
          maxBuffer: 64 * 1024 * 1024,
        })
      ).stdout;
    } catch (raisedValue) {
      throw new UnreadableFetchedSourceFault(
        `The fetched source has no readable "${path}".`,
        `Check that the source holds "${path}", and that it is under 64 MiB.`,
        { internal: false, cause: raisedValue },
      );
    }
  }

  /** `git cat-file blob FETCH_HEAD:<path>`, its output taken as bytes: the
   *  blob as it was committed, with no textconv a user's own git config sets
   *  (CORE-FR-207). */
  async readBytesAt(commit: string, path: string): Promise<Uint8Array> {
    const storeFolderPath = commit;
    try {
      return new Uint8Array(
        (
          await runGit("git", ["cat-file", "blob", `${FETCHED_REF}:${path}`], {
            cwd: storeFolderPath,
            env: { ...process.env, GIT_DIR: storeFolderPath },
            maxBuffer: 64 * 1024 * 1024,
            encoding: "buffer",
          })
        ).stdout,
      );
    } catch (raisedValue) {
      throw new UnreadableFetchedSourceFault(
        `The fetched source has no readable "${path}".`,
        `Check that the source holds "${path}", and that it is under 64 MiB.`,
        { internal: false, cause: raisedValue },
      );
    }
  }

  /** `git read-tree --prefix` into an index of the store's, and `checkout-index`
   *  into a work tree of the store's, then a copy beside the folder, swapped with
   *  it once whole, the folder put back if the swap fails. The
   *  repository's own index, and what is staged in it, is never read from or
   *  written to. */
  async checkOutFolder(commit: string, fromFolder: string, intoSubFolder: string): Promise<void> {
    const storeFolderPath = commit;
    const repoFolderPath = fileURLToPath(this.#repoFolder);
    const checkoutFolderPath = join(storeFolderPath, "cw-checkout");
    const intoFolderPath = join(repoFolderPath, intoSubFolder);
    const copyFolderPath = `${intoFolderPath}.cw-checkout`;
    const previousFolderPath = `${intoFolderPath}.cw-previous`;
    // A link a source put on the way here would carry all that follows out of its folder (CORE-FR-044).
    const intoFolderNames = intoSubFolder.split("/");
    for (const [folderNameIndex] of intoFolderNames.entries()) {
      const stepPath = intoFolderNames.slice(0, folderNameIndex + 1).join("/");
      const stepStats = await lstat(join(repoFolderPath, stepPath)).catch(() => undefined);
      if (stepStats === undefined) break;
      if (stepStats.isSymbolicLink())
        throw new LinkedFolderFault(
          `"${stepPath}" is a link, and nothing is written through one.`,
          `Delete "${stepPath}", and run this again.`,
          { internal: false },
        );
    }
    const checkoutEnv = {
      ...process.env,
      GIT_DIR: storeFolderPath,
      GIT_WORK_TREE: checkoutFolderPath,
      GIT_INDEX_FILE: join(storeFolderPath, "cw-checkout-index"),
    };
    try {
      for (const staleFolderPath of [checkoutFolderPath, copyFolderPath, previousFolderPath])
        await rm(staleFolderPath, { recursive: true, force: true });
      await rm(checkoutEnv.GIT_INDEX_FILE, { force: true });
      await mkdir(checkoutFolderPath);
      await runGit(
        "git",
        ["read-tree", `--prefix=${intoSubFolder}/`, fromFolder === "" ? FETCHED_REF : `${FETCHED_REF}:${fromFolder}`],
        { cwd: checkoutFolderPath, env: checkoutEnv },
      );
      await runGit("git", ["checkout-index", "--all", "--force"], { cwd: checkoutFolderPath, env: checkoutEnv });
      await cp(join(checkoutFolderPath, intoSubFolder), copyFolderPath, { recursive: true, verbatimSymlinks: true });
      await rename(intoFolderPath, previousFolderPath).catch((renameError: NodeJS.ErrnoException) => {
        if (renameError.code !== "ENOENT") throw renameError;
      });
      await rename(copyFolderPath, intoFolderPath);
    } catch (checkoutError) {
      await rm(copyFolderPath, { recursive: true, force: true });
      await rename(previousFolderPath, intoFolderPath).catch((renameError: NodeJS.ErrnoException) => {
        if (renameError.code !== "ENOENT")
          throw new UnrestoredFolderFault(
            `What "${intoSubFolder}" held could not be put back.`,
            `What "${intoSubFolder}" held is in "${intoSubFolder}.cw-previous": put it back by hand.`,
            { internal: false, cause: renameError },
          );
      });
      throw new FailedCheckoutFault(
        `"${intoSubFolder}" could not be checked out.`,
        `Check that "${intoSubFolder}" can be written, and run this again.`,
        { internal: false, cause: checkoutError },
      );
    }
    await rm(previousFolderPath, { recursive: true, force: true }).catch((rmError: unknown) => {
      throw new LeftoverFolderFault(
        `"${intoSubFolder}.cw-previous" could not be deleted.`,
        `"${intoSubFolder}" is in place: delete "${intoSubFolder}.cw-previous" beside it.`,
        { internal: false, cause: rmError },
      );
    });
  }

  /** A store left behind is only a temporary folder, and never worth reporting
   *  a source that landed as one that failed. */
  async removeFetchedCommit(commit: string): Promise<void> {
    const storeFolderPath = commit;
    await rm(storeFolderPath, { recursive: true, force: true }).catch(() => undefined);
  }
}
