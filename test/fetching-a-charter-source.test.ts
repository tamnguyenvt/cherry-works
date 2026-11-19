import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readdir, readFile, readlink, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { GitSources } from "../src/module/charter/infra/git-sources.adapter.js";
import { AdapterFault } from "../src/module/shared/domain/models/adapter.fault.js";
import { FileOutput } from "../src/module/shared/infra/file-output.adapter.js";
import { FileReaders } from "../src/module/shared/infra/file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { answerOf, faultTextOf } from "./answer-of.js";
import { authoringCharterOf } from "./use-cases-of.js";

const run = promisify(execFile);
/** What is asked of a commit already fetched — its files, letting it go —
 *  is the same whichever repository fetched it. */
const gitSources = new GitSources(pathToFileURL(`${tmpdir()}/`));

/** Git as a test runs it: an author of its own, nothing signed, so what is
 *  committed here does not depend on whose machine this is. */
const commit = (cwd: string, message: string) =>
  run("git", ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgSign=false", "commit", "-qm", message], {
    cwd,
  });

/** A temporary directory, taken away when the test that asked for it is done. */
async function temporary(t: { after(fn: () => unknown): void }, name: string): Promise<string> {
  const at = await mkdtemp(join(tmpdir(), `cw-${name}-`));
  t.after(() => rm(at, { recursive: true, force: true }));
  return at;
}

/** The folder of the one charter `published` authors, `base`. */
const PUBLISHED_CHARTER_FOLDER = ".cw/charter/base";

/** A repository to install from: one guide in the charter it authors, a README
 *  beside its charter, one commit, one tag. A path on disk is a
 *  source git fetches like any other, so the adapter is exercised whole
 *  without a network. */
async function published(t: { after(fn: () => unknown): void }, body = "Reject any."): Promise<string> {
  const source = join(await temporary(t, "source"), "charter");
  await mkdir(join(source, PUBLISHED_CHARTER_FOLDER, "primitive", "guide", "no-any"), { recursive: true });
  await writeFile(
    join(source, PUBLISHED_CHARTER_FOLDER, "primitive", "guide", "no-any", "index.md"),
    `---\nkind: guide\n---\n\n${body}\n`,
  );
  await writeFile(join(source, "README.md"), "Not part of the charter.\n");
  await run("git", ["init", "-q", "-b", "main"], { cwd: source });
  await run("git", ["add", "."], { cwd: source });
  await commit(source, "one");
  await run("git", ["-c", "tag.gpgSign=false", "-c", "tag.forceSignAnnotated=false", "tag", "v1.0.0"], {
    cwd: source,
  });
  return source;
}

/** A repository to install into: versioned, with the one commit a subtree needs
 *  to land on, and nothing in hand. */
async function repository(t: { after(fn: () => unknown): void }): Promise<string> {
  const repo = await temporary(t, "repo");
  await run("git", ["init", "-q", "-b", "main"], { cwd: repo });
  await writeFile(join(repo, "README.md"), "one\n");
  await run("git", ["add", "."], { cwd: repo });
  await commit(repo, "one");
  return repo;
}

/** One source installed into one repository the way installing does it: the
 *  source fetched at this version, and its charter folder checked out at
 *  `.cw/charter/base`. Which folders those are is the hexagon's to decide; the
 *  adapter is told. */
async function installed(source: string, repo: string, version?: string): Promise<void> {
  const repoUrl = pathToFileURL(`${repo}/`);
  const fetchedCommit = await new GitSources(repoUrl).fetchCommit(source, version);
  await new GitSources(repoUrl).checkOutFolder(fetchedCommit, PUBLISHED_CHARTER_FOLDER, ".cw/charter/base");
  await gitSources.removeFetchedCommit(fetchedCommit);
}

/** What the installed guide says in this repository, read off disk. */
const installedGuideTextOf = (repo: string) =>
  readFile(join(repo, ".cw", "charter", "base", "primitive", "guide", "no-any", "index.md"), "utf8");

