import assert from "node:assert/strict";
import { test } from "node:test";
import { GitSources } from "../src/module/charter/infra/git-sources.adapter.js";
import { composeApplications } from "../src/module/composition.js";
import { FileSessionAnalysisRepository } from "../src/module/runtime/infra/file-session-analysis.repository.js";
import { GitWorktrees } from "../src/module/runtime/infra/git-worktrees.adapter.js";
import { Promptfoo } from "../src/module/runtime/infra/promptfoo.adapter.js";
import { Shell } from "../src/module/runtime/infra/shell.adapter.js";
import { FolderAddress } from "../src/module/shared/app/port/out/folder-address.port.js";
import { DomainFault } from "../src/module/shared/domain/models/domain.fault.js";
import { FileOutput } from "../src/module/shared/infra/file-output.adapter.js";
import { FileReaders } from "../src/module/shared/infra/file-readers.adapter.js";
import { InMemoryClock } from "../src/module/shared/infra/in-memory/in-memory-clock.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { answerOf } from "./answer-of.js";
import { reviewingSessionsOf } from "./use-cases-of.js";

/** Today, as the clock the sessions are reviewed by tells it. */
const today = new Date("2026-10-03T12:00:00.000Z");

/** One kept stop of one session, as `cw-session-tokens-counter` writes it. */
const sessionAnalysisLine = (sessionId: string, total: number) =>
  `${JSON.stringify({
    time: "2026-10-02T12:00:00.000Z",
    sessionId,
    repository: "/",
    model: "claude-opus-5-5",
    tokens: { input: total / 10, output: total / 10, cacheWrite: total / 10, cacheRead: (total * 7) / 10 },
    total,
  })}\n`;

/** These logs, each last written at its stop, beside whatever else is held. */
const fileReadersHolding = (
  logTextByFile: Readonly<Record<string, string>>,
  otherFiles: Readonly<Record<string, string>> = {},
) => {
  const fileReaders = new InMemoryFileReaders(otherFiles);
  for (const [logFile, logText] of Object.entries(logTextByFile))
    fileReaders.writeFile(new URL(logFile), logText, new Date("2026-10-02T12:00:00.000Z"));
  return fileReaders;
};

/** The ids of the sessions one review found, and the folder it names. */
const reviewedSessionsOf = async (repo: string, home: string, fileReaders: InMemoryFileReaders) => {
  const sessionReviewOutcome = answerOf(
    await reviewingSessionsOf(
      new URL(repo),
      new URL(home),
      fileReaders.makeReadersAt(new URL(repo)),
      (rootFolder) => fileReaders.makeReadersAt(rootFolder),
      new InMemoryClock(today),
      new InMemoryReporter(),
    ).summarizeSessions(),
  );
  return {
    sessionIds: sessionReviewOutcome.data.sessionSummary.data.sessions.map((session) => session.sessionId),
    sessionsFolder: sessionReviewOutcome.data.sessionsFolder,
  };
};

test("two repositories differing only in their host each read a folder of their own (SDK Story 1 scenario 1, SDK-FR-011)", async () => {
  const fileReaders = fileReadersHolding({
    "memory://home/.cherry-works/memory_3a_2f_2fa/session-a/session-analysis.jsonl": sessionAnalysisLine(
      "session-a",
      1000,
    ),
    "memory://home/.cherry-works/memory_3a_2f_2fb/session-b/session-analysis.jsonl": sessionAnalysisLine(
      "session-b",
      2000,
    ),
  });

  assert.deepEqual((await reviewedSessionsOf("memory://a/", "memory://home/", fileReaders)).sessionIds, ["session-a"]);
  assert.deepEqual((await reviewedSessionsOf("memory://b/", "memory://home/", fileReaders)).sessionIds, ["session-b"]);
  assert.ok(fileReaders.calls.every((call) => call.includes("memory://")));
});

