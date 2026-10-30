import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { SensorRunning } from "../src/hexagon/application/SensorRunning.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { InMemoryTokenCounter } from "../src/zdriven/InMemoryTokenCounter.js";
import { InMemoryAgentCli } from "../src/zdriven/InMemoryAgentCli.js";
import { InMemoryShellCommands } from "../src/zdriven/InMemoryShellCommands.js";
import type { ShellCommandResult } from "../src/hexagon/port/zdriven/ForRunningShellCommands.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";

const MAIN = fileURLToPath(new URL("../main.ts", import.meta.url));
const TSX = import.meta.resolve("tsx");
const MODULE_LOADER = import.meta.resolve("../scripts/moduleLoader.mjs");

const repo = new URL("file:///repo/");
const root = new URL(".cw/charter/", repo);
const at = (path: string) => new URL(path, root).href;
const inRepo = (path: string) => new URL(path, repo).href;

const sensor = (id: string, signal: string, run: string) =>
  ["---", "kind: sensor", `id: ${id}`, `description: What ${id} is for, in one line.`, `signal: ${signal}`, `run: ${JSON.stringify(run)}`, "---", "", `The body of ${id}.`, ""].join("\n");

/** The engine's own sensor, which every build carries on `Stop`. */
const SESSION_COUNTER_COMMAND = 'node ".cw/out/script/cw-session-tokens-counter/sessionTokensCounter.mjs"';

/** One hook entry, as Claude's settings hold it. */
const hookEntry = (command: string) => ({ hooks: [{ type: "command", command }] });

/** A charter built and run on the same files, each command answered as the
 *  test says, and the engine's own sensor answering nothing. */
const aRepository = (files: Readonly<Record<string, string>>, resultByCommand: Readonly<Record<string, ShellCommandResult>> = {}) => {
  const held = new InMemoryFileReaders({ [inRepo(".cw/settings.json")]: JSON.stringify({ agents: ["claude"] }), ...files });
  const charterAuthoringApp = new CharterAuthoring(repo, held, new YamlParser(), new InMemoryFileOutput(held), new InMemoryVCS(), new InMemoryTokenCounter(), {
    claude: new InMemoryAgentCli(),
  });
  const shell = new InMemoryShellCommands({ [SESSION_COUNTER_COMMAND]: { exitCode: 0, stdout: "", stderr: "" }, ...resultByCommand });
  const sensorRunningApp = new SensorRunning(repo, held, shell);
  const claudeSettings = async () => JSON.parse((await held.readIfThere(new URL(".claude/settings.json", repo))) ?? "{}");
  return { held, shell, build: () => charterAuthoringApp.build(), runSensors: sensorRunningApp.runSensors.bind(sensorRunningApp), claudeSettings };
};

test("a host is given one command per signal its sensors name, and none of the sensors' own (CORE-FR-175, CORE-SC-047)", async () => {
  const { held, build, claudeSettings } = aRepository({
    [at("sensor/say-a/index.md")]: sensor("say-a", "Stop", "echo a"),
    [at("sensor/say-b/index.md")]: sensor("say-b", "Stop", "echo b"),
    [at("sensor/guard/index.md")]: sensor("guard", "PreToolUse", "./bin/guard"),
  });

  await build();

  assert.deepEqual((await claudeSettings()).hooks, {
    PreToolUse: [hookEntry("cw sensor run PreToolUse --agent claude")],
    Stop: [hookEntry("cw sensor run Stop --agent claude")],
  });
  const settingsText = (await held.readIfThere(new URL(".claude/settings.json", repo))) ?? "";
  for (const sensorCommand of ["echo a", "echo b", "./bin/guard", SESSION_COUNTER_COMMAND]) assert.ok(!settingsText.includes(sensorCommand.replaceAll('"', '\\"')));
});

test("each sensor's command is built into the output, in order of id, its scripts written as their built files (CORE-FR-169, CORE-FR-179)", async () => {
  const { held, build } = aRepository({
    [at("sensor/check-on-stop/index.md")]: sensor("check-on-stop", "Stop", "[[release/check]] --strict"),
    [at("script/release/check/index.md")]: ["---", "kind: script", "id: release/check", "description: Checks a release.", "executionPath: ./bin/run.sh", "---", ""].join("\n"),
    [at("script/release/check/bin/run.sh")]: "#!/usr/bin/env bash\n",
  });

  await build();

  assert.deepEqual(JSON.parse((await held.readIfThere(new URL(".cw/out/sensors.json", repo))) ?? "{}"), {
    sensors: [
      { id: "check-on-stop", signal: "Stop", command: ".cw/out/script/release/check/bin/run.sh --strict" },
      { id: "cw-session-tokens-counter-on-stop", signal: "Stop", command: SESSION_COUNTER_COMMAND, "agent-provider": ["claude"] },
    ],
  });
});

