import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// `pnpm test` builds this tree first: dist/ is what its source builds to.
const cwFilePath = fileURLToPath(new URL("../dist/cw.js", import.meta.url));
const releaseScriptPath = ".cw/out/script/charter-release-action/charter-release-action.mjs";

interface ReleaseFolder {
  readonly repositoryFolderPath: string;
  readonly originFolderPath: string;
  readonly workFolderPath: string;
  readonly commandEnv: NodeJS.ProcessEnv;
}

/** A repository set up with `cw init`, once committed and pushed: a README
 *  holding the install section's markers, a changelog and a `.gitignore`
 *  leaving out what `cw build` writes, where `hasReadmeAndChangelog` says so;
 *  the charters `charterTextByPath` holds, and an `origin` its `main` is
 *  pushed to; built, so the release script is laid.
 *  git and cw run there as a developer would, under a home and a git
 *  configuration of the run's own, `cw` on the PATH being the one just built. */
async function inReleaseFolder(
  charterTextByPath: Readonly<Record<string, string>>,
  runTest: (releaseFolder: ReleaseFolder) => Promise<void>,
  hasReadmeAndChangelog = true,
) {
  const workFolderPath = await mkdtemp(join(tmpdir(), "cw-charter-release-"));
  try {
    const repositoryFolderPath = join(workFolderPath, "acme-charters");
    const originFolderPath = join(workFolderPath, "acme", "acme-charters.git");
    await mkdir(repositoryFolderPath);
    await mkdir(join(workFolderPath, "home"));
    await mkdir(join(workFolderPath, "bin"));
    await writeFile(join(workFolderPath, "gitconfig"), "");
    await writeFile(join(workFolderPath, "bin", "cw"), `#!/bin/sh\nexec "${process.execPath}" "${cwFilePath}" "$@"\n`, {
      mode: 0o755,
    });
    const commandEnv: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: `${join(workFolderPath, "bin")}:${process.env.PATH}`,
      HOME: join(workFolderPath, "home"),
      NO_COLOR: "1",
      GIT_CONFIG_GLOBAL: join(workFolderPath, "gitconfig"),
      GIT_AUTHOR_NAME: "Someone",
      GIT_AUTHOR_EMAIL: "someone@example.com",
      GIT_COMMITTER_NAME: "Someone",
      GIT_COMMITTER_EMAIL: "someone@example.com",
    };
    runGit(["init", "--quiet", "-b", "main"], repositoryFolderPath, commandEnv);
    assert.equal(runCw(["init", "--agent", "claude"], repositoryFolderPath, commandEnv).status, 0);
    await writeFile(
      join(repositoryFolderPath, ".gitignore"),
      "**/.cw/out/\n.claude/\n.agents/\n.codex/\n.mcp.json\nCLAUDE.md\nAGENTS.md\n",
    );
    if (hasReadmeAndChangelog) {
      await writeFile(
        join(repositoryFolderPath, "README.md"),
        "# acme-charters\n\nRules for TypeScript services.\n\n<!-- charter-release-action: charters -->\n<!-- /charter-release-action: charters -->\n\n## Releasing\n\nAsk your agent `/charter-release`.\n",
      );
      await writeFile(join(repositoryFolderPath, ".cw/CHANGELOG.md"), "# Changelog\n");
    }
    for (const [charterFilePath, charterText] of Object.entries(charterTextByPath)) {
      await mkdir(join(repositoryFolderPath, charterFilePath, ".."), { recursive: true });
      await writeFile(join(repositoryFolderPath, charterFilePath), charterText);
    }
    runGit(["add", "."], repositoryFolderPath, commandEnv);
    runGit(["commit", "--quiet", "-m", "The charters"], repositoryFolderPath, commandEnv);
    runGit(["init", "--quiet", "--bare", "-b", "main", originFolderPath], workFolderPath, commandEnv);
    runGit(["remote", "add", "origin", originFolderPath], repositoryFolderPath, commandEnv);
    runGit(["push", "--quiet", "origin", "main"], repositoryFolderPath, commandEnv);
    runCw(["build"], repositoryFolderPath, commandEnv);
    await runTest({ repositoryFolderPath, originFolderPath, workFolderPath, commandEnv });
  } finally {
    await rm(workFolderPath, { recursive: true, force: true });
  }
}

function runCw(cwArgs: readonly string[], folderPath: string, commandEnv: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [cwFilePath, ...cwArgs], {
    cwd: folderPath,
    env: commandEnv,
    input: "",
    encoding: "utf8",
  });
}

function runGit(gitArgs: readonly string[], folderPath: string, commandEnv: NodeJS.ProcessEnv) {
  const gitRun = spawnSync("git", gitArgs, { cwd: folderPath, env: commandEnv, encoding: "utf8" });
  assert.equal(gitRun.status, 0, gitRun.stderr);
  return gitRun.stdout.trim();
}

/** One step of the release script, run at the repository's root as
 *  /charter-release runs it. */
function runReleaseAction(actionArgs: readonly string[], { repositoryFolderPath, commandEnv }: ReleaseFolder) {
  return spawnSync(process.execPath, [releaseScriptPath, ...actionArgs], {
    cwd: repositoryFolderPath,
    env: commandEnv,
    encoding: "utf8",
  });
}

/** What git says changed in the repository: nothing, where nothing was
 *  written. */
function statusOf({ repositoryFolderPath, commandEnv }: ReleaseFolder) {
  return runGit(["status", "--porcelain", "--untracked-files=all"], repositoryFolderPath, commandEnv);
}

/** Charter `sdd`, holding a skill that names a guide of charter `baseline`,
 *  `baseline` itself, and `grill`, installed from elsewhere. */
const CHARTER_TEXT_BY_PATH = {
  ".cw/charter/sdd/primitive/skill/greet/index.md":
    '---\nkind: skill\nid: greet\ndescription: Say hello.\ntriggers: ["say hello"]\n---\n\nHi, as [[be-kind]] says.\n',
  ".cw/charter/baseline/primitive/guide/be-kind/index.md":
    "---\nkind: guide\nid: be-kind\ndescription: Be kind in every answer.\n---\n\nBe kind.\n",
  ".cw/charter/grill/primitive/skill/grill-me/index.md":
    '---\nkind: skill\nid: grill-me\ndescription: Ask hard questions.\ntriggers: ["grill me"]\n---\n\nAsk.\n',
  ".cw/charter/grill/cw-package.json": `${JSON.stringify({ charter: "grill", source: "mattpocock/skills", version: "v1.0.0" })}\n`,
};

