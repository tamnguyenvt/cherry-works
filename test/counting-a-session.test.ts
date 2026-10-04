import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { CwSessionTokensCounterScript } from "../src/hexagon/domain/models/charter/builtin/CwSessionTokensCounterScript.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { InMemoryTokenCounter } from "../src/zdriven/InMemoryTokenCounter.js";
import { InMemoryAgentCli } from "../src/zdriven/InMemoryAgentCli.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";

const repo = new URL("file:///repo/");
const inRepo = (path: string) => new URL(path, repo).href;

test("a built charter runs the engine's own counter when the agent stops (EVAL-FR-008)", async () => {
  const fileReaders = new InMemoryFileReaders({ [inRepo(".cw/settings.json")]: JSON.stringify({ agents: ["claude"] }) });
  const fileOutput = new InMemoryFileOutput(fileReaders);
  const charterAuthoringApp = new CharterAuthoring(repo, fileReaders, new YamlParser(), fileOutput, new InMemoryVCS(), new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() });

  await charterAuthoringApp.build();

  const claudeSettings = JSON.parse((await fileReaders.readIfThere(new URL(".claude/settings.json", repo))) ?? "{}");
  const stopCommands = (claudeSettings.hooks?.Stop ?? []).flatMap((entry: { hooks: { command: string }[] }) => entry.hooks.map((hook) => hook.command));
  assert.deepEqual(stopCommands, ['node ".cw/out/script/cw-session-tokens-counter/sessionTokensCounter.mjs"']);
  assert.ok(fileOutput.executables.has(inRepo(".cw/out/script/cw-session-tokens-counter/sessionTokensCounter.mjs")));
});

/** One line of a Claude Code transcript: an assistant message and its usage. */
const assistantLine = (messageId: string, usage: { input: number; output: number; cacheWrite?: number; cacheRead?: number }, model = "claude-opus-5-5") =>
  JSON.stringify({
    type: "assistant",
    message: {
      id: messageId,
      model,
      usage: { input_tokens: usage.input, output_tokens: usage.output, cache_creation_input_tokens: usage.cacheWrite ?? 0, cache_read_input_tokens: usage.cacheRead ?? 0 },
    },
  });

/** A machine of its own: a home the log is kept under, a repository the agent
 *  works in, and the folder Claude Code keeps its transcripts in. */
async function aMachine(settings: object = { agents: ["claude"] }) {
  const machineFolder = await mkdtemp(join(tmpdir(), "cw-session-"));
  const homeFolder = join(machineFolder, "home");
  const repoFolder = join(machineFolder, "repo");
  const transcriptsFolder = join(machineFolder, "transcripts");
  await mkdir(join(repoFolder, ".cw"), { recursive: true });
  await mkdir(homeFolder, { recursive: true });
  await writeFile(join(repoFolder, ".cw/settings.json"), JSON.stringify(settings));
  const counterAsset = new CwSessionTokensCounterScript().assets.find((assetFile) => assetFile.file === "sessionTokensCounter.mjs");
  assert.ok(counterAsset);
  const counterFile = join(machineFolder, "sessionTokensCounter.mjs");
  await writeFile(counterFile, counterAsset.contents);

  /** Write a session's transcript, its subagents' beside it. */
  const writeSession = async (sessionId: string, lines: readonly string[], subagentLinesById: Readonly<Record<string, readonly string[]>> = {}) => {
    await mkdir(join(transcriptsFolder, sessionId, "subagents"), { recursive: true });
    await writeFile(join(transcriptsFolder, `${sessionId}.jsonl`), lines.join("\n") + "\n");
    for (const [agentId, subagentLines] of Object.entries(subagentLinesById))
      await writeFile(join(transcriptsFolder, sessionId, "subagents", `agent-${agentId}.jsonl`), subagentLines.join("\n") + "\n");
  };

  /** Stop the agent once, as Claude Code runs a Stop hook: the event on
   *  standard input, from the repository. */
  const stopOutputOf = (sessionId: string) =>
    new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
      const counterProcess = spawn(process.execPath, [counterFile], { cwd: repoFolder, env: { ...process.env, HOME: homeFolder }, stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      counterProcess.stdout.on("data", (chunk) => (stdout += chunk));
      counterProcess.stderr.on("data", (chunk) => (stderr += chunk));
      counterProcess.on("close", (code) => resolve({ code, stdout, stderr }));
      counterProcess.stdin.end(
        JSON.stringify({ session_id: sessionId, transcript_path: join(transcriptsFolder, `${sessionId}.jsonl`), cwd: repoFolder, hook_event_name: "Stop", stop_hook_active: false }),
      );
    });

  /** Where the sessions are kept unless the repository says otherwise. */
  const defaultSessionsFolder = join(homeFolder, ".cherry-works", repoFolder.replace(/[^A-Za-z0-9]/g, "-"));
  /** Every line kept, of every session's own folder. */
  const sessionLines = async (sessionsFolder = defaultSessionsFolder) => {
    const sessionIds = await readdir(sessionsFolder).catch(() => []);
    const logTexts = await Promise.all(sessionIds.map((sessionId) => readFile(join(sessionsFolder, sessionId, "session-analysis.jsonl"), "utf8")));
    return logTexts.flatMap((logText) => logText.split("\n").filter((line) => line !== "").map((line) => JSON.parse(line)));
  };

  return { machineFolder, homeFolder, repoFolder, writeSession, stopOutputOf, sessionLines, removeMachineFolder: () => rm(machineFolder, { recursive: true, force: true }) };
}