test("the hooks under a signal the charter's sensors name are the charter's whole, written over what is there (CORE-FR-039)", async () => {
  const { build, claudeSettings } = aRepository({
    [at("sensor/say-a/index.md")]: sensor("say-a", "Stop", "echo a"),
    // One the repository set for itself, and the ones an earlier build wrote
    // one per sensor.
    [inRepo(".claude/settings.json")]: `${JSON.stringify({
      hooks: { Stop: [hookEntry(SESSION_COUNTER_COMMAND), hookEntry("afplay Glass.aiff"), hookEntry("echo a")] },
    })}\n`,
  });

  await build();

  assert.deepEqual((await claudeSettings()).hooks, { Stop: [hookEntry("cw sensor run Stop --agent claude")] });
});

test("a signal whose last sensor is removed keeps the command the last build wrote, which runs nothing (CORE-FR-175, CORE-FR-176)", async () => {
  const { held, shell, build, runSensors, claudeSettings } = aRepository({ [at("sensor/guard/index.md")]: sensor("guard", "PreToolUse", "./bin/guard") });
  await build();
  held.remove(new URL("sensor/guard/index.md", root));

  await build();
  const sensorRunOutcome = await runSensors("PreToolUse", "{}");

  assert.deepEqual((await claudeSettings()).hooks, { PreToolUse: [hookEntry("cw sensor run PreToolUse --agent claude")], Stop: [hookEntry("cw sensor run Stop --agent claude")] });
  assert.deepEqual(sensorRunOutcome.data, { exitCode: 0, answer: "", problem: "" });
  assert.deepEqual(shell.runs, []);
});

test("the sensors of one signal run all at once, each given the same event (CORE-FR-176)", async () => {
  const { shell, build, runSensors } = aRepository({
    [at("sensor/say-a/index.md")]: sensor("say-a", "Stop", "echo a"),
    [at("sensor/say-b/index.md")]: sensor("say-b", "Stop", "echo b"),
  });
  await build();

  await runSensors("Stop", '{"hook_event_name":"Stop"}');

  assert.deepEqual(shell.runs.map(({ command }) => command).sort(), [SESSION_COUNTER_COMMAND, "echo a", "echo b"].sort());
  assert.ok(shell.runs.every(({ stdin }) => stdin === '{"hook_event_name":"Stop"}'));
  // Every one was started before any had answered.
  assert.equal(shell.mostRunningAtOnce, 3);
  assert.ok(shell.runs.every(({ workingFolder }) => workingFolder.href === repo.href));
});

test("one sensor exiting 2 makes the command exit 2 with its error, and the other still runs to its end (CORE-FR-177)", async () => {
  const { shell, build, runSensors } = aRepository(
    {
      [at("sensor/gate/index.md")]: sensor("gate", "Stop", "./gate"),
      [at("sensor/say-a/index.md")]: sensor("say-a", "Stop", "echo a"),
    },
    { "./gate": { exitCode: 2, stdout: "", stderr: "a release is open\n" }, "echo a": { exitCode: 0, stdout: "a\n", stderr: "" } },
  );
  await build();

  const sensorRunOutcome = await runSensors("Stop", "{}");

  assert.equal(sensorRunOutcome.data.exitCode, 2);
  assert.equal(sensorRunOutcome.data.problem, "a release is open\n");
  assert.ok(shell.finished.includes("echo a"));
});

test("two sensors both exiting 2 give the error of each, in order of id (CORE-FR-177)", async () => {
  const { build, runSensors } = aRepository(
    {
      [at("sensor/gate-b/index.md")]: sensor("gate-b", "Stop", "./gate-b"),
      [at("sensor/gate-a/index.md")]: sensor("gate-a", "Stop", "./gate-a"),
    },
    { "./gate-a": { exitCode: 2, stdout: "", stderr: "a\n" }, "./gate-b": { exitCode: 2, stdout: "", stderr: "b\n" } },
  );
  await build();

  const sensorRunOutcome = await runSensors("Stop", "{}");

  assert.equal(sensorRunOutcome.data.exitCode, 2);
  assert.equal(sensorRunOutcome.data.problem, "a\nb\n");
});

test("one sensor exiting 1 makes the command exit 1, and the other still runs to its end (CORE-FR-177)", async () => {
  const { shell, build, runSensors } = aRepository(
    {
      [at("sensor/broken/index.md")]: sensor("broken", "Stop", "./broken"),
      [at("sensor/say-a/index.md")]: sensor("say-a", "Stop", "echo a"),
    },
    { "./broken": { exitCode: 1, stdout: "", stderr: "no such file\n" }, "echo a": { exitCode: 0, stdout: "a\n", stderr: "" } },
  );
  await build();

  const sensorRunOutcome = await runSensors("Stop", "{}");

  assert.equal(sensorRunOutcome.data.exitCode, 1);
  assert.equal(sensorRunOutcome.data.problem, "no such file\n");
  assert.ok(shell.finished.includes("echo a"));
});

