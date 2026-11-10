// The rules of `clean`, run against a repository made for each case: a target
// branch, and a change on a branch of its own.
//
//   node --test .cw/out/script/sdd-clean/clean.test.mjs
//
// What the rules look for is spelt in pieces here, so that this file's own
// change does not hold it.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";

const cleanScript = join(dirname(fileURLToPath(import.meta.url)), "clean.mjs");
const MARKER = "TO" + "DO";
const DEBUG_PRINT = "console" + ".log('here');";
let repositoryFolder;

const git = (...args) => execFileSync("git", args, { cwd: repositoryFolder, encoding: "utf8" });
function write(path, text) {
  mkdirSync(dirname(join(repositoryFolder, path)), { recursive: true });
  writeFileSync(join(repositoryFolder, path), text);
}

// A repository whose `main` holds the files given, standing on `task/change`.
function repositoryOf(files = { "app.mjs": "export const one = 1;\n" }) {
  repositoryFolder = mkdtempSync(join(tmpdir(), "sdd-clean-"));
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  for (const [path, text] of Object.entries(files)) write(path, text);
  git("add", "-A");
  git("commit", "-q", "-m", "Base");
  git("checkout", "-q", "-b", "task/change");
}

function clean(...args) {
  const run = spawnSync("node", [cleanScript, "main", ...args], { cwd: repositoryFolder, encoding: "utf8" });
  return { status: run.status, output: run.stdout + run.stderr };
}

afterEach(() => rmSync(repositoryFolder, { recursive: true, force: true }));

test("a clean change passes", () => {
  repositoryOf();
  write("app.mjs", "export const one = 1;\nexport const two = 2;\n");
  const { status, output } = clean();
  assert.equal(status, 0);
  assert.match(output, /clean/);
});

test("a temporary file and a debug print fail, each named by where it is", () => {
  repositoryOf();
  write("notes.tmp", "scratch\n");
  write("app.mjs", `export const one = 1;\n${DEBUG_PRINT}\n`);
  const { status, output } = clean();
  assert.equal(status, 1);
  assert.match(output, /^notes\.tmp: stray: a temporary file$/m);
  assert.match(output, /^app\.mjs:2: debug: console\.log\('here'\);$/m);
});

test("stray files are found whether committed on the branch, staged or untracked", () => {
  repositoryOf();
  write("committed.bak", "x\n");
  git("add", "committed.bak");
  git("commit", "-q", "-m", "Change");
  write("staged.orig", "x\n");
  git("add", "staged.orig");
  write(".DS_Store", "x");
  write("tmp/run.txt", "x\n");
  write(".env", "A=1\n");
  write(".env.example", "A=\n");
  const { status, output } = clean();
  assert.equal(status, 1);
  for (const path of ["committed.bak", "staged.orig", ".DS_Store", "tmp/run.txt", ".env"]) assert.match(output, new RegExp(`^${path.replace(/\./g, "\\.")}: stray`, "m"));
  assert.doesNotMatch(output, /\.env\.example/);
});

test("a leftover marker fails in any file; a debug print only in code", () => {
  repositoryOf();
  write("README.md", `# Read me\n\n${MARKER}: write this.\n\nRun \`${DEBUG_PRINT}\`.\n`);
  write("app.py", `def main():\n    ${"pri" + "nt('here')"}\n`);
  const { status, output } = clean();
  assert.equal(status, 1);
  assert.match(output, new RegExp(`^README\\.md:3: marker: ${MARKER}: write this\\.$`, "m"));
  assert.doesNotMatch(output, /README\.md:5/);
  assert.match(output, /^app\.py:2: debug: print\('here'\)$/m);
});

test("a conflict marker and a debugger statement fail", () => {
  repositoryOf();
  write("app.mjs", `${"<".repeat(7)} HEAD\nexport const one = 1;\n${">".repeat(7)} other\n  ${"debug" + "ger"};\n`);
  const { output } = clean();
  assert.match(output, /^app\.mjs:1: marker:/m);
  assert.match(output, /^app\.mjs:3: marker:/m);
  assert.match(output, /^app\.mjs:4: debug:/m);
});

test("a secret fails, named by its kind and never printed", () => {
  repositoryOf();
  const awsKey = "AKIA" + "ABCDEFGHIJKLMNOP";
  const password = "hunter2" + "hunter2";
  write("config.mjs", `export const key = "${awsKey}";\nexport const pass${"word"} = "${password}";\n`);
  write("id_rsa", `-----BEGIN ${"RSA PRIVATE"} KEY-----\nabc\n`);
  const { status, output } = clean();
  assert.equal(status, 1);
  assert.match(output, /^config\.mjs:1: secret: an AWS access key$/m);
  assert.match(output, /^config\.mjs:2: secret: a password or token assigned in the clear$/m);
  assert.match(output, /^id_rsa:1: secret: a private key$/m);
  assert.doesNotMatch(output, new RegExp(awsKey));
  assert.doesNotMatch(output, new RegExp(password));
});

