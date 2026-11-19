import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// `pnpm test` builds this tree first: dist/ is what its source builds to.
const cwFilePath = fileURLToPath(new URL("../dist/cw.js", import.meta.url));
const gitignoreTemplatePath = fileURLToPath(
  new URL("../src/presentation/cli/templates/vendor-init-command/gitignore.txt", import.meta.url),
);
const readmeTemplatePath = fileURLToPath(
  new URL("../src/presentation/cli/templates/vendor-init-command/README.md", import.meta.url),
);
const releaseScriptPath = ".cw/out/script/vendor-release-action/vendor-release-action.mjs";

interface ReleaseFolder {
  readonly repositoryFolderPath: string;
  readonly originFolderPath: string;
  readonly workFolderPath: string;
  readonly commandEnv: NodeJS.ProcessEnv;
}

/** A charter repository as `cw vendor init` leaves it once committed and
 *  pushed: its settings marking it a vendor's, README, changelog and
 *  `.gitignore` from the template, the charters `charterTextByPath` holds, and
 *  an `origin` its `main` is pushed to; built, so the release script is laid.
 *  git and cw run there as a developer would, under a home and a git
 *  configuration of the run's own, `cw` on the PATH being the one just built. */
async function inReleaseFolder(
  charterTextByPath: Readonly<Record<string, string>>,
  runTest: (releaseFolder: ReleaseFolder) => Promise<void>,
) {
  const workFolderPath = await mkdtemp(join(tmpdir(), "cw-vendor-release-"));
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
    const settingsFilePath = join(repositoryFolderPath, ".cw/settings.json");
    await writeFile(
      settingsFilePath,
      `${JSON.stringify({ ...JSON.parse(await readFile(settingsFilePath, "utf8")), vendor: true }, null, 2)}\n`,
    );
    await writeFile(join(repositoryFolderPath, ".gitignore"), await readFile(gitignoreTemplatePath, "utf8"));
    await writeFile(
      join(repositoryFolderPath, "README.md"),
      (await readFile(readmeTemplatePath, "utf8"))
        .replaceAll("{{name}}", "acme-charters")
        .replaceAll("{{description}}", "Rules for TypeScript services."),
    );
    await writeFile(join(repositoryFolderPath, "CHANGELOG.md"), "# Changelog\n");
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
 *  /vendor-release runs it. */
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
  ".cw/charter/grill/cw-vendor.json": `${JSON.stringify({ charter: "grill", source: "mattpocock/skills", version: "v1.0.0" })}\n`,
};

