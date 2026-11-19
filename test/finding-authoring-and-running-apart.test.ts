import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";

// `pnpm test` builds this tree first: dist/ is what its source builds to.
const cwFilePath = fileURLToPath(new URL("../dist/cw.js", import.meta.url));

/** The names the commands running what was built were typed by before
 *  (CORE-FR-244). */
const DEPRECATED_COMMAND_PATTERN = /cw mcp serve|cw sensor run|cw portal|"mcp",\s*"serve"/;

/** `cw` run as a developer runs it, in a folder of its own, its home held
 *  there too so nothing of this machine is read. */
const runCw = (cwArgs: readonly string[], folderPath: string, input = "") =>
  spawnSync(process.execPath, [cwFilePath, ...cwArgs], {
    cwd: folderPath,
    env: { ...process.env, HOME: join(folderPath, ".home"), NO_COLOR: "1" },
    input,
    encoding: "utf8",
  });

const aFolder = async (t: { after: (cleanUp: () => Promise<void>) => void }) => {
  const folderPath = await mkdtemp(join(tmpdir(), "cw-run-"));
  t.after(() => rm(folderPath, { recursive: true, force: true }));
  return folderPath;
};

/** Every file a build writes for an agent, outside cw's own folder, by its
 *  path in the repository. */
const agentTextByPath = async (folderPath: string): Promise<Map<string, string>> => {
  const folderEntries = await readdir(folderPath, { recursive: true, withFileTypes: true });
  const agentFilePaths = folderEntries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(folderPath, join(entry.parentPath, entry.name)))
    .filter((filePath) => !filePath.startsWith(".cw/") && !filePath.startsWith(".home/"));
  return new Map(
    await Promise.all(
      agentFilePaths.map(async (filePath) => [filePath, await readFile(join(folderPath, filePath), "utf8")] as const),
    ),
  );
};

/** A repository chosen for every agent, with a sensor on `Stop`, built. */
const aBuiltRepository = async (t: { after: (cleanUp: () => Promise<void>) => void }) => {
  const folderPath = await aFolder(t);
  await mkdir(join(folderPath, ".cw/charter/team/primitive/sensor/say"), { recursive: true });
  await writeFile(join(folderPath, ".cw/settings.json"), JSON.stringify({ agents: ["claude", "codex"] }));
  await writeFile(
    join(folderPath, ".cw/charter/team/primitive/sensor/say/index.md"),
    "---\nkind: sensor\nid: say\ndescription: Says a.\nsignal: Stop\nrun: echo a\n---\n\nSays a.\n",
  );
  const buildRun = runCw(["build"], folderPath);
  assert.equal(buildRun.status, 0, buildRun.stderr);
  return folderPath;
};

test("cw --help lists the commands in two sections, the three cw run commands alone in the second, and no deprecated name (CORE Story 69 scenario 1, CORE-FR-243, CORE-SC-076)", async (t) => {
  const helpRun = runCw(["--help"], await aFolder(t));

  assert.equal(helpRun.status, 0, helpRun.stderr);
  const authoringText = helpRun.stdout.slice(
    helpRun.stdout.indexOf("Authoring the charter:"),
    helpRun.stdout.indexOf("Running it:"),
  );
  const runningText = helpRun.stdout.slice(helpRun.stdout.indexOf("Running it:"), helpRun.stdout.indexOf("Options:"));
  assert.ok(authoringText.startsWith("Authoring the charter:"), helpRun.stdout);
  assert.ok(runningText.startsWith("Running it:"), helpRun.stdout);
  assert.deepEqual(
    runningText.split("\n").flatMap((helpLine) => helpLine.match(/^ {2}(cw \S+(?: \S+)*?)(?: {2,}|$)/)?.[1] ?? []),
    ["cw run mcp", "cw run sensor <signal>", "cw run portal"],
  );
  const authoringHeadWords = authoringText
    .split("\n")
    .flatMap((helpLine) => helpLine.match(/^ {2}cw (\S+)/)?.[1] ?? []);
  const otherHeadWords = new Set(
    COMMANDS.map((command) => command.name.split(" ")[0] as string).filter((headWord) => headWord !== "run"),
  );
  assert.deepEqual(new Set(authoringHeadWords), otherHeadWords);
  assert.doesNotMatch(helpRun.stdout, /mcp serve|sensor run|cw portal|\bserve\b/);
});

test("cw sensor run, cw mcp serve and cw portal answer as cw run sensor, cw run mcp and cw run portal do, given the same flags (CORE Story 69 scenario 3, CORE-FR-244)", async (t) => {
  const sensorFolderPath = await aFolder(t);
  await mkdir(join(sensorFolderPath, ".cw/out"), { recursive: true });
  await writeFile(join(sensorFolderPath, ".cw/settings.json"), JSON.stringify({ agents: ["claude"] }));
  await writeFile(
    join(sensorFolderPath, ".cw/out/sensors.json"),
    JSON.stringify({
      sensors: [
        { id: "say", signal: "Stop", command: "cat > /dev/null; echo said" },
        { id: "gate", signal: "Stop", command: "echo blocked >&2; exit 2" },
      ],
    }),
  );
  const neverBuiltFolderPath = await aFolder(t);
  const neverSetUpFolderPath = await aFolder(t);
  const answerOfRun = (folderPath: string, cwArgs: readonly string[]) => {
    const commandRun = runCw(cwArgs, folderPath, '{"hook_event_name":"Stop"}');
    return { status: commandRun.status, stdout: commandRun.stdout, stderr: commandRun.stderr };
  };

  const pairedAnswers = [
    [
      answerOfRun(sensorFolderPath, ["sensor", "run", "Stop", "--agent", "claude"]),
      answerOfRun(sensorFolderPath, ["run", "sensor", "Stop", "--agent", "claude"]),
    ],
    [answerOfRun(neverBuiltFolderPath, ["mcp", "serve"]), answerOfRun(neverBuiltFolderPath, ["run", "mcp"])],
    [
      answerOfRun(neverSetUpFolderPath, ["portal", "--port", "47432"]),
      answerOfRun(neverSetUpFolderPath, ["run", "portal", "--port", "47432"]),
    ],
  ];

  assert.deepEqual(pairedAnswers[0]?.[1], { status: 2, stdout: "said\n", stderr: "blocked\n" });
  assert.equal(pairedAnswers[1]?.[1]?.status, 1);
  assert.match(pairedAnswers[1]?.[1]?.stderr ?? "", /cw build/);
  assert.equal(pairedAnswers[2]?.[1]?.status, 1);
  assert.match(pairedAnswers[2]?.[1]?.stderr ?? "", /cw init/);
  for (const [deprecatedAnswer, runAnswer] of pairedAnswers) assert.deepEqual(deprecatedAnswer, runAnswer);
});