test("sensors answering in plain text reach the host as one answer, in order of id (CORE-FR-178, CORE-SC-048)", async () => {
  const { build, runSensors } = aRepository(
    {
      [at("sensor/say-b/index.md")]: sensor("say-b", "Stop", "echo b"),
      [at("sensor/say-a/index.md")]: sensor("say-a", "Stop", "echo a"),
    },
    { "echo a": { exitCode: 0, stdout: "a\n", stderr: "" }, "echo b": { exitCode: 0, stdout: "b\n", stderr: "" } },
  );
  await build();

  const sensorRunOutcome = await runSensors("Stop", "{}");

  assert.deepEqual(sensorRunOutcome.data, { exitCode: 0, answer: "a\nb\n", problem: "" });
});

test("sensors answering in the host's structured form are combined as the host combines hooks (CORE-FR-178, CORE-SC-048)", async () => {
  const { build, runSensors } = aRepository(
    {
      [at("sensor/allow/index.md")]: sensor("allow", "PreToolUse", "./allow"),
      [at("sensor/deny/index.md")]: sensor("deny", "PreToolUse", "./deny"),
      [at("sensor/note/index.md")]: sensor("note", "PreToolUse", "./note"),
    },
    {
      "./allow": {
        exitCode: 0,
        stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", permissionDecisionReason: "read only" } }),
        stderr: "",
      },
      "./deny": {
        exitCode: 0,
        stdout: JSON.stringify({ systemMessage: "denied", hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "touches a secret" } }),
        stderr: "",
      },
      "./note": { exitCode: 0, stdout: "checked\n", stderr: "" },
    },
  );
  await build();

  const sensorRunOutcome = await runSensors("PreToolUse", "{}");

  assert.equal(sensorRunOutcome.data.exitCode, 0);
  assert.deepEqual(JSON.parse(sensorRunOutcome.data.answer), {
    systemMessage: "denied\nchecked",
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "touches a secret" },
  });
});

test("a PermissionRequest denial wins over an earlier allowance without carrying its input override", async () => {
  const { build, runSensors } = aRepository({
    [at("sensor/allow/index.md")]: sensor("allow", "PermissionRequest", "./allow"),
    [at("sensor/deny/index.md")]: sensor("deny", "PermissionRequest", "./deny"),
  }, {
    "./allow": { exitCode: 0, stderr: "", stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "allow", updatedInput: { command: "echo allowed" } } } }) },
    "./deny": { exitCode: 0, stderr: "", stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "deny", message: "blocked by the charter", interrupt: true } } }) },
  });
  assert.equal((await build()).type, "PlanSummary");
  const outcome = await runSensors("PermissionRequest", "{}");
  assert.deepEqual(JSON.parse(outcome.data.answer).hookSpecificOutput.decision, {
    behavior: "deny", message: "blocked by the charter", interrupt: true,
  });
});

test("a block and context from two sensors both reach the host (CORE-FR-178)", async () => {
  const { build, runSensors } = aRepository(
    {
      [at("sensor/block/index.md")]: sensor("block", "UserPromptSubmit", "./block"),
      [at("sensor/context/index.md")]: sensor("context", "UserPromptSubmit", "./context"),
      [at("sensor/plain/index.md")]: sensor("plain", "UserPromptSubmit", "./plain"),
    },
    {
      "./block": { exitCode: 0, stdout: JSON.stringify({ decision: "block", reason: "no secrets in prompts" }), stderr: "" },
      "./context": { exitCode: 0, stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: "on branch main" } }), stderr: "" },
      "./plain": { exitCode: 0, stdout: "today is Thursday\n", stderr: "" },
    },
  );
  await build();

  const sensorRunOutcome = await runSensors("UserPromptSubmit", "{}");

  assert.deepEqual(JSON.parse(sensorRunOutcome.data.answer), {
    decision: "block",
    reason: "no secrets in prompts",
    hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: "on branch main\ntoday is Thursday" },
  });
});

test("a sensor changed in the charter and not built runs as last built (CORE-FR-179)", async () => {
  const { held, shell, build, runSensors } = aRepository({ [at("sensor/say-a/index.md")]: sensor("say-a", "Stop", "echo a") });
  await build();
  held.write(new URL("sensor/say-a/index.md", root), sensor("say-a", "Stop", "echo changed"));

  await runSensors("Stop", "{}");

  assert.ok(shell.runs.some(({ command }) => command === "echo a"));
  assert.ok(!shell.runs.some(({ command }) => command === "echo changed"));
});

