import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, mkdir, readdir, readFile, readlink, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { FileOutput } from "../src/zdriven/FileOutput.js";
import { FileReaders } from "../src/zdriven/FileReaders.js";
import { GitSources } from "../src/zdriven/GitSources.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import { AdapterFault } from "../src/hexagon/port/zdriven/AdapterFault.js";

const run = promisify(execFile);
const gitSources = new GitSources();

/** Git as a test runs it: an author of its own, nothing signed, so what is
 *  committed here does not depend on whose machine this is. */
const commit = (cwd: string, message: string) =>
  run(
    "git",
    ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgSign=false", "commit", "-qm", message],
    { cwd },
  );

/** A temporary directory, taken away when the test that asked for it is done. */
async function temporary(t: { after(fn: () => unknown): void }, name: string): Promise<string> {
  const at = await mkdtemp(join(tmpdir(), `cw-${name}-`));
  t.after(() => rm(at, { recursive: true, force: true }));
  return at;
}

/** A repository to install from: one guide under its charter folder, a README
 *  beside it, one commit, one tag. A path on disk is a source git fetches like
 *  any other, so the adapter is exercised whole without a network. */
async function published(t: { after(fn: () => unknown): void }, body = "Reject any."): Promise<string> {
  const source = join(await temporary(t, "source"), "charter");
  await mkdir(join(source, ".cw", "charter", "guide", "no-any"), { recursive: true });
  await writeFile(join(source, ".cw", "charter", "guide", "no-any", "index.md"), `---\nkind: guide\n---\n\n${body}\n`);
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
 *  `.cw/vendor/charter`. Which folders those are is the hexagon's to decide; the
 *  adapter is told. */
async function installed(source: string, repo: string, version?: string): Promise<void> {
  const repoUrl = pathToFileURL(`${repo}/`);
  const fetchedCommit = await gitSources.fetchCommit(source, repoUrl, version);
  await gitSources.checkoutFolderAt(repoUrl, fetchedCommit, ".cw/charter", ".cw/vendor/charter");
  await gitSources.forgetCommit(fetchedCommit);
}

/** What the vendored guide says in this repository, read off disk. */
const vendored = (repo: string) => readFile(join(repo, ".cw", "vendor", "charter", "guide", "no-any", "index.md"), "utf8");

test("a source's charter folder checked out at its commit lands where it is told, left unstaged and uncommitted", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  const { stdout: headBefore } = await run("git", ["rev-parse", "HEAD"], { cwd: repo });

  await installed(source, repo);

  assert.match(await vendored(repo), /Reject any\./);
  await assert.rejects(readFile(join(repo, ".cw", "vendor", "charter", "README.md")), "only the folder asked for lands");
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

test("installing a source already there brings it up to date", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  await installed(source, repo);

  await writeFile(join(source, ".cw", "charter", "guide", "no-any", "index.md"), "---\nkind: guide\n---\n\nReject it everywhere.\n");
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

  const fetchFault = await gitSources.fetchCommit(source, pathToFileURL(`${repo}/`), "v9.9.9").catch((gitFault: unknown) => gitFault);

  assert.ok(fetchFault instanceof AdapterFault, String(fetchFault));
  assert.match(fetchFault.fix, /tag or branch/);
  await assert.rejects(vendored(repo));
});

test("a source that cannot be reached is refused in git's own words", async (t) => {
  const repo = await repository(t);

  const fetchFault = await gitSources.fetchCommit(join(repo, "nothing-here"), pathToFileURL(`${repo}/`)).catch((gitFault: unknown) => gitFault);

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

  const fetchedCommit = await gitSources.fetchCommit(source, repoUrl);

  await assert.rejects(readFile(join(repo, ".git", "FETCH_HEAD")));
  await gitSources.forgetCommit(fetchedCommit);
  await assert.rejects(gitSources.listFilesAt(fetchedCommit));
});

test("a source is reached under the repository's own git config (CORE Story 37 scenario 6)", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  await run("git", ["config", "--local", `url.${source}.insteadOf`, "cw-team:charter"], { cwd: repo });
  const repoUrl = pathToFileURL(`${repo}/`);

  const fetchedCommit = await gitSources.fetchCommit("cw-team:charter", repoUrl);
  t.after(() => gitSources.forgetCommit(fetchedCommit));
  await gitSources.checkoutFolderAt(repoUrl, fetchedCommit, ".cw/charter", ".cw/vendor/charter");

  assert.match(await vendored(repo), /Reject any\./);
  const { stdout } = await run("git", ["status", "--porcelain"], { cwd: repo });
  assert.equal(stdout.trim(), "?? .cw/");
});

