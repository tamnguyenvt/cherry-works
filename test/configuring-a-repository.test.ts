import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSettings } from "../src/hexagon/service/settingsRepo.js";
import { SettingsFault } from "../src/hexagon/domain/models/DomainFault.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";

const repo = new URL("file:///repo/");
const file = new URL(".cw/settings.json", repo).href;

const holding = (contents: string) => new InMemoryFileReaders({ [file]: contents });

/** What reading these settings raised, for a test that is about the fault. */
const refusing = async (contents: string) => {
  const raised = await loadSettings(repo, holding(contents)).then(
    () => undefined,
    (fault: SettingsFault) => fault,
  );
  assert.ok(raised instanceof SettingsFault, "reading settings that do not read raises");
  assert.ok(raised.fix, "and says what to do about it");
  return raised;
};

test("what a repository answered at setup is read from its own settings", async () => {
  const settings = await loadSettings(repo, holding(`${JSON.stringify({ agents: ["claude"] })}\n`));

  assert.deepEqual(settings.agents, ["claude"]);
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

test("the repository is what is asked, whether or not it was named as a directory", async () => {
  const settings = await loadSettings(new URL("file:///repo"), holding(`${JSON.stringify({ agents: ["claude"] })}\n`));

  assert.deepEqual(settings.agents, ["claude"]);
});

test("a session mark that is no whole number above 0 is refused, naming the field (EVAL-FR-010)", async () => {
  const settingsFault = await refusing(`${JSON.stringify({ agents: ["claude"], sessionContextMark: -5 })}\n`);

  assert.match(settingsFault.message, /"sessionContextMark"/);
  assert.match(settingsFault.fix ?? "", /100000/);
});

test("a session analysis folder that is no absolute path or path under ~/ is refused, naming the field (EVAL-FR-009)", async () => {
  const settingsFault = await refusing(`${JSON.stringify({ agents: ["claude"], sessionAnalysisFolder: "logs/sessions" })}\n`);

  assert.match(settingsFault.message, /"sessionAnalysisFolder"/);
});
