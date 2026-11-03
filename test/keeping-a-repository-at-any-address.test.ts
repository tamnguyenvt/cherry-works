import { test } from "node:test";
import assert from "node:assert/strict";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { CharterEvaluating } from "../src/hexagon/application/CharterEvaluating.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { McpConnecting } from "../src/hexagon/application/McpConnecting.js";
import { SensorRunning } from "../src/hexagon/application/SensorRunning.js";
import { SessionReviewing } from "../src/hexagon/application/SessionReviewing.js";
import { TestAuthoring } from "../src/hexagon/application/TestAuthoring.js";
import { DomainFault } from "../src/hexagon/domain/models/DomainFault.js";
import { folderURL } from "../src/hexagon/domain/path.js";
import { InMemoryAgentCli } from "../src/zdriven/InMemoryAgentCli.js";
import { InMemoryAuthorizing } from "../src/zdriven/InMemoryAuthorizing.js";
import { InMemoryClock } from "../src/zdriven/InMemoryClock.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryMcpServers } from "../src/zdriven/InMemoryMcpServers.js";
import { InMemoryPromptfoo } from "../src/zdriven/InMemoryPromptfoo.js";
import { InMemoryReporter } from "../src/zdriven/InMemoryReporter.js";
import { InMemorySecrets } from "../src/zdriven/InMemorySecrets.js";
import { InMemoryShellCommands } from "../src/zdriven/InMemoryShellCommands.js";
import { InMemorySources } from "../src/zdriven/InMemorySources.js";
import { InMemoryTokenCounter } from "../src/zdriven/InMemoryTokenCounter.js";
import { InMemoryWorktrees } from "../src/zdriven/InMemoryWorktrees.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";

/** Today, as the clock the sessions are reviewed by tells it. */
const today = new Date("2026-10-03T12:00:00.000Z");

/** One kept stop of one session, as `cw-session-tokens-counter` writes it. */
const sessionAnalysisLine = (sessionId: string, total: number) =>
  JSON.stringify({
    time: "2026-10-02T12:00:00.000Z",
    sessionId,
    repository: "/",
    model: "claude-opus-5-5",
    tokens: { input: total / 10, output: total / 10, cacheWrite: total / 10, cacheRead: (total * 7) / 10 },
    total,
  }) + "\n";

/** These logs, each last written at its stop, beside whatever else is held. */
const fileReadersHolding = (logTextByFile: Readonly<Record<string, string>>, otherFiles: Readonly<Record<string, string>> = {}) => {
  const fileReaders = new InMemoryFileReaders(otherFiles);
  for (const [logFile, logText] of Object.entries(logTextByFile)) fileReaders.write(new URL(logFile), logText, new Date("2026-10-02T12:00:00.000Z"));
  return fileReaders;
};

/** The ids of the sessions one review found, and the folder it names. */
const reviewedSessionsOf = async (repo: string, home: string, fileReaders: InMemoryFileReaders) => {
  const sessionReviewOutcome = await new SessionReviewing(new URL(repo), new URL(home), fileReaders, new InMemoryClock(today)).sessionSummary();
  return {
    sessionIds: sessionReviewOutcome.data.sessionSummary.data.sessions.map((session) => session.sessionId),
    sessionsFolder: sessionReviewOutcome.data.sessionsFolder,
  };
};

test("two repositories differing only in their host each read a folder of their own (SDK Story 1 scenario 1, SDK-FR-011)", async () => {
  const fileReaders = fileReadersHolding({
    "memory://home/.cherry-works/memory_3a_2f_2fa/session-a/session-analysis.jsonl": sessionAnalysisLine("session-a", 1000),
    "memory://home/.cherry-works/memory_3a_2f_2fb/session-b/session-analysis.jsonl": sessionAnalysisLine("session-b", 2000),
  });

  assert.deepEqual((await reviewedSessionsOf("memory://a/", "memory://home/", fileReaders)).sessionIds, ["session-a"]);
  assert.deepEqual((await reviewedSessionsOf("memory://b/", "memory://home/", fileReaders)).sessionIds, ["session-b"]);
  assert.ok(fileReaders.calls.every((call) => call.includes("memory://")));
});

test("two file: repositories differing only in their host each read a folder of their own (SDK Story 1 scenario 1, SDK-FR-011)", async () => {
  const fileReaders = fileReadersHolding({
    "file:///home/dev/.cherry-works/file_3a_2f_2fserver_2da_2frepo/session-a/session-analysis.jsonl": sessionAnalysisLine("session-a", 1000),
    "file:///home/dev/.cherry-works/file_3a_2f_2fserver_2db_2frepo/session-b/session-analysis.jsonl": sessionAnalysisLine("session-b", 2000),
  });

  assert.deepEqual((await reviewedSessionsOf("file://server-a/repo/", "file:///home/dev/", fileReaders)).sessionIds, ["session-a"]);
  assert.deepEqual((await reviewedSessionsOf("file://server-b/repo/", "file:///home/dev/", fileReaders)).sessionIds, ["session-b"]);
});