test("a repository's config that applies only where it stands reaches the fetch too (CORE Story 37 scenario 6)", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  const conditionalConfigFile = join(repo, ".git", "cw-conditional-config");
  await run("git", ["config", "--file", conditionalConfigFile, `url.${source}.insteadOf`, "cw-team:charter"]);
  const { stdout: repoGitFolder } = await run("git", ["rev-parse", "--absolute-git-dir"], { cwd: repo });
  await run("git", ["config", "--local", `includeIf.gitdir:${repoGitFolder.trim()}.path`, conditionalConfigFile], { cwd: repo });

  const fetchedCommit = await gitSources.fetchCommit("cw-team:charter", pathToFileURL(`${repo}/`));
  t.after(() => gitSources.forgetCommit(fetchedCommit));

  assert.ok((await gitSources.listFilesAt(fetchedCommit)).includes("README.md"));
});

test("a repository whose config includes a file by a relative path still fetches, under what that file says (CORE Story 37 scenario 6)", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  await run("git", ["config", "--file", join(repo, ".git", "cw-included-config"), `url.${source}.insteadOf`, "cw-team:charter"]);
  await run("git", ["config", "--local", "include.path", "cw-included-config"], { cwd: repo });

  const fetchedCommit = await gitSources.fetchCommit("cw-team:charter", pathToFileURL(`${repo}/`));
  t.after(() => gitSources.forgetCommit(fetchedCommit));

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

  const fetchedCommit = await gitSources.fetchCommit("cw-team:charter", pathToFileURL(`${repo}/`));
  t.after(() => gitSources.forgetCommit(fetchedCommit));

  assert.ok((await gitSources.listFilesAt(fetchedCommit)).includes("README.md"));
});

test("a machine with no git is told git is what reaches a source (CORE-FR-205)", async (t) => {
  const repo = await temporary(t, "plain");
  const keptPath = process.env.PATH;
  process.env.PATH = "";
  t.after(() => {
    process.env.PATH = keptPath;
  });

  const fetchFault = await gitSources.fetchCommit("team/charter", pathToFileURL(`${repo}/`)).catch((gitFault: unknown) => gitFault);

  assert.ok(fetchFault instanceof AdapterFault, String(fetchFault));
  assert.match(fetchFault.fix, /needs git: install it/);
});

/** Vendoring as `cw` runs it on a disk, into this folder. */
const charterVendoringIn = (folder: string) => new CharterVendoring(pathToFileURL(`${folder}/`), new FileReaders(), gitSources, new FileOutput(), new YamlParser());

test("in a folder with no version control, a source is installed, then removed with its folder gone (CORE Story 37 scenarios 1, 2)", async (t) => {
  const [source, folder] = [await published(t), await temporary(t, "plain")];
  await writeFile(join(folder, "work.txt"), "In hand.\n");
  const charterVendoringApp = charterVendoringIn(folder);

  const [{ folder: installedFolder } = { folder: "" }] = (await charterVendoringApp.add(source)).data;
  const vendorName = installedFolder.replace(".cw/vendor/", "");
  await charterVendoringApp.remove(vendorName);

  await assert.rejects(stat(join(folder, installedFolder)), "its folder is gone");
  assert.equal(await readFile(join(folder, "work.txt"), "utf8"), "In hand.\n");
});

