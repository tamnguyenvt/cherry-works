import assert from "node:assert/strict";
import { test } from "node:test";
import { CwAuthorSkill } from "../src/module/charter/domain/builtin/cw-author-skill.js";
import { Primitives } from "../src/module/charter/domain/models/primitive/primitive.js";
import { ClaudeProjection } from "../src/module/charter/infra/claude/claude-projection.adapter.js";
import { CodexProjection } from "../src/module/charter/infra/codex/codex-projection.adapter.js";
import { FileCharterRepository } from "../src/module/charter/infra/file-charter.repository.js";
import { InMemoryCredentialsRepository } from "../src/module/charter/infra/in-memory/in-memory-credentials.repository.js";
import { InMemoryOAuthAuthorizer } from "../src/module/charter/infra/in-memory/in-memory-oauth-authorizer.adapter.js";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { LocalRepoManipulator } from "../src/module/charter/infra/local-repo-manipulator.adapter.js";
import { composeApplications, composeEngine, type EngineAdapters } from "../src/module/composition.js";
import { FileSessionAnalysisRepository } from "../src/module/runtime/infra/file-session-analysis.repository.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryPromptfoo } from "../src/module/runtime/infra/in-memory/in-memory-promptfoo.adapter.js";
import { InMemoryShellCommands } from "../src/module/runtime/infra/in-memory/in-memory-shell-commands.adapter.js";
import { InMemoryWorktrees } from "../src/module/runtime/infra/in-memory/in-memory-worktrees.adapter.js";
import { InMemoryClock } from "../src/module/shared/infra/in-memory/in-memory-clock.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryMcpServers } from "../src/module/shared/infra/in-memory/in-memory-mcp-servers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { FileWorkspaceSettingsRepository } from "../src/module/workspace/infra/file-workspace-settings.repository.js";
import { Commander } from "../src/presentation/cli/cli.commander.js";
import { type CommandLine, EXIT_FAILURE } from "../src/presentation/cli/commands/command.interface.js";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { answerOf, faultTextOf } from "./answer-of.js";

const repoFolder = new URL("file:///repo/");
const homeFolder = new URL("file:///home/");
const repoFileUrlOf = (path: string) => new URL(path, repoFolder).href;

const settingsText = `${JSON.stringify({ agents: ["claude"] })}\n`;
const skillTextOf = (id: string) =>
  `---\nkind: skill\nid: ${id}\ndescription: Do ${id}.\ntriggers: ["${id}"]\n---\nDo ${id}.\n`;
const vendorRecordText = `${JSON.stringify({ charter: "grill", source: "mattpocock/skills", version: "v1.0.0" })}\n`;

/** A repository holding charters `sdd` and `baseline`, each authored with a
 *  skill, and `grill`, installed with one. */
const filesInThreeCharters = {
  [repoFileUrlOf(".cw/settings.json")]: settingsText,
  [repoFileUrlOf(".cw/charter/sdd/primitive/skill/sdd-plan/index.md")]: skillTextOf("sdd-plan"),
  [repoFileUrlOf(".cw/charter/baseline/primitive/skill/baseline-check/index.md")]: skillTextOf("baseline-check"),
  [repoFileUrlOf(".cw/charter/grill/primitive/skill/grill-me/index.md")]: skillTextOf("grill-me"),
  [repoFileUrlOf(".cw/charter/grill/cw-vendor.json")]: vendorRecordText,
};

