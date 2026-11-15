import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readdir, readFile, readlink, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
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

/** The folder of the one charter `published` keeps, under `charters/`. */
const PUBLISHED_CHARTER_FOLDER = "charters/base/.cw/charter/primitive";

/** A repository to install from: one guide under the charter it keeps under
 *  `charters/`, a README beside it, one commit, one tag. A path on disk is a
 *  source git fetches like any other, so the adapter is exercised whole
 *  without a network. */
async function published(t: { after(fn: () => unknown): void }, body = "Reject any."): Promise<string> {
  const source = join(await temporary(t, "source"), "charter");
  await mkdir(join(source, PUBLISHED_CHARTER_FOLDER, "guide", "no-any"), { recursive: true });
  await writeFile(
    join(source, PUBLISHED_CHARTER_FOLDER, "guide", "no-any", "index.md"),
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

/** One source installed into one repository the way vendoring does it: the
 *  source fetched at this version, and its charter folder checked out at
 *  `.cw/charter/vendor/charter`. Which folders those are is the hexagon's to decide; the
 *  adapter is told. */
async function installed(source: string, repo: string, version?: string): Promise<void> {
  const repoUrl = pathToFileURL(`${repo}/`);
  const fetchedCommit = await new GitSources(repoUrl).fetchCommit(source, version);
  await new GitSources(repoUrl).checkOutFolder(fetchedCommit, PUBLISHED_CHARTER_FOLDER, ".cw/charter/vendor/charter");
  await gitSources.removeFetchedCommit(fetchedCommit);
}

/** What the vendored guide says in this repository, read off disk. */
const vendored = (repo: string) =>
  readFile(join(repo, ".cw", "charter", "vendor", "charter", "guide", "no-any", "index.md"), "utf8");

test("a source's charter folder checked out at its commit lands where it is told, left unstaged and uncommitted (CORE Story 2 scenario 1)", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  const { stdout: headBefore } = await run("git", ["rev-parse", "HEAD"], { cwd: repo });

  await installed(source, repo);

  assert.match(await vendored(repo), /Reject any\./);
  await assert.rejects(
    readFile(join(repo, ".cw", "charter", "vendor", "charter", "README.md")),
    "only the folder asked for lands",
  );
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

  assert.match(await vendored(repo), /Reject any\./);
  const { stdout: stagedFiles } = await run("git", ["diff", "--cached", "--name-only"], { cwd: repo });
  assert.equal(stagedFiles.trim(), "staged.md");
  assert.equal(await readFile(join(repo, "README.md"), "utf8"), "two\n");
});

test("a version names what is fetched", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];

  await installed(source, repo, "v1.0.0");

  assert.match(await vendored(repo), /Reject any\./);
});

test("installing a source already there brings it up to date (CORE Story 2 scenario 3)", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  await installed(source, repo);

  await writeFile(
    join(source, PUBLISHED_CHARTER_FOLDER, "guide", "no-any", "index.md"),
    "---\nkind: guide\n---\n\nReject it everywhere.\n",
  );
  await run("git", ["add", "."], { cwd: source });
  await commit(source, "two");

  await installed(source, repo);

  assert.match(await vendored(repo), /Reject it everywhere\./);
});

test("installing again what is already committed there leaves nothing in hand", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  await installed(source, repo);
  await run("git", ["add", "."], { cwd: repo });
  await commit(repo, "vendored");

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
  await assert.rejects(vendored(repo));
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

  assert.match(await vendored(folder), /Reject any\./);
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
  await new GitSources(repoUrl).checkOutFolder(fetchedCommit, PUBLISHED_CHARTER_FOLDER, ".cw/charter/vendor/charter");

  assert.match(await vendored(repo), /Reject any\./);
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

/** Vendoring as `cw` runs it on a disk, into this folder. */
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

  const [{ folder: installedUri } = { folder: "" }] = answerOf(await charterAuthoringApp.addVendor(source)).data;
  const installedFolder = relative(folder, fileURLToPath(installedUri));
  const vendorName = installedFolder.replace(".cw/charter/vendor/", "");
  await charterAuthoringApp.removeVendor(vendorName);

  await assert.rejects(stat(join(folder, installedFolder)), "its folder is gone");
  assert.equal(await readFile(join(folder, "work.txt"), "utf8"), "In hand.\n");
});