test("a source's charter folder checked out at its commit lands where it is told, left unstaged and uncommitted (CORE Story 2 scenario 1)", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  const { stdout: headBefore } = await run("git", ["rev-parse", "HEAD"], { cwd: repo });

  await installed(source, repo);

  assert.match(await installedGuideTextOf(repo), /Reject any\./);
  await assert.rejects(readFile(join(repo, ".cw", "charter", "base", "README.md")), "only the folder asked for lands");
  const { stdout: headAfter } = await run("git", ["rev-parse", "HEAD"], { cwd: repo });
  assert.equal(headAfter, headBefore, "nothing is committed");
  const { stdout: stagedFiles } = await run("git", ["diff", "--cached", "--name-only"], { cwd: repo });
  assert.equal(stagedFiles.trim(), "", "nothing is staged");
});

test("installing with work in hand leaves that work as it was, staged or not", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  await writeFile(join(repo, "README.md"), "two\n");
  await writeFile(join(repo, "staged.md"), "staged\n");
  await run("git", ["add", "staged.md"], { cwd: repo });

  await installed(source, repo);

  assert.match(await installedGuideTextOf(repo), /Reject any\./);
  const { stdout: stagedFiles } = await run("git", ["diff", "--cached", "--name-only"], { cwd: repo });
  assert.equal(stagedFiles.trim(), "staged.md");
  assert.equal(await readFile(join(repo, "README.md"), "utf8"), "two\n");
});

test("a version names what is fetched", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];

  await installed(source, repo, "v1.0.0");

  assert.match(await installedGuideTextOf(repo), /Reject any\./);
});

test("installing a source already there brings it up to date (CORE Story 2 scenario 3)", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  await installed(source, repo);

  await writeFile(
    join(source, PUBLISHED_CHARTER_FOLDER, "primitive", "guide", "no-any", "index.md"),
    "---\nkind: guide\n---\n\nReject it everywhere.\n",
  );
  await run("git", ["add", "."], { cwd: source });
  await commit(source, "two");

  await installed(source, repo);

  assert.match(await installedGuideTextOf(repo), /Reject it everywhere\./);
});

test("installing again what is already committed there leaves nothing in hand", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  await installed(source, repo);
  await run("git", ["add", "."], { cwd: repo });
  await commit(repo, "installed");

  await installed(source, repo);

  const { stdout } = await run("git", ["status", "--porcelain"], { cwd: repo });
  assert.equal(stdout.trim(), "");
});

test("a version the source has not got is refused in git's own words, fetching nothing", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];

  const fetchFault = await new GitSources(pathToFileURL(`${repo}/`))
    .fetchCommit(source, "v9.9.9")
    .catch((gitFault: unknown) => gitFault);

  assert.ok(fetchFault instanceof AdapterFault, String(fetchFault));
  assert.match(fetchFault.fix, /tag or branch/);
  await assert.rejects(installedGuideTextOf(repo));
});

test("a source refused with a user and password in its address names it without them, git's words whole in the cause (SDK-FR-018)", async (t) => {
  const repo = await repository(t);

  const fetchFault = await new GitSources(pathToFileURL(`${repo}/`))
    .fetchCommit("https://reader:tok-very-secret@127.0.0.1:1/team/charter.git")
    .catch((gitFault: unknown) => gitFault);

  assert.ok(fetchFault instanceof AdapterFault, String(fetchFault));
  assert.match(fetchFault.message, /https:\/\/127\.0\.0\.1:1\/team\/charter\.git could not be fetched/);
  assert.doesNotMatch(fetchFault.message, /tok-very-secret|reader/);
});

test("a source that cannot be reached is refused in git's own words", async (t) => {
  const repo = await repository(t);

  const fetchFault = await new GitSources(pathToFileURL(`${repo}/`))
    .fetchCommit(join(repo, "nothing-here"))
    .catch((gitFault: unknown) => gitFault);

  assert.ok(fetchFault instanceof AdapterFault, String(fetchFault));
  assert.match(fetchFault.message, /repository|does not exist/);
});