test("each stop is kept as one line outside the repository, by kind, subagents counted in, a message counted once (EVAL-FR-008, EVAL-FR-009)", async () => {
  const machine = await aMachine();
  try {
    await machine.writeSession(
      "session-a",
      [
        JSON.stringify({ type: "user", message: { role: "user", content: "hello" } }),
        // One message written as two lines, one per block: counted once.
        assistantLine("msg-1", { input: 10, output: 5, cacheWrite: 100, cacheRead: 1000 }),
        assistantLine("msg-1", { input: 10, output: 5, cacheWrite: 100, cacheRead: 1000 }),
        assistantLine("msg-2", { input: 1, output: 20, cacheRead: 1100 }),
      ],
      { one: [assistantLine("msg-sub", { input: 3, output: 7, cacheWrite: 50, cacheRead: 200 }, "claude-haiku-4-5-20251001")] },
    );

    const stopOutput = await machine.stopOutputOf("session-a");

    assert.equal(stopOutput.code, 0);
    const [sessionLine, ...otherLines] = await machine.sessionLines();
    assert.deepEqual(otherLines, []);
    assert.equal(sessionLine.sessionId, "session-a");
    assert.equal(sessionLine.repository, machine.repoFolder);
    assert.equal(sessionLine.model, "claude-opus-5-5");
    assert.ok(!Number.isNaN(Date.parse(sessionLine.time)));
    assert.deepEqual(sessionLine.tokens, { input: 14, output: 32, cacheWrite: 150, cacheRead: 2300 });
    assert.equal(sessionLine.total, 2496);
    assert.deepEqual(await readdir(machine.repoFolder), [".cw"]);
    assert.deepEqual(await readdir(join(machine.repoFolder, ".cw")), ["settings.json"]);
  } finally {
    await machine.removeMachineFolder();
  }
});

test("each session is kept in a folder of its own, named by its id, and an id that names no folder keeps nothing (EVAL-FR-009, EVAL-FR-011)", async () => {
  const machine = await aMachine();
  try {
    await machine.writeSession("session-h", [assistantLine("msg-1", { input: 1, output: 1 })]);
    await machine.writeSession("session-i", [assistantLine("msg-1", { input: 2, output: 2 })]);
    await machine.writeSession("..", [assistantLine("msg-1", { input: 2, output: 2 })]);

    await machine.stopOutputOf("session-h");
    await machine.stopOutputOf("session-i");
    await machine.stopOutputOf("session-h");
    await machine.stopOutputOf("..");

    const sessionsFolder = join(machine.homeFolder, ".cherry-works", machine.repoFolder.replace(/[^A-Za-z0-9]/g, "-"));
    assert.deepEqual((await readdir(sessionsFolder)).sort(), ["session-h", "session-i"]);
    const sessionHText = await readFile(join(sessionsFolder, "session-h", "session-analysis.jsonl"), "utf8");
    assert.equal(sessionHText.split("\n").filter((line) => line !== "").length, 2);
    assert.deepEqual(await readdir(join(machine.homeFolder, ".cherry-works")), [machine.repoFolder.replace(/[^A-Za-z0-9]/g, "-")]);
  } finally {
    await machine.removeMachineFolder();
  }
});

test("the log is kept, by default, in a folder of the repository's own under ~/.cherry-works, or where the repository says (EVAL-FR-009)", async () => {
  const machine = await aMachine({ agents: ["claude"], sessionAnalysisFolder: "~/elsewhere/sessions" });
  try {
    await machine.writeSession("session-g", [assistantLine("msg-1", { input: 1, output: 1 })]);

    await machine.stopOutputOf("session-g");

    assert.deepEqual(await machine.sessionLines(), []);
    assert.equal((await machine.sessionLines(join(machine.homeFolder, "elsewhere/sessions")))[0].sessionId, "session-g");
  } finally {
    await machine.removeMachineFolder();
  }
});