test("in a repository with work in hand, removing commits nothing and leaves that work as it was (CORE Story 37 scenario 2, CORE Story 2 scenario 3)", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  const charterAuthoringApp = charterAuthoringIn(repo);
  const [{ folder: installedUri } = { folder: "" }] = answerOf(await charterAuthoringApp.addVendor(source)).data;
  const installedFolder = relative(repo, fileURLToPath(installedUri));
  await run("git", ["add", "."], { cwd: repo });
  await commit(repo, "vendored");
  await writeFile(join(repo, "README.md"), "two\n");
  await writeFile(join(repo, "staged.md"), "staged\n");
  await run("git", ["add", "staged.md"], { cwd: repo });
  const { stdout: headBefore } = await run("git", ["rev-parse", "HEAD"], { cwd: repo });

  await charterAuthoringApp.removeVendor(installedFolder.replace(".cw/charter/vendor/", ""));

  const { stdout: headAfter } = await run("git", ["rev-parse", "HEAD"], { cwd: repo });
  assert.equal(headAfter, headBefore, "nothing is committed");
  const { stdout: stagedFiles } = await run("git", ["diff", "--cached", "--name-only"], { cwd: repo });
  assert.equal(stagedFiles.trim(), "staged.md");
  assert.equal(await readFile(join(repo, "README.md"), "utf8"), "two\n");
  await assert.rejects(stat(join(repo, installedFolder)));
});

test("a folder held by nothing else goes up to the vendor folder, and never past it, whatever it held (CORE-FR-204)", async (t) => {
  const [source, folder] = [await published(t), await temporary(t, "plain")];
  const charterAuthoringApp = charterAuthoringIn(folder);
  const [{ folder: installedUri } = { folder: "" }] = answerOf(await charterAuthoringApp.addVendor(source)).data;
  const installedFolder = relative(folder, fileURLToPath(installedUri));
  await symlink("nowhere", join(folder, installedFolder, "dangling"));
  await mkdir(join(folder, installedFolder, "empty"));

  await charterAuthoringApp.removeVendor(installedFolder.replace(".cw/charter/vendor/", ""));

  await assert.rejects(stat(join(folder, ".cw", "charter", "vendor")), "the vendor folder left empty goes");
  assert.ok((await stat(join(folder, ".cw"))).isDirectory(), "what is above it stays");
  assert.ok((await stat(folder)).isDirectory());
});

test("a folder holding a link beside the vendor stays (CORE-FR-204)", async (t) => {
  const [source, folder] = [await published(t), await temporary(t, "plain")];
  const charterAuthoringApp = charterAuthoringIn(folder);
  const [{ folder: installedUri } = { folder: "" }] = answerOf(await charterAuthoringApp.addVendor(source)).data;
  const installedFolder = relative(folder, fileURLToPath(installedUri));
  const ownerFolder = join(folder, installedFolder, "..");
  await symlink("nowhere", join(ownerFolder, "link"));

  await charterAuthoringApp.removeVendor(installedFolder.replace(".cw/charter/vendor/", ""));

  assert.equal(await readlink(join(ownerFolder, "link")), "nowhere");
});