test("a source lands in a folder with no version control, and no .git is left there (CORE-FR-205)", async (t) => {
  const [source, folder] = [await published(t), await temporary(t, "plain")];

  await installed(source, folder);

  assert.match(await installedGuideTextOf(folder), /Reject any\./);
  await assert.rejects(readFile(join(folder, ".git", "HEAD")), "the folder stays no repository");
});

test("a fetch leaves nothing in the repository's own object store, and what is forgotten is gone", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  const repoUrl = pathToFileURL(`${repo}/`);

  const fetchedCommit = await new GitSources(repoUrl).fetchCommit(source);

  await assert.rejects(readFile(join(repo, ".git", "FETCH_HEAD")));
  await gitSources.removeFetchedCommit(fetchedCommit);
  await assert.rejects(gitSources.listFilesAt(fetchedCommit));
});

test("a source is reached under the repository's own git config (CORE Story 37 scenario 6)", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  await run("git", ["config", "--local", `url.${source}.insteadOf`, "cw-team:charter"], { cwd: repo });
  const repoUrl = pathToFileURL(`${repo}/`);

  const fetchedCommit = await new GitSources(repoUrl).fetchCommit("cw-team:charter");
  t.after(() => gitSources.removeFetchedCommit(fetchedCommit));
  await new GitSources(repoUrl).checkOutFolder(fetchedCommit, PUBLISHED_CHARTER_FOLDER, ".cw/charter/base");

  assert.match(await installedGuideTextOf(repo), /Reject any\./);
  const { stdout } = await run("git", ["status", "--porcelain"], { cwd: repo });
  assert.equal(stdout.trim(), "?? .cw/");
});

test("a repository's config that applies only where it stands reaches the fetch too (CORE Story 37 scenario 6)", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  const conditionalConfigFile = join(repo, ".git", "cw-conditional-config");
  await run("git", ["config", "--file", conditionalConfigFile, `url.${source}.insteadOf`, "cw-team:charter"]);
  const { stdout: repoGitFolder } = await run("git", ["rev-parse", "--absolute-git-dir"], { cwd: repo });
  await run("git", ["config", "--local", `includeIf.gitdir:${repoGitFolder.trim()}.path`, conditionalConfigFile], {
    cwd: repo,
  });

  const fetchedCommit = await new GitSources(pathToFileURL(`${repo}/`)).fetchCommit("cw-team:charter");
  t.after(() => gitSources.removeFetchedCommit(fetchedCommit));

  assert.ok((await gitSources.listFilesAt(fetchedCommit)).includes("README.md"));
});

test("a repository whose config includes a file by a relative path still fetches, under what that file says (CORE Story 37 scenario 6)", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  await run("git", [
    "config",
    "--file",
    join(repo, ".git", "cw-included-config"),
    `url.${source}.insteadOf`,
    "cw-team:charter",
  ]);
  await run("git", ["config", "--local", "include.path", "cw-included-config"], { cwd: repo });

  const fetchedCommit = await new GitSources(pathToFileURL(`${repo}/`)).fetchCommit("cw-team:charter");
  t.after(() => gitSources.removeFetchedCommit(fetchedCommit));

  assert.ok((await gitSources.listFilesAt(fetchedCommit)).includes("README.md"));
});

test("a global config reaches the fetch, read once (CORE Story 37 scenario 6)", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  const globalConfigFile = join(await temporary(t, "global"), "gitconfig");
  await run("git", ["config", "--file", globalConfigFile, `url.${source}.insteadOf`, "cw-team:charter"]);
  const keptGlobal = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = globalConfigFile;
  t.after(() => {
    if (keptGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
    else process.env.GIT_CONFIG_GLOBAL = keptGlobal;
  });

  const fetchedCommit = await new GitSources(pathToFileURL(`${repo}/`)).fetchCommit("cw-team:charter");
  t.after(() => gitSources.removeFetchedCommit(fetchedCommit));

  assert.ok((await gitSources.listFilesAt(fetchedCommit)).includes("README.md"));
});

