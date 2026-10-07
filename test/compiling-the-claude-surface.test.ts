import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCharterRoot } from "../src/hexagon/service/charterRepo.js";
import { folderURL } from "../src/hexagon/domain/path.js";
import { compile } from "../src/hexagon/domain/services/compile/compileService.js";
import { shortenStringsOf } from "../src/hexagon/domain/models/helper.js";
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
  const written = await putDownBy(repo, compile(charter, agents), held);

  return Object.fromEntries(
    await Promise.all(written.map(async (path) => [path, await held.read(new URL(path, repo))] as const)),
  ) as Readonly<Record<string, string>>;
};

/** Everything of it that lands in claude's own directory. */
const projected = async (files: Readonly<Record<string, string>>) =>
  Object.fromEntries(Object.entries(await putDown(files)).filter(([path]) => path.startsWith(".claude/")));

/** Where the skills the engine brings land on this host: every charter holds
 *  them, so every projection has them (FR-021, EVAL-FR-014). */
const builtinSkill = ".claude/skills/cw-author/SKILL.md";
const cwSessionCostSkill = ".claude/skills/cw-session-cost/SKILL.md";

/** Where the sensor the engine brings lands on this host: its settings, as a
 *  Stop hook running the engine's session counter (EVAL-FR-008). Every charter
 *  holds it, so every projection has that file. */
const builtinSettings = ".claude/settings.json";
const sessionCounterStopHook = { hooks: [{ type: "command", command: 'node ".cw/out/script/cw-session-tokens-counter/sessionTokensCounter.mjs"' }] };

/** What the engine's session primitives compile to under the workspace. */
const sessionCounterPaths = [
  ".cw/out/skill/cw-session-cost/index.md",
  ".cw/out/script/cw-session-tokens-counter/index.md",
  ".cw/out/script/cw-session-tokens-counter/sessionTokensCounter.mjs",
  ".cw/out/sensor/cw-session-tokens-counter-on-stop/index.md",
];

const aRole = {
  [at("agent/ship/index.md")]: primitive("agent", "ship", "Run the build, then push.", ['tools: ["Bash"]']),
};

test("each charter kind this host has a kind for lands where that host reads it (FR-018)", async () => {
  const files = await projected({
    ...aRole,
    [at("agent/reviewer/index.md")]: primitive("agent", "reviewer", "Review the diff.", ['tools: ["Read", "Grep"]']),
    [at("skill/refactoring/index.md")]: primitive("skill", "refactoring", "How this repository refactors.", [
      'triggers: ["a refactor is asked for"]',
    ]),
    [at("guide/no-any/index.md")]: primitive("guide", "no-any", "Never write `any`.", ['globs: ["src/**/*.ts"]']),
    [at("playbook/release/index.md")]: primitive("playbook", "release", "How a release runs.", ['triggers: ["a release"]']),
    [at("sensor/ci-failed/index.md")]: primitive("sensor", "ci-failed", "CI went red.", ["signal: PostToolUse", "run: ./bin/report-ci"]),
    [at("posture/sandboxed/index.md")]: primitive("posture", "sandboxed", "What may be run unattended.", [
      'allow: ["Read(**)"]',
      'deny: ["Bash(rm:*)"]',
    ]),
  });

  assert.deepEqual(Object.keys(files).sort(), [
    ".claude/agents/reviewer.md",
    ".claude/agents/ship.md",
    ".claude/rules/no-any.md",
    ".claude/settings.json",
    builtinSkill,
    cwSessionCostSkill,
    ".claude/skills/refactoring/SKILL.md",
    ".claude/skills/release/SKILL.md",
  ]);
});

test("a guide becomes a rule, and the files it speaks about are the paths that load it (FR-013)", async () => {
  const files = await projected({
    [at("guide/no-any/index.md")]: primitive("guide", "no-any", "Never write `any`.", [
      'globs: ["src/**/*.ts", "test/**/*.ts"]',
    ]),
  });

  const contents = files[".claude/rules/no-any.md"] ?? "";
  assert.ok(contents.includes('---\npaths: ["src/**/*.ts", "test/**/*.ts"]\n---'), contents);
  // An `@` is expanded when the session opens, whatever its paths, so the
  // guide is pointed to and read only once a file it names is touched.
  assert.ok(contents.includes("Read and follow .cw/out/guide/no-any/index.md.\n"), contents);
  assert.ok(!contents.includes("@"), contents);
});