test("an owner's folder still holding a source stays", async (t) => {
  const [source, folder] = [await published(t), await temporary(t, "plain")];
  const charterAuthoringApp = charterAuthoringIn(folder);
  const [{ folder: installedUri } = { folder: "" }] = answerOf(await charterAuthoringApp.addVendor(source)).data;
  const installedFolder = relative(folder, fileURLToPath(installedUri));
  const ownerFolder = join(folder, installedFolder, "..");
  await mkdir(join(ownerFolder, "other", "guide"), { recursive: true });
  await writeFile(join(ownerFolder, "other", "README.md"), "Other.\n");

  await charterAuthoringApp.removeVendor(installedFolder.replace(".cw/charter/vendor/", ""));

  assert.equal(await readFile(join(ownerFolder, "other", "README.md"), "utf8"), "Other.\n");
});

test("installing over a folder replaces it whole, and leaves no copy beside it (CORE-FR-205)", async (t) => {
  const [source, folder] = [await published(t), await temporary(t, "plain")];
  await mkdir(join(folder, ".cw", "charter", "vendor", "charter"), { recursive: true });
  await writeFile(join(folder, ".cw", "charter", "vendor", "charter", "stale.md"), "From before.\n");

  await installed(source, folder);

  await assert.rejects(readFile(join(folder, ".cw", "charter", "vendor", "charter", "stale.md")));
  assert.deepEqual(await readdir(join(folder, ".cw", "charter", "vendor")), ["charter"]);
});

test("a folder that cannot be written keeps what it held, with a fault saying so (CORE-FR-205)", async (t) => {
  const [source, folder] = [await published(t), await temporary(t, "plain")];
  const folderUrl = pathToFileURL(`${folder}/`);
  await mkdir(join(folder, ".cw", "charter", "vendor", "charter"), { recursive: true });
  await writeFile(join(folder, ".cw", "charter", "vendor", "charter", "kept.md"), "Kept.\n");
  const fetchedCommit = await new GitSources(folderUrl).fetchCommit(source);
  t.after(() => gitSources.removeFetchedCommit(fetchedCommit));
  await chmod(join(folder, ".cw", "charter", "vendor"), 0o555);

  await assert.rejects(
    new GitSources(folderUrl).checkOutFolder(fetchedCommit, PUBLISHED_CHARTER_FOLDER, ".cw/charter/vendor/charter"),
    (raised: unknown) => {
      assert.ok(raised instanceof AdapterFault);
      assert.equal(raised.internal, false);
      assert.match(raised.message, /could not be checked out/);
      assert.doesNotMatch(raised.message, /EACCES|EPERM|Error:/);
      return true;
    },
  );
  await chmod(join(folder, ".cw", "charter", "vendor"), 0o755);

  assert.equal(await readFile(join(folder, ".cw", "charter", "vendor", "charter", "kept.md"), "utf8"), "Kept.\n");
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
  await mkdir(join(folder, ".cw", "charter", "vendor", "charter"), { recursive: true });
  await writeFile(join(folder, ".cw", "charter", "vendor", "charter", "kept.md"), "Kept.\n");
  const fetchedCommit = await new GitSources(folderUrl).fetchCommit(source);
  t.after(() => gitSources.removeFetchedCommit(fetchedCommit));

  await assert.rejects(
    new GitSources(folderUrl).checkOutFolder(fetchedCommit, "no-such-folder", ".cw/charter/vendor/charter"),
    AdapterFault,
  );

  assert.equal(await readFile(join(folder, ".cw", "charter", "vendor", "charter", "kept.md"), "utf8"), "Kept.\n");
});

/** A skills repository to take from: two skills, one with an asset two folders
 *  down, one commit. */
async function publishedSkills(t: { after(fn: () => unknown): void }): Promise<string> {
  const source = join(await temporary(t, "skills"), "skills");
  await mkdir(join(source, "skills", "grill-me", "agents", "deep"), { recursive: true });
  await mkdir(join(source, "skills", "grilling"), { recursive: true });
  await writeFile(
    join(source, "skills", "grill-me", "SKILL.md"),
    "---\nname: grill-me\ndescription: Grill.\n---\n\nGrill me.\n",
  );
  await writeFile(join(source, "skills", "grill-me", "agents", "deep", "openai.yaml"), "model: x\n");
  await writeFile(
    join(source, "skills", "grilling", "SKILL.md"),
    "---\nname: grilling\ndescription: Grilling.\n---\n\nGrill.\n",
  );
  await run("git", ["init", "-q", "-b", "main"], { cwd: source });
  await run("git", ["add", "."], { cwd: source });
  await commit(source, "one");
  return source;
}