test("a machine with no git is told git is what reaches a source (CORE-FR-205)", async (t) => {
  const repo = await temporary(t, "plain");
  const keptPath = process.env.PATH;
  process.env.PATH = "";
  t.after(() => {
    process.env.PATH = keptPath;
  });

  const fetchFault = await new GitSources(pathToFileURL(`${repo}/`))
    .fetchCommit("team/charter")
    .catch((gitFault: unknown) => gitFault);

  assert.ok(fetchFault instanceof AdapterFault, String(fetchFault));
  assert.match(fetchFault.fix, /needs git: install it/);
});

/** Installing as `cw` runs it on a disk, into this folder. */
const charterAuthoringIn = (folder: string) =>
  authoringCharterOf(
    new FileReaders(pathToFileURL(`${folder}/`)),
    new FileOutput(pathToFileURL(`${folder}/`)),
    new InMemoryReporter(),
    { sourceFetcher: new GitSources(pathToFileURL(`${folder}/`)) },
  );

test("in a folder with no version control, a source is installed, then removed with its folder gone (CORE Story 37 scenarios 1, 2)", async (t) => {
  const [source, folder] = [await published(t), await temporary(t, "plain")];
  await writeFile(join(folder, "work.txt"), "In hand.\n");
  const charterAuthoringApp = charterAuthoringIn(folder);

  const [{ folder: installedUri } = { folder: "" }] = answerOf(
    await charterAuthoringApp.pullCharters(source, false),
  ).data;
  const installedFolder = relative(folder, fileURLToPath(installedUri));
  const installedCharterName = basename(installedFolder);
  await charterAuthoringApp.removeCharters(installedCharterName, false, false);

  await assert.rejects(stat(join(folder, installedFolder)), "its folder is gone");
  assert.equal(await readFile(join(folder, "work.txt"), "utf8"), "In hand.\n");
});

test("in a repository with work in hand, removing commits nothing and leaves that work as it was (CORE Story 37 scenario 2, CORE Story 2 scenario 3)", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  const charterAuthoringApp = charterAuthoringIn(repo);
  const [{ folder: installedUri } = { folder: "" }] = answerOf(
    await charterAuthoringApp.pullCharters(source, false),
  ).data;
  const installedFolder = relative(repo, fileURLToPath(installedUri));
  await run("git", ["add", "."], { cwd: repo });
  await commit(repo, "installed");
  await writeFile(join(repo, "README.md"), "two\n");
  await writeFile(join(repo, "staged.md"), "staged\n");
  await run("git", ["add", "staged.md"], { cwd: repo });
  const { stdout: headBefore } = await run("git", ["rev-parse", "HEAD"], { cwd: repo });

  await charterAuthoringApp.removeCharters(basename(installedFolder), false, false);

  const { stdout: headAfter } = await run("git", ["rev-parse", "HEAD"], { cwd: repo });
  assert.equal(headAfter, headBefore, "nothing is committed");
  const { stdout: stagedFiles } = await run("git", ["diff", "--cached", "--name-only"], { cwd: repo });
  assert.equal(stagedFiles.trim(), "staged.md");
  assert.equal(await readFile(join(repo, "README.md"), "utf8"), "two\n");
  await assert.rejects(stat(join(repo, installedFolder)));
});

test("an installed charter's folder goes whole, whatever it held, and never what is above it (CORE-FR-204, VENDOR Story 3 scenario 21)", async (t) => {
  const [source, folder] = [await published(t), await temporary(t, "plain")];
  const charterAuthoringApp = charterAuthoringIn(folder);
  const [{ folder: installedUri } = { folder: "" }] = answerOf(
    await charterAuthoringApp.pullCharters(source, false),
  ).data;
  const installedFolder = relative(folder, fileURLToPath(installedUri));
  await symlink("nowhere", join(folder, installedFolder, "dangling"));
  await mkdir(join(folder, installedFolder, "empty"));

  await charterAuthoringApp.removeCharters(basename(installedFolder), false, false);

  await assert.rejects(stat(join(folder, installedFolder)), "the charter's folder goes");
  assert.ok((await stat(join(folder, ".cw", "charter"))).isDirectory(), "what is above it stays");
  assert.ok((await stat(folder)).isDirectory());
});