test("released from the default branch of origin, the install section and the entry are committed, pushed and tagged, and another repository installs a charter with the line the README gives, the line installing them all naming each charter authored and never the one installed (VENDOR Story 2 scenario 1, VENDOR Story 8 scenario 5, VENDOR-FR-005, VENDOR-FR-006)", async () => {
  await inReleaseFolder(CHARTER_TEXT_BY_PATH, async (releaseFolder) => {
    const { repositoryFolderPath, originFolderPath, workFolderPath, commandEnv } = releaseFolder;
    // What this machine ignores, a file its desktop leaves, is no file the
    // repository keeps off git.
    await writeFile(join(workFolderPath, "ignored-here"), ".DS_Store\n");
    runGit(
      ["config", "--global", "core.excludesFile", join(workFolderPath, "ignored-here")],
      workFolderPath,
      commandEnv,
    );
    await writeFile(join(repositoryFolderPath, ".cw/charter/sdd/.DS_Store"), "");

    const checkRun = runReleaseAction(["check"], releaseFolder);
    assert.equal(checkRun.status, 0, checkRun.stderr);
    const readmeRun = runReleaseAction(["readme"], releaseFolder);
    assert.equal(readmeRun.status, 0, readmeRun.stderr);
    const readmeText = await readFile(join(repositoryFolderPath, "README.md"), "utf8");
    // Every charter authored named, never the one installed (VENDOR-FR-005).
    assert.ok(
      readmeText.includes(`cw charter pull ${originFolderPath} --charter=baseline --charter=sdd\n`),
      readmeText,
    );
    assert.ok(
      readmeText.includes(`### baseline\n\n\`\`\`bash\ncw charter pull ${originFolderPath} --charter=baseline\n`),
    );
    assert.ok(readmeText.includes(`### sdd\n\n\`\`\`bash\ncw charter pull ${originFolderPath} --charter=sdd\n`));
    assert.match(readmeText, /\| `\/greet` \| Say hello\. \|/);
    // Only what the repository authored, never cw's own skills.
    const installSectionText = readmeText.slice(
      readmeText.indexOf("<!-- charter-release-action: charters -->"),
      readmeText.indexOf("<!-- /charter-release-action: charters -->"),
    );
    assert.doesNotMatch(installSectionText, /grill/);
    assert.doesNotMatch(installSectionText, /`\/cw-author`|`\/charter-release`/);
    // The rest of the README is the authors' own.
    assert.match(readmeText, /^# acme-charters\n\nRules for TypeScript services\.\n/);
    assert.match(readmeText, /## Releasing\n/);

    const draftRun = runReleaseAction(["draft"], releaseFolder);
    assert.equal(draftRun.status, 0, draftRun.stderr);
    assert.match(draftRun.stdout, /Version: 0\.1\.0/);
    await writeFile(join(workFolderPath, "entry.md"), "- First.\n");
    const publishRun = runReleaseAction(
      ["publish", "0.1.0", join(workFolderPath, "entry.md"), "--date", "2026-11-19"],
      releaseFolder,
    );
    assert.equal(publishRun.status, 0, publishRun.stderr);
    assert.equal(runGit(["tag", "--list"], originFolderPath, commandEnv), "v0.1.0");
    assert.equal(runGit(["log", "-1", "--format=%s", "main"], originFolderPath, commandEnv), "release v0.1.0");
    assert.equal(
      runGit(["show", "main:.cw/CHANGELOG.md"], originFolderPath, commandEnv),
      "# Changelog\n\n## 0.1.0 — 2026-11-19\n\n- First.",
    );
    assert.equal(statusOf(releaseFolder), "");

    const consumerFolderPath = join(workFolderPath, "consumer");
    await mkdir(consumerFolderPath);
    runGit(["init", "--quiet"], consumerFolderPath, commandEnv);
    assert.equal(runCw(["init", "--agent", "claude"], consumerFolderPath, commandEnv).status, 0);
    // The line the README gives, run as it is written.
    const readmeInstallArgs = /^cw (charter pull \S+ --charter=sdd)$/m.exec(readmeText)?.[1]?.split(" ") ?? [];
    assert.deepEqual(readmeInstallArgs, ["charter", "pull", originFolderPath, "--charter=sdd"]);
    const charterPullRun = runCw(readmeInstallArgs, consumerFolderPath, commandEnv);
    assert.equal(charterPullRun.status, 0, charterPullRun.stderr);
    assert.deepEqual(
      (await readdir(join(consumerFolderPath, ".cw/charter"))).filter((entryName) => entryName !== ".gitkeep").sort(),
      ["baseline", "sdd"],
    );
    const consumerBuildRun = runCw(["build"], consumerFolderPath, commandEnv);
    assert.equal(consumerBuildRun.status, 0, consumerBuildRun.stdout);
  });
});

test("a release on another branch, with a change not committed, with no origin, or behind or diverged from origin is refused naming which, and nothing is written (VENDOR Story 2 scenario 2)", async () => {
  await inReleaseFolder(CHARTER_TEXT_BY_PATH, async (releaseFolder) => {
    const { repositoryFolderPath, originFolderPath, workFolderPath, commandEnv } = releaseFolder;

    runGit(["checkout", "--quiet", "-b", "draft"], repositoryFolderPath, commandEnv);
    const branchRun = runReleaseAction(["check"], releaseFolder);
    assert.equal(branchRun.status, 1);
    assert.match(branchRun.stderr, /On branch "draft", not "main"/);
    runGit(["checkout", "--quiet", "main"], repositoryFolderPath, commandEnv);

    await writeFile(join(repositoryFolderPath, "notes.md"), "Half done.\n");
    const dirtyRun = runReleaseAction(["check"], releaseFolder);
    assert.equal(dirtyRun.status, 1);
    assert.match(dirtyRun.stderr, /The working tree is not clean/);
    await rm(join(repositoryFolderPath, "notes.md"));

    // Another clone pushes; this one falls behind, then commits of its own.
    const otherFolderPath = join(workFolderPath, "other");
    runGit(["clone", "--quiet", originFolderPath, otherFolderPath], workFolderPath, commandEnv);
    await writeFile(join(otherFolderPath, "NOTICE.md"), "Theirs.\n");
    runGit(["add", "."], otherFolderPath, commandEnv);
    runGit(["commit", "--quiet", "-m", "Theirs"], otherFolderPath, commandEnv);
    runGit(["push", "--quiet", "origin", "main"], otherFolderPath, commandEnv);
    const behindRun = runReleaseAction(["check"], releaseFolder);
    assert.equal(behindRun.status, 1);
    assert.match(behindRun.stderr, /main is 1 commit\(s\) behind origin\/main/);
    await writeFile(join(repositoryFolderPath, "OURS.md"), "Ours.\n");
    runGit(["add", "."], repositoryFolderPath, commandEnv);
    runGit(["commit", "--quiet", "-m", "Ours"], repositoryFolderPath, commandEnv);
    const divergedRun = runReleaseAction(["check"], releaseFolder);
    assert.equal(divergedRun.status, 1);
    assert.match(divergedRun.stderr, /main has diverged from origin\/main/);

    runGit(["remote", "remove", "origin"], repositoryFolderPath, commandEnv);
    const noOriginRun = runReleaseAction(["check"], releaseFolder);
    assert.equal(noOriginRun.status, 1);
    assert.match(noOriginRun.stderr, /main has no origin to push to/);
    assert.equal(statusOf(releaseFolder), "");
  });
});

test("a build that changes what is committed is refused at check, the release writing nothing of its own (VENDOR Story 2 scenario 10, VENDOR-FR-005)", async () => {
  await inReleaseFolder(CHARTER_TEXT_BY_PATH, async (releaseFolder) => {
    const { repositoryFolderPath, commandEnv } = releaseFolder;
    await writeFile(join(repositoryFolderPath, ".cw/out/CHARTER.md"), "Stale.\n");
    runGit(["add", "--force", ".cw/out/CHARTER.md"], repositoryFolderPath, commandEnv);
    runGit(["commit", "--quiet", "-m", "Stale output"], repositoryFolderPath, commandEnv);
    runGit(["push", "--quiet", "origin", "main"], repositoryFolderPath, commandEnv);

    const checkRun = runReleaseAction(["check"], releaseFolder);

    assert.equal(checkRun.status, 1);
    assert.match(checkRun.stderr, /The build changed what is committed/);
    assert.match(checkRun.stderr, /\.cw\/out\/CHARTER\.md/);
    // Nothing of the release's own: the build's output alone is changed.
    assert.equal(statusOf(releaseFolder), "M .cw/out/CHARTER.md");
    assert.equal(runGit(["tag", "--list"], repositoryFolderPath, commandEnv), "");
  });
});

test("a version or date the author names that a release would refuse is refused at draft, before the README is written (VENDOR Story 2 scenario 10, VENDOR-FR-005)", async () => {
  await inReleaseFolder(CHARTER_TEXT_BY_PATH, async (releaseFolder) => {
    const { repositoryFolderPath, commandEnv } = releaseFolder;
    runGit(["tag", "-a", "v0.2.0", "-m", "release v0.2.0"], repositoryFolderPath, commandEnv);
    await writeFile(join(repositoryFolderPath, ".cw/CHANGELOG.md"), "# Changelog\n\n## 0.2.0 — 2026-11-01\n");
    runGit(["commit", "--quiet", "-am", "Released"], repositoryFolderPath, commandEnv);

    for (const [draftArgs, refusalPattern] of [
      [["--version", "1.2"], /"1\.2" is no version/],
      [["--version", "0.2.0"], /v0\.2\.0 is already a tag/],
      [["--version", "0.1.9"], /0\.1\.9 is not after the last release, v0\.2\.0/],
      [["--version", "0.3.0", "--date", "20-11-2026"], /"20-11-2026" is no date/],
    ] as const) {
      const draftRun = runReleaseAction(["draft", ...draftArgs], releaseFolder);
      assert.equal(draftRun.status, 1, draftArgs.join(" "));
      assert.match(draftRun.stderr, refusalPattern);
    }
    const acceptedRun = runReleaseAction(["draft", "--version", "0.3.0", "--date", "2026-11-20"], releaseFolder);
    assert.equal(acceptedRun.status, 0, acceptedRun.stderr);
    assert.equal(statusOf(releaseFolder), "");
  });
});

test("a charter that does not build with the charters it includes alone is refused naming it and why, and nothing is written (VENDOR Story 2 scenario 3)", async () => {
  await inReleaseFolder(CHARTER_TEXT_BY_PATH, async (releaseFolder) => {
    const { repositoryFolderPath, commandEnv } = releaseFolder;
    // A charter that builds here only with what cw brings this repository,
    // committed and pushed after the last build.
    const notesFolderPath = join(repositoryFolderPath, ".cw/charter/release-notes/primitive/skill/notes");
    await mkdir(notesFolderPath, { recursive: true });
    await writeFile(
      join(notesFolderPath, "index.md"),
      '---\nkind: skill\nid: notes\ndescription: Write the notes.\ntriggers: ["write notes"]\n---\n\nThen run [[charter-release]].\n',
    );
    runGit(["add", "."], repositoryFolderPath, commandEnv);
    runGit(["commit", "--quiet", "-m", "Release notes"], repositoryFolderPath, commandEnv);
    runGit(["push", "--quiet", "origin", "main"], repositoryFolderPath, commandEnv);

    const checkRun = runReleaseAction(["check"], releaseFolder);

    assert.equal(checkRun.status, 1);
    assert.match(checkRun.stderr, /"release-notes" does not build with the charters it includes alone/);
    assert.match(checkRun.stderr, /\.cw\/charter\/release-notes\/primitive\/skill\/notes\/index\.md/);
    assert.match(checkRun.stderr, /names "charter-release"/);
    assert.equal(statusOf(releaseFolder), "");
  });
});

test("a charter git ignores, which no install would hold, is refused naming its files, and nothing is written (VENDOR Story 2 scenario 3)", async () => {
  await inReleaseFolder(CHARTER_TEXT_BY_PATH, async (releaseFolder) => {
    const { repositoryFolderPath, commandEnv } = releaseFolder;
    // A committed charter that builds here only with a charter kept off git.
    await writeFile(join(repositoryFolderPath, ".gitignore"), "\n.cw/charter/private/\n", { flag: "a" });
    const privateFolderPath = join(repositoryFolderPath, ".cw/charter/private/primitive/guide/secret-rule");
    await mkdir(privateFolderPath, { recursive: true });
    await writeFile(
      join(privateFolderPath, "index.md"),
      "---\nkind: guide\nid: secret-rule\ndescription: A rule kept off git.\n---\n\nKeep it.\n",
    );
    const notesFolderPath = join(repositoryFolderPath, ".cw/charter/notes/primitive/skill/notes");
    await mkdir(notesFolderPath, { recursive: true });
    await writeFile(
      join(notesFolderPath, "index.md"),
      '---\nkind: skill\nid: notes\ndescription: Write the notes.\ntriggers: ["write notes"]\n---\n\nAs [[secret-rule]] says.\n',
    );
    runGit(["add", "."], repositoryFolderPath, commandEnv);
    runGit(["commit", "--quiet", "-m", "Notes"], repositoryFolderPath, commandEnv);
    runGit(["push", "--quiet", "origin", "main"], repositoryFolderPath, commandEnv);

    const checkRun = runReleaseAction(["check"], releaseFolder);

    assert.equal(checkRun.status, 1);
    assert.match(checkRun.stderr, /git ignores/);
    assert.match(checkRun.stderr, /\.cw\/charter\/private\/primitive\/guide\/secret-rule\/index\.md/);
    assert.equal(statusOf(releaseFolder), "");
  });
});

test("with no tag 0.1.0 is proposed, and a last tag the changelog's top heading does not name stops quoting both (VENDOR Story 2 scenario 4)", async () => {
  await inReleaseFolder(CHARTER_TEXT_BY_PATH, async (releaseFolder) => {
    const { repositoryFolderPath, commandEnv } = releaseFolder;

    const firstDraftRun = runReleaseAction(["draft"], releaseFolder);
    assert.equal(firstDraftRun.status, 0, firstDraftRun.stderr);
    assert.match(firstDraftRun.stdout, /Last release: none\nVersion: 0\.1\.0\n/);

    runGit(["tag", "-a", "v0.2.0", "-m", "release v0.2.0"], repositoryFolderPath, commandEnv);
    const mismatchRun = runReleaseAction(["draft"], releaseFolder);
    assert.equal(mismatchRun.status, 1);
    assert.match(mismatchRun.stderr, /The last tag is v0\.2\.0, and the top heading of \.cw\/CHANGELOG\.md is none/);
    assert.equal(statusOf(releaseFolder), "");

    // The top heading is the one compared, quoted as written, never a release
    // heading below it.
    await writeFile(
      join(repositoryFolderPath, ".cw/CHANGELOG.md"),
      "# Changelog\n\n## Unreleased\n\n## 0.2.0 — 2026-11-01\n\n- First.\n",
    );
    runGit(["commit", "--quiet", "-am", "Unreleased"], repositoryFolderPath, commandEnv);
    const unreleasedRun = runReleaseAction(["draft"], releaseFolder);
    assert.equal(unreleasedRun.status, 1);
    assert.match(unreleasedRun.stderr, /the top heading of \.cw\/CHANGELOG\.md is "## Unreleased"/);
    // A changelog not opening with its heading is refused before the README.
    await writeFile(join(repositoryFolderPath, ".cw/CHANGELOG.md"), "Changes\n\n## 0.2.0\n");
    runGit(["commit", "--quiet", "-am", "No heading"], repositoryFolderPath, commandEnv);
    const unheadedRun = runReleaseAction(["draft"], releaseFolder);
    assert.equal(unheadedRun.status, 1);
    assert.match(unheadedRun.stderr, /\.cw\/CHANGELOG\.md does not open with "# Changelog"/);
    // A top heading naming the tag, dated or not, lets the draft through.
    await writeFile(join(repositoryFolderPath, ".cw/CHANGELOG.md"), "# Changelog\n\n## 0.2.0\n\n- First.\n");
    runGit(["commit", "--quiet", "-am", "Dateless"], repositoryFolderPath, commandEnv);
    const datelessRun = runReleaseAction(["draft"], releaseFolder);
    assert.equal(datelessRun.status, 0, datelessRun.stderr);
  });
});

test("after a release, the patch and the minor bump are proposed, with what was removed or renamed under the charters and every commit since (VENDOR Story 2 scenario 4)", async () => {
  await inReleaseFolder(CHARTER_TEXT_BY_PATH, async (releaseFolder) => {
    const { repositoryFolderPath, commandEnv } = releaseFolder;
    await writeFile(
      join(repositoryFolderPath, ".cw/CHANGELOG.md"),
      "# Changelog\n\n## 0.1.0 — 2026-11-19\n\n- First.\n",
    );
    runGit(["commit", "--quiet", "-am", "release v0.1.0"], repositoryFolderPath, commandEnv);
    runGit(["tag", "-a", "v0.1.0", "-m", "release v0.1.0"], repositoryFolderPath, commandEnv);
    runGit(["rm", "--quiet", "-r", ".cw/charter/baseline"], repositoryFolderPath, commandEnv);
    runGit(["commit", "--quiet", "-m", "Drop baseline"], repositoryFolderPath, commandEnv);

    const draftRun = runReleaseAction(["draft"], releaseFolder);

    assert.equal(draftRun.status, 0, draftRun.stderr);
    assert.match(draftRun.stdout, /Last release: v0\.1\.0\n/);
    assert.match(draftRun.stdout, /Patch: 0\.1\.1\n/);
    assert.match(draftRun.stdout, /Minor, [^\n]*: 0\.2\.0\n/);
    assert.match(
      draftRun.stdout,
      /Removed or renamed under \.cw\/charter\/:\n {2}D \.cw\/charter\/baseline\/primitive\/guide\/be-kind\/index\.md\n/,
    );
    assert.match(draftRun.stdout, /Landed:\n {2}\S+ Drop baseline\n/);
    assert.doesNotMatch(draftRun.stdout, /release v0\.1\.0/);
    assert.equal(statusOf(releaseFolder), "");
  });
});

test("an origin naming no default branch has the author asked which branch releases are made from, and a branch other than origin's default is refused (VENDOR Story 2 scenario 5)", async () => {
  await inReleaseFolder(CHARTER_TEXT_BY_PATH, async (releaseFolder) => {
    const { repositoryFolderPath, workFolderPath, commandEnv } = releaseFolder;

    const otherBranchRun = runReleaseAction(["check", "--branch", "draft"], releaseFolder);
    assert.equal(otherBranchRun.status, 1);
    assert.match(otherBranchRun.stderr, /origin's default branch is "main", not "draft"/);

    // An origin holding no commit names no default branch.
    const emptyOriginFolderPath = join(workFolderPath, "empty.git");
    runGit(["init", "--quiet", "--bare", emptyOriginFolderPath], workFolderPath, commandEnv);
    runGit(["remote", "set-url", "origin", emptyOriginFolderPath], repositoryFolderPath, commandEnv);
    const unsureRun = runReleaseAction(["check"], releaseFolder);
    assert.equal(unsureRun.status, 1);
    assert.match(unsureRun.stderr, /Unsure which branch to release from/);
    assert.match(unsureRun.stderr, /Ask the user which branch releases are made from/);
    const confirmedRun = runReleaseAction(["check", "--branch", "main"], releaseFolder);
    assert.equal(confirmedRun.status, 0, confirmedRun.stderr);
    // A name a shell would read as more than a branch is refused, so no line
    // printed to finish a release runs anything else.
    const shellBranchRun = runReleaseAction(["check", "--branch", "main;rm -rf ~"], releaseFolder);
    assert.equal(shellBranchRun.status, 1);
    assert.match(shellBranchRun.stderr, /"main;rm -rf ~" is no branch a release is made from/);

    // An origin that cannot be reached is said as it is, never asked as a
    // branch.
    runGit(["remote", "set-url", "origin", join(workFolderPath, "gone.git")], repositoryFolderPath, commandEnv);
    const unreachableRun = runReleaseAction(["check"], releaseFolder);
    assert.equal(unreachableRun.status, 1);
    assert.match(unreachableRun.stderr, /origin could not be reached/);
    assert.doesNotMatch(unreachableRun.stderr, /Unsure which branch/);
  });
});

test("a push that fails stops the release at that step, saying which steps ran and the command that finishes the rest, and no tag is made or moved (VENDOR Story 2 scenario 6)", async () => {
  await inReleaseFolder(CHARTER_TEXT_BY_PATH, async (releaseFolder) => {
    const { originFolderPath, workFolderPath, commandEnv } = releaseFolder;
    assert.equal(runReleaseAction(["check"], releaseFolder).status, 0);
    assert.equal(runReleaseAction(["readme"], releaseFolder).status, 0);
    await writeFile(
      join(originFolderPath, "hooks", "pre-receive"),
      "#!/bin/sh\necho 'origin is closed' >&2\nexit 1\n",
      {
        mode: 0o755,
      },
    );
    await writeFile(join(workFolderPath, "entry.md"), "- First.\n");

    const publishRun = runReleaseAction(
      ["publish", "0.1.0", join(workFolderPath, "entry.md"), "--date", "2026-11-19"],
      releaseFolder,
    );

    assert.equal(publishRun.status, 1);
    assert.match(publishRun.stderr, /Stopped at "push main"/);
    assert.match(publishRun.stderr, /Ran: write the entry into \.cw\/CHANGELOG\.md, commit\./);
    assert.match(
      publishRun.stderr,
      /To finish: git push origin main && git tag -a v0\.1\.0 -m "release v0\.1\.0" && git push origin v0\.1\.0/,
    );
    assert.equal(runGit(["tag", "--list"], originFolderPath, commandEnv), "");

    // A tag already there is never moved.
    runGit(["tag", "-a", "v0.2.0", "-m", "release v0.2.0"], releaseFolder.repositoryFolderPath, commandEnv);
    const movedTagRun = runReleaseAction(
      ["publish", "0.2.0", join(workFolderPath, "entry.md"), "--date", "2026-11-19"],
      releaseFolder,
    );
    assert.equal(movedTagRun.status, 1);
    assert.match(movedTagRun.stderr, /v0\.2\.0 is already a tag, and a tag is never moved\./);
  });
});

test("a tag push that fails stops the release at that step, saying which steps ran and the command that finishes the rest (VENDOR Story 2 scenario 6)", async () => {
  await inReleaseFolder(CHARTER_TEXT_BY_PATH, async (releaseFolder) => {
    const { originFolderPath, workFolderPath, commandEnv } = releaseFolder;
    assert.equal(runReleaseAction(["check"], releaseFolder).status, 0);
    assert.equal(runReleaseAction(["readme"], releaseFolder).status, 0);
    // origin takes the branch and refuses every tag.
    await writeFile(
      join(originFolderPath, "hooks", "pre-receive"),
      "#!/bin/sh\nwhile read old new ref; do case $ref in refs/tags/*) echo 'tags are closed' >&2; exit 1;; esac; done\n",
      { mode: 0o755 },
    );
    await writeFile(join(workFolderPath, "entry.md"), "- First.\n");

    const publishRun = runReleaseAction(
      ["publish", "0.1.0", join(workFolderPath, "entry.md"), "--date", "2026-11-19"],
      releaseFolder,
    );

    assert.equal(publishRun.status, 1);
    assert.match(publishRun.stderr, /Stopped at "push v0\.1\.0"/);
    assert.match(publishRun.stderr, /Ran: write the entry into \.cw\/CHANGELOG\.md, commit, push main, tag v0\.1\.0\./);
    assert.match(publishRun.stderr, /To finish: git push origin v0\.1\.0$/m);
    assert.equal(runGit(["tag", "--list"], originFolderPath, commandEnv), "");
  });
});

test("cw init and cw charter create in an empty folder set a repository releasing charters up: the charter held, empty, /charter-release laid, no mark in the settings (VENDOR Story 1 scenario 1, VENDOR-FR-032, VENDOR-FR-029, VENDOR-SC-001)", async () => {
  await inReleaseFolder(
    {},
    async ({ repositoryFolderPath, commandEnv }) => {
      const createRun = runCw(["charter", "create", "sdd"], repositoryFolderPath, commandEnv);
      assert.equal(createRun.status, 0, createRun.stderr);

      assert.deepEqual(
        (await readdir(join(repositoryFolderPath, ".cw/charter"))).filter((entryName) => entryName !== ".gitkeep"),
        ["sdd"],
      );
      assert.deepEqual(
        (await readdir(join(repositoryFolderPath, ".cw/charter/sdd"))).filter((entryName) => entryName !== ".gitkeep"),
        [],
      );
      assert.ok((await readFile(join(repositoryFolderPath, ".cw/out/skill/charter-release/index.md"), "utf8")) !== "");
      assert.deepEqual(
        Object.keys(JSON.parse(await readFile(join(repositoryFolderPath, ".cw/settings.json"), "utf8"))),
        ["agents"],
      );
    },
    false,
  );
});

test("any repository builds /charter-release and its script from cw itself, into no charter of its own (VENDOR Story 8 scenario 1, VENDOR Story 2 scenario 7, VENDOR-FR-027)", async () => {
  await inReleaseFolder(CHARTER_TEXT_BY_PATH, async ({ repositoryFolderPath, commandEnv }) => {
    for (const outputPath of [
      ".cw/out/skill/charter-release/index.md",
      releaseScriptPath,
      ".claude/skills/charter-release/SKILL.md",
    ])
      assert.ok((await readFile(join(repositoryFolderPath, outputPath), "utf8")) !== "", outputPath);
    // Never written into a charter (VENDOR-FR-013).
    assert.deepEqual(
      (await readdir(join(repositoryFolderPath, ".cw/charter"))).filter((entryName) => entryName !== ".gitkeep").sort(),
      ["baseline", "grill", "sdd"],
    );
    // Read as the charter holds them, as the build lays them.
    const listRun = runCw(["list"], repositoryFolderPath, commandEnv);
    assert.equal(listRun.status, 0, listRun.stderr);
    assert.match(listRun.stdout, /charter-release(?!-)/);
    assert.match(listRun.stdout, /charter-release-action/);
    // Nothing in the settings marks it.
    assert.deepEqual(Object.keys(JSON.parse(await readFile(join(repositoryFolderPath, ".cw/settings.json"), "utf8"))), [
      "agents",
    ]);
  });
});

test("released with no README and no changelog, both are written and committed with the release, the README holding the install section alone (VENDOR Story 8 scenario 2, VENDOR Story 2 scenario 9, VENDOR-FR-006, VENDOR-FR-007)", async () => {
  await inReleaseFolder(
    CHARTER_TEXT_BY_PATH,
    async (releaseFolder) => {
      const { repositoryFolderPath, originFolderPath, workFolderPath, commandEnv } = releaseFolder;
      assert.equal(runReleaseAction(["check"], releaseFolder).status, 0);
      const readmeRun = runReleaseAction(["readme"], releaseFolder);
      assert.equal(readmeRun.status, 0, readmeRun.stderr);
      const readmeText = await readFile(join(repositoryFolderPath, "README.md"), "utf8");
      assert.ok(readmeText.startsWith("<!-- charter-release-action: charters -->\n## Install\n"), readmeText);
      assert.ok(readmeText.endsWith("<!-- /charter-release-action: charters -->\n"), readmeText);
      assert.ok(readmeText.includes(`\ncw charter pull ${originFolderPath} --charter=sdd\n`), readmeText);
      const draftRun = runReleaseAction(["draft"], releaseFolder);
      assert.equal(draftRun.status, 0, draftRun.stderr);
      assert.match(draftRun.stdout, /Version: 0\.1\.0/);
      await writeFile(join(workFolderPath, "entry.md"), "- First.\n");

      const publishRun = runReleaseAction(
        ["publish", "0.1.0", join(workFolderPath, "entry.md"), "--date", "2026-11-19"],
        releaseFolder,
      );

      assert.equal(publishRun.status, 0, publishRun.stderr);
      assert.equal(runGit(["tag", "--list"], originFolderPath, commandEnv), "v0.1.0");
      assert.equal(
        runGit(["show", "main:.cw/CHANGELOG.md"], originFolderPath, commandEnv),
        "# Changelog\n\n## 0.1.0 — 2026-11-19\n\n- First.",
      );
      assert.equal(runGit(["show", "main:README.md"], originFolderPath, commandEnv), readmeText.trim());
      assert.equal(statusOf(releaseFolder), "");
    },
    false,
  );
});

test("cw add refuses the id of /charter-release, writing nothing (VENDOR Story 2 scenario 8, VENDOR-FR-028)", async () => {
  await inReleaseFolder({}, async ({ repositoryFolderPath, commandEnv }) => {
    const addRun = runCw(
      [
        "add",
        "skill",
        "charter-release",
        "--charter=team",
        "--header",
        "description=Mine.",
        "--header",
        "triggers=mine",
      ],
      repositoryFolderPath,
      commandEnv,
    );
    assert.equal(addRun.status, 1);
    assert.match(addRun.stderr.replace(/\s+/g, " "), /"charter-release" is what cw brings to every repository/);
    await assert.rejects(readdir(join(repositoryFolderPath, ".cw/charter/team/primitive/skill/charter-release")));
  });
});

for (const [caseName, primitiveKind, primitiveText] of [
  [
    "holding the id",
    "skill",
    '---\nkind: skill\nid: charter-release\ndescription: Release mine.\ntriggers: ["release mine"]\n---\n\nMine.\n',
  ],
  [
    "naming it in its body",
    "skill",
    '---\nkind: skill\nid: notes\ndescription: Write the notes.\ntriggers: ["write notes"]\n---\n\nThen run [[charter-release-action]].\n',
  ],
  [
    "naming it as its rationale",
    "skill",
    '---\nkind: skill\nid: notes\ndescription: Write the notes.\ntriggers: ["write notes"]\nrationale: charter-release\n---\n\nWrite them.\n',
  ],
  [
    "naming it among its mixins",
    "skill",
    '---\nkind: skill\nid: notes\ndescription: Write the notes.\ntriggers: ["write notes"]\nmixins: ["charter-release"]\n---\n\nWrite them.\n',
  ],
  [
    "naming it in a sensor's run",
    "sensor",
    '---\nkind: sensor\nid: release-on-stop\ndescription: Release when the agent stops.\nsignal: Stop\nrun: node "[[charter-release-action]]" check\n---\n\nRelease.\n',
  ],
  [
    "naming it among an agent's tools",
    "agent",
    '---\nkind: agent\nid: releaser\ndescription: Release the charters.\ntools: ["Read", "[[charter-release]]"]\n---\n\nRelease.\n',
  ],
] as const)
  test(`a primitive ${caseName} of /charter-release or its script is refused naming its file (VENDOR Story 2 scenario 8, VENDOR-FR-028)`, async () => {
    await inReleaseFolder({}, async ({ repositoryFolderPath, commandEnv }) => {
      const primitiveId = /^id: (\S+)$/m.exec(primitiveText)?.[1] ?? "";
      const primitiveFilePath = `.cw/charter/team/primitive/${primitiveKind}/${primitiveId}/index.md`;
      await mkdir(join(repositoryFolderPath, primitiveFilePath, ".."), { recursive: true });
      await writeFile(join(repositoryFolderPath, primitiveFilePath), primitiveText);

      const buildRun = runCw(["build"], repositoryFolderPath, commandEnv);

      const buildProblemText = buildRun.stderr.replace(/\s+/g, " ");
      assert.equal(buildRun.status, 1);
      assert.ok(buildRun.stderr.includes(primitiveFilePath), buildRun.stderr);
      assert.match(buildProblemText, /"charter-release(-action)?", which cw brings to every repository/);
      if (caseName === "holding the id") {
        assert.match(buildProblemText, /Give this one an id of its own, or delete it/);
        assert.doesNotMatch(buildProblemText, /is already declared by/);
      }
      // Never told to author what no primitive may hold.
      assert.doesNotMatch(buildProblemText, /holds no (primitive|mixin|corpus) of that id/);
    });
  });

test("a README /vendor-release wrote is refused naming the markers to rename, and nothing is written (VENDOR Story 8 scenario 6, VENDOR-FR-006)", async () => {
  await inReleaseFolder(
    CHARTER_TEXT_BY_PATH,
    async (releaseFolder) => {
      const { repositoryFolderPath, commandEnv } = releaseFolder;
      const oldReadmeText =
        "# acme-charters\n\n<!-- vendor-release-action: charters -->\n## Install\n<!-- /vendor-release-action: charters -->\n";
      await writeFile(join(repositoryFolderPath, "README.md"), oldReadmeText);
      runGit(["add", "README.md"], repositoryFolderPath, commandEnv);
      runGit(["commit", "--quiet", "-m", "The README of 1.2.0"], repositoryFolderPath, commandEnv);
      runGit(["push", "--quiet", "origin", "main"], repositoryFolderPath, commandEnv);
      assert.equal(runReleaseAction(["check"], releaseFolder).status, 0);

      const readmeRun = runReleaseAction(["readme"], releaseFolder);

      assert.equal(readmeRun.status, 1);
      assert.match(
        readmeRun.stderr,
        /rename them "<!-- charter-release-action: charters -->" … "<!-- \/charter-release-action: charters -->"/,
      );
      assert.equal(await readFile(join(repositoryFolderPath, "README.md"), "utf8"), oldReadmeText);
    },
    false,
  );
});

test("a README holding no install section gets it at its end, the rest kept as it is (VENDOR Story 8 scenario 7, VENDOR-FR-006)", async () => {
  await inReleaseFolder(
    CHARTER_TEXT_BY_PATH,
    async (releaseFolder) => {
      const { repositoryFolderPath, originFolderPath, commandEnv } = releaseFolder;
      const ownReadmeText = "# acme-charters\n\nRules for TypeScript services.\n";
      await writeFile(join(repositoryFolderPath, "README.md"), ownReadmeText);
      runGit(["add", "README.md"], repositoryFolderPath, commandEnv);
      runGit(["commit", "--quiet", "-m", "The README GitHub made"], repositoryFolderPath, commandEnv);
      runGit(["push", "--quiet", "origin", "main"], repositoryFolderPath, commandEnv);
      assert.equal(runReleaseAction(["check"], releaseFolder).status, 0);

      const readmeRun = runReleaseAction(["readme"], releaseFolder);

      assert.equal(readmeRun.status, 0, readmeRun.stderr);
      const readmeText = await readFile(join(repositoryFolderPath, "README.md"), "utf8");
      assert.ok(
        readmeText.startsWith(`${ownReadmeText}\n<!-- charter-release-action: charters -->\n## Install\n`),
        readmeText,
      );
      assert.ok(readmeText.endsWith("<!-- /charter-release-action: charters -->\n"), readmeText);
      assert.ok(readmeText.includes(`\ncw charter pull ${originFolderPath} --charter=sdd\n`), readmeText);
    },
    false,
  );
});

test("the README installs from the address origin names, a credential an https address carries left out (VENDOR-SC-002, VENDOR-FR-006)", async () => {
  await inReleaseFolder(CHARTER_TEXT_BY_PATH, async (releaseFolder) => {
    const { repositoryFolderPath, commandEnv } = releaseFolder;
    runGit(
      ["remote", "set-url", "origin", "https://someone:secret-token@example.com/acme/acme-charters.git"],
      repositoryFolderPath,
      commandEnv,
    );

    const readmeRun = runReleaseAction(["readme"], releaseFolder);

    assert.equal(readmeRun.status, 0, readmeRun.stderr);
    const readmeText = await readFile(join(repositoryFolderPath, "README.md"), "utf8");
    assert.ok(
      readmeText.includes(
        "\ncw charter pull https://example.com/acme/acme-charters.git --charter=baseline --charter=sdd\n",
      ),
      readmeText,
    );
    assert.doesNotMatch(readmeText, /secret-token|someone@/);
  });
});

test("a charter the repository installed that does not build refuses the release, showing why, and nothing is written (VENDOR Story 8 scenario 8, VENDOR-FR-005)", async () => {
  await inReleaseFolder(CHARTER_TEXT_BY_PATH, async (releaseFolder) => {
    const { repositoryFolderPath, commandEnv } = releaseFolder;
    const brokenFolderPath = join(repositoryFolderPath, ".cw/charter/broken");
    await mkdir(join(brokenFolderPath, "primitive/guide/no-description"), { recursive: true });
    await writeFile(
      join(brokenFolderPath, "primitive/guide/no-description/index.md"),
      "---\nkind: guide\nid: no-description\n---\n\nSay nothing of what it is.\n",
    );
    await writeFile(
      join(brokenFolderPath, "cw-package.json"),
      `${JSON.stringify({ charter: "broken", source: "acme/broken", version: "v1.0.0" })}\n`,
    );
    runGit(["add", "."], repositoryFolderPath, commandEnv);
    runGit(["commit", "--quiet", "-m", "A charter installed"], repositoryFolderPath, commandEnv);
    runGit(["push", "--quiet", "origin", "main"], repositoryFolderPath, commandEnv);
    const readmeTextBefore = await readFile(join(repositoryFolderPath, "README.md"), "utf8");

    const checkRun = runReleaseAction(["check"], releaseFolder);

    assert.equal(checkRun.status, 1);
    assert.match(checkRun.stderr, /"broken" does not build/);
    assert.match(checkRun.stderr, /broken\/primitive\/guide\/no-description/);
    assert.equal(await readFile(join(repositoryFolderPath, "README.md"), "utf8"), readmeTextBefore);
    assert.equal(statusOf(releaseFolder), "");
  });
});

for (const [caseName, brokenReadmeText] of [
  ["its end marker alone", "# acme-charters\n\n<!-- /charter-release-action: charters -->\n"],
  ["its start marker alone", "# acme-charters\n\n<!-- charter-release-action: charters -->\n"],
  [
    "its two markers out of order",
    "# acme-charters\n\n<!-- /charter-release-action: charters -->\n<!-- charter-release-action: charters -->\n",
  ],
] as const)
  test(`a README holding ${caseName} is refused, naming both lines, and nothing is written (VENDOR Story 8 scenario 9, VENDOR-FR-006)`, async () => {
    await inReleaseFolder(
      CHARTER_TEXT_BY_PATH,
      async (releaseFolder) => {
        const { repositoryFolderPath, commandEnv } = releaseFolder;
        await writeFile(join(repositoryFolderPath, "README.md"), brokenReadmeText);
        runGit(["add", "README.md"], repositoryFolderPath, commandEnv);
        runGit(["commit", "--quiet", "-m", "A broken section"], repositoryFolderPath, commandEnv);
        runGit(["push", "--quiet", "origin", "main"], repositoryFolderPath, commandEnv);
        assert.equal(runReleaseAction(["check"], releaseFolder).status, 0);

        const readmeRun = runReleaseAction(["readme"], releaseFolder);

        assert.equal(readmeRun.status, 1);
        assert.match(
          readmeRun.stderr,
          /holds only one of "<!-- charter-release-action: charters -->" and "<!-- \/charter-release-action: charters -->", or the two out of order/,
        );
        assert.equal(await readFile(join(repositoryFolderPath, "README.md"), "utf8"), brokenReadmeText);
      },
      false,
    );
  });

test("a release keeps the charters' changelog in .cw/CHANGELOG.md, leaves a CHANGELOG.md at the root as it is, and links it from the README (VENDOR Story 8 scenario 10, VENDOR-FR-007)", async () => {
  await inReleaseFolder(
    CHARTER_TEXT_BY_PATH,
    async (releaseFolder) => {
      const { repositoryFolderPath, originFolderPath, workFolderPath, commandEnv } = releaseFolder;
      const ownChangelogText = "# Our own changelog\n\n## 9.9.9\n\n- Not the charters'.\n";
      await writeFile(join(repositoryFolderPath, "CHANGELOG.md"), ownChangelogText);
      runGit(["add", "CHANGELOG.md"], repositoryFolderPath, commandEnv);
      runGit(["commit", "--quiet", "-m", "Our own changelog"], repositoryFolderPath, commandEnv);
      runGit(["push", "--quiet", "origin", "main"], repositoryFolderPath, commandEnv);
      assert.equal(runReleaseAction(["check"], releaseFolder).status, 0);
      const draftRun = runReleaseAction(["draft"], releaseFolder);
      assert.equal(draftRun.status, 0, draftRun.stderr);
      assert.match(draftRun.stdout, /Version: 0\.1\.0/);
      assert.equal(runReleaseAction(["readme"], releaseFolder).status, 0);
      await writeFile(join(workFolderPath, "entry.md"), "- First.\n");

      const publishRun = runReleaseAction(
        ["publish", "0.1.0", join(workFolderPath, "entry.md"), "--date", "2026-11-20"],
        releaseFolder,
      );

      assert.equal(publishRun.status, 0, publishRun.stderr);
      assert.equal(
        runGit(["show", "main:.cw/CHANGELOG.md"], originFolderPath, commandEnv),
        "# Changelog\n\n## 0.1.0 — 2026-11-20\n\n- First.",
      );
      assert.equal(runGit(["show", "main:CHANGELOG.md"], originFolderPath, commandEnv), ownChangelogText.trim());
      assert.match(
        runGit(["show", "main:README.md"], originFolderPath, commandEnv),
        /What changed in each release: \[the changelog of these charters\]\(\.cw\/CHANGELOG\.md\), kept by Cherry Works\.\n<!-- \/charter-release-action: charters -->/,
      );
    },
    false,
  );
});

test("a repository tagged before it kept .cw/CHANGELOG.md drafts the release after its last tag (VENDOR-FR-007)", async () => {
  await inReleaseFolder(
    CHARTER_TEXT_BY_PATH,
    async (releaseFolder) => {
      const { repositoryFolderPath, commandEnv } = releaseFolder;
      runGit(["tag", "-a", "v0.2.0", "-m", "release v0.2.0"], repositoryFolderPath, commandEnv);
      await writeFile(join(repositoryFolderPath, "notes.md"), "A change after it.\n");
      runGit(["add", "notes.md"], repositoryFolderPath, commandEnv);
      runGit(["commit", "--quiet", "-m", "A change after it"], repositoryFolderPath, commandEnv);

      const draftRun = runReleaseAction(["draft"], releaseFolder);

      assert.equal(draftRun.status, 0, draftRun.stderr);
      assert.match(draftRun.stdout, /Last release: v0\.2\.0\n/);
      assert.match(draftRun.stdout, /Patch: 0\.2\.1\n/);
      assert.match(draftRun.stdout, /Landed:\n {2}\S+ A change after it\n/);
      assert.doesNotMatch(draftRun.stdout, /Version: 0\.1\.0/);
    },
    false,
  );
});