test("a charter with sensors, built for every agent, names only cw run sensor and cw run mcp in every agent's files (CORE Story 69 scenario 4, CORE-FR-244, CORE-FR-146, CORE-FR-175, CORE-SC-076)", async (t) => {
  const folderPath = await aBuiltRepository(t);

  const builtAgentTextByPath = await agentTextByPath(folderPath);

  for (const [filePath, agentText] of builtAgentTextByPath)
    assert.doesNotMatch(agentText, DEPRECATED_COMMAND_PATTERN, filePath);
  assert.match(builtAgentTextByPath.get(".claude/settings.json") ?? "", /"cw run sensor Stop --agent claude"/);
  assert.deepEqual(JSON.parse(builtAgentTextByPath.get(".mcp.json") ?? "{}").mcpServers.cw, {
    command: "cw",
    args: ["run", "mcp"],
  });
  assert.match(builtAgentTextByPath.get(".codex/config.toml") ?? "", /args = \[ "run", "mcp" \]/);
  assert.match(builtAgentTextByPath.get(".codex/config.toml") ?? "", /&& cw run sensor Stop --agent codex"/);
});

test("a repository built by the release before is reported out of date, and building again moves every agent's files off the old names (CORE Story 69 scenario 5, CORE-FR-244, CORE-FR-080, CORE-SC-076)", async (t) => {
  const folderPath = await aBuiltRepository(t);
  // What the release before wrote: the same files under the old names.
  for (const [filePath, agentText] of await agentTextByPath(folderPath))
    await writeFile(
      join(folderPath, filePath),
      agentText
        .replaceAll("cw run sensor", "cw sensor run")
        .replaceAll('"run",\n        "mcp"', '"mcp",\n        "serve"')
        .replaceAll('[ "run", "mcp" ]', '[ "mcp", "serve" ]'),
    );
  assert.ok(
    [...(await agentTextByPath(folderPath)).values()].some((agentText) => DEPRECATED_COMMAND_PATTERN.test(agentText)),
  );

  const doctorRun = runCw(["doctor"], folderPath);
  const buildRun = runCw(["build"], folderPath);

  assert.match(doctorRun.stdout, /Built: +\d+ files? out of date\. Run "cw build"\./);
  assert.equal(buildRun.status, 0, buildRun.stderr);
  for (const [filePath, agentText] of await agentTextByPath(folderPath))
    assert.doesNotMatch(agentText, DEPRECATED_COMMAND_PATTERN, filePath);
});

test("a hook the release before wrote under a signal that has since lost its last sensor is moved off the old name by building again (CORE Story 69 scenario 5, CORE-FR-244, CORE-FR-175, CORE-SC-076)", async (t) => {
  const folderPath = await aBuiltRepository(t);
  // What the release before left under PreToolUse, whose last sensor was
  // removed before upgrading: the build keeps a signal's command as it was.
  const claudeSettings = JSON.parse(await readFile(join(folderPath, ".claude/settings.json"), "utf8"));
  claudeSettings.hooks.PreToolUse = [
    { hooks: [{ type: "command", command: "cw sensor run PreToolUse --agent claude" }] },
  ];
  await writeFile(join(folderPath, ".claude/settings.json"), `${JSON.stringify(claudeSettings, null, 2)}\n`);
  const codexConfigText = await readFile(join(folderPath, ".codex/config.toml"), "utf8");
  await writeFile(
    join(folderPath, ".codex/config.toml"),
    `${codexConfigText}\n[[hooks.PreToolUse]]\n[[hooks.PreToolUse.hooks]]\ntype = "command"\ncommand = "cd -- \\"$(git rev-parse --show-toplevel)\\" && cw sensor run PreToolUse --agent codex"\n`,
  );

  const buildRun = runCw(["build"], folderPath);

  assert.equal(buildRun.status, 0, buildRun.stderr);
  const rebuiltAgentTextByPath = await agentTextByPath(folderPath);
  for (const [filePath, agentText] of rebuiltAgentTextByPath)
    assert.doesNotMatch(agentText, DEPRECATED_COMMAND_PATTERN, filePath);
  assert.match(rebuiltAgentTextByPath.get(".claude/settings.json") ?? "", /"cw run sensor PreToolUse --agent claude"/);
  assert.match(rebuiltAgentTextByPath.get(".codex/config.toml") ?? "", /&& cw run sensor PreToolUse --agent codex"/);
});