/** Every adapter that would reach past memory, held in memory, over `files`. */
function adaptersInMemory(files: Readonly<Record<string, string>>) {
  const fileReader = new InMemoryFileReaders(files);
  const fileWriter = new InMemoryFileOutput(fileReader);
  return {
    fileReader,
    fileWriter,
    sourceFetcher: new InMemorySources(fileReader),
    worktreeKeeper: new InMemoryWorktrees(fileReader),
    credentialsRepository: new InMemoryCredentialsRepository(),
    oauthAuthorizer: new InMemoryOAuthAuthorizer(),
    tokenCounter: new InMemoryTokenCounter(),
    shell: new InMemoryShellCommands({}),
    progressReporter: new InMemoryReporter(),
    mcpServerCaller: new InMemoryMcpServers(),
    clock: new InMemoryClock(new Date("2026-11-18T00:00:00Z")),
    promptfooRunner: new InMemoryPromptfoo(),
  };
}

/** The engine's plugin over the adapters held in memory, as main.ts composes
 *  it but for the agents' command lines. */
function pluginsInMemory(adapters: ReturnType<typeof adaptersInMemory>): EngineAdapters {
  return {
    ...adapters,
    agentProvider: {
      claude: { projection: new ClaudeProjection(adapters.fileReader), agentCli: new InMemoryAgentCli() },
      codex: { projection: new CodexProjection(adapters.fileReader), agentCli: new InMemoryAgentCli() },
    },
    charterRepository: new FileCharterRepository(adapters.fileReader, adapters.fileWriter, adapters.sourceFetcher),
    sessionAnalysisRepository: new FileSessionAnalysisRepository(
      (rootFolder) => new InMemoryFileReaders({}, rootFolder),
      repoFolder,
      homeFolder,
    ),
    workspaceSettingsRepository: new FileWorkspaceSettingsRepository(adapters.fileReader, adapters.fileWriter),
    localOutput: new LocalRepoManipulator(adapters.fileReader, adapters.fileWriter),
  };
}

/** What one command line run over the adapters printed to each stream, and
 *  its exit status. */
async function problemPrintedBy(adapters: ReturnType<typeof adaptersInMemory>, argv: readonly string[]) {
  const commandLine: CommandLine = {
    cwd: "/repo",
    version: "0.0.0",
    composeApplications: () => composeApplications(repoFolder, homeFolder, pluginsInMemory(adapters)),
  };
  const stdoutTexts: string[] = [];
  const stderrTexts: string[] = [];
  const originalWriteByStream = { out: process.stdout.write, err: process.stderr.write };
  process.stdout.write = ((text: string) => (stdoutTexts.push(String(text)), true)) as typeof originalWriteByStream.out;
  process.stderr.write = ((text: string) => (stderrTexts.push(String(text)), true)) as typeof originalWriteByStream.err;
  try {
    return {
      code: await new Commander(commandLine, COMMANDS).runCommandLine(argv),
      outputText: stdoutTexts.join(""),
      problem: stderrTexts.join(""),
    };
  } finally {
    process.stdout.write = originalWriteByStream.out;
    process.stderr.write = originalWriteByStream.err;
  }
}

const engineOver = (adapters: ReturnType<typeof adaptersInMemory>) =>
  composeEngine({ agents: ["claude"] }, pluginsInMemory(adapters));

test("a build at the root holds every charter's primitives, and every agent chosen is offered each charter's skills (VENDOR Story 3 scenario 1)", async () => {
  const adapters = adaptersInMemory(filesInThreeCharters);

  answerOf(
    await composeEngine({ agents: ["claude", "codex"] }, pluginsInMemory(adapters)).charterBuildingApp.buildCharter(),
  );

  for (const skillId of ["sdd-plan", "baseline-check", "grill-me"]) {
    assert.ok(await adapters.fileReader.readIfThere(`.cw/out/skill/${skillId}/index.md`), `no compiled ${skillId}`);
    assert.ok(await adapters.fileReader.readIfThere(`.claude/skills/${skillId}/SKILL.md`), `no claude file ${skillId}`);
    assert.ok(await adapters.fileReader.readIfThere(`.agents/skills/${skillId}/SKILL.md`), `no codex file ${skillId}`);
  }
});