test("an absolute sessions folder is read under the home's scheme, and no file: address is asked for (SDK Story 1 scenario 2, SDK-FR-011)", async () => {
  const fileReaders = fileReadersHolding(
    { "memory://h/sessions/session-d/session-analysis.jsonl": sessionAnalysisLine("session-d", 3000) },
    { "memory://a/.cw/settings.json": JSON.stringify({ agents: ["claude"], sessionAnalysisFolder: "/sessions" }) },
  );

  const reviewedSessions = await reviewedSessionsOf("memory://a/", "memory://h/home/", fileReaders);

  assert.deepEqual(reviewedSessions.sessionIds, ["session-d"]);
  assert.ok(!fileReaders.calls.some((call) => call.includes("file:")));
});

test("the sessions folder a review names tells one repository's from another's (SDK Story 1 scenario 3, SDK-FR-011)", async () => {
  const fileReaders = fileReadersHolding({});

  const sessionsFolderOfA = (await reviewedSessionsOf("memory://a/", "memory://home/", fileReaders)).sessionsFolder;
  const sessionsFolderOfB = (await reviewedSessionsOf("memory://b/", "memory://home/", fileReaders)).sessionsFolder;

  assert.equal(sessionsFolderOfA, "memory://home/.cherry-works/memory_3a_2f_2fa/");
  assert.notEqual(sessionsFolderOfA, sessionsFolderOfB);
});

/** Every use case, built on one repository address. */
const useCasesOn = (repo: URL) => {
  const fileReaders = new InMemoryFileReaders({});
  const fileWriter = new InMemoryFileOutput(fileReaders);
  return {
    CharterAuthoring: () => new CharterAuthoring(repo, fileReaders, new YamlParser(), fileWriter, new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() }),
    CharterEvaluating: () =>
      new CharterEvaluating(repo, fileReaders, new YamlParser(), fileWriter, new InMemoryWorktrees(fileReaders), { claude: new InMemoryAgentCli() }, new InMemoryPromptfoo(), new InMemoryReporter()),
    CharterVendoring: () => new CharterVendoring(repo, fileReaders, new InMemorySources(), fileWriter, new YamlParser()),
    McpConnecting: () => new McpConnecting(repo, fileReaders, new InMemorySecrets(), new InMemoryAuthorizing(), new YamlParser(), new InMemoryMcpServers()),
    SensorRunning: () => new SensorRunning(repo, fileReaders, new InMemoryShellCommands()),
    SessionReviewing: () => new SessionReviewing(repo, new URL("memory://home/"), fileReaders, new InMemoryClock(today)),
    TestAuthoring: () => new TestAuthoring(repo, fileReaders, fileWriter),
  };
};

test("an address with no hierarchical path, or not ending in its separator, is refused with a fault saying what it must be (SDK Story 1 scenario 4, SDK-FR-010)", () => {
  for (const [address, messagePattern] of [
    ["mailto:charters/", /no folder/],
    ["memory://a/repo", /names a file/],
    ["file:///work/my-repo", /names a file/],
  ] as const) {
    for (const [useCaseName, useCaseOf] of Object.entries(useCasesOn(new URL(address)))) {
      assert.throws(
        useCaseOf,
        (fault: unknown) => fault instanceof DomainFault && messagePattern.test(fault.message) && fault.fix.includes("/"),
        `${useCaseName} on ${address}`,
      );
    }
  }
});

test("a home that is no folder is refused too (SDK Story 1 scenario 4, SDK-FR-010)", () => {
  assert.throws(
    () => new SessionReviewing(new URL("memory://a/"), new URL("mailto:home"), new InMemoryFileReaders({}), new InMemoryClock(today)),
    (fault: unknown) => fault instanceof DomainFault && /no folder/.test(fault.message),
  );
});

test("a hierarchical address with no host is an address like any other (SDK Story 1, edge cases)", async () => {
  const fileReaders = fileReadersHolding({ "memory:/home/.cherry-works/memory_3a_2frepo/session-a/session-analysis.jsonl": sessionAnalysisLine("session-a", 1000) });

  assert.deepEqual((await reviewedSessionsOf("memory:/repo/", "memory:/home/", fileReaders)).sessionIds, ["session-a"]);
  for (const useCaseOf of Object.values(useCasesOn(new URL("memory:/repo/")))) useCaseOf();
});

test("at a file: address, the sessions folder and the answer are what they were (SDK Story 1 scenario 5, SDK-FR-012)", async () => {
  const fileReaders = fileReadersHolding(
    { "file:///home/dev/.cherry-works/-work-my-repo/session-a/session-analysis.jsonl": sessionAnalysisLine("session-a", 1000) },
  );

  const reviewedSessions = await reviewedSessionsOf("file:///work/my-repo/", "file:///home/dev/", fileReaders);

  assert.deepEqual(reviewedSessions, { sessionIds: ["session-a"], sessionsFolder: "/home/dev/.cherry-works/-work-my-repo/" });
});