test("a guide that names no files is a rule with no paths, loaded every session (FR-013)", async () => {
  const files = await projected({
    [at("guide/small-diffs/index.md")]: primitive("guide", "small-diffs", "Keep each change small."),
  });

  const carried = files[".claude/rules/small-diffs.md"] ?? "";
  assert.ok(carried.includes("@../../.cw/out/guide/small-diffs/index.md\n"), carried);
  assert.ok(!carried.includes("paths:"));
});

test("a guide and a skill of the same id stay two files, each named by its id alone (FR-171)", async () => {
  const files = await projected({
    [at("guide/review/index.md")]: primitive("guide", "review", "Ours as a rule.", ['globs: ["src/**/*.ts"]']),
    [at("skill/review/index.md")]: primitive("skill", "review", "Ours as know-how.", ['triggers: ["a review"]']),
  });

  assert.deepEqual(Object.keys(files).sort(), [
    ".claude/rules/review.md",
    builtinSettings,
    builtinSkill,
    cwSessionCostSkill,
    ".claude/skills/review/SKILL.md",
  ]);
});

test("an id holding / names a host file with it written as -, a role's too (FR-141)", async () => {
  const files = await projected({
    [at("agent/release/ship/index.md")]: primitive("agent", "release/ship", "Run the build, then push.", ['tools: ["Bash"]']),
    [at("skill/mfbs/refactoring/index.md")]: primitive("skill", "mfbs/refactoring", "How this team refactors.", ['triggers: ["a refactor"]']),
  });

  assert.ok(".claude/agents/release-ship.md" in files);
  assert.ok(".claude/skills/mfbs-refactoring/SKILL.md" in files);
});

test("the kinds this host has no kind for project nothing: they are read from the charter", async () => {
  const files = await projected({
    [at("corpus/type-safety/index.md")]: primitive("corpus", "type-safety", "Why types are kept tight."),
    [at("mixin/house-style/index.md")]: primitive("mixin", "house-style", "Write plainly."),
  });

  assert.deepEqual(Object.keys(files), [builtinSettings, builtinSkill, cwSessionCostSkill]);
});

test("a host's document points to the compiled one, which alone carries the body (FR-018, FR-139)", async () => {
  const files = await putDown(aRole);

  const role = files[".claude/agents/ship.md"] ?? "";
  assert.ok(role.includes("Read and follow @../../.cw/out/agent/ship/index.md.\n"), role);
  assert.ok(!role.includes("Run the build, then push."));
  assert.ok(files[".cw/out/agent/ship/index.md"]?.includes("Run the build, then push."));
});

test("a skill points three folders up, from inside the folder its SKILL.md sits in (FR-139)", async () => {
  const files = await projected({
    [at("skill/review/index.md")]: primitive("skill", "review", "Review the diff.", ["triggers: [review this]"]),
  });

  assert.ok(files[".claude/skills/review/SKILL.md"]?.includes("Read and follow @../../../.cw/out/skill/review/index.md.\n"));
});

test("a compiled file says this engine wrote it, so an edit goes to the charter (FR-020)", async () => {
  const files = await projected(aRole);

  assert.ok(
    files[".claude/agents/ship.md"]?.includes(
      "<!-- Generated by cherry-works. Do not edit; edit the charter and build again. -->",
    ),
  );
});

test("a role carries the tools it may use, on the one line claude reads them from", async () => {
  const files = await projected({
    [at("agent/reviewer/index.md")]: primitive("agent", "reviewer", "Review the diff.", ['tools: ["Read", "Grep", "Bash"]']),
  });

  const contents = files[".claude/agents/reviewer.md"] ?? "";
  assert.ok(contents.includes("\ntools: Read, Grep, Bash\n"));
  assert.ok(contents.includes("\nname: reviewer\n"));
});

test("a role carries the model its charter names for this host, and none where it names none", async () => {
  const files = await projected({
    [at("agent/locator/index.md")]: primitive("agent", "locator", "Find the code.", ['tools: ["Read"]', "model: claude:haiku-4-5"]),
    [at("agent/reviewer/index.md")]: primitive("agent", "reviewer", "Review the diff.", ['tools: ["Read"]']),
  });

  assert.ok(files[".claude/agents/locator.md"]?.includes("\nmodel: haiku-4-5\n"));
  assert.ok(!files[".claude/agents/reviewer.md"]?.includes("model:"));
});

