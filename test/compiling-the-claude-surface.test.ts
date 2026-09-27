import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCharterRoot } from "../src/hexagon/service/charterRepo.js";
import { folderURL } from "../src/hexagon/domain/path.js";
import { compile } from "../src/hexagon/domain/services/compileService.js";
import { putDownBy } from "./put-down-by.js";
import type { AgentProvider } from "../src/hexagon/domain/models/AgentProvider.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";

import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";

const CLAUDE: AgentProvider = "claude";
const repo = new URL("file:///repo");
const root = folderURL("file:///repo/.cw/charter/");
const vendorRoot = folderURL("file:///repo/.cw/vendor/");

const primitive = (kind: string, id: string, body: string, headers: readonly string[] = []) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: What ${id} is for, in one line.`, ...headers, "---", "", body, ""].join(
    "\n",
  );

const at = (path: string) => new URL(path, root).href;
const vendored = (path: string) => new URL(`acme/${path}`, vendorRoot).href;

const load = (files: Readonly<Record<string, string>>, held = new InMemoryFileReaders(files)) =>
  loadCharterRoot(repo, held, new YamlParser());

/** Everything this charter is put down as, under the path each file was written
 *  at. */
const putDown = async (files: Readonly<Record<string, string>>, agents: readonly AgentProvider[] = [CLAUDE]) => {
  const held = new InMemoryFileReaders(files);
  const charter = await load(files, held);
  const written = await putDownBy(repo, compile(charter, agents), agents, held);

  return Object.fromEntries(
    await Promise.all(written.map(async (path) => [path, await held.read(new URL(path, repo))] as const)),
  ) as Readonly<Record<string, string>>;
};

/** Everything of it that lands in claude's own directory. */
const projected = async (files: Readonly<Record<string, string>>) =>
  Object.fromEntries(Object.entries(await putDown(files)).filter(([path]) => path.startsWith(".claude/")));

/** Where the skill the engine brings lands on this host: every charter holds
 *  it, so every projection has it (FR-021). */
const builtinSkill = ".claude/skills/skill-cw-author/SKILL.md";

const aCommand = {
  [at("command/ship.md")]: primitive("command", "ship", "Run the build, then push."),
};

test("each charter kind this host has a kind for lands where that host reads it (FR-018)", async () => {
  const files = await projected({
    ...aCommand,
    [at("agent/reviewer.md")]: primitive("agent", "reviewer", "Review the diff.", ['tools: ["Read", "Grep"]']),
    [at("skill/refactoring.md")]: primitive("skill", "refactoring", "How this repository refactors.", [
      'triggers: ["a refactor is asked for"]',
    ]),
    [at("guide/no-any.md")]: primitive("guide", "no-any", "Never write `any`.", ['globs: ["src/**/*.ts"]']),
    [at("playbook/release.md")]: primitive("playbook", "release", "How a release runs.", ['triggers: ["a release"]']),
    [at("sensor/ci-failed.md")]: primitive("sensor", "ci-failed", "CI went red.", ["signal: PostToolUse", "run: ./bin/report-ci"]),
    [at("posture/sandboxed.md")]: primitive("posture", "sandboxed", "What may be run unattended.", [
      'allow: ["Read(**)"]',
      'deny: ["Bash(rm:*)"]',
    ]),
  });

  assert.deepEqual(Object.keys(files).sort(), [
    ".claude/agents/agent-reviewer.md",
    ".claude/commands/ship.md",
    ".claude/rules/guide-no-any.md",
    ".claude/settings.json",
    ".claude/skills/playbook-release/SKILL.md",
    builtinSkill,
    ".claude/skills/skill-refactoring/SKILL.md",
  ]);
});

test("a guide becomes a rule, and the files it speaks about are the paths that load it (FR-013)", async () => {
  const files = await projected({
    [at("guide/no-any.md")]: primitive("guide", "no-any", "Never write `any`.", [
      'globs: ["src/**/*.ts", "test/**/*.ts"]',
    ]),
  });

  const contents = files[".claude/rules/guide-no-any.md"] ?? "";
  assert.ok(contents.includes('---\npaths: ["src/**/*.ts", "test/**/*.ts"]\n---'), contents);
  assert.ok(contents.includes("## guide:no-any"));
  assert.ok(contents.includes("Never write `any`."));
});

test("a guide that names no files is a rule with no paths, loaded every session (FR-013)", async () => {
  const files = await projected({
    [at("guide/small-diffs.md")]: primitive("guide", "small-diffs", "Keep each change small."),
  });

  const carried = files[".claude/rules/guide-small-diffs.md"] ?? "";
  assert.ok(carried.includes("## guide:small-diffs"));
  assert.ok(carried.includes("Keep each change small."));
  assert.ok(!carried.includes("paths:"));
});

test("a guide and a skill of the same id stay two files", async () => {
  const files = await projected({
    [at("guide/review.md")]: primitive("guide", "review", "Ours as a rule.", ['globs: ["src/**/*.ts"]']),
    [at("skill/review.md")]: primitive("skill", "review", "Ours as know-how.", ['triggers: ["a review"]']),
  });

  assert.deepEqual(Object.keys(files).sort(), [
    ".claude/rules/guide-review.md",
    builtinSkill,
    ".claude/skills/skill-review/SKILL.md",
  ]);
});

test("an id holding / names a host file with it written as -, a command's too (FR-141)", async () => {
  const files = await projected({
    [at("command/release/ship.md")]: primitive("command", "release/ship", "Run the build, then push."),
    [at("skill/mfbs/refactoring.md")]: primitive("skill", "mfbs/refactoring", "How this team refactors.", ['triggers: ["a refactor"]']),
  });

  assert.ok(".claude/commands/release-ship.md" in files);
  assert.ok(".claude/skills/skill-mfbs-refactoring/SKILL.md" in files);
});

test("the kinds this host has no kind for project nothing: they are read from the charter", async () => {
  const files = await projected({
    [at("corpus/type-safety.md")]: primitive("corpus", "type-safety", "Why types are kept tight."),
    [at("mixin/house-style.md")]: primitive("mixin", "house-style", "Write plainly."),
  });

  assert.deepEqual(Object.keys(files), [builtinSkill]);
});

test("a compiled file carries the body, which is what the catalogues do not (FR-018)", async () => {
  const files = await projected(aCommand);

  assert.ok(files[".claude/commands/ship.md"]?.includes("Run the build, then push."));
});

test("a compiled file says this engine wrote it, so an edit goes to the charter (FR-020)", async () => {
  const files = await projected(aCommand);

  assert.ok(
    files[".claude/commands/ship.md"]?.includes(
      "<!-- Generated by cherry-works. Do not edit; edit the charter and build again. -->",
    ),
  );
});

test("a role carries the tools it may use, on the one line claude reads them from", async () => {
  const files = await projected({
    [at("agent/reviewer.md")]: primitive("agent", "reviewer", "Review the diff.", ['tools: ["Read", "Grep", "Bash"]']),
  });

  const contents = files[".claude/agents/agent-reviewer.md"] ?? "";
  assert.ok(contents.includes("\ntools: Read, Grep, Bash\n"));
  assert.ok(contents.includes("\nname: agent-reviewer\n"));
});

test("a skill says its triggers in the description, which is what decides it is loaded", async () => {
  const files = await projected({
    [at("skill/refactoring.md")]: primitive("skill", "refactoring", "How this repository refactors.", [
      'triggers: ["a refactor is asked for", "a file is split"]',
    ]),
  });

  assert.ok(
    files[".claude/skills/skill-refactoring/SKILL.md"]?.includes(
      // Quoted, because `: ` inside a plain value is a second mapping to YAML.
      'description: "What refactoring is for, in one line. Use when: a refactor is asked for; a file is split."',
    ),
  );
});

test("a sensor compiles to a hook this host runs: the event, and the command (FR-004)", async () => {
  const files = await projected({
    [at("sensor/ci-failed.md")]: primitive("sensor", "ci-failed", "Look at the failing job first.", [
      "signal: PostToolUse",
      "run: ./bin/report-ci",
    ]),
  });

  assert.deepEqual(Object.keys(files), [".claude/settings.json", builtinSkill]);
  assert.deepEqual(JSON.parse(files[".claude/settings.json"] ?? ""), {
    hooks: { PostToolUse: [{ hooks: [{ type: "command", command: "./bin/report-ci" }] }] },
  });
});

test("a playbook is loaded the way a skill is, since this host has one kind for both", async () => {
  const files = await projected({
    [at("playbook/release.md")]: primitive("playbook", "release", "How a release runs.", [
      'triggers: ["a release is cut"]',
    ]),
  });

  assert.ok(
    files[".claude/skills/playbook-release/SKILL.md"]?.includes(
      'description: "What release is for, in one line. Use when: a release is cut."',
    ),
  );
});

test("a posture compiles to the settings this host enforces, as JSON (FR-018)", async () => {
  const files = await projected({
    [at("posture/sandboxed.md")]: primitive("posture", "sandboxed", "What may be run unattended.", [
      'allow: ["Read(**)", "Grep(**)"]',
      'deny: ["Bash(rm:*)"]',
    ]),
  });

  assert.deepEqual(JSON.parse(files[".claude/settings.json"] ?? ""), {
    permissions: { allow: ["Read(**)", "Grep(**)"], deny: ["Bash(rm:*)"] },
  });
});

test("every posture lands in the one file this host reads its settings from", async () => {
  const files = await projected({
    [at("posture/sandboxed.md")]: primitive("posture", "sandboxed", "Unattended.", [
      'allow: ["Read(**)"]',
      'deny: ["Bash(rm:*)"]',
    ]),
    [at("posture/no-network.md")]: primitive("posture", "no-network", "Nothing leaves the machine.", [
      'allow: ["Read(**)"]',
      'deny: ["WebFetch"]',
    ]),
  });

  // Two postures, one file: what both of them ask for, read together, each thing
  // once — and in the order their files sort in (SC-007).
  assert.deepEqual(Object.keys(files), [".claude/settings.json", builtinSkill]);
  assert.deepEqual(JSON.parse(files[".claude/settings.json"] ?? "").permissions, {
    allow: ["Read(**)"],
    deny: ["WebFetch", "Bash(rm:*)"],
  });
});

test("a mixin's body is written before its host's, which is the one place a mixin applies (FR-006)", async () => {
  const files = await projected({
    [at("mixin/house-style.md")]: primitive("mixin", "house-style", "Write plainly."),
    [at("mixin/no-jargon.md")]: primitive("mixin", "no-jargon", "No jargon."),
    [at("command/ship.md")]: primitive("command", "ship", "Run the build, then push.", [
      'mixins: ["house-style", "no-jargon"]',
    ]),
  });

  const contents = files[".claude/commands/ship.md"] ?? "";
  assert.ok(contents.indexOf("Write plainly.") < contents.indexOf("No jargon."));
  assert.ok(contents.indexOf("No jargon.") < contents.indexOf("Run the build, then push."));
});

test("nothing is compiled for an agent that was not named as installed", async () => {
  const files = await putDown(aCommand, []);

  assert.deepEqual(Object.keys(files), [
    ".cw/out/catalog.json",
    ".cw/out/catalog.min.json",
    ".cw/out/CHARTER.md",
    ".cw/out/command/ship.md",
    ".cw/out/skill/cw-author.md",
  ]);
});

test("a guide's rule has the mixins it pulls in already written into it (FR-006)", async () => {
  const files = await projected({
    [at("mixin/house-style.md")]: primitive("mixin", "house-style", "Write plainly."),
    [at("guide/no-any.md")]: primitive("guide", "no-any", "Never write `any`.", [
      'globs: ["src/**/*.ts"]',
      'mixins: ["house-style"]',
    ]),
  });

  const carried = files[".claude/rules/guide-no-any.md"] ?? "";
  assert.ok(carried.indexOf("Write plainly.") < carried.indexOf("Never write `any`."));
});

test("a charter with no guide carries no rule at all (SC-005)", async () => {
  const files = await projected(aCommand);

  assert.deepEqual(
    Object.keys(files).filter((path) => path.startsWith(".claude/rules/")),
    [],
  );
});