test("two file: repositories differing only in their host each read a folder of their own (SDK Story 1 scenario 1, SDK-FR-011)", async () => {
  const fileReaders = fileReadersHolding({
    "file:///home/dev/.cherry-works/file_3a_2f_2fserver_2da_2frepo/session-a/session-analysis.jsonl":
      sessionAnalysisLine("session-a", 1000),
    "file:///home/dev/.cherry-works/file_3a_2f_2fserver_2db_2frepo/session-b/session-analysis.jsonl":
      sessionAnalysisLine("session-b", 2000),
  });

  assert.deepEqual((await reviewedSessionsOf("file://server-a/repo/", "file:///home/dev/", fileReaders)).sessionIds, [
    "session-a",
  ]);
  assert.deepEqual((await reviewedSessionsOf("file://server-b/repo/", "file:///home/dev/", fileReaders)).sessionIds, [
    "session-b",
  ]);
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

/** Every adapter a repository's storage is set up with, on one address. */
const adaptersOn = (repo: URL) => ({
  FileReaders: () => new FileReaders(repo),
  FileOutput: () => new FileOutput(repo),
  GitSources: () => new GitSources(repo),
  GitWorktrees: () => new GitWorktrees(repo),
  Shell: () => new Shell(repo),
  Promptfoo: () => new Promptfoo(repo, new URL("memory://home/.cherry-works/")),
  InMemoryFileReaders: () => new InMemoryFileReaders({}, repo),
  FileSessionAnalysisRepository: () =>
    new FileSessionAnalysisRepository(
      (rootFolder) => new InMemoryFileReaders({}, rootFolder),
      repo,
      new URL("memory://home/"),
    ),
});

test("an address with no hierarchical path, or not ending in its separator, is refused with a fault saying what it must be, where the repository's storage is set up on it (SDK Story 1 scenario 4, SDK-FR-010, CORE Story 46 scenario 3)", () => {
  for (const [address, messagePattern] of [
    ["mailto:charters/", /no folder/],
    ["memory://a/repo", /names a file/],
    ["file:///work/my-repo", /names a file/],
  ] as const) {
    for (const [adapterName, adapterOf] of Object.entries(adaptersOn(new URL(address)))) {
      assert.throws(
        adapterOf,
        (fault: unknown) =>
          fault instanceof DomainFault && messagePattern.test(fault.message) && fault.fix.includes("/"),
        `${adapterName} on ${address}`,
      );
    }
  }
});

test("a home that is no folder is refused too (SDK Story 1 scenario 4, SDK-FR-010)", () => {
  assert.throws(
    () =>
      new FileSessionAnalysisRepository(
        (rootFolder) => new InMemoryFileReaders({}, rootFolder),
        new URL("memory://a/"),
        new URL("mailto:home"),
      ),
    (fault: unknown) => fault instanceof DomainFault && /no folder/.test(fault.message),
  );
});

test("a home naming no folder is refused when the engine is composed, never on a later call (SDK-FR-010)", async () => {
  await assert.rejects(
    composeApplications(new URL("memory://a/"), new URL("file:///home/user"), {
      fileReader: new InMemoryFileReaders({}, new URL("memory://a/")),
    }),
    (fault: unknown) =>
      fault instanceof DomainFault && /names a file, and a folder is what is wanted here/.test(fault.message),
  );
});

test("a hierarchical address with no host is an address like any other (SDK Story 1, edge cases)", async () => {
  const fileReaders = fileReadersHolding({
    "memory:/home/.cherry-works/memory_3a_2frepo/session-a/session-analysis.jsonl": sessionAnalysisLine(
      "session-a",
      1000,
    ),
  });

  assert.deepEqual((await reviewedSessionsOf("memory:/repo/", "memory:/home/", fileReaders)).sessionIds, ["session-a"]);
  for (const adapterOf of Object.values(adaptersOn(new URL("memory:/repo/")))) adapterOf();
});

test("at a file: address, the sessions folder and the answer are what they were, found by what keeps the sessions (SDK Story 1 scenario 5, SDK-FR-012, CORE Story 46 scenario 2)", async () => {
  const fileReaders = fileReadersHolding({
    "file:///home/dev/.cherry-works/-work-my-repo/session-a/session-analysis.jsonl": sessionAnalysisLine(
      "session-a",
      1000,
    ),
  });

  const reviewedSessions = await reviewedSessionsOf("file:///work/my-repo/", "file:///home/dev/", fileReaders);

  assert.deepEqual(reviewedSessions, {
    sessionIds: ["session-a"],
    sessionsFolder: "/home/dev/.cherry-works/-work-my-repo/",
  });
});

test("at a file: address, an absolute sessions folder is the same one it was (SDK Story 1 scenario 5, SDK-FR-012)", async () => {
  const fileReaders = fileReadersHolding(
    { "file:///sessions/session-d/session-analysis.jsonl": sessionAnalysisLine("session-d", 3000) },
    {
      "file:///work/my-repo/.cw/settings.json": JSON.stringify({
        agents: ["claude"],
        sessionAnalysisFolder: "/sessions",
      }),
    },
  );

  const reviewedSessions = await reviewedSessionsOf("file:///work/my-repo/", "file:///home/dev/", fileReaders);

  assert.deepEqual(reviewedSessions, { sessionIds: ["session-d"], sessionsFolder: "/sessions/" });
});

test("two hosts differing only in a dot and a dash each read a folder of their own (SDK Story 1 scenario 1, SDK-FR-011)", async () => {
  const fileReaders = fileReadersHolding({
    "memory://home/.cherry-works/memory_3a_2f_2fa_2eb/session-a/session-analysis.jsonl": sessionAnalysisLine(
      "session-a",
      1000,
    ),
    "memory://home/.cherry-works/memory_3a_2f_2fa_2db/session-b/session-analysis.jsonl": sessionAnalysisLine(
      "session-b",
      2000,
    ),
  });

  assert.deepEqual((await reviewedSessionsOf("memory://a.b/", "memory://home/", fileReaders)).sessionIds, [
    "session-a",
  ]);
  assert.deepEqual((await reviewedSessionsOf("memory://a-b/", "memory://home/", fileReaders)).sessionIds, [
    "session-b",
  ]);
});

test("the credentials an address carries name no folder, and are never answered (SDK Story 1 scenario 3, SDK-FR-011)", async () => {
  const fileReaders = fileReadersHolding({
    "db://dev:home-secret@h/home/.cherry-works/db_3a_2f_2fh_2fcharters/session-a/session-analysis.jsonl":
      sessionAnalysisLine("session-a", 1000),
  });

  const reviewedSessions = await reviewedSessionsOf(
    "db://user:repo-secret@h/charters/",
    "db://dev:home-secret@h/home/",
    fileReaders,
  );

  assert.deepEqual(reviewedSessions, {
    sessionIds: ["session-a"],
    sessionsFolder: "db://h/home/.cherry-works/db_3a_2f_2fh_2fcharters/",
  });
});

test("the query and fragment an address carries name no folder, and are never answered (SDK Story 1 scenario 3, SDK-FR-011)", async () => {
  const fileReaders = fileReadersHolding({
    "db://h/home/.cherry-works/db_3a_2f_2fh_2fcharters/session-a/session-analysis.jsonl": sessionAnalysisLine(
      "session-a",
      1000,
    ),
  });

  const reviewedSessions = await reviewedSessionsOf("db://h/charters/?key=secret#part", "db://h/home/", fileReaders);

  assert.deepEqual(reviewedSessions, {
    sessionIds: ["session-a"],
    sessionsFolder: "db://h/home/.cherry-works/db_3a_2f_2fh_2fcharters/",
  });
});

test("a fault refusing an address repeats none of its credentials, and the fix it gives is a folder (SDK Story 1 scenario 4, SDK-FR-010)", () => {
  for (const address of ["db://user:secret@h/charters?key=secret#secret", "mailto://user:secret@h?key=secret"]) {
    assert.throws(
      () => new FileReaders(new URL(address)),
      (fault: unknown) => {
        assert.ok(fault instanceof DomainFault);
        assert.doesNotMatch(`${fault.message} ${fault.fix}`, /secret/);
        const fixAddress = [...fault.fix.matchAll(/"([^"]+)"/g)].at(-1)?.[1];
        assert.ok(fixAddress !== undefined);
        FolderAddress.parseFolderUrl(fixAddress);
        return true;
      },
    );
  }
});

test("a long address is given a folder name a disk takes, and two such still read folders of their own (SDK Story 1 scenario 1, SDK-FR-011)", async () => {
  // Past 255 characters once escaped, and differing only past where the name is cut.
  const longRepoAddressOf = (teamName: string) =>
    `db://db.prod.internal.example.com/cherry-works/charters/${"platform/".repeat(20)}${teamName}/`;
  const fileReaders = fileReadersHolding({});

  const sessionsFolderOfA = (await reviewedSessionsOf(longRepoAddressOf("team-a"), "memory://home/", fileReaders))
    .sessionsFolder;
  const sessionsFolderOfB = (await reviewedSessionsOf(longRepoAddressOf("team-b"), "memory://home/", fileReaders))
    .sessionsFolder;

  for (const sessionsFolder of [sessionsFolderOfA, sessionsFolderOfB])
    assert.ok(new TextEncoder().encode(sessionsFolder.split("/").at(-2)).length <= 255);
  assert.notEqual(sessionsFolderOfA, sessionsFolderOfB);
});

test("an address with a host and no path is told the folder at its root (SDK Story 1 scenario 4, SDK-FR-010)", () => {
  assert.throws(
    () => new FileReaders(new URL("db://h")),
    (fault: unknown) => fault instanceof DomainFault && fault.fix.includes('"db://h/"'),
  );
});
