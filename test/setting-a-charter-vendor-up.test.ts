import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// `pnpm test` builds this tree first: dist/ is what its source builds to.
const cwFilePath = fileURLToPath(new URL("../dist/cw.js", import.meta.url));

/** A folder of its own for each run, `acme-charters` in it to set up, git
 *  and cw run there as a developer would, under a home and a git
 *  configuration of the run's own. */
async function inWorkFolder(
  runTest: (repositoryFolderPath: string, commandEnv: NodeJS.ProcessEnv, workFolderPath: string) => Promise<void>,
) {
  const workFolderPath = await mkdtemp(join(tmpdir(), "cw-vendor-init-"));
  try {
    const repositoryFolderPath = join(workFolderPath, "acme-charters");
    await mkdir(repositoryFolderPath);
    await mkdir(join(workFolderPath, "home"));
    await writeFile(join(workFolderPath, "gitconfig"), "");
    await runTest(
      repositoryFolderPath,
      {
        ...process.env,
        HOME: join(workFolderPath, "home"),
        NO_COLOR: "1",
        GIT_CONFIG_GLOBAL: join(workFolderPath, "gitconfig"),
        GIT_AUTHOR_NAME: "Someone",
        GIT_AUTHOR_EMAIL: "someone@example.com",
        GIT_COMMITTER_NAME: "Someone",
        GIT_COMMITTER_EMAIL: "someone@example.com",
      },
      workFolderPath,
    );
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

/** Drives a command at a terminal of its own: for each step, waits until the
 *  command has shown the text, then types the keys. Python's `pty` makes the
 *  terminal, since node has none of its own. */
const TERMINAL_DRIVER_PY = `
import json, os, pty, select, sys, time
steps = json.loads(sys.argv[1])
pid, fd = pty.fork()
if pid == 0:
    os.execvp(sys.argv[2], sys.argv[2:])
shown = b""
def read_shown(timeout):
    global shown
    if not select.select([fd], [], [], max(timeout, 0))[0]:
        return False
    try:
        data = os.read(fd, 4096)
    except OSError:
        return None
    shown += data
    return bool(data) or None
for expected_text, typed_keys in steps:
    deadline = time.time() + 60
    while expected_text.encode() not in shown:
        if read_shown(deadline - time.time()) is None or time.time() > deadline:
            sys.stdout.write(shown.decode(errors="replace"))
            sys.exit(97)
    time.sleep(0.3)
    for typed_key in typed_keys:
        os.write(fd, typed_key.encode())
        time.sleep(0.05)
while read_shown(60) is True:
    pass
sys.stdout.write(shown.decode(errors="replace"))
sys.exit(os.waitstatus_to_exitcode(os.waitpid(pid, 0)[1]))
`;

const hasPython = spawnSync("python3", ["--version"]).status === 0;

/** `cw vendor init` answered at a terminal: the name as it is offered, the
 *  description typed, and claude, the first agent, ticked at cw init's
 *  question, which an empty description never reaches. */
function runVendorInitAtTerminal(
  folderPath: string,
  commandEnv: NodeJS.ProcessEnv,
  repositoryDescription = "Rules for TypeScript services.",
) {
  const answerSteps = [
    ["repository called", "\r"],
    ["install them", `${repositoryDescription}\r`],
    ...(repositoryDescription === "" ? [] : [["Which agents", " \r"]]),
  ];
  return spawnSync(
    "python3",
    ["-c", TERMINAL_DRIVER_PY, JSON.stringify(answerSteps), process.execPath, cwFilePath, "vendor", "init"],
    { cwd: folderPath, env: commandEnv, encoding: "utf8" },
  );
}

/** Every file under a folder, by its path from it, `.git` left out. */
async function listFilePaths(folderPath: string): Promise<readonly string[]> {
  return (await readdir(folderPath, { recursive: true, withFileTypes: true }))
    .filter((dirent) => dirent.isFile())
    .map((dirent) => relative(folderPath, join(dirent.parentPath, dirent.name)))
    .filter((filePath) => !filePath.startsWith(".git/"))
    .sort();
}

test("an empty folder answered at a terminal is set up as a charter repository from the template, on main, with nothing committed", {
  skip: !hasPython && "python3 makes the terminal",
}, async () => {
  await inWorkFolder(async (repositoryFolderPath, commandEnv) => {
    const vendorInitRun = runVendorInitAtTerminal(repositoryFolderPath, commandEnv);

    assert.equal(vendorInitRun.status, 0, vendorInitRun.stdout);
    assert.match(vendorInitRun.stdout, /Set up acme-charters as a charter repository, with nothing committed\./);
    const filePaths = await listFilePaths(repositoryFolderPath);
    for (const templatePath of ["README.md", "CHANGELOG.md", ".gitignore", ".cw/settings.json"])
      assert.ok(filePaths.includes(templatePath), templatePath);
    // It makes no charter (VENDOR Story 3 scenario 6).
    assert.deepEqual(
      [
        ...new Set(
          filePaths
            .filter((filePath) => filePath.startsWith(".cw/charter/") && filePath.split("/").length > 3)
            .map((filePath) => filePath.split("/")[2]),
        ),
      ],
      [],
    );
    assert.ok(!filePaths.some((filePath) => filePath.startsWith("charters/")));
    // cw init chose the agent, and the build after the copy ran.
    assert.ok(filePaths.includes(".cw/out/catalogue.json"));

    const readmeText = await readFile(join(repositoryFolderPath, "README.md"), "utf8");
    assert.match(readmeText, /^# acme-charters\n\nRules for TypeScript services\.\n/);
    assert.doesNotMatch(readmeText, /\{\{/);
    assert.equal(await readFile(join(repositoryFolderPath, "CHANGELOG.md"), "utf8"), "# Changelog\n");

    assert.equal(runGit(["symbolic-ref", "HEAD"], repositoryFolderPath, commandEnv), "refs/heads/main");
    assert.equal(runGit(["rev-list", "--all"], repositoryFolderPath, commandEnv), "");
    // What cw build writes is left out of git, here and in each charter.
    const untrackedPaths = runGit(["status", "--porcelain", "--untracked-files=all"], repositoryFolderPath, commandEnv);
    assert.doesNotMatch(untrackedPaths, /\.cw\/out\/|\.claude\/|CLAUDE\.md|\.mcp\.json/);
    assert.match(untrackedPaths, /README\.md/);
  });
});

test("at a terminal with colour, the folder each charter is written under is set apart (CORE Story 67 scenario 1)", {
  skip: !hasPython && "python3 makes the terminal",
}, async () => {
  await inWorkFolder(async (repositoryFolderPath, { NO_COLOR: _noColour, ...colouredEnv }) => {
    const vendorInitRun = runVendorInitAtTerminal(repositoryFolderPath, colouredEnv);

    assert.equal(vendorInitRun.status, 0, vendorInitRun.stdout);
    assert.ok(vendorInitRun.stdout.includes("under \x1b[36m.cw/charter/<charter>/\x1b[0m with"), vendorInitRun.stdout);
  });
});

test("with nobody at the terminal, it stops before asking anything, writing nothing", async () => {
  await inWorkFolder(async (repositoryFolderPath, commandEnv) => {
    const vendorInitRun = runCw(["vendor", "init"], repositoryFolderPath, commandEnv);

    assert.equal(vendorInitRun.status, 1);
    assert.match(vendorInitRun.stderr, /Run "cw vendor init" at a terminal/);
    assert.deepEqual(await readdir(repositoryFolderPath), []);
  });
});

test("it takes no flag: every answer is asked", async () => {
  await inWorkFolder(async (repositoryFolderPath, commandEnv) => {
    const vendorInitRun = runCw(["vendor", "init", "--description", "x"], repositoryFolderPath, commandEnv);

    assert.equal(vendorInitRun.status, 2, vendorInitRun.stderr);
    assert.deepEqual(await readdir(repositoryFolderPath), []);
  });
});

test("a description left empty is refused, writing nothing", {
  skip: !hasPython && "python3 makes the terminal",
}, async () => {
  await inWorkFolder(async (repositoryFolderPath, commandEnv) => {
    const vendorInitRun = runVendorInitAtTerminal(repositoryFolderPath, commandEnv, "");

    assert.equal(vendorInitRun.status, 1);
    assert.match(vendorInitRun.stdout, /description is empty/);
    assert.deepEqual(await readdir(repositoryFolderPath), []);
  });
});

test("a folder holding anything, or a git repository with a commit, is refused, and left as it was", async () => {
  await inWorkFolder(async (repositoryFolderPath, commandEnv) => {
    await writeFile(join(repositoryFolderPath, "notes.txt"), "Mine.\n");
    const heldFileRun = runCw(["vendor", "init"], repositoryFolderPath, commandEnv);
    assert.equal(heldFileRun.status, 1);
    assert.match(heldFileRun.stderr, /This folder holds notes\.txt/);
    assert.deepEqual(await readdir(repositoryFolderPath), ["notes.txt"]);

    runGit(["init", "--quiet"], repositoryFolderPath, commandEnv);
    runGit(["add", "."], repositoryFolderPath, commandEnv);
    runGit(["commit", "--quiet", "-m", "Notes"], repositoryFolderPath, commandEnv);
    runGit(["rm", "--quiet", "notes.txt"], repositoryFolderPath, commandEnv);
    const committedRun = runCw(["vendor", "init"], repositoryFolderPath, commandEnv);
    assert.equal(committedRun.status, 1);
    assert.match(committedRun.stderr, /a git repository with a commit/);
    assert.deepEqual(await readdir(repositoryFolderPath), [".git"]);
  });
});

test("a git repository with no commit yet is set up on the branch it is on", {
  skip: !hasPython && "python3 makes the terminal",
}, async () => {
  await inWorkFolder(async (repositoryFolderPath, commandEnv) => {
    runGit(["init", "--quiet"], repositoryFolderPath, commandEnv);
    runGit(["symbolic-ref", "HEAD", "refs/heads/trunk"], repositoryFolderPath, commandEnv);

    const vendorInitRun = runVendorInitAtTerminal(repositoryFolderPath, commandEnv);

    assert.equal(vendorInitRun.status, 0, vendorInitRun.stdout);
    assert.equal(runGit(["symbolic-ref", "HEAD"], repositoryFolderPath, commandEnv), "refs/heads/trunk");
    assert.ok((await readdir(repositoryFolderPath)).includes("README.md"));
  });
});

test("a repository it set up releases its charters with the script it copied, and another repository installs them", {
  skip: !hasPython && "python3 makes the terminal",
  todo: "VENDOR Story 2 rewrites /vendor-release to release charters",
}, async () => {
  await inWorkFolder(async (repositoryFolderPath, commandEnv, workFolderPath) => {
    assert.equal(runVendorInitAtTerminal(repositoryFolderPath, commandEnv).status, 0);
    const charterFolderPath = join(repositoryFolderPath, "charters", "demo");
    await mkdir(charterFolderPath, { recursive: true });
    assert.equal(runCw(["init", "--agent", "claude"], charterFolderPath, commandEnv).status, 0);
    await mkdir(join(charterFolderPath, ".cw/charter/primitive/skill/greet"), { recursive: true });
    await writeFile(
      join(charterFolderPath, ".cw/charter/primitive/skill/greet/index.md"),
      '---\nkind: skill\nid: greet\ndescription: Say hello.\ntriggers: ["say hello"]\n---\n\nHi.\n',
    );
    runGit(["add", "."], repositoryFolderPath, commandEnv);
    runGit(["commit", "--quiet", "-m", "A charter"], repositoryFolderPath, commandEnv);
    const originFolderPath = join(workFolderPath, "acme", "acme-charters.git");
    runGit(["init", "--quiet", "--bare", "-b", "main", originFolderPath], workFolderPath, commandEnv);
    runGit(["remote", "add", "origin", originFolderPath], repositoryFolderPath, commandEnv);
    runGit(["push", "--quiet", "origin", "main"], repositoryFolderPath, commandEnv);

    const releaseAction = (actionArgs: readonly string[]) =>
      spawnSync(
        process.execPath,
        [".cw/out/script/vendor-release-action/vendor-release-action.mjs", ...actionArgs],
        // The script runs `cw build` in each charter: the cw just built.
        {
          cwd: repositoryFolderPath,
          env: { ...commandEnv, PATH: `${join(workFolderPath, "bin")}:${commandEnv.PATH}` },
          encoding: "utf8",
        },
      );
    await mkdir(join(workFolderPath, "bin"));
    await writeFile(join(workFolderPath, "bin", "cw"), `#!/bin/sh\nexec "${process.execPath}" "${cwFilePath}" "$@"\n`, {
      mode: 0o755,
    });
    const checkRun = releaseAction(["check"]);
    assert.equal(checkRun.status, 0, checkRun.stderr);
    const readmeRun = releaseAction(["readme"]);
    assert.equal(readmeRun.status, 0, readmeRun.stderr);
    const readmeText = await readFile(join(repositoryFolderPath, "README.md"), "utf8");
    assert.match(readmeText, /cw vendor add acme\/acme-charters\n/);
    assert.match(readmeText, /cw vendor add acme\/acme-charters --charter demo/);
    assert.match(readmeText, /\| `\/greet` \| Say hello\. \|/);
    assert.doesNotMatch(readmeText, /\| `\/cw-author` \|/);
    await writeFile(join(workFolderPath, "entry.md"), "- First.\n");
    const publishRun = releaseAction(["publish", "0.1.0", join(workFolderPath, "entry.md"), "--date", "2026-11-15"]);
    assert.equal(publishRun.status, 0, publishRun.stderr);
    assert.equal(runGit(["tag", "--list"], originFolderPath, commandEnv), "v0.1.0");

    const consumerFolderPath = join(workFolderPath, "consumer");
    await mkdir(consumerFolderPath);
    runGit(["init", "--quiet"], consumerFolderPath, commandEnv);
    assert.equal(runCw(["init", "--agent", "claude"], consumerFolderPath, commandEnv).status, 0);
    const vendorAddRun = runCw(["vendor", "add", originFolderPath], consumerFolderPath, commandEnv);
    assert.equal(vendorAddRun.status, 0, vendorAddRun.stderr);
    assert.deepEqual(
      (await listFilePaths(join(consumerFolderPath, ".cw/charter/vendor"))).filter((filePath) =>
        filePath.endsWith("index.md"),
      ),
      ["acme/acme-charters/demo/primitive/skill/greet/index.md"],
    );
  });
});
