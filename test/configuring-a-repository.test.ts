import assert from "node:assert/strict";
import { test } from "node:test";
import type { FaultDTOs } from "../src/module/shared/app/port/in/fault.dto.js";
import { AgentProvider } from "../src/module/shared/domain/models/agent/agent-provider.value-object.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { answerOf } from "./answer-of.js";
import { workspaceAppOf } from "./use-cases-of.js";

const repo = new URL("file:///repo/");
const file = new URL(".cw/settings.json", repo).href;

const holding = (contents: string) => new InMemoryFileReaders({ [file]: contents });
/** The settings a repository holding these files has, as the workspace module answers them (CORE-FR-231). */
const loadSettingsHeldIn = async (fileReaders: InMemoryFileReaders) =>
  workspaceAppOf(fileReaders).readWorkspaceSettings();

/** What reading these settings raised, for a test that is about the fault. */
const refusing = async (contents: string) => {
  const settingsDTO = await loadSettingsHeldIn(holding(contents));
  assert.equal(settingsDTO.type, "Fault", "reading settings that do not read is refused");
  const raised = (settingsDTO as FaultDTOs.Fault).data;
  assert.equal(raised.name, "InvalidSettingsFault");
  assert.ok(raised.fix, "and says what to do about it");
  return raised;
};

test("what a repository answered at setup is read from its own settings", async () => {
  const settings = await loadSettingsHeldIn(holding(`${JSON.stringify({ agents: ["claude"] })}\n`));

  assert.deepEqual(settings.type === "WorkspaceSettings" && settings.data.agents, [new AgentProvider("claude").name]);
});

test("settings that are not JSON are refused, and the file is named", async () => {
  assert.match((await refusing("not json at all\n")).message, /not JSON/);
});

test("settings holding something other than a set of fields are refused", async () => {
  assert.match((await refusing("[]\n")).message, /other than a set of fields/);
});

test("agents written as anything but a list of names is a fault the author can act on", async () => {
  assert.match((await refusing(`${JSON.stringify({ agents: "claude" })}\n`)).message, /not a list of names/);
});

test("settings naming no agent at all are refused: setup names one (FR-033)", async () => {
  assert.match((await refusing("{}\n")).message, /not a list of names/);
});

test("an agent this engine cannot compile for is named, every unknown one at once (FR-009)", async () => {
  const raised = await refusing(`${JSON.stringify({ agents: ["nowhere", "claude", "elsewhere"] })}\n`);

  assert.match(raised.message, /"nowhere", "elsewhere"/);
  assert.match(raised.fix, /claude/);
});

test("a session mark that is no whole number above 0 is refused, naming the field (EVAL-FR-010)", async () => {
  const settingsFault = await refusing(`${JSON.stringify({ agents: ["claude"], sessionContextMark: -5 })}\n`);

  assert.match(settingsFault.message, /"sessionContextMark"/);
  assert.match(settingsFault.fix ?? "", /100000/);
});

test("a session analysis folder that is no absolute path or path under ~/ is refused, naming the field (EVAL-FR-009)", async () => {
  const settingsFault = await refusing(
    `${JSON.stringify({ agents: ["claude"], sessionAnalysisFolder: "logs/sessions" })}\n`,
  );

  assert.match(settingsFault.message, /"sessionAnalysisFolder"/);
});

test("settings hold no mark of a repository releasing charters: setup writes none, and one left from before is read past (VENDOR Story 8 scenario 3, VENDOR-FR-032)", async () => {
  const fileReaders = new InMemoryFileReaders({ [file]: `${JSON.stringify({ agents: ["claude"], vendor: true })}\n` });
  const workspaceApp = workspaceAppOf(fileReaders, new InMemoryFileOutput(fileReaders));

  const settingsDTO = answerOf(await workspaceApp.readWorkspaceSettings());
  assert.deepEqual(Object.keys(settingsDTO.data).sort(), ["agents", "isSetUp", "mainContextCeiling"]);
  answerOf(await workspaceApp.setUpWorkspace(["claude"], "0.0.0"));
  assert.deepEqual(JSON.parse(await fileReaders.readFile(new URL(file))), { agents: ["claude"] });
});

test("setup refuses no agent, an agent the engine does not compile for and a ceiling not above 0, each by its own fault, and writes nothing (FR-033, EVAL-FR-006)", async () => {
  for (const [agentNames, mainContextCeiling, faultName] of [
    [[], undefined, "NoAgentFault"],
    [["nope"], undefined, "UnknownAgentFault"],
    [["claude"], 0, "InvalidMainContextCeilingFault"],
  ] as const) {
    const fileReaders = new InMemoryFileReaders({});
    const setUpAnswer = await workspaceAppOf(fileReaders, new InMemoryFileOutput(fileReaders)).setUpWorkspace(
      agentNames,
      "0.0.0",
      mainContextCeiling,
    );

    assert.equal(setUpAnswer.type, "Fault", faultName);
    assert.equal((setUpAnswer as FaultDTOs.Fault).data.name, faultName);
    assert.deepEqual(await fileReaders.readFilesRecursively(repo), [], faultName);
  }
});
