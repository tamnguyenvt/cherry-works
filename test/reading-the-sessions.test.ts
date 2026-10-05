import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Commander } from "../src/driver/cli/Commander.js";
import { COMMANDS } from "../src/driver/cli/commands/index.js";
import { EXIT_FAILURE, EXIT_OK } from "../src/driver/cli/commands/Command.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { SessionReviewing } from "../src/hexagon/application/SessionReviewing.js";
import { TestAuthoring } from "../src/hexagon/application/TestAuthoring.js";
import { CwSessionTokensCounterScript } from "../src/hexagon/domain/models/charter/builtin/CwSessionTokensCounterScript.js";
import { FileReaders } from "../src/zdriven/FileReaders.js";
import { InMemoryClock } from "../src/zdriven/InMemoryClock.js";
import { SystemClock } from "../src/zdriven/SystemClock.js";
import { InMemoryAgentCli } from "../src/zdriven/InMemoryAgentCli.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryTokenCounter } from "../src/zdriven/InMemoryTokenCounter.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import type { ForReadingFiles } from "../src/hexagon/port/zdriven/ForReadingFiles.js";
import type { ForTellingTime } from "../src/hexagon/port/zdriven/ForTellingTime.js";
import { noMcpOriginsReached } from "./no-mcp-origins.js";

const repoPath = new URL("file:///work/my-repo/");
const homePath = new URL("file:///home/dev/");
/** Where the counter keeps this repository's sessions unless it says otherwise. */
const defaultSessionsFolder = "file:///home/dev/.cherry-works/-work-my-repo/";

/** One kept stop of one session, as `cw-session-tokens-counter` writes it. Each
 *  at noon UTC, so its day is the same wherever the test runs. */
const sessionAnalysisLine = (sessionId: string, time: string, total: number, model = "claude-opus-5-5") =>
  JSON.stringify({
    time,
    sessionId,
    repository: "/work/my-repo",
    model,
    tokens: { input: total / 10, output: total / 10, cacheWrite: total / 10, cacheRead: (total * 7) / 10 },
    total,
  });

/** Today, as the clock the command line is run with tells it. */
const today = new Date("2026-10-03T12:00:00.000Z");

/** Three sessions over two days, each kept at several stops. */
const keptLog: Readonly<Record<string, string>> = {
  [`${defaultSessionsFolder}session-a/session-analysis.jsonl`]: [
    sessionAnalysisLine("session-a", "2026-10-01T12:00:00.000Z", 1000),
    sessionAnalysisLine("session-a", "2026-10-01T12:10:00.000Z", 5000),
  ].join("\n") + "\n",
  [`${defaultSessionsFolder}session-b/session-analysis.jsonl`]: [
    sessionAnalysisLine("session-b", "2026-10-01T12:20:00.000Z", 2000),
    sessionAnalysisLine("session-b", "2026-10-01T12:30:00.000Z", 9000),
  ].join("\n") + "\n",
  [`${defaultSessionsFolder}session-c/session-analysis.jsonl`]: [
    sessionAnalysisLine("session-c", "2026-10-02T12:00:00.000Z", 40000),
    sessionAnalysisLine("session-c", "2026-10-02T12:05:00.000Z", 60000),
    sessionAnalysisLine("session-c", "2026-10-02T12:15:00.000Z", 70000),
  ].join("\n") + "\n",
};

/** These logs, each last written at its last stop, as the counter leaves
 *  them, beside whatever else the machine holds. */
const machineHolding = (logTexts: Readonly<Record<string, string>>, otherFiles: Readonly<Record<string, string>> = {}) => {
  const fileReaders = new InMemoryFileReaders(otherFiles);
  for (const [logFile, logText] of Object.entries(logTexts)) {
    const lastTime = JSON.parse(logText.trim().split("\n").at(-1)!).time;
    fileReaders.write(new URL(logFile), logText, new Date(lastTime));
  }
  return fileReaders;
};

/** The command line over one repository and one home, the files of both held
 *  by one reader. */