test("released from the default branch of origin, the install section and the entry are committed, pushed and tagged, and another repository installs a charter with the line the README gives (VENDOR Story 2 scenario 1)", async () => {
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
    assert.match(readmeText, /cw vendor add acme\/acme-charters\n/);
    assert.match(readmeText, /### baseline\n\n```bash\ncw vendor add acme\/acme-charters --charter=baseline\n/);
    assert.match(readmeText, /### sdd\n\n```bash\ncw vendor add acme\/acme-charters --charter=sdd\n/);
    assert.match(readmeText, /\| `\/greet` \| Say hello\. \|/);
    // Only what the repository authored, never cw's own skills.
    const installSectionText = readmeText.slice(
      readmeText.indexOf("<!-- vendor-release-action: charters -->"),
      readmeText.indexOf("<!-- /vendor-release-action: charters -->"),
    );
    assert.doesNotMatch(installSectionText, /grill/);
    assert.doesNotMatch(installSectionText, /`\/cw-author`|`\/vendor-release`/);
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
      runGit(["show", "main:CHANGELOG.md"], originFolderPath, commandEnv),
      "# Changelog\n\n## 0.1.0 — 2026-11-19\n\n- First.",
    );
    assert.equal(statusOf(releaseFolder), "");

    const consumerFolderPath = join(workFolderPath, "consumer");
    await mkdir(consumerFolderPath);
    runGit(["init", "--quiet"], consumerFolderPath, commandEnv);
    assert.equal(runCw(["init", "--agent", "claude"], consumerFolderPath, commandEnv).status, 0);
    // The line the README gives, its source the origin on disk that
    // acme/acme-charters stands for here.
    const readmeInstallArgs = /^cw vendor add acme\/acme-charters (--charter=sdd)$/m.exec(readmeText)?.slice(1) ?? [];
    assert.deepEqual(readmeInstallArgs, ["--charter=sdd"]);
    const vendorAddRun = runCw(
      ["vendor", "add", originFolderPath, ...readmeInstallArgs],
      consumerFolderPath,
      commandEnv,
    );
    assert.equal(vendorAddRun.status, 0, vendorAddRun.stderr);
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

test("a charter that does not build with the charters it includes alone is refused naming it and why, and nothing is written (VENDOR Story 2 scenario 3)", async () => {
  await inReleaseFolder(CHARTER_TEXT_BY_PATH, async (releaseFolder) => {
    const { repositoryFolderPath, commandEnv } = releaseFolder;
    // A charter that builds here only with what cw brings this repository,
    // committed and pushed after the last build.
    const notesFolderPath = join(repositoryFolderPath, ".cw/charter/release-notes/primitive/skill/notes");
    await mkdir(notesFolderPath, { recursive: true });
    await writeFile(
      join(notesFolderPath, "index.md"),
      '---\nkind: skill\nid: notes\ndescription: Write the notes.\ntriggers: ["write notes"]\n---\n\nThen run [[vendor-release]].\n',
    );
    runGit(["add", "."], repositoryFolderPath, commandEnv);
    runGit(["commit", "--quiet", "-m", "Release notes"], repositoryFolderPath, commandEnv);
    runGit(["push", "--quiet", "origin", "main"], repositoryFolderPath, commandEnv);

    const checkRun = runReleaseAction(["check"], releaseFolder);

    assert.equal(checkRun.status, 1);
    assert.match(checkRun.stderr, /"release-notes" does not build with the charters it includes alone/);
    assert.match(checkRun.stderr, /\.cw\/charter\/release-notes\/primitive\/skill\/notes\/index\.md/);
    assert.match(checkRun.stderr, /names "vendor-release"/);
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
    assert.match(mismatchRun.stderr, /The last tag is v0\.2\.0, and the top heading of CHANGELOG\.md is none/);
    assert.equal(statusOf(releaseFolder), "");
  });
});

test("after a release, the patch and the minor bump are proposed, with what was removed or renamed under the charters and every commit since (VENDOR Story 2 scenario 4)", async () => {
  await inReleaseFolder(CHARTER_TEXT_BY_PATH, async (releaseFolder) => {
    const { repositoryFolderPath, commandEnv } = releaseFolder;
    await writeFile(join(repositoryFolderPath, "CHANGELOG.md"), "# Changelog\n\n## 0.1.0 — 2026-11-19\n\n- First.\n");
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
    assert.match(publishRun.stderr, /Ran: write the entry into CHANGELOG\.md, commit\./);
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
    assert.match(publishRun.stderr, /Ran: write the entry into CHANGELOG\.md, commit, push main, tag v0\.1\.0\./);
    assert.match(publishRun.stderr, /To finish: git push origin v0\.1\.0$/m);
    assert.equal(runGit(["tag", "--list"], originFolderPath, commandEnv), "");
  });
});

test("a repository marked a vendor's builds /vendor-release and its script from cw itself, and any other repository builds neither (VENDOR Story 2 scenario 7)", async () => {
  await inReleaseFolder(CHARTER_TEXT_BY_PATH, async ({ repositoryFolderPath, commandEnv }) => {
    for (const outputPath of [
      ".cw/out/skill/vendor-release/index.md",
      releaseScriptPath,
      ".claude/skills/vendor-release/SKILL.md",
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
    assert.match(listRun.stdout, /vendor-release(?!-)/);
    assert.match(listRun.stdout, /vendor-release-action/);

    const settingsFilePath = join(repositoryFolderPath, ".cw/settings.json");
    const { vendor: _vendor, ...otherSettings } = JSON.parse(await readFile(settingsFilePath, "utf8"));
    await writeFile(settingsFilePath, `${JSON.stringify(otherSettings, null, 2)}\n`);
    const buildRun = runCw(["build"], repositoryFolderPath, commandEnv);
    assert.equal(buildRun.status, 0, buildRun.stdout);
    for (const outputPath of [
      ".cw/out/skill/vendor-release/index.md",
      releaseScriptPath,
      ".claude/skills/vendor-release/SKILL.md",
    ])
      await assert.rejects(readFile(join(repositoryFolderPath, outputPath)), outputPath);

    // `cw init` run again keeps the mark.
    await writeFile(settingsFilePath, `${JSON.stringify({ ...otherSettings, vendor: true }, null, 2)}\n`);
    assert.equal(runCw(["init", "--agent", "claude"], repositoryFolderPath, commandEnv).status, 0);
    assert.equal(JSON.parse(await readFile(settingsFilePath, "utf8")).vendor, true);
  });
});

test("cw add refuses the id of what cw builds into a vendor's repository alone, writing nothing, in a vendor's repository or any other (VENDOR Story 2 scenario 8)", async () => {
  await inReleaseFolder({}, async ({ repositoryFolderPath, commandEnv }) => {
    const settingsFilePath = join(repositoryFolderPath, ".cw/settings.json");
    const vendorSettingsText = await readFile(settingsFilePath, "utf8");
    const { vendor: _vendor, ...otherSettings } = JSON.parse(vendorSettingsText);

    for (const settingsText of [vendorSettingsText, `${JSON.stringify(otherSettings, null, 2)}\n`]) {
      await writeFile(settingsFilePath, settingsText);
      const addRun = runCw(
        [
          "add",
          "skill",
          "vendor-release",
          "--charter=team",
          "--header",
          "description=Mine.",
          "--header",
          "triggers=mine",
        ],
        repositoryFolderPath,
        commandEnv,
      );
      assert.equal(addRun.status, 1, settingsText);
      assert.match(
        addRun.stderr.replace(/\s+/g, " "),
        /"vendor-release" is what cw brings to a repository "cw vendor init" set up alone/,
      );
      await assert.rejects(readdir(join(repositoryFolderPath, ".cw/charter/team/primitive/skill/vendor-release")));
    }
  });
});

for (const [caseName, primitiveKind, primitiveText] of [
  [
    "holding the id",
    "skill",
    '---\nkind: skill\nid: vendor-release\ndescription: Release mine.\ntriggers: ["release mine"]\n---\n\nMine.\n',
  ],
  [
    "naming it in its body",
    "skill",
    '---\nkind: skill\nid: notes\ndescription: Write the notes.\ntriggers: ["write notes"]\n---\n\nThen run [[vendor-release-action]].\n',
  ],
  [
    "naming it as its rationale",
    "skill",
    '---\nkind: skill\nid: notes\ndescription: Write the notes.\ntriggers: ["write notes"]\nrationale: vendor-release\n---\n\nWrite them.\n',
  ],
  [
    "naming it among its mixins",
    "skill",
    '---\nkind: skill\nid: notes\ndescription: Write the notes.\ntriggers: ["write notes"]\nmixins: ["vendor-release"]\n---\n\nWrite them.\n',
  ],
  [
    "naming it in a sensor's run",
    "sensor",
    '---\nkind: sensor\nid: release-on-stop\ndescription: Release when the agent stops.\nsignal: Stop\nrun: node "[[vendor-release-action]]" check\n---\n\nRelease.\n',
  ],
  [
    "naming it among an agent's tools",
    "agent",
    '---\nkind: agent\nid: releaser\ndescription: Release the charters.\ntools: ["Read", "[[vendor-release]]"]\n---\n\nRelease.\n',
  ],
] as const)
  test(`a primitive ${caseName} of what cw builds into a vendor's repository alone is refused naming its file, in a vendor's repository or any other (VENDOR Story 2 scenario 8)`, async () => {
    await inReleaseFolder({}, async ({ repositoryFolderPath, commandEnv }) => {
      const primitiveId = /^id: (\S+)$/m.exec(primitiveText)?.[1] ?? "";
      const primitiveFilePath = `.cw/charter/team/primitive/${primitiveKind}/${primitiveId}/index.md`;
      await mkdir(join(repositoryFolderPath, primitiveFilePath, ".."), { recursive: true });
      await writeFile(join(repositoryFolderPath, primitiveFilePath), primitiveText);
      const settingsFilePath = join(repositoryFolderPath, ".cw/settings.json");
      const vendorSettingsText = await readFile(settingsFilePath, "utf8");
      const { vendor: _vendor, ...otherSettings } = JSON.parse(vendorSettingsText);

      for (const settingsText of [vendorSettingsText, `${JSON.stringify(otherSettings, null, 2)}\n`]) {
        await writeFile(settingsFilePath, settingsText);
        const buildRun = runCw(["build"], repositoryFolderPath, commandEnv);
        const buildProblemText = buildRun.stderr.replace(/\s+/g, " ");
        assert.equal(buildRun.status, 1, settingsText);
        assert.ok(buildRun.stderr.includes(primitiveFilePath), buildRun.stderr);
        assert.match(
          buildProblemText,
          /"vendor-release(-action)?", which cw brings to a repository "cw vendor init" set up alone/,
        );
        // One an earlier `cw vendor init` wrote is deleted, the settings
        // marking the repository a vendor's, and never said to be renamed.
        if (caseName === "holding the id") {
          assert.match(
            buildProblemText,
            /Delete it where "cw vendor init" set this repository up, and add "vendor": true to this repository's own settings/,
          );
          assert.doesNotMatch(buildProblemText, /is already declared by/);
        }
        // Never told to author what no primitive may hold.
        assert.doesNotMatch(buildProblemText, /holds no (primitive|mixin|corpus) of that id/);
      }
    });
  });