test("a charter holding a cw-vendor.json is read as installed, and editing or removing its primitives is refused (VENDOR Story 3 scenario 2)", async () => {
  const adapters = adaptersInMemory(filesInThreeCharters);
  const { charterAuthoringApp } = engineOver(adapters);

  const grillPrimitive = answerOf(await charterAuthoringApp.openPrimitive("grill-me")).data;
  const sddPrimitive = answerOf(await charterAuthoringApp.openPrimitive("sdd-plan")).data;
  assert.equal(grillPrimitive.layerName, "vendor");
  assert.equal(sddPrimitive.layerName, "repo");

  assert.match(
    faultTextOf(
      await charterAuthoringApp.rewritePrimitive("grill-me", grillPrimitive.headers, "Changed.", grillPrimitive.hash),
    ),
    /read-only/,
  );
  assert.match(faultTextOf(await charterAuthoringApp.removePrimitive("grill-me")), /read-only/);
  const { code, problem } = await problemPrintedBy(adapters, ["edit", "grill-me"]);
  assert.equal(code, EXIT_FAILURE);
  assert.match(problem, /installed/);
  assert.equal(
    await adapters.fileReader.readIfThere(".cw/charter/grill/primitive/skill/grill-me/index.md"),
    skillTextOf("grill-me"),
  );
});

test("a cw-vendor.json that does not read is refused, naming the file (VENDOR Story 3 scenario 2)", async () => {
  const adapters = adaptersInMemory({
    ...filesInThreeCharters,
    [repoFileUrlOf(".cw/charter/grill/cw-vendor.json")]: "{ not json",
  });

  const buildAnswer = await engineOver(adapters).charterBuildingApp.buildCharter();

  assert.match(faultTextOf(buildAnswer), /charter\/grill\/cw-vendor\.json/);
});

test("one id held in two charters is refused naming both files (VENDOR Story 3 scenario 3)", async () => {
  const adapters = adaptersInMemory({
    ...filesInThreeCharters,
    [repoFileUrlOf(".cw/charter/baseline/primitive/skill/sdd-plan/index.md")]: skillTextOf("sdd-plan"),
  });

  const diagnosis = JSON.stringify(await engineOver(adapters).charterBuildingApp.diagnoseCharter());

  assert.match(diagnosis, /charter\/sdd\/primitive\/skill\/sdd-plan\/index\.md/);
  assert.match(diagnosis, /charter\/baseline\/primitive\/skill\/sdd-plan\/index\.md/);
});

test("a primitive right under its kind's folder, test or eval cases right under the charter, or a vendor under vendor/, refuse every command, naming the move into a named charter (VENDOR Story 3 scenarios 4 and 7)", async () => {
  for (const oldLayoutPath of [
    ".cw/charter/primitive/guide/kept-guide/index.md",
    ".cw/charter/test/kept.json",
    ".cw/charter/eval/kept.json",
    ".cw/charter/vendor/team/rules/root/primitive/guide/kept-guide/index.md",
    ".cw/vendor/team/rules/root/primitive/guide/kept-guide/index.md",
  ]) {
    const adapters = adaptersInMemory({ ...filesInThreeCharters, [repoFileUrlOf(oldLayoutPath)]: "kept\n" });
    for (const argv of [["build"], ["list"], ["add", "guide", "no-any", "--charter=sdd"]]) {
      const { code, problem } = await problemPrintedBy(adapters, argv);
      assert.equal(code, EXIT_FAILURE, `${oldLayoutPath}: ${argv.join(" ")}`);
      assert.match(problem, /laid out the old way/, `${oldLayoutPath}: ${argv.join(" ")}`);
      assert.match(problem, /named charter/, `${oldLayoutPath}: ${argv.join(" ")}`);
      // The fix names the folder of vendors this repository holds, never another.
      const oldVendorsFolderPath = /^(\.cw\/(?:charter\/)?vendor)\//.exec(oldLayoutPath)?.[1];
      if (oldVendorsFolderPath !== undefined)
        assert.ok(problem.includes(`delete each vendor under ${oldVendorsFolderPath}/ `), problem);
    }
    assert.equal(await adapters.fileReader.readIfThere(".cw/charter/sdd/primitive/guide/no-any/index.md"), undefined);
  }
});