const cliOver = (fileReaders: ForReadingFiles, repo = repoPath, home = homePath, clock: ForTellingTime = new InMemoryClock(today)) => {
  const held = new InMemoryFileReaders({});
  const vcs = new InMemoryVCS();
  const charterAuthoringApp = new CharterAuthoring(repo, held, new YamlParser(), new InMemoryFileOutput(held), vcs, new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() });
  const charterVendoringApp = new CharterVendoring(repo, held, vcs);
  const testAuthoringApp = new TestAuthoring(repo, held, new InMemoryFileOutput(held));
  const sessionReviewingApp = new SessionReviewing(repo, home, fileReaders, clock);
  return new Commander({ cwd: "/work/my-repo", version: "0.0.0", charterAuthoringApp, charterVendoringApp, testAuthoringApp, mcpConnectingApp: noMcpOriginsReached, sessionReviewingApp }, COMMANDS);
};

/** What one command printed to each stream, and its exit status. */
const printed = async (cli: Commander, argv: readonly string[]) => {
  const results: string[] = [];
  const problems: string[] = [];
  const kept = { out: process.stdout.write, err: process.stderr.write };
  process.stdout.write = ((text: string) => (results.push(String(text)), true)) as typeof kept.out;
  process.stderr.write = ((text: string) => (problems.push(String(text)), true)) as typeof kept.err;
  try {
    return { code: await cli.run(argv), text: results.join(""), problem: problems.join("") };
  } finally {
    process.stdout.write = kept.out;
    process.stderr.write = kept.err;
  }
};

/** Every day line, `<day>  <tokens> tokens`, and every session line under it,
 *  `<tokens>  <model>  <session id>`, in the order printed. */
const listedSummary = (text: string) =>
  text.split("\n").flatMap((line): ({ day: string; tokens: number } | { sessionId: string; tokens: number })[] => {
    const [, day, dayTokens] = line.match(/^(\d{4}-\d{2}-\d{2}) +([\d,]+) tokens/) ?? [];
    if (day !== undefined) return [{ day, tokens: Number(dayTokens!.replaceAll(",", "")) }];
    const [, sessionTokens, , sessionId] = line.match(/^ +([\d,]+) {2}(\S+) +(\S+)/) ?? [];
    return sessionTokens === undefined || sessionId === undefined ? [] : [{ sessionId, tokens: Number(sessionTokens.replaceAll(",", "")) }];
  });

test("the summary lists each day and each session in it, the largest first, each session once at its last stop (EVAL-FR-012)", async () => {
  const cli = cliOver(machineHolding(keptLog));

  const { code, text } = await printed(cli, ["sessions"]);

  assert.equal(code, EXIT_OK);
  assert.deepEqual(listedSummary(text), [
    { day: "2026-10-02", tokens: 70000 },
    { sessionId: "session-c", tokens: 70000 },
    { day: "2026-10-01", tokens: 14000 },
    { sessionId: "session-b", tokens: 9000 },
    { sessionId: "session-a", tokens: 5000 },
  ]);
  assert.match(text, /claude-opus-5-5/);
  assert.match(text, /84,000 tokens in all, 3 sessions, from 2026-09-03 until 2026-10-03\./);
});

test("a span counts only the sessions within it (EVAL-FR-012)", async () => {
  const cli = cliOver(machineHolding(keptLog));

  const { code, text } = await printed(cli, ["sessions", "--since", "2026-10-02", "--until", "2026-10-02"]);

  assert.equal(code, EXIT_OK);
  assert.deepEqual(listedSummary(text), [
    { day: "2026-10-02", tokens: 70000 },
    { sessionId: "session-c", tokens: 70000 },
  ]);
  assert.match(text, /70,000 tokens in all, 1 session, from 2026-10-02 until 2026-10-02\./);

  const untilText = (await printed(cli, ["sessions", "--until", "2026-10-01"])).text;
  assert.deepEqual(
    listedSummary(untilText).flatMap((listed) => ("sessionId" in listed ? [listed.sessionId] : [])),
    ["session-b", "session-a"],
  );

  const emptySpanText = (await printed(cli, ["sessions", "--since", "2026-10-03"])).text;
  assert.deepEqual(listedSummary(emptySpanText), []);
  assert.match(emptySpanText, /No session has been kept for this repository from 2026-10-03 until 2026-11-02/);
});