test("a link beside the installed charter stays (CORE-FR-204)", async (t) => {
  const [source, folder] = [await published(t), await temporary(t, "plain")];
  const charterAuthoringApp = charterAuthoringIn(folder);
  const [{ folder: installedUri } = { folder: "" }] = answerOf(
    await charterAuthoringApp.pullCharters(source, false),
  ).data;
  const installedFolder = relative(folder, fileURLToPath(installedUri));
  const chartersFolder = join(folder, installedFolder, "..");
  await symlink("nowhere", join(chartersFolder, "link"));

  await charterAuthoringApp.removeCharters(basename(installedFolder), false, false);

  assert.equal(await readlink(join(chartersFolder, "link")), "nowhere");
});

test("another charter beside the one removed stays (VENDOR Story 3 scenario 21)", async (t) => {
  const [source, folder] = [await published(t), await temporary(t, "plain")];
  const charterAuthoringApp = charterAuthoringIn(folder);
  const [{ folder: installedUri } = { folder: "" }] = answerOf(
    await charterAuthoringApp.pullCharters(source, false),
  ).data;
  const installedFolder = relative(folder, fileURLToPath(installedUri));
  const chartersFolder = join(folder, installedFolder, "..");
  await mkdir(join(chartersFolder, "other", "guide"), { recursive: true });
  await writeFile(join(chartersFolder, "other", "README.md"), "Other.\n");

  await charterAuthoringApp.removeCharters(basename(installedFolder), false, false);

  assert.equal(await readFile(join(chartersFolder, "other", "README.md"), "utf8"), "Other.\n");
});

test("installing over a folder replaces it whole, and leaves no copy beside it (CORE-FR-205)", async (t) => {
  const [source, folder] = [await published(t), await temporary(t, "plain")];
  await mkdir(join(folder, ".cw", "charter", "base"), { recursive: true });
  await writeFile(join(folder, ".cw", "charter", "base", "stale.md"), "From before.\n");

  await installed(source, folder);

  await assert.rejects(readFile(join(folder, ".cw", "charter", "base", "stale.md")));
  assert.deepEqual(await readdir(join(folder, ".cw", "charter")), ["base"]);
});

test("a folder that cannot be written keeps what it held, with a fault saying so (CORE-FR-205)", async (t) => {
  const [source, folder] = [await published(t), await temporary(t, "plain")];
  const folderUrl = pathToFileURL(`${folder}/`);
  await mkdir(join(folder, ".cw", "charter", "base"), { recursive: true });
  await writeFile(join(folder, ".cw", "charter", "base", "kept.md"), "Kept.\n");
  const fetchedCommit = await new GitSources(folderUrl).fetchCommit(source);
  t.after(() => gitSources.removeFetchedCommit(fetchedCommit));
  await chmod(join(folder, ".cw", "charter"), 0o555);

  await assert.rejects(
    new GitSources(folderUrl).checkOutFolder(fetchedCommit, PUBLISHED_CHARTER_FOLDER, ".cw/charter/base"),
    (raised: unknown) => {
      assert.ok(raised instanceof AdapterFault);
      assert.equal(raised.internal, false);
      assert.match(raised.message, /could not be checked out/);
      assert.doesNotMatch(raised.message, /EACCES|EPERM|Error:/);
      return true;
    },
  );
  await chmod(join(folder, ".cw", "charter"), 0o755);

  assert.equal(await readFile(join(folder, ".cw", "charter", "base", "kept.md"), "utf8"), "Kept.\n");
});