test("a signal no sensor names runs nothing, writes nothing, and exits 0 (CORE-FR-176)", async () => {
  const { shell, build, runSensors } = aRepository({});
  await build();

  const sensorRunOutcome = await runSensors("PreCompact", "{}");

  assert.deepEqual(sensorRunOutcome.data, { exitCode: 0, answer: "", problem: "" });
  assert.deepEqual(shell.runs, []);
});

test("Codex runs a signal once through the shared runner, passes its payload and excludes the Claude counter", async () => {
  const { shell, build, runSensors } = aRepository({
    [at("sensor/check/index.md")]: sensor("check", "Stop", "echo check"),
    [at("sensor/gate/index.md")]: sensor("gate", "Stop", "echo gate"),
  }, {
    "echo check": { exitCode: 0, stdout: '{"decision":"block","reason":"check failed"}', stderr: "" },
    "echo gate": { exitCode: 2, stdout: "", stderr: "blocked" },
  });
  await build();
  const payload = '{"hook_event_name":"Stop","turn_id":"turn-1"}';
  const outcome = await runSensors("Stop", payload, "codex");
  assert.equal(outcome.data.exitCode, 2);
  assert.equal(outcome.data.problem, "blocked");
  assert.match(outcome.data.answer, /check failed/);
  assert.equal(shell.runs.length, 2);
  assert.ok(!shell.runs.some(({ command }) => command === SESSION_COUNTER_COMMAND));
  assert.ok(shell.runs.every((run) => run.stdin === payload));
});

test("cw sensor run, started by the host, runs a built signal's sensors in the shell and answers once (CORE-FR-176, CORE-FR-177, CORE-FR-178)", async (t) => {
  const repoFolder = await mkdtemp(join(tmpdir(), "cw-sensor-"));
  t.after(() => rm(repoFolder, { recursive: true, force: true }));
  await mkdir(join(repoFolder, ".cw", "out"), { recursive: true });
  await writeFile(
    join(repoFolder, ".cw", "out", "sensors.json"),
    JSON.stringify({
      sensors: [
        { id: "gate", signal: "Stop", command: "cat > /dev/null; if [ -f release.lock ]; then echo 'a release is open' >&2; exit 2; fi" },
        { id: "say-a", signal: "Stop", command: "grep -q '\"Stop\"' && echo a" },
        { id: "say-b", signal: "Stop", command: "grep -q '\"Stop\"' && echo b" },
      ],
    }),
  );
  const runSignal = () =>
    spawnSync(process.execPath, ["--import", TSX, "--import", MODULE_LOADER, MAIN, "sensor", "run", "Stop"], {
      cwd: repoFolder,
      encoding: "utf8",
      input: '{"hook_event_name":"Stop"}',
    });

  const openRun = runSignal();
  await writeFile(join(repoFolder, "release.lock"), "");
  const lockedRun = runSignal();

  assert.deepEqual({ status: openRun.status, stdout: openRun.stdout, stderr: openRun.stderr }, { status: 0, stdout: "a\nb\n", stderr: "" });
  assert.deepEqual({ status: lockedRun.status, stdout: lockedRun.stdout, stderr: lockedRun.stderr }, { status: 2, stdout: "a\nb\n", stderr: "a release is open\n" });
});

test("sensors run only for their declared provider from the built snapshot", async () => {
  const { held, shell, build, runSensors, claudeSettings } = aRepository({
    [at("sensor/shared/index.md")]: sensor("shared", "SessionStart", "echo shared"),
    [at("sensor/claude-only/index.md")]: sensor("claude-only", "SessionStart", "echo claude").replace("signal:", "agent-provider: [claude]\nsignal:"),
    [at("sensor/codex-only/index.md")]: sensor("codex-only", "SessionStart", "echo codex").replace("signal:", "agent-provider: [codex]\nsignal:"),
    [at("sensor/codex-event/index.md")]: sensor("codex-event", "PreCompact", "echo compact").replace("signal:", "agent-provider: [codex]\nsignal:"),
  });
  assert.equal((await build()).type, "PlanSummary");
  assert.equal((await claudeSettings()).hooks.PreCompact, undefined);
  assert.match(JSON.stringify((await claudeSettings()).hooks), /--agent claude/);
  // Editing the source does not change what the last build runs.
  held.write(new URL(at("sensor/codex-only/index.md")), sensor("codex-only", "SessionStart", "echo modified"));
  await runSensors("SessionStart", "original event", "codex");
  assert.deepEqual(shell.runs.map((shellCall) => shellCall.command).sort(), ["echo codex", "echo shared"]);
  shell.runs.length = 0;
  await runSensors("SessionStart", "original event", "claude");
  assert.deepEqual(shell.runs.map((shellCall) => shellCall.command).sort(), ["echo claude", "echo shared"]);
});