test("a log last written outside the span is not read (EVAL-FR-012, EVAL-SC-007)", async () => {
  const oldLogFile = `${defaultSessionsFolder}session-old/session-analysis.jsonl`;
  const fileReaders = machineHolding({ ...keptLog, [oldLogFile]: sessionAnalysisLine("session-old", "2026-06-01T12:00:00.000Z", 999999) + "\n" });

  const { text } = await printed(cliOver(fileReaders), ["sessions"]);

  assert.doesNotMatch(text, /session-old/);
  assert.ok(!fileReaders.calls.includes(`read ${oldLogFile}`));
  assert.ok(fileReaders.calls.includes(`read ${defaultSessionsFolder}session-c/session-analysis.jsonl`));
});

test("with no span named, the last 31 days are summed up, today among them (EVAL-FR-030)", async () => {
  const fileReaders = machineHolding({
    ...keptLog,
    [`${defaultSessionsFolder}session-first/session-analysis.jsonl`]: sessionAnalysisLine("session-first", "2026-09-03T12:00:00.000Z", 100) + "\n",
    [`${defaultSessionsFolder}session-before/session-analysis.jsonl`]: sessionAnalysisLine("session-before", "2026-09-02T12:00:00.000Z", 100) + "\n",
  });

  const { text } = await printed(cliOver(fileReaders), ["sessions"]);

  assert.match(text, /session-first/);
  assert.doesNotMatch(text, /session-before/);
});

test("a span named by one end is 31 days from it or up to it (EVAL-FR-030)", async () => {
  const cli = cliOver(machineHolding(keptLog));

  assert.match((await printed(cli, ["sessions", "--since", "2026-09-15"])).text, /from 2026-09-15 until 2026-10-15\./);
  assert.match((await printed(cli, ["sessions", "--until", "2026-10-01"])).text, /from 2026-09-01 until 2026-10-01\./);
});