test("in a repository with work in hand, removing commits nothing and leaves that work as it was (CORE Story 37 scenario 2)", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  const charterVendoringApp = charterVendoringIn(repo);
  const [{ folder: installedFolder } = { folder: "" }] = (await charterVendoringApp.add(source)).data;
  await run("git", ["add", "."], { cwd: repo });
  await commit(repo, "vendored");
  await writeFile(join(repo, "README.md"), "two\n");
  await writeFile(join(repo, "staged.md"), "staged\n");
  await run("git", ["add", "staged.md"], { cwd: repo });
  const { stdout: headBefore } = await run("git", ["rev-parse", "HEAD"], { cwd: repo });

  await charterVendoringApp.remove(installedFolder.replace(".cw/vendor/", ""));

  const { stdout: headAfter } = await run("git", ["rev-parse", "HEAD"], { cwd: repo });
  assert.equal(headAfter, headBefore, "nothing is committed");
  const { stdout: stagedFiles } = await run("git", ["diff", "--cached", "--name-only"], { cwd: repo });
  assert.equal(stagedFiles.trim(), "staged.md");
  assert.equal(await readFile(join(repo, "README.md"), "utf8"), "two\n");
  await assert.rejects(stat(join(repo, installedFolder)));
});

test("a folder held by nothing else goes up to the vendor folder, and never past it, whatever it held (CORE-FR-204)", async (t) => {
  const [source, folder] = [await published(t), await temporary(t, "plain")];
  const charterVendoringApp = charterVendoringIn(folder);
  const [{ folder: installedFolder } = { folder: "" }] = (await charterVendoringApp.add(source)).data;
  await symlink("nowhere", join(folder, installedFolder, "dangling"));
  await mkdir(join(folder, installedFolder, "empty"));

  await charterVendoringApp.remove(installedFolder.replace(".cw/vendor/", ""));

  await assert.rejects(stat(join(folder, ".cw", "vendor")), "the vendor folder left empty goes");
  assert.ok((await stat(join(folder, ".cw"))).isDirectory(), "what is above it stays");
  assert.ok((await stat(folder)).isDirectory());
});

test("a folder holding a link beside the vendor stays (CORE-FR-204)", async (t) => {
  const [source, folder] = [await published(t), await temporary(t, "plain")];
  const charterVendoringApp = charterVendoringIn(folder);
  const [{ folder: installedFolder } = { folder: "" }] = (await charterVendoringApp.add(source)).data;
  const ownerFolder = join(folder, installedFolder, "..");
  await symlink("nowhere", join(ownerFolder, "link"));

  await charterVendoringApp.remove(installedFolder.replace(".cw/vendor/", ""));

  assert.equal(await readlink(join(ownerFolder, "link")), "nowhere");
});

test("an owner's folder still holding a source stays", async (t) => {
  const [source, folder] = [await published(t), await temporary(t, "plain")];
  const charterVendoringApp = charterVendoringIn(folder);
  const [{ folder: installedFolder } = { folder: "" }] = (await charterVendoringApp.add(source)).data;
  const ownerFolder = join(folder, installedFolder, "..");
  await mkdir(join(ownerFolder, "other", "guide"), { recursive: true });
  await writeFile(join(ownerFolder, "other", "README.md"), "Other.\n");

  await charterVendoringApp.remove(installedFolder.replace(".cw/vendor/", ""));

  assert.equal(await readFile(join(ownerFolder, "other", "README.md"), "utf8"), "Other.\n");
});

test("installing over a folder replaces it whole, and leaves no copy beside it (CORE-FR-205)", async (t) => {
  const [source, folder] = [await published(t), await temporary(t, "plain")];
  await mkdir(join(folder, ".cw", "vendor", "charter"), { recursive: true });
  await writeFile(join(folder, ".cw", "vendor", "charter", "stale.md"), "From before.\n");

  await installed(source, folder);

  await assert.rejects(readFile(join(folder, ".cw", "vendor", "charter", "stale.md")));
  assert.deepEqual(await readdir(join(folder, ".cw", "vendor")), ["charter"]);
});