test("following /cw-author moves a repository laid out the old way into the charter the developer names, has each vendor installed again, and the repository builds (VENDOR Story 3 scenario 5)", async () => {
  const skillBody = new CwAuthorSkill().body;
  assert.match(skillBody, /ask\s+the developer which charter/);
  assert.match(skillBody, /vendor[\s\S]*never moved[\s\S]*delete the folder[\s\S]*installed again with the latest cw/);
  // The developer answers `team`.
  const movedPathPairs = [...skillBody.matchAll(/^- `([^`]+)` → `([^`]+)`/gm)].flatMap(([, oldPath, newPath]) =>
    oldPath!.includes("<kind>")
      ? Primitives.kinds.map(
          (kind) =>
            [oldPath!.replace("<kind>", kind), newPath!.replace("<kind>", kind).replace("<charter>", "team")] as const,
        )
      : [[oldPath!, newPath!.replace("<charter>", "team")] as const],
  );
  const filesLaidOutTheOldWay = {
    ".cw/settings.json": settingsText,
    ".cw/charter/primitive/skill/sdd-plan/index.md": skillTextOf("sdd-plan"),
    ".cw/charter/test/kept.json": `${JSON.stringify({ cases: [{ do: { prompt: "sdd-plan" }, expect: { activate: "sdd-plan" } }] })}\n`,
    ".cw/charter/vendor/team/rules/root/primitive/skill/grill-me/index.md": skillTextOf("grill-me"),
  };
  assert.equal(
    (
      await problemPrintedBy(
        adaptersInMemory(
          Object.fromEntries(Object.entries(filesLaidOutTheOldWay).map(([path, text]) => [repoFileUrlOf(path), text])),
        ),
        ["build"],
      )
    ).code,
    EXIT_FAILURE,
  );

  const movedFiles = Object.fromEntries(
    Object.entries(filesLaidOutTheOldWay)
      .filter(([filePath]) => !filePath.startsWith(".cw/charter/vendor/"))
      .map(([filePath, contents]) => {
        const movedPathPair = movedPathPairs.find(([oldPath]) => filePath.startsWith(oldPath));
        return [
          repoFileUrlOf(
            movedPathPair === undefined ? filePath : `${movedPathPair[1]}${filePath.slice(movedPathPair[0].length)}`,
          ),
          contents,
        ];
      }),
  );
  assert.deepEqual(Object.keys(movedFiles).sort(), [
    repoFileUrlOf(".cw/charter/team/primitive/skill/sdd-plan/index.md"),
    repoFileUrlOf(".cw/charter/team/test/kept.json"),
    repoFileUrlOf(".cw/settings.json"),
  ]);
  answerOf(await engineOver(adaptersInMemory(movedFiles)).charterBuildingApp.buildCharter());
});

const guideTextOf = (id: string) =>
  `---\nkind: guide\nid: ${id}\ndescription: Keep ${id}.\nglobs: ["src/**"]\n---\nKeep ${id}.\n`;
const testSuiteTextOf = (guideId: string) =>
  `${JSON.stringify({ cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: guideId } }] })}\n`;
const evalSuiteTextOf = (skillId: string) =>
  `${JSON.stringify({ cases: [{ prompt: skillId, expect: { invoke: skillId } }] })}\n`;

/** Charters `sdd` and `baseline`, each holding a skill, test cases and eval
 *  cases. */