test("a folder that cannot be taken away is a fault with its fix, not a raw error", async (t) => {
  const folder = await temporary(t, "plain");
  await mkdir(join(folder, "locked", "inner"), { recursive: true });
  await chmod(join(folder, "locked"), 0o555);

  await assert.rejects(new FileOutput(pathToFileURL(`${folder}/`)).deleteFolder("locked/inner"), AdapterFault);
  await chmod(join(folder, "locked"), 0o755);
});

test("a checkout git refuses leaves what the folder held (CORE-FR-205)", async (t) => {
  const [source, folder] = [await published(t), await temporary(t, "plain")];
  const folderUrl = pathToFileURL(`${folder}/`);
  await mkdir(join(folder, ".cw", "charter", "base"), { recursive: true });
  await writeFile(join(folder, ".cw", "charter", "base", "kept.md"), "Kept.\n");
  const fetchedCommit = await new GitSources(folderUrl).fetchCommit(source);
  t.after(() => gitSources.removeFetchedCommit(fetchedCommit));

  await assert.rejects(
    new GitSources(folderUrl).checkOutFolder(fetchedCommit, "no-such-folder", ".cw/charter/base"),
    AdapterFault,
  );

  assert.equal(await readFile(join(folder, ".cw", "charter", "base", "kept.md"), "utf8"), "Kept.\n");
});

/** A source of two charters to take from: `grill`, whose guide `grill-me`
 *  keeps an asset two folders down, and `grilling`; one commit. */
async function publishedCharters(t: { after(fn: () => unknown): void }): Promise<string> {
  const source = join(await temporary(t, "charters"), "charters");
  const grillMeFolder = join(source, ".cw", "charter", "grill", "primitive", "guide", "grill-me");
  const grillingFolder = join(source, ".cw", "charter", "grilling", "primitive", "guide", "grilling");
  await mkdir(join(grillMeFolder, "agents", "deep"), { recursive: true });
  await mkdir(grillingFolder, { recursive: true });
  await writeFile(
    join(grillMeFolder, "index.md"),
    "---\nkind: guide\nid: grill-me\ndescription: Grill.\n---\n\nGrill me.\n",
  );
  await writeFile(join(grillMeFolder, "agents", "deep", "openai.yaml"), "model: x\n");
  await writeFile(
    join(grillingFolder, "index.md"),
    "---\nkind: guide\nid: grilling\ndescription: Grilling.\n---\n\nGrill.\n",
  );
  await run("git", ["init", "-q", "-b", "main"], { cwd: source });
  await run("git", ["add", "."], { cwd: source });
  await commit(source, "one");
  return source;
}

/** The folder of the guide `grilling` in the source `publishedCharters` makes. */
const GRILLING_FOLDER = ".cw/charter/grilling/primitive/guide/grilling";

test("a link a source holds carries no write out of its installed charter folder (CORE-FR-044)", async (t) => {
  const [source, folder] = [await publishedCharters(t), await temporary(t, "plain")];
  await writeFile(join(folder, "CLAUDE.md"), "Mine.\n");
  await symlink("../../../../../../CLAUDE.md", join(source, GRILLING_FOLDER, "notes.md"));
  await run("git", ["add", "."], { cwd: source });
  await commit(source, "two");

  await charterAuthoringIn(folder).pullCharters(source, false, undefined, ["grilling"]);

  assert.equal(await readFile(join(folder, "CLAUDE.md"), "utf8"), "Mine.\n");
});

test("a link a source holds for its README carries no write out of its installed charter folder (CORE-FR-044)", async (t) => {
  const [source, folder] = [await published(t), await temporary(t, "plain")];
  await writeFile(join(folder, "CLAUDE.md"), "Mine.\n");
  await symlink("../../../../CLAUDE.md", join(source, PUBLISHED_CHARTER_FOLDER, "README.md"));
  await run("git", ["add", "."], { cwd: source });
  await commit(source, "two");

  await charterAuthoringIn(folder).pullCharters(source, false);

  assert.equal(await readFile(join(folder, "CLAUDE.md"), "utf8"), "Mine.\n");
});