test("a folder that cannot be written keeps what it held, with a fault saying so (CORE-FR-205)", async (t) => {
  const [source, folder] = [await published(t), await temporary(t, "plain")];
  const folderUrl = pathToFileURL(`${folder}/`);
  await mkdir(join(folder, ".cw", "vendor", "charter"), { recursive: true });
  await writeFile(join(folder, ".cw", "vendor", "charter", "kept.md"), "Kept.\n");
  const fetchedCommit = await gitSources.fetchCommit(source, folderUrl);
  t.after(() => gitSources.forgetCommit(fetchedCommit));
  await chmod(join(folder, ".cw", "vendor"), 0o555);

  await assert.rejects(gitSources.checkoutFolderAt(folderUrl, fetchedCommit, ".cw/charter", ".cw/vendor/charter"), AdapterFault);
  await chmod(join(folder, ".cw", "vendor"), 0o755);

  assert.equal(await readFile(join(folder, ".cw", "vendor", "charter", "kept.md"), "utf8"), "Kept.\n");
});

test("a folder that cannot be taken away is a fault with its fix, not a raw error", async (t) => {
  const folder = await temporary(t, "plain");
  await mkdir(join(folder, "locked", "inner"), { recursive: true });
  await chmod(join(folder, "locked"), 0o555);

  await assert.rejects(new FileOutput().deleteFolder(pathToFileURL(`${folder}/locked/inner/`)), AdapterFault);
  await chmod(join(folder, "locked"), 0o755);
});

test("a checkout git refuses leaves what the folder held (CORE-FR-205)", async (t) => {
  const [source, folder] = [await published(t), await temporary(t, "plain")];
  const folderUrl = pathToFileURL(`${folder}/`);
  await mkdir(join(folder, ".cw", "vendor", "charter"), { recursive: true });
  await writeFile(join(folder, ".cw", "vendor", "charter", "kept.md"), "Kept.\n");
  const fetchedCommit = await gitSources.fetchCommit(source, folderUrl);
  t.after(() => gitSources.forgetCommit(fetchedCommit));

  await assert.rejects(gitSources.checkoutFolderAt(folderUrl, fetchedCommit, "no-such-folder", ".cw/vendor/charter"), AdapterFault);

  assert.equal(await readFile(join(folder, ".cw", "vendor", "charter", "kept.md"), "utf8"), "Kept.\n");
});

/** A skills repository to take from: two skills, one with an asset two folders
 *  down, one commit. */
async function publishedSkills(t: { after(fn: () => unknown): void }): Promise<string> {
  const source = join(await temporary(t, "skills"), "skills");
  await mkdir(join(source, "skills", "grill-me", "agents", "deep"), { recursive: true });
  await mkdir(join(source, "skills", "grilling"), { recursive: true });
  await writeFile(join(source, "skills", "grill-me", "SKILL.md"), "---\nname: grill-me\ndescription: Grill.\n---\n\nGrill me.\n");
  await writeFile(join(source, "skills", "grill-me", "agents", "deep", "openai.yaml"), "model: x\n");
  await writeFile(join(source, "skills", "grilling", "SKILL.md"), "---\nname: grilling\ndescription: Grilling.\n---\n\nGrill.\n");
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

  await charterVendoringIn(folder).add(source, undefined, ["grilling"]);

  assert.equal(await readFile(join(folder, "CLAUDE.md"), "utf8"), "Mine.\n");
});

test("a link a source holds for its README carries no write out of its vendor folder (CORE-FR-044)", async (t) => {
  const [source, folder] = [await published(t), await temporary(t, "plain")];
  await writeFile(join(folder, "CLAUDE.md"), "Mine.\n");
  await symlink("../../../../CLAUDE.md", join(source, ".cw", "charter", "README.md"));
  await run("git", ["add", "."], { cwd: source });
  await commit(source, "two");

  await charterVendoringIn(folder).add(source);

  assert.equal(await readFile(join(folder, "CLAUDE.md"), "utf8"), "Mine.\n");
});