test("below its next mark, a stop shows nothing (EVAL-FR-010)", async () => {
  const machine = await aMachine();
  try {
    await machine.writeSession("session-b", [assistantLine("msg-1", { input: 10, output: 10, cacheRead: 99_000 })]);

    const stopOutput = await machine.stopOutputOf("session-b");

    assert.equal(stopOutput.code, 0);
    assert.equal(stopOutput.stdout, "");
    assert.equal((await machine.sessionLines()).length, 1);
  } finally {
    await machine.removeMachineFolder();
  }
});

test("crossing a mark shows the developer one line, which the model is not sent, and the next stop below the next mark shows nothing (EVAL-FR-010)", async () => {
  const machine = await aMachine();
  try {
    await machine.writeSession("session-c", [assistantLine("msg-1", { input: 10, output: 10, cacheRead: 90_000 })]);
    assert.equal((await machine.stopOutputOf("session-c")).stdout, "");

    await machine.writeSession("session-c", [assistantLine("msg-1", { input: 10, output: 10, cacheRead: 90_000 }), assistantLine("msg-2", { input: 10, output: 10, cacheRead: 95_000 })]);
    const crossingOutput = await machine.stopOutputOf("session-c");

    // Claude Code shows `systemMessage` to the developer and sends the model
    // nothing of it; exit 0 lets the agent stop.
    assert.equal(crossingOutput.code, 0);
    const hookOutput = JSON.parse(crossingOutput.stdout);
    assert.deepEqual(Object.keys(hookOutput), ["systemMessage"]);
    assert.match(hookOutput.systemMessage, /185,040 tokens/);
    assert.equal(hookOutput.systemMessage.split("\n").length, 1);

    await machine.writeSession("session-c", [
      assistantLine("msg-1", { input: 10, output: 10, cacheRead: 90_000 }),
      assistantLine("msg-2", { input: 10, output: 10, cacheRead: 95_000 }),
      assistantLine("msg-3", { input: 10, output: 10 }),
    ]);
    assert.equal((await machine.stopOutputOf("session-c")).stdout, "");
    assert.equal((await machine.sessionLines()).length, 3);
  } finally {
    await machine.removeMachineFolder();
  }
});

test("the repository sets its own mark (EVAL-FR-010)", async () => {
  const machine = await aMachine({ agents: ["claude"], sessionContextMark: 1_000 });
  try {
    await machine.writeSession("session-d", [assistantLine("msg-1", { input: 600, output: 600 })]);

    const stopOutput = await machine.stopOutputOf("session-d");

    assert.match(JSON.parse(stopOutput.stdout).systemMessage, /1,200 tokens/);
  } finally {
    await machine.removeMachineFolder();
  }
});

test("a record that cannot be read lets the agent stop, with nothing shown and nothing kept (EVAL-FR-011)", async () => {
  const machine = await aMachine({ agents: ["claude"], sessionContextMark: 1 });
  try {
    await machine.writeSession("session-e", ["not json at all", assistantLine("msg-1", { input: 600, output: 600 })]);
    const unreadOutput = await machine.stopOutputOf("session-e");
    await machine.writeSession("session-f", [JSON.stringify({ type: "assistant", message: { id: "msg-1", usage: { tokens: 12 } } })]);
    const reshapedOutput = await machine.stopOutputOf("session-f");
    const missingOutput = await machine.stopOutputOf("session-never-written");

    for (const stopOutput of [unreadOutput, reshapedOutput, missingOutput]) {
      assert.equal(stopOutput.code, 0);
      assert.equal(stopOutput.stdout, "");
      assert.equal(stopOutput.stderr, "");
    }
    assert.deepEqual(await machine.sessionLines(), []);
  } finally {
    await machine.removeMachineFolder();
  }
});

test("two sessions stopping at once are each kept, neither lost (EVAL-FR-009)", async () => {
  const machine = await aMachine();
  try {
    const sessionIds = Array.from({ length: 8 }, (_, index) => `session-${index}`);
    for (const sessionId of sessionIds) await machine.writeSession(sessionId, [assistantLine("msg-1", { input: 1, output: 1 })]);

    await Promise.all(sessionIds.map((sessionId) => machine.stopOutputOf(sessionId)));

    assert.deepEqual((await machine.sessionLines()).map((sessionLine) => sessionLine.sessionId).sort(), [...sessionIds].sort());
  } finally {
    await machine.removeMachineFolder();
  }
});