test("a link a source left on the way to a folder carries no later install through it (CORE Story 37 scenario 5)", async (t) => {
  const [source, folder] = [await publishedCharters(t), await temporary(t, "plain")];
  const charterFile = join(folder, ".cw", "charter", "team", "primitive", "guide", "mine", "index.md");
  await mkdir(join(charterFile, ".."), { recursive: true });
  await writeFile(charterFile, "Mine.\n");
  // The charter installed from this source, as an install left it, with a
  // link where its guides go.
  const installedCharterFolder = join(folder, ".cw", "charter", "grilling");
  await mkdir(join(installedCharterFolder, "primitive"), { recursive: true });
  await writeFile(
    join(installedCharterFolder, "cw-package.json"),
    `${JSON.stringify({ charter: "grilling", source, version: "HEAD" })}\n`,
  );
  await symlink("../../../..", join(installedCharterFolder, "primitive", "guide"));

  assert.match(
    faultTextOf(await charterAuthoringIn(folder).pullCharters(source, false, undefined, ["grilling"])),
    /is a link/,
  );

  assert.equal(await readFile(charterFile, "utf8"), "Mine.\n");
});

test("a file a source names to climb out of a primitive's folder lands inside it when injected (CORE Story 37 scenario 5)", async (t) => {
  const [source, folder] = [await publishedCharters(t), await temporary(t, "plain")];
  await writeFile(join(folder, "CLAUDE.md"), "Mine.\n");
  const climbingFolder = join(source, GRILLING_FOLDER, "%2e%2e", "%2e%2e", "%2e%2e", "%2e%2e");
  await mkdir(climbingFolder, { recursive: true });
  await writeFile(join(climbingFolder, "CLAUDE.md"), "Theirs.\n");
  await run("git", ["add", "."], { cwd: source });
  await commit(source, "two");

  answerOf(await charterAuthoringIn(folder).pullCharters(source, true, undefined, ["grilling"]));

  assert.equal(await readFile(join(folder, "CLAUDE.md"), "utf8"), "Mine.\n");
  assert.equal(
    await readFile(join(folder, GRILLING_FOLDER, "%2e%2e", "%2e%2e", "%2e%2e", "%2e%2e", "CLAUDE.md"), "utf8"),
    "Theirs.\n",
  );
});

test("a version the source has not got is refused when injected as installed charter add refuses it, and nothing is written (CORE Story 34 scenario 6, CORE-FR-198, CORE Story 55 scenario 8)", async (t) => {
  const [source, injectFolder, addFolder] = [
    await published(t),
    await temporary(t, "inject"),
    await temporary(t, "add"),
  ];

  const injectRefusalText = faultTextOf(await charterAuthoringIn(injectFolder).pullCharters(source, true, "v9.9.9"));
  const addRefusalText = faultTextOf(await charterAuthoringIn(addFolder).pullCharters(source, false, "v9.9.9"));

  assert.match(injectRefusalText, /tag or branch/);
  assert.equal(injectRefusalText, addRefusalText.replaceAll(addFolder, injectFolder));
  assert.deepEqual(await readdir(injectFolder), []);
});

test("in a folder with no version control, a charter is injected as in a repository, and another installed there too (CORE Story 37 scenario 1)", async (t) => {
  const [source, folder] = [await publishedCharters(t), await temporary(t, "plain")];
  const charterAuthoringApp = charterAuthoringIn(folder);

  answerOf(await charterAuthoringApp.pullCharters(source, true, undefined, ["grilling"]));
  answerOf(await charterAuthoringApp.pullCharters(source, false, undefined, ["grill"], "installed-grill"));

  assert.match(await readFile(join(folder, GRILLING_FOLDER, "index.md"), "utf8"), /Grill\./);
  assert.equal(answerOf(await charterAuthoringApp.listCharters(true)).data.charters.length, 1);
});