test("a link a source left on the way to a folder carries no later install through it (CORE Story 37 scenario 5)", async (t) => {
  const [source, folder] = [await publishedSkills(t), await temporary(t, "plain")];
  const charterFile = join(folder, ".cw", "charter", "guide", "mine", "index.md");
  await mkdir(join(charterFile, ".."), { recursive: true });
  await writeFile(charterFile, "Mine.\n");
  const vendorFolder = join(folder, ".cw", "vendor", basename(dirname(source)), "skills");
  await mkdir(vendorFolder, { recursive: true });
  await symlink("../../..", join(vendorFolder, "skill"));

  await assert.rejects(charterVendoringIn(folder).add(source, undefined, ["grilling"]), /is a link/);

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

  await charterVendoringIn(folder).inject(source, undefined, ["grilling"]);

  assert.equal(await readFile(join(folder, "CLAUDE.md"), "utf8"), "Mine.\n");
});

test("in a folder with no version control, a skill is injected as in a repository, and installed there too (CORE Story 37 scenario 1)", async (t) => {
  const [source, folder] = [await publishedSkills(t), await temporary(t, "plain")];
  const charterVendoringApp = charterVendoringIn(folder);

  await charterVendoringApp.inject(source, undefined, ["grilling"]);
  await charterVendoringApp.add(source, undefined, ["grill-me"]);

  assert.match(await readFile(join(folder, ".cw/charter/skill/grilling/index.md"), "utf8"), /Grill\./);
  assert.equal((await charterVendoringApp.installed()).length, 1);
});

test("a source fetched once is read at its commit: every file it holds, and what one holds (CORE-FR-185)", async (t) => {
  const [source, repo] = [await publishedSkills(t), await repository(t)];
  const repoUrl = pathToFileURL(`${repo}/`);

  const fetchedCommit = await gitSources.fetchCommit(source, repoUrl);

  assert.deepEqual([...(await gitSources.listFilesAt(fetchedCommit))].sort(), [
    "skills/grill-me/SKILL.md",
    "skills/grill-me/agents/deep/openai.yaml",
    "skills/grilling/SKILL.md",
  ]);
  assert.equal(await gitSources.readFileAt(fetchedCommit, "skills/grilling/SKILL.md"), "---\nname: grilling\ndescription: Grilling.\n---\n\nGrill.\n");
});

test("one folder of a commit fetched is checked out over a folder here, whole, left unstaged and uncommitted (CORE-FR-187, CORE-FR-189)", async (t) => {
  const [source, repo] = [await publishedSkills(t), await repository(t)];
  const repoUrl = pathToFileURL(`${repo}/`);
  const fetchedCommit = await gitSources.fetchCommit(source, repoUrl);
  const intoSubFolder = ".cw/vendor/team/skills/skill/grill-me";
  await mkdir(join(repo, intoSubFolder), { recursive: true });
  await writeFile(join(repo, intoSubFolder, "stale.md"), "From before.\n");
  await mkdir(join(repo, ".cw/vendor/team/skills/skill/grilling"), { recursive: true });
  await writeFile(join(repo, ".cw/vendor/team/skills/skill/grilling/index.md"), "Kept.\n");
  const { stdout: headBefore } = await run("git", ["rev-parse", "HEAD"], { cwd: repo });

  await gitSources.checkoutFolderAt(repoUrl, fetchedCommit, "skills/grill-me", intoSubFolder);

  assert.equal(await readFile(join(repo, intoSubFolder, "agents", "deep", "openai.yaml"), "utf8"), "model: x\n");
  assert.match(await readFile(join(repo, intoSubFolder, "SKILL.md"), "utf8"), /name: grill-me/);
  await assert.rejects(() => readFile(join(repo, intoSubFolder, "stale.md"), "utf8"), "what the folder held is replaced whole");
  assert.equal(await readFile(join(repo, ".cw/vendor/team/skills/skill/grilling/index.md"), "utf8"), "Kept.\n", "a folder beside it is left as it was");
  const { stdout: headAfter } = await run("git", ["rev-parse", "HEAD"], { cwd: repo });
  assert.equal(headAfter, headBefore, "nothing is committed");
  const { stdout: stagedFiles } = await run("git", ["diff", "--cached", "--name-only"], { cwd: repo });
  assert.equal(stagedFiles.trim(), "", "nothing is staged");
});