test("a role holds each mcp it lists, whole or one tool, under the name this host is given it by, and no mcp origin its body only names (FR-156)", async () => {
  const files = await projected({
    [at("mcp/linear/index.md")]: primitive("mcp", "linear", "Issues.", ["endpoint: https://mcp.linear.app/mcp", "auth: [token]", "tools: [list_issues, create_issue]"]),
    [at("mcp/github/billing/index.md")]: primitive("mcp", "github/billing", "Code.", ["endpoint: https://api.githubcopilot.com/mcp/", "auth: [oauth]", "tools: [search_code, get_file_contents]"]),
    [at("mcp/sentry/index.md")]: primitive("mcp", "sentry", "Errors.", ["endpoint: https://mcp.sentry.dev/mcp", "auth: [oauth]", "tools: [list_errors]"]),
    [at("agent/fraud-scanner/index.md")]: primitive("agent", "fraud-scanner", "Read the issues, and the errors in [[sentry]].", [
      'tools: ["Read", "[[linear]]", "[[github/billing]]:search_code"]',
    ]),
  });

  const servedNames = shortenStringsOf(["linear", "github/billing", "sentry"]);
  const contents = files[".claude/agents/fraud-scanner.md"] ?? "";
  assert.ok(
    contents.includes(
      `\ntools: Read, mcp__cw__${servedNames["linear"]}__list_issues, mcp__cw__${servedNames["linear"]}__create_issue, mcp__cw__${servedNames["github/billing"]}__search_code\n`,
    ),
    contents,
  );
  assert.ok(!contents.includes(`${servedNames["sentry"]}__`));
});

test("a charter reaching an mcp origin turns the host's own tool search on, and one reaching none leaves the settings alone (EVAL-FR-016)", async () => {
  const reachingFiles = await projected({
    [at("mcp/linear/index.md")]: primitive("mcp", "linear", "Issues.", ["endpoint: https://mcp.linear.app/mcp", "auth: [token]", "tools: [list_issues]"]),
  });
  const reachingNoneFiles = await projected({ [at("skill/refactoring/index.md")]: primitive("skill", "refactoring", "How this repository refactors.", []) });

  assert.deepEqual(JSON.parse(reachingFiles[".claude/settings.json"] ?? "{}").env, { ENABLE_TOOL_SEARCH: "true" });
  assert.equal(JSON.parse(reachingNoneFiles[".claude/settings.json"] ?? "{}").env, undefined);
});

test("a skill says its triggers in the description, which is what decides it is loaded", async () => {
  const files = await projected({
    [at("skill/refactoring/index.md")]: primitive("skill", "refactoring", "How this repository refactors.", [
      'triggers: ["a refactor is asked for", "a file is split"]',
    ]),
  });

  assert.ok(
    files[".claude/skills/refactoring/SKILL.md"]?.includes(
      // Quoted, because `: ` inside a plain value is a second mapping to YAML.
      'description: "What refactoring is for, in one line. Use when: a refactor is asked for; a file is split."',
    ),
  );
});

test("a sensor compiles to a hook this host runs: the event, and the command (FR-004)", async () => {
  const files = await projected({
    [at("sensor/ci-failed/index.md")]: primitive("sensor", "ci-failed", "Look at the failing job first.", [
      "signal: PostToolUse",
      "run: ./bin/report-ci",
    ]),
  });

  assert.deepEqual(Object.keys(files), [".claude/settings.json", builtinSkill, cwSessionCostSkill]);
  assert.deepEqual(JSON.parse(files[".claude/settings.json"] ?? ""), {
    hooks: { PostToolUse: [{ hooks: [{ type: "command", command: "./bin/report-ci" }] }], Stop: [sessionCounterStopHook] },
  });
});

test("a playbook is loaded the way a skill is, since this host has one kind for both", async () => {
  const files = await projected({
    [at("playbook/release/index.md")]: primitive("playbook", "release", "How a release runs.", [
      'triggers: ["a release is cut"]',
    ]),
  });

  assert.ok(
    files[".claude/skills/release/SKILL.md"]?.includes(
      'description: "What release is for, in one line. Use when: a release is cut."',
    ),
  );
});

test("a skill or a playbook marked disable-user-invocation is no command the user types, and still a skill the agent opens (CORE-FR-173, CORE-FR-174)", async () => {
  const files = await projected({
    [at("playbook/ship/index.md")]: primitive("playbook", "ship", "Run [[ship-review]], then tag.", ['triggers: ["ship this"]', "disable-user-invocation: false"]),
    [at("skill/ship-review/index.md")]: primitive("skill", "ship-review", "Review what ships.", ['triggers: ["review the release"]', "disable-user-invocation: true"]),
    [at("playbook/hotfix-step/index.md")]: primitive("playbook", "hotfix-step", "One step of a hotfix.", ['triggers: ["patch it"]', "disable-user-invocation: true"]),
    [at("skill/explain/index.md")]: primitive("skill", "explain", "Explain the code.", ['triggers: ["explain this"]']),
  });

  for (const hiddenSkillFile of [".claude/skills/ship-review/SKILL.md", ".claude/skills/hotfix-step/SKILL.md"]) {
    assert.match(files[hiddenSkillFile] ?? "", /^---\nname: [a-z-]+\ndescription: .+\nuser-invocable: false\n---\n/, hiddenSkillFile);
    assert.match(files[hiddenSkillFile] ?? "", /Read and follow @/, hiddenSkillFile);
  }
  for (const commandSkillFile of [".claude/skills/ship/SKILL.md", ".claude/skills/explain/SKILL.md"])
    assert.doesNotMatch(files[commandSkillFile] ?? "", /user-invocable/, commandSkillFile);
});