test("a link a source holds carries no write out of its vendor folder (CORE-FR-044)", async (t) => {
  const [source, folder] = [await publishedSkills(t), await temporary(t, "plain")];
  await writeFile(join(folder, "CLAUDE.md"), "Mine.\n");
  await symlink("../../../../../../CLAUDE.md", join(source, "skills", "grilling", "index.md"));
  await run("git", ["add", "."], { cwd: source });
  await commit(source, "two");

  await charterAuthoringIn(folder).addVendor(source, undefined, ["grilling"]);

  assert.equal(await readFile(join(folder, "CLAUDE.md"), "utf8"), "Mine.\n");
});

test("a link a source holds for its README carries no write out of its vendor folder (CORE-FR-044)", async (t) => {
  const [source, folder] = [await published(t), await temporary(t, "plain")];
  await writeFile(join(folder, "CLAUDE.md"), "Mine.\n");
  await symlink("../../../../CLAUDE.md", join(source, "charters", "base", ".cw", "charter", "README.md"));
  await run("git", ["add", "."], { cwd: source });
  await commit(source, "two");

  await charterAuthoringIn(folder).addVendor(source);

  assert.equal(await readFile(join(folder, "CLAUDE.md"), "utf8"), "Mine.\n");
});

test("a link a source left on the way to a folder carries no later install through it (CORE Story 37 scenario 5)", async (t) => {
  const [source, folder] = [await publishedSkills(t), await temporary(t, "plain")];
  const charterFile = join(folder, ".cw", "charter", "primitive", "guide", "mine", "index.md");
  await mkdir(join(charterFile, ".."), { recursive: true });
  await writeFile(charterFile, "Mine.\n");
  const vendorFolder = join(
    folder,
    ".cw",
    "charter",
    "vendor",
    basename(dirname(source)),
    "skills",
    "root",
    "primitive",
  );
  await mkdir(vendorFolder, { recursive: true });
  await symlink("../../../../..", join(vendorFolder, "skill"));

  assert.match(faultTextOf(await charterAuthoringIn(folder).addVendor(source, undefined, ["grilling"])), /is a link/);

  assert.equal(await readFile(charterFile, "utf8"), "Mine.\n");
});

test("a file a source names to climb out of a skill's folder lands inside it when injected (CORE Story 37 scenario 5)", async (t) => {
  const [source, folder] = [await publishedSkills(t), await temporary(t, "plain")];
  await writeFile(join(folder, "CLAUDE.md"), "Mine.\n");
  const climbingFolder = join(source, "skills", "grilling", "%2e%2e", "%2e%2e", "%2e%2e", "%2e%2e");
  await mkdir(climbingFolder, { recursive: true });
  await writeFile(join(climbingFolder, "CLAUDE.md"), "Theirs.\n");
  await run("git", ["add", "."], { cwd: source });
  await commit(source, "two");

  await charterAuthoringIn(folder).injectVendor(source, undefined, ["grilling"]);

  assert.equal(await readFile(join(folder, "CLAUDE.md"), "utf8"), "Mine.\n");
});

test("a version the source has not got is refused when injected as vendor add refuses it, and nothing is written (CORE Story 34 scenario 6, CORE-FR-198, CORE Story 55 scenario 8)", async (t) => {
  const [source, injectFolder, addFolder] = [
    await published(t),
    await temporary(t, "inject"),
    await temporary(t, "add"),
  ];

  const injectRefusalText = faultTextOf(await charterAuthoringIn(injectFolder).injectVendor(source, "v9.9.9"));
  const addRefusalText = faultTextOf(await charterAuthoringIn(addFolder).addVendor(source, "v9.9.9"));

  assert.match(injectRefusalText, /tag or branch/);
  assert.equal(injectRefusalText, addRefusalText.replaceAll(addFolder, injectFolder));
  assert.deepEqual(await readdir(injectFolder), []);
});

