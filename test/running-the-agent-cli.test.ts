import { test } from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ClaudeCli } from "../src/zdriven/ClaudeCli.js";
import { DrivenFault } from "../src/hexagon/port/zdriven/ForRunningAgentCli.js";

/**
 * A `claude` of the test's own, put first on the PATH: it answers `--version`,
 * and given a prompt on its input prints the JSON `claude -p` prints. Its
 * first message is sent 100 tokens and one per character of the prompt; a
 * second message, as a model answering at length runs on into, 999 more. The
 * prompt `fail` stops it with status 2, and `error` is answered as a run that
 * is not signed in; any other is answered "Answered: " and the prompt. Every run writes the folder it ran in and how many runs
 * were under way at once into the folder it was put in.
 */
const FAKE_CLAUDE = `#!/usr/bin/env node
const { appendFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
if (process.argv.includes("--version")) { console.log("9.9.9 (Claude Code)"); process.exit(0); }
const fakeFolder = process.env.CW_FAKE_CLAUDE_FOLDER;
const runningFolder = join(fakeFolder, "running");
mkdirSync(runningFolder, { recursive: true });
const runFile = join(runningFolder, String(process.pid));
writeFileSync(runFile, "");
appendFileSync(join(fakeFolder, "runs.log"), process.cwd() + "\\t" + readdirSync(runningFolder).length + "\\n");
let prompt = "";
process.stdin.on("data", (chunk) => (prompt += chunk));
process.stdin.on("end", () => setTimeout(() => {
  rmSync(runFile);
  if (prompt === "fail") { process.stderr.write("boom"); process.exit(2); }
  const first = { input_tokens: 1, cache_creation_input_tokens: 100 + prompt.length, cache_read_input_tokens: 0 };
  const second = { input_tokens: 999, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
  const usage = { input_tokens: 1000, cache_creation_input_tokens: first.cache_creation_input_tokens, cache_read_input_tokens: 0, iterations: [first, second] };
  console.log(JSON.stringify(prompt === "error" ? { is_error: true, result: "Not logged in", usage } : { is_error: false, result: "Answered: " + prompt, usage }));
}, 50));
`;

/** Run what follows with the test's own `claude` first on the PATH, and the
 *  PATH as it was again afterwards. */
const withFakeClaude = async (work: (fakeFolder: string) => Promise<void>) => {
  const fakeFolder = await mkdtemp(join(tmpdir(), "cw-fake-claude-"));
  const fakeClaude = join(fakeFolder, "claude");
  await writeFile(fakeClaude, FAKE_CLAUDE);
  await chmod(fakeClaude, 0o755);
  const kept = { path: process.env.PATH, fakeFolder: process.env.CW_FAKE_CLAUDE_FOLDER };
  process.env.PATH = `${fakeFolder}:${dirname(process.execPath)}`;
  process.env.CW_FAKE_CLAUDE_FOLDER = fakeFolder;
  try {
    await work(fakeFolder);
  } finally {
    process.env.PATH = kept.path;
    if (kept.fakeFolder === undefined) delete process.env.CW_FAKE_CLAUDE_FOLDER;
    else process.env.CW_FAKE_CLAUDE_FOLDER = kept.fakeFolder;
    await rm(fakeFolder, { recursive: true, force: true });
  }
};

/** Every run the test's own `claude` logged: the folder it ran in, and how
 *  many were under way at once. */
const runsOf = async (fakeFolder: string) =>
  (await readFile(join(fakeFolder, "runs.log"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => {
      const [runFolder = "", runsAtOnce = "0"] = line.split("\t");
      return { runFolder, runsAtOnce: Number(runsAtOnce) };
    });

test("the command line is installed where `claude` answers, and not where it is nowhere on the PATH (EVAL-FR-004)", async () => {
  await withFakeClaude(async () => assert.equal(await new ClaudeCli().isInstalled(), true));

  const keptPath = process.env.PATH;
  process.env.PATH = dirname(process.execPath);
  try {
    assert.equal(await new ClaudeCli().isInstalled(), false);
  } finally {
    process.env.PATH = keptPath;
  }
});

test("an answer holds what the model said, and its usage read off the first message sent, not the total a long answer adds a second one to (EVAL-FR-004)", async () => {
  await withFakeClaude(async () => {
    assert.deepEqual(await new ClaudeCli().ask("hello"), {
      resultText: "Answered: hello",
      usage: { inputTokens: 1, cacheCreationInputTokens: 105, cacheReadInputTokens: 0 },
    });
  });
});

test("each prompt runs in an empty folder of its own, taken away afterwards", async () => {
  await withFakeClaude(async (fakeFolder) => {
    const claudeCli = new ClaudeCli();
    await claudeCli.ask("one");
    await claudeCli.ask("two");

    const [firstRun, secondRun] = await runsOf(fakeFolder);
    assert.ok(firstRun !== undefined && secondRun !== undefined);
    assert.notEqual(firstRun.runFolder, secondRun.runFolder);
    assert.equal(existsSync(firstRun.runFolder), false);
    assert.notEqual(firstRun.runFolder, process.cwd());
  });
});

test("no more than four prompts run at once, however many are asked for together", async () => {
  await withFakeClaude(async (fakeFolder) => {
    const claudeCli = new ClaudeCli();
    await Promise.all(Array.from({ length: 10 }, (_, index) => claudeCli.ask(`prompt ${index}`)));

    const runs = await runsOf(fakeFolder);
    assert.equal(runs.length, 10);
    assert.ok(Math.max(...runs.map(({ runsAtOnce }) => runsAtOnce)) <= 4);
  });
});

test("a run that stops with an error, or is answered as one, is raised and frees its place for the next", async () => {
  await withFakeClaude(async () => {
    const claudeCli = new ClaudeCli();

    await assert.rejects(claudeCli.ask("fail"), (raised) => raised instanceof DrivenFault && /status 2: boom/.test(raised.message));
    await assert.rejects(claudeCli.ask("error"), (raised) => raised instanceof DrivenFault && /Not logged in/.test(raised.message));
    // Every place freed: five more run, and none waits forever.
    await Promise.all(Array.from({ length: 5 }, () => claudeCli.ask("after")));
  });
});