test("at a file: address, an absolute sessions folder is the same one it was (SDK Story 1 scenario 5, SDK-FR-012)", async () => {
  const fileReaders = fileReadersHolding(
    { "file:///sessions/session-d/session-analysis.jsonl": sessionAnalysisLine("session-d", 3000) },
    { "file:///work/my-repo/.cw/settings.json": JSON.stringify({ agents: ["claude"], sessionAnalysisFolder: "/sessions" }) },
  );

  const reviewedSessions = await reviewedSessionsOf("file:///work/my-repo/", "file:///home/dev/", fileReaders);

  assert.deepEqual(reviewedSessions, { sessionIds: ["session-d"], sessionsFolder: "/sessions/" });
});

test("two hosts differing only in a dot and a dash each read a folder of their own (SDK Story 1 scenario 1, SDK-FR-011)", async () => {
  const fileReaders = fileReadersHolding({
    "memory://home/.cherry-works/memory_3a_2f_2fa_2eb/session-a/session-analysis.jsonl": sessionAnalysisLine("session-a", 1000),
    "memory://home/.cherry-works/memory_3a_2f_2fa_2db/session-b/session-analysis.jsonl": sessionAnalysisLine("session-b", 2000),
  });

  assert.deepEqual((await reviewedSessionsOf("memory://a.b/", "memory://home/", fileReaders)).sessionIds, ["session-a"]);
  assert.deepEqual((await reviewedSessionsOf("memory://a-b/", "memory://home/", fileReaders)).sessionIds, ["session-b"]);
});

test("the credentials an address carries name no folder, and are never answered (SDK Story 1 scenario 3, SDK-FR-011)", async () => {
  const fileReaders = fileReadersHolding({ "db://dev:home-secret@h/home/.cherry-works/db_3a_2f_2fh_2fcharters/session-a/session-analysis.jsonl": sessionAnalysisLine("session-a", 1000) });

  const reviewedSessions = await reviewedSessionsOf("db://user:repo-secret@h/charters/", "db://dev:home-secret@h/home/", fileReaders);

  assert.deepEqual(reviewedSessions, { sessionIds: ["session-a"], sessionsFolder: "db://h/home/.cherry-works/db_3a_2f_2fh_2fcharters/" });
});

test("the query and fragment an address carries name no folder, and are never answered (SDK Story 1 scenario 3, SDK-FR-011)", async () => {
  const fileReaders = fileReadersHolding({ "db://h/home/.cherry-works/db_3a_2f_2fh_2fcharters/session-a/session-analysis.jsonl": sessionAnalysisLine("session-a", 1000) });

  const reviewedSessions = await reviewedSessionsOf("db://h/charters/?key=secret#part", "db://h/home/", fileReaders);

  assert.deepEqual(reviewedSessions, { sessionIds: ["session-a"], sessionsFolder: "db://h/home/.cherry-works/db_3a_2f_2fh_2fcharters/" });
});

test("a fault refusing an address repeats none of its credentials, and the fix it gives is a folder (SDK Story 1 scenario 4, SDK-FR-010)", () => {
  for (const address of ["db://user:secret@h/charters?key=secret#secret", "mailto://user:secret@h?key=secret"]) {
    assert.throws(
      () => new SensorRunning(new URL(address), new InMemoryFileReaders({}), new InMemoryShellCommands()),
      (fault: unknown) => {
        assert.ok(fault instanceof DomainFault);
        assert.doesNotMatch(`${fault.message} ${fault.fix}`, /secret/);
        const fixAddress = [...fault.fix.matchAll(/"([^"]+)"/g)].at(-1)?.[1];
        assert.ok(fixAddress !== undefined);
        folderURL(fixAddress);
        return true;
      },
    );
  }
});

test("a long address is given a folder name a disk takes, and two such still read folders of their own (SDK Story 1 scenario 1, SDK-FR-011)", async () => {
  // Past 255 characters once escaped, and differing only past where the name is cut.
  const longRepoAddressOf = (teamName: string) => `db://db.prod.internal.example.com/cherry-works/charters/${"platform/".repeat(20)}${teamName}/`;
  const fileReaders = fileReadersHolding({});

  const sessionsFolderOfA = (await reviewedSessionsOf(longRepoAddressOf("team-a"), "memory://home/", fileReaders)).sessionsFolder;
  const sessionsFolderOfB = (await reviewedSessionsOf(longRepoAddressOf("team-b"), "memory://home/", fileReaders)).sessionsFolder;

  for (const sessionsFolder of [sessionsFolderOfA, sessionsFolderOfB]) assert.ok(new TextEncoder().encode(sessionsFolder.split("/").at(-2)).length <= 255);
  assert.notEqual(sessionsFolderOfA, sessionsFolderOfB);
});

test("an address with a host and no path is told the folder at its root (SDK Story 1 scenario 4, SDK-FR-010)", () => {
  assert.throws(
    () => new SensorRunning(new URL("db://user:secret@h"), new InMemoryFileReaders({}), new InMemoryShellCommands()),
    (fault: unknown) => fault instanceof DomainFault && fault.fix.includes('"db://h/"'),
  );
});