const filesInTwoTestedCharters = {
  [repoFileUrlOf(".cw/settings.json")]: settingsText,
  [repoFileUrlOf(".cw/charter/sdd/primitive/skill/sdd-plan/index.md")]: skillTextOf("sdd-plan"),
  [repoFileUrlOf(".cw/charter/sdd/primitive/guide/sdd-guide/index.md")]: guideTextOf("sdd-guide"),
  [repoFileUrlOf(".cw/charter/sdd/test/plan.json")]: testSuiteTextOf("sdd-guide"),
  [repoFileUrlOf(".cw/charter/sdd/eval/plan.json")]: evalSuiteTextOf("sdd-plan"),
  [repoFileUrlOf(".cw/charter/baseline/primitive/skill/baseline-check/index.md")]: skillTextOf("baseline-check"),
  [repoFileUrlOf(".cw/charter/baseline/primitive/guide/baseline-guide/index.md")]: guideTextOf("baseline-guide"),
  [repoFileUrlOf(".cw/charter/baseline/test/check.json")]: testSuiteTextOf("baseline-guide"),
  [repoFileUrlOf(".cw/charter/baseline/eval/check.json")]: evalSuiteTextOf("baseline-check"),
};

/** The suite each case of a run reported came from, each named once; a run
 *  answered as faults fails the test with them. */
const suiteNamesOf = (
  runReport: { readonly data: object },
  caseReportsField: "testCaseReports" | "evalCaseReports",
) => {
  const caseReports = (runReport.data as Record<string, unknown>)[caseReportsField];
  assert.ok(Array.isArray(caseReports), JSON.stringify(runReport));
  return [...new Set(caseReports.map(({ data: { suiteName } }: { data: { suiteName: string } }) => suiteName))].sort();
};

test("cw test with no --charter runs every case of every charter (VENDOR Story 3 scenario 24)", async () => {
  const testRunReport = answerOf(
    await engineOver(adaptersInMemory(filesInTwoTestedCharters)).charterAuthoringApp.testCharter(),
  );

  assert.deepEqual(suiteNamesOf(testRunReport, "testCaseReports"), ["baseline/check.json", "sdd/plan.json"]);
});

test("cw test --charter=sdd runs only sdd's cases (VENDOR Story 3 scenario 25)", async () => {
  const adapters = adaptersInMemory(filesInTwoTestedCharters);
  const testRunReport = answerOf(await engineOver(adapters).charterAuthoringApp.testCharter("sdd"));
  assert.deepEqual(suiteNamesOf(testRunReport, "testCaseReports"), ["sdd/plan.json"]);

  const { code, outputText } = await problemPrintedBy(adapters, ["test", "--charter=sdd"]);
  assert.equal(code, 0);
  assert.match(outputText, /activates sdd-guide/);
  assert.doesNotMatch(outputText, /baseline-guide/);
});

test("cw test and cw eval with --charter naming an installed charter run its cases alone (VENDOR-FR-024, VENDOR-FR-025)", async () => {
  const filesWithBaselineInstalled = {
    ...filesInTwoTestedCharters,
    [repoFileUrlOf(".cw/charter/baseline/cw-vendor.json")]:
      `${JSON.stringify({ charter: "baseline", source: "acme/charters", version: "v1" })}\n`,
  };
  const adapters = adaptersInMemory(filesWithBaselineInstalled);
  adapters.promptfooRunner.workingFolderFileReaders = adapters.fileReader;
  const { charterAuthoringApp, charterRuntimeApp } = engineOver(adapters);

  const testRunReport = answerOf(await charterAuthoringApp.testCharter("baseline"));
  assert.deepEqual(suiteNamesOf(testRunReport, "testCaseReports"), ["baseline/check.json"]);
  const evalRunReport = answerOf(await charterRuntimeApp.evaluateCharter(undefined, "baseline"));
  assert.deepEqual(suiteNamesOf(evalRunReport, "evalCaseReports"), ["baseline/check.json"]);
});