test("a span longer than 31 days is refused before anything is read, saying how long one may be (EVAL-FR-030)", async () => {
  const fileReaders = machineHolding(keptLog);

  const { code, problem } = await printed(cliOver(fileReaders), ["sessions", "--since", "2026-09-01", "--until", "2026-10-02"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problem, /32 days/);
  assert.match(problem, /31/);
  assert.deepEqual(fileReaders.calls, []);
});

test("a span that is no day is refused, saying how to write one (EVAL-FR-012)", async () => {
  const cli = cliOver(machineHolding(keptLog));

  const { code, problem } = await printed(cli, ["sessions", "--since", "last week"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problem, /2026-10-01|YYYY-MM-DD/);
});

test("a day the calendar does not hold is refused (EVAL-FR-030)", async () => {
  const fileReaders = machineHolding(keptLog);

  const { code, problem } = await printed(cliOver(fileReaders), ["sessions", "--since", "2026-02-31"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problem, /"2026-02-31" is no day/);
  assert.deepEqual(fileReaders.calls, []);
  assert.match((await printed(cliOver(fileReaders), ["sessions", "--until", "2026-13-01"])).problem, /"2026-13-01" is no day/);
});

test("only each session's own folder is looked in, however deep the folder named holds files (EVAL-FR-009, EVAL-SC-007)", async () => {
  const deepLogFile = "file:///home/dev/projects/a/b/session-analysis.jsonl";
  const fileReaders = machineHolding(
    {
      "file:///home/dev/session-f/session-analysis.jsonl": sessionAnalysisLine("session-f", "2026-10-02T12:00:00.000Z", 500) + "\n",
      [deepLogFile]: sessionAnalysisLine("session-deep", "2026-10-02T12:00:00.000Z", 500) + "\n",
    },
    { "file:///work/my-repo/.cw/settings.json": JSON.stringify({ agents: ["claude"], sessionAnalysisFolder: "~/" }) },
  );

  const { text } = await printed(cliOver(fileReaders), ["sessions"]);

  assert.match(text, /session-f/);
  assert.doesNotMatch(text, /session-deep/);
  assert.ok(!fileReaders.calls.includes(`read ${deepLogFile}`));
  assert.ok(!fileReaders.calls.some((call) => call.startsWith("listed files under file:///home/dev/projects/a/")));
});

test("with no log yet, the summary says none was kept and how one starts (EVAL-FR-013)", async () => {
  const cli = cliOver(machineHolding({}));

  const { code, text } = await printed(cli, ["sessions"]);

  assert.equal(code, EXIT_OK);
  assert.match(text, /No session has been kept/);
  assert.match(text, /cw build/);
  assert.match(text, /\/home\/dev\/\.cherry-works\/-work-my-repo/);
});

test("the summary reads the folder the repository's settings name (EVAL-FR-012)", async () => {
  const fileReaders = machineHolding(
    { "file:///home/dev/sessions/session-d/session-analysis.jsonl": sessionAnalysisLine("session-d", "2026-10-03T12:00:00.000Z", 3000) + "\n", ...keptLog },
    { "file:///work/my-repo/.cw/settings.json": JSON.stringify({ agents: ["claude"], sessionAnalysisFolder: "~/sessions" }) },
  );

  const { text } = await printed(cliOver(fileReaders), ["sessions"]);

  assert.deepEqual(listedSummary(text), [
    { day: "2026-10-03", tokens: 3000 },
    { sessionId: "session-d", tokens: 3000 },
  ]);
});

test("the summary reads what the counter kept when the agent stopped, on a disk (EVAL-FR-012)", async () => {
  const machineFolder = await mkdtemp(join(tmpdir(), "cw-sessions-"));
  try {
    const homeFolder = join(machineFolder, "home");
    const repoFolder = join(machineFolder, "my repo");
    await mkdir(join(repoFolder, ".cw"), { recursive: true });
    await mkdir(homeFolder, { recursive: true });
    await writeFile(join(repoFolder, ".cw/settings.json"), JSON.stringify({ agents: ["claude"] }));
    const counterFile = join(machineFolder, "sessionTokensCounter.mjs");
    await writeFile(counterFile, new CwSessionTokensCounterScript().assets.find((assetFile) => assetFile.file === "sessionTokensCounter.mjs")!.contents);
    const transcriptFile = join(machineFolder, "session-e.jsonl");
    await writeFile(
      transcriptFile,
      JSON.stringify({ type: "assistant", message: { id: "msg-1", model: "claude-opus-5-5", usage: { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 30, cache_read_input_tokens: 40 } } }) + "\n",
    );
    await new Promise<void>((resolve) => {
      const counterProcess = spawn(process.execPath, [counterFile], { cwd: repoFolder, env: { ...process.env, HOME: homeFolder }, stdio: ["pipe", "ignore", "ignore"] });
      counterProcess.on("close", () => resolve());
      counterProcess.stdin.end(JSON.stringify({ session_id: "session-e", transcript_path: transcriptFile, cwd: repoFolder, hook_event_name: "Stop" }));
    });

    const { text } = await printed(cliOver(new FileReaders(), pathToFileURL(`${repoFolder}/`), pathToFileURL(`${homeFolder}/`), new SystemClock()), ["sessions"]);

    assert.deepEqual(
      listedSummary(text).flatMap((listed) => ("sessionId" in listed ? [listed] : [])),
      [{ sessionId: "session-e", tokens: 100 }],
    );
  } finally {
    await rm(machineFolder, { recursive: true, force: true });
  }
});

test("asked for JSON, the summary gives each session's tokens by kind, so a skill can price them (EVAL-FR-012, EVAL-FR-014)", async () => {
  const cli = cliOver(machineHolding(keptLog));

  const { code, text } = await printed(cli, ["sessions", "--json"]);

  assert.equal(code, EXIT_OK);
  const {
    data: { sessionSummary, dailySessionSummary },
  } = JSON.parse(text);
  assert.deepEqual(sessionSummary.data.span, { since: "2026-09-03", until: "2026-10-03" });
  assert.equal(sessionSummary.data.totalTokens, 84000);
  assert.deepEqual(
    sessionSummary.data.sessions.map(({ sessionId, model, tokens }: { sessionId: string; model: string; tokens: unknown }) => ({ sessionId, model, tokens })),
    [
      { sessionId: "session-c", model: "claude-opus-5-5", tokens: { input: 7000, output: 7000, cacheWrite: 7000, cacheRead: 49000 } },
      { sessionId: "session-b", model: "claude-opus-5-5", tokens: { input: 900, output: 900, cacheWrite: 900, cacheRead: 6300 } },
      { sessionId: "session-a", model: "claude-opus-5-5", tokens: { input: 500, output: 500, cacheWrite: 500, cacheRead: 3500 } },
    ],
  );
  assert.deepEqual(Object.keys(dailySessionSummary), ["2026-10-02", "2026-10-01"]);
  assert.deepEqual(dailySessionSummary["2026-10-01"].data.sessions[0].tokens, { input: 900, output: 900, cacheWrite: 900, cacheRead: 6300 });
});