test("a posture compiles to the settings this host enforces, as JSON (FR-018)", async () => {
  const files = await projected({
    [at("posture/sandboxed/index.md")]: primitive("posture", "sandboxed", "What may be run unattended.", [
      'allow: ["Read(**)", "Grep(**)"]',
      'deny: ["Bash(rm:*)"]',
    ]),
  });

  assert.deepEqual(JSON.parse(files[".claude/settings.json"] ?? ""), {
    permissions: { allow: ["Read(**)", "Grep(**)"], deny: ["Bash(rm:*)"] },
    hooks: { Stop: [sessionCounterStopHook] },
  });
});

test("every posture lands in the one file this host reads its settings from", async () => {
  const files = await projected({
    [at("posture/sandboxed/index.md")]: primitive("posture", "sandboxed", "Unattended.", [
      'allow: ["Read(**)"]',
      'deny: ["Bash(rm:*)"]',
    ]),
    [at("posture/no-network/index.md")]: primitive("posture", "no-network", "Nothing leaves the machine.", [
      'allow: ["Read(**)"]',
      'deny: ["WebFetch"]',
    ]),
  });

  // Two postures, one file: what both of them ask for, read together, each thing
  // once — and in the order their files sort in (SC-007).
  assert.deepEqual(Object.keys(files), [".claude/settings.json", builtinSkill, cwSessionCostSkill]);
  assert.deepEqual(JSON.parse(files[".claude/settings.json"] ?? "").permissions, {
    allow: ["Read(**)"],
    deny: ["WebFetch", "Bash(rm:*)"],
  });
});

test("a mixin's body is written before its host's, which is the one place a mixin applies (FR-006)", async () => {
  const files = await putDown({
    [at("mixin/house-style/index.md")]: primitive("mixin", "house-style", "Write plainly."),
    [at("mixin/no-jargon/index.md")]: primitive("mixin", "no-jargon", "No jargon."),
    [at("agent/ship/index.md")]: primitive("agent", "ship", "Run the build, then push.", [
      'tools: ["Bash"]',
      'mixins: ["house-style", "no-jargon"]',
    ]),
  });

  const contents = files[".cw/out/agent/ship/index.md"] ?? "";
  assert.ok(contents.indexOf("Write plainly.") > -1);
  assert.ok(contents.indexOf("Write plainly.") < contents.indexOf("No jargon."));
  assert.ok(contents.indexOf("No jargon.") < contents.indexOf("Run the build, then push."));
});

test("nothing is compiled for an agent that was not named as installed", async () => {
  const files = await putDown(aRole, []);

  assert.deepEqual(Object.keys(files), [
    ".cw/out/catalog.json",
    ".cw/out/mcp-origins.json",
    ".cw/out/CHARTER.md",
    ".cw/out/skill/cw-author/index.md",
    ...sessionCounterPaths,
    ".cw/out/agent/ship/index.md",
  ]);
});

test("a guide's compiled document has the mixins it pulls in already written into it (FR-006)", async () => {
  const files = await putDown({
    [at("mixin/house-style/index.md")]: primitive("mixin", "house-style", "Write plainly."),
    [at("guide/no-any/index.md")]: primitive("guide", "no-any", "Never write `any`.", [
      'globs: ["src/**/*.ts"]',
      'mixins: ["house-style"]',
    ]),
  });

  const carried = files[".cw/out/guide/no-any/index.md"] ?? "";
  assert.ok(carried.indexOf("Write plainly.") > -1);
  assert.ok(carried.indexOf("Write plainly.") < carried.indexOf("Never write `any`."));
});

test("a charter with no guide carries no rule at all (SC-005)", async () => {
  const files = await projected(aRole);

  assert.deepEqual(
    Object.keys(files).filter((path) => path.startsWith(".claude/rules/")),
    [],
  );
});