test("a secret on a debug or marker line is not printed by either", () => {
  repositoryOf();
  const token = "sk-ant-" + "abcdefghijklmnopqrstuvwxyz";
  write("app.mjs", `console${".log"}("${token}");\n// ${MARKER} drop ${token}\n`);
  const { output } = clean();
  assert.match(output, /^app\.mjs:1: debug: an Anthropic API key$/m);
  assert.match(output, /^app\.mjs:2: marker: an Anthropic API key$/m);
  assert.doesNotMatch(output, new RegExp(token));
});

test("a last line that had no newline, replaced, is looked at", () => {
  repositoryOf({ "app.mjs": "export const one = 1;" });
  write("app.mjs", DEBUG_PRINT);
  const { output } = clean();
  assert.match(output, /^app\.mjs:1: debug:/m);
});

test("paths are named whole, whatever the diff prefixes, a space in them included", () => {
  repositoryOf({ "my app.mjs": "export const one = 1;\n" });
  git("config", "diff.noprefix", "true");
  write("my app.mjs", `export const one = 1;\n${DEBUG_PRINT}\n`);
  const { output } = clean();
  assert.match(output, /^my app\.mjs:2: debug:/m);
});

test("an untracked folder or nested repository is passed over, not crashed on", () => {
  repositoryOf();
  mkdirSync(join(repositoryFolder, "nested"));
  execFileSync("git", ["init", "-q"], { cwd: join(repositoryFolder, "nested") });
  write("nested/file.txt", "x\n");
  const { status, output } = clean();
  assert.equal(status, 0, output);
});

test("only lines the change adds are looked at", () => {
  repositoryOf({ "app.mjs": `// ${MARKER}: old\n${DEBUG_PRINT}\n`, "old.bak": "x\n" });
  write("app.mjs", `// ${MARKER}: old\n${DEBUG_PRINT}\nexport const two = 2;\n`);
  const { status } = clean();
  assert.equal(status, 0);
});

test("a finding accepted for this change no longer fails it", () => {
  repositoryOf();
  write("notes.tmp", "scratch\n");
  write("app.mjs", `export const one = 1;\n${DEBUG_PRINT}\n`);
  const { status, output } = clean("--accept", "app.mjs:2", "--accept", "notes.tmp");
  assert.equal(status, 0);
  assert.doesNotMatch(output, /app\.mjs:2|notes\.tmp/);
});

test("run twice on the same state, it gives the same result and changes nothing", () => {
  repositoryOf();
  write("notes.tmp", "scratch\n");
  write("app.mjs", `export const one = 1;\n${DEBUG_PRINT}\n`);
  const statusBefore = git("status", "--porcelain");
  const first = clean();
  const second = clean();
  assert.deepEqual(second, first);
  assert.equal(git("status", "--porcelain"), statusBefore);
  assert.equal(readFileSync(join(repositoryFolder, "app.mjs"), "utf8"), `export const one = 1;\n${DEBUG_PRINT}\n`);
});

test("run twice on a clean state, it passes both times with the same result", () => {
  repositoryOf();
  write("app.mjs", "export const one = 1;\nexport const two = 2;\n");
  const first = clean();
  const second = clean();
  assert.equal(first.status, 0);
  assert.deepEqual(second, first);
});

test("a list of findings longer than a pipe holds is written whole (an asynchronous pipe, as on macOS)", () => {
  repositoryOf();
  const count = 6000;
  write("app.mjs", `export const one = 1;\n${`${DEBUG_PRINT}\n`.repeat(count)}`);
  const { status, output } = clean();
  assert.equal(status, 1);
  assert.ok(output.length > 128 * 1024);
  assert.equal(output.match(/^app\.mjs:\d+: debug: /gm)?.length, count);
  assert.match(output, new RegExp(`^app\\.mjs:${count + 1}: debug: `, "m"));
});

test("gitignored files are not looked at", () => {
  repositoryOf({ ".gitignore": "*.log\n" });
  write("debug.log", "x\n");
  const { status } = clean();
  assert.equal(status, 0);
});

test("a target that does not exist is refused", () => {
  repositoryOf();
  const run = spawnSync("node", [cleanScript, "nowhere"], { cwd: repositoryFolder, encoding: "utf8" });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /nowhere/);
});