test("in a folder with no version control, a skill is injected as in a repository, and installed there too (CORE Story 37 scenario 1)", async (t) => {
  const [source, folder] = [await publishedSkills(t), await temporary(t, "plain")];
  const charterAuthoringApp = charterAuthoringIn(folder);

  await charterAuthoringApp.injectVendor(source, undefined, ["grilling"]);
  await charterAuthoringApp.addVendor(source, undefined, ["grill-me"]);

  assert.match(await readFile(join(folder, ".cw/charter/primitive/skill/grilling/index.md"), "utf8"), /Grill\./);
  assert.equal(answerOf(await charterAuthoringApp.listVendors()).data.folders.length, 1);
});

test("a source fetched once is read at its commit: every file it holds, and what one holds (CORE-FR-185)", async (t) => {
  const [source, repo] = [await publishedSkills(t), await repository(t)];
  const repoUrl = pathToFileURL(`${repo}/`);

  const fetchedCommit = await new GitSources(repoUrl).fetchCommit(source);

  assert.deepEqual([...(await gitSources.listFilesAt(fetchedCommit))].sort(), [
    "skills/grill-me/SKILL.md",
    "skills/grill-me/agents/deep/openai.yaml",
    "skills/grilling/SKILL.md",
  ]);
  assert.equal(
    await gitSources.readFileAt(fetchedCommit, "skills/grilling/SKILL.md"),
    "---\nname: grilling\ndescription: Grilling.\n---\n\nGrill.\n",
  );
});

test("one folder of a commit fetched is checked out over a folder here, whole, left unstaged and uncommitted (CORE-FR-187, CORE-FR-189, CORE Story 32 scenario 3)", async (t) => {
  const [source, repo] = [await publishedSkills(t), await repository(t)];
  const repoUrl = pathToFileURL(`${repo}/`);
  const fetchedCommit = await new GitSources(repoUrl).fetchCommit(source);
  const intoSubFolder = ".cw/charter/vendor/team/skills/root/primitive/skill/grill-me";
  await mkdir(join(repo, intoSubFolder), { recursive: true });
  await writeFile(join(repo, intoSubFolder, "stale.md"), "From before.\n");
  await mkdir(join(repo, ".cw/charter/vendor/team/skills/root/primitive/skill/grilling"), { recursive: true });
  await writeFile(join(repo, ".cw/charter/vendor/team/skills/root/primitive/skill/grilling/index.md"), "Kept.\n");
  const { stdout: headBefore } = await run("git", ["rev-parse", "HEAD"], { cwd: repo });

  await new GitSources(repoUrl).checkOutFolder(fetchedCommit, "skills/grill-me", intoSubFolder);

  assert.equal(await readFile(join(repo, intoSubFolder, "agents", "deep", "openai.yaml"), "utf8"), "model: x\n");
  assert.match(await readFile(join(repo, intoSubFolder, "SKILL.md"), "utf8"), /name: grill-me/);
  await assert.rejects(
    () => readFile(join(repo, intoSubFolder, "stale.md"), "utf8"),
    "what the folder held is replaced whole",
  );
  assert.equal(
    await readFile(join(repo, ".cw/charter/vendor/team/skills/root/primitive/skill/grilling/index.md"), "utf8"),
    "Kept.\n",
    "a folder beside it is left as it was",
  );
  const { stdout: headAfter } = await run("git", ["rev-parse", "HEAD"], { cwd: repo });
  assert.equal(headAfter, headBefore, "nothing is committed");
  const { stdout: stagedFiles } = await run("git", ["diff", "--cached", "--name-only"], { cwd: repo });
  assert.equal(stagedFiles.trim(), "", "nothing is staged");
});