test("a source fetched once is read at its commit: every file it holds, and what one holds (VENDOR-FR-017)", async (t) => {
  const [source, repo] = [await publishedCharters(t), await repository(t)];
  const repoUrl = pathToFileURL(`${repo}/`);

  const fetchedCommit = await new GitSources(repoUrl).fetchCommit(source);

  assert.deepEqual([...(await gitSources.listFilesAt(fetchedCommit))].sort(), [
    ".cw/charter/grill/primitive/guide/grill-me/agents/deep/openai.yaml",
    ".cw/charter/grill/primitive/guide/grill-me/index.md",
    `${GRILLING_FOLDER}/index.md`,
  ]);
  assert.equal(
    await gitSources.readFileAt(fetchedCommit, `${GRILLING_FOLDER}/index.md`),
    "---\nkind: guide\nid: grilling\ndescription: Grilling.\n---\n\nGrill.\n",
  );
});

test("one folder of a commit fetched is checked out over a folder here, whole, left unstaged and uncommitted (CORE-FR-196, CORE Story 33 scenario 4)", async (t) => {
  const [source, repo] = [await publishedCharters(t), await repository(t)];
  const repoUrl = pathToFileURL(`${repo}/`);
  const fetchedCommit = await new GitSources(repoUrl).fetchCommit(source);
  const grillMeFolder = ".cw/charter/grill/primitive/guide/grill-me";
  await mkdir(join(repo, grillMeFolder), { recursive: true });
  await writeFile(join(repo, grillMeFolder, "stale.md"), "From before.\n");
  await mkdir(join(repo, ".cw/charter/grill/primitive/guide/grilling"), { recursive: true });
  await writeFile(join(repo, ".cw/charter/grill/primitive/guide/grilling/index.md"), "Kept.\n");
  const { stdout: headBefore } = await run("git", ["rev-parse", "HEAD"], { cwd: repo });

  await new GitSources(repoUrl).checkOutFolder(fetchedCommit, grillMeFolder, grillMeFolder);

  assert.equal(await readFile(join(repo, grillMeFolder, "agents", "deep", "openai.yaml"), "utf8"), "model: x\n");
  assert.match(await readFile(join(repo, grillMeFolder, "index.md"), "utf8"), /id: grill-me/);
  await assert.rejects(
    () => readFile(join(repo, grillMeFolder, "stale.md"), "utf8"),
    "what the folder held is replaced whole",
  );
  assert.equal(
    await readFile(join(repo, ".cw/charter/grill/primitive/guide/grilling/index.md"), "utf8"),
    "Kept.\n",
    "a folder beside it is left as it was",
  );
  const { stdout: headAfter } = await run("git", ["rev-parse", "HEAD"], { cwd: repo });
  assert.equal(headAfter, headBefore, "nothing is committed");
  const { stdout: stagedFiles } = await run("git", ["diff", "--cached", "--name-only"], { cwd: repo });
  assert.equal(stagedFiles.trim(), "", "nothing is staged");
});

test("a link to a folder kept under the charter root is refused naming it, and nothing is read through it (CORE-FR-044)", async (t) => {
  const [folder, elsewhere] = [await temporary(t, "plain"), await temporary(t, "elsewhere")];
  await writeFile(join(elsewhere, "secret.md"), "Not the charter's.\n");
  const guideFolder = join(folder, ".cw", "charter", "team", "primitive", "guide", "mine");
  await mkdir(guideFolder, { recursive: true });
  await writeFile(join(guideFolder, "index.md"), "---\nkind: guide\nid: mine\ndescription: Mine.\n---\n");
  await symlink(elsewhere, join(guideFolder, "linked"));

  await assert.rejects(
    new FileReaders(pathToFileURL(`${folder}/`)).readFilesRecursively(".cw/charter"),
    /"\.cw\/charter\/team\/primitive\/guide\/mine\/linked" is a link to a folder/,
  );
});