test("cw eval runs every charter's cases, and with --charter=sdd sdd's alone, each at the repository's root (VENDOR Story 3 scenario 26)", async () => {
  const everyCharterAdapters = adaptersInMemory(filesInTwoTestedCharters);
  everyCharterAdapters.promptfooRunner.workingFolderFileReaders = everyCharterAdapters.fileReader;
  const everyCharterReport = answerOf(await engineOver(everyCharterAdapters).charterRuntimeApp.evaluateCharter());
  assert.deepEqual(suiteNamesOf(everyCharterReport, "evalCaseReports"), ["baseline/check.json", "sdd/plan.json"]);

  const oneCharterAdapters = adaptersInMemory(filesInTwoTestedCharters);
  oneCharterAdapters.promptfooRunner.workingFolderFileReaders = oneCharterAdapters.fileReader;
  const oneCharterReport = answerOf(
    await engineOver(oneCharterAdapters).charterRuntimeApp.evaluateCharter(undefined, "sdd"),
  );
  assert.deepEqual(suiteNamesOf(oneCharterReport, "evalCaseReports"), ["sdd/plan.json"]);
  // Each case's working copy is a worktree of the repository, its root.
  for (const { workingPath } of oneCharterAdapters.promptfooRunner.evaluatedTests)
    assert.match(workingPath, /^\.cw\/log\/eval\/worktrees\/[^/]+$/);
});

test("--charter naming no charter held refuses cw test and cw eval, naming the charters held, and nothing runs (VENDOR Story 3 scenario 27)", async () => {
  const adapters = adaptersInMemory(filesInTwoTestedCharters);
  adapters.promptfooRunner.workingFolderFileReaders = adapters.fileReader;
  for (const argv of [
    ["test", "--charter=nothing-here"],
    ["eval", "--charter=nothing-here"],
  ]) {
    const { code, problem } = await problemPrintedBy(adapters, argv);
    assert.equal(code, EXIT_FAILURE, argv.join(" "));
    assert.match(problem, /nothing-here/, argv.join(" "));
    assert.match(problem, /baseline, sdd/, argv.join(" "));
  }
  assert.deepEqual(adapters.promptfooRunner.evaluatedTests, []);
});

test("a suite command names its charter with --charter, and with none takes the one charter the repository authored, else is refused naming the charters held (VENDOR Story 3 scenario 24)", async () => {
  const oneCharterAdapters = adaptersInMemory({
    [repoFileUrlOf(".cw/settings.json")]: settingsText,
    [repoFileUrlOf(".cw/charter/sdd/primitive/skill/sdd-plan/index.md")]: skillTextOf("sdd-plan"),
  });
  assert.equal((await problemPrintedBy(oneCharterAdapters, ["suite", "add"])).code, 0);
  assert.ok(await oneCharterAdapters.fileReader.readIfThere(".cw/charter/sdd/test/untitled-1.json"));
  assert.equal((await problemPrintedBy(oneCharterAdapters, ["suite", "remove", "untitled-1.json"])).code, 0);
  assert.equal(await oneCharterAdapters.fileReader.readIfThere(".cw/charter/sdd/test/untitled-1.json"), undefined);

  const twoCharterAdapters = adaptersInMemory(filesInTwoTestedCharters);
  const { code, problem } = await problemPrintedBy(twoCharterAdapters, ["suite", "add"]);
  assert.equal(code, EXIT_FAILURE);
  assert.match(problem, /baseline, sdd/);
  assert.equal((await problemPrintedBy(twoCharterAdapters, ["suite", "add", "--charter=baseline"])).code, 0);
  assert.ok(await twoCharterAdapters.fileReader.readIfThere(".cw/charter/baseline/test/untitled-1.json"));
  assert.equal((await problemPrintedBy(twoCharterAdapters, ["suite", "remove", "plan.json", "--charter=sdd"])).code, 0);
  assert.equal(await twoCharterAdapters.fileReader.readIfThere(".cw/charter/sdd/test/plan.json"), undefined);
});
