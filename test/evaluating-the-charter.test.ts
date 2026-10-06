import { test } from "node:test";
import assert from "node:assert/strict";
import { Commander } from "../src/driver/cli/Commander.js";
import { COMMANDS } from "../src/driver/cli/commands/index.js";
import { EXIT_FAILURE, EXIT_OK } from "../src/driver/cli/commands/Command.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { CharterEvaluating } from "../src/hexagon/application/CharterEvaluating.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { TestAuthoring } from "../src/hexagon/application/TestAuthoring.js";
import type { PromptfooTestResult } from "../src/hexagon/port/zdriven/ForRunningPromptfoo.js";
import { InMemoryAgentCli } from "../src/zdriven/InMemoryAgentCli.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryPromptfoo } from "../src/zdriven/InMemoryPromptfoo.js";
import { InMemoryReporter } from "../src/zdriven/InMemoryReporter.js";
import { InMemoryTokenCounter } from "../src/zdriven/InMemoryTokenCounter.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import { noMcpOriginsReached } from "./no-mcp-origins.js";
import { noSessionsKept } from "./no-sessions.js";

const repoPath = new URL("file:///repo/");
const at = (path: string) => new URL(path, repoPath).href;

const primitive = (kind: string, id: string, headers: readonly string[], body: string) =>
  ["---", `kind: ${kind}`, `id: ${id}`, ...headers, "---", "", body, ""].join("\n");

/** A charter holding a planning skill, a refactoring skill and a naming guide,
 *  and the evaluation cases this repository wrote for it. */
const holding = (evalCases: readonly object[]) => ({
  [at(".cw/settings.json")]: `${JSON.stringify({ agents: ["claude"] })}\n`,
  [at(".cw/charter/skill/planning/index.md")]: primitive(
    "skill",
    "planning",
    ["description: Plan a feature.", 'triggers: ["plan this feature"]'],
    "Plan it.",
  ),
  [at(".cw/charter/skill/refactoring/index.md")]: primitive(
    "skill",
    "refactoring",
    ["description: Change how code is structured.", 'triggers: ["refactor this"]'],
    "Refactor it.",
  ),
  [at(".cw/charter/guide/plain-names/index.md")]: primitive(
    "guide",
    "plain-names",
    ["description: Name a variable after what it holds.", 'globs: ["src/**/*.ts"]'],
    "Never name a variable `data`.",
  ),
  [at(".cw/test/guides.json")]: JSON.stringify({ cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: "plain-names" } }] }),
  [at(".cw/eval/skills.json")]: JSON.stringify({ cases: evalCases }),
});

/** How promptfoo graded one test: each assertion's pass and reason, and the
 *  tokens the agent used. */
const promptfooResult = (totalTokens: number, componentResults: PromptfooTestResult["componentResults"] = []): PromptfooTestResult => ({
  success: componentResults.every(({ pass }) => pass),
  totalTokens,
  componentResults,
});

/** The command line over one repository held in memory, promptfoo and the
 *  agent's command line answering as a test says. */
const surfaces = (files: Readonly<Record<string, string>>, promptfoo: InMemoryPromptfoo, agentCli = new InMemoryAgentCli()) => {
  const held = new InMemoryFileReaders(files);
  const vcs = new InMemoryVCS(true, true, held);
  promptfoo.folderFiles = held;
  const fileOutput = new InMemoryFileOutput(held);
  const reporter = new InMemoryReporter();
  const charterAuthoringApp = new CharterAuthoring(repoPath, held, new YamlParser(), fileOutput, vcs, new InMemoryTokenCounter(), { claude: agentCli });
  const charterEvaluatingApp = new CharterEvaluating(repoPath, held, new YamlParser(), fileOutput, vcs, { claude: agentCli }, promptfoo, reporter);
  const cli = new Commander(
    {
      cwd: "/repo",
      version: "0.0.0",
      charterAuthoringApp,
      charterVendoringApp: new CharterVendoring(repoPath, held, vcs),
      testAuthoringApp: new TestAuthoring(repoPath, held, fileOutput),
      mcpConnectingApp: noMcpOriginsReached,
      sessionReviewingApp: noSessionsKept,
      charterEvaluatingApp,
    },
    COMMANDS,
  );
  return { held, vcs, reporter, cli };
};

/** What one command printed to each stream, and its exit status. */
const printed = async (cli: Commander, argv: readonly string[]) => {
  const results: string[] = [];
  const problems: string[] = [];
  const [stdoutWrite, stderrWrite] = [process.stdout.write, process.stderr.write];
  process.stdout.write = ((chunk: string) => results.push(chunk) > 0) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string) => problems.push(chunk) > 0) as typeof process.stderr.write;
  try {
    const code = await cli.run(argv);
    return { code, result: results.join(""), problem: problems.join("") };
  } finally {
    process.stdout.write = stdoutWrite;
    process.stderr.write = stderrWrite;
  }
};

test("a case expecting a skill is handed to promptfoo as skill-used, and passes or fails as promptfoo grades it, saying which skills were invoked (EVAL Story 6 scenario 1)", async () => {
  const promptfoo = new InMemoryPromptfoo();
  promptfoo.resultByPrompt.set("plan this feature: export", promptfooResult(1_200, [{ assertionType: "skill-used", pass: true, reason: "All required skills used" }]));
  promptfoo.resultByPrompt.set(
    "refactor this file",
    promptfooResult(800, [{ assertionType: "skill-used", pass: false, reason: "Missing required skill(s): refactoring. Actual skills: planning" }]),
  );
  const { cli } = surfaces(
    holding([
      { prompt: "plan this feature: export", expect: { invoke: "planning" } },
      { prompt: "refactor this file", expect: { invoke: "refactoring" } },
    ]),
    promptfoo,
  );

  const { code, result } = await printed(cli, ["eval"]);

  assert.deepEqual(promptfoo.evaluatedTests[0]?.assertions, [{ type: "skill-used", value: "planning" }]);
  assert.equal(code, EXIT_FAILURE);
  assert.match(result, /pass\s+1,200 tokens\s+plan this feature: export/);
  assert.match(result, /FAIL\s+800 tokens\s+refactor this file\n\s+Missing required skill\(s\): refactoring\. Actual skills: planning/);
  assert.match(result, /1 of 2 cases failed, 2,000 tokens in all\./);
});

test("a case expecting a guide followed is handed to promptfoo as an agent-rubric with the guide, and fails with the grader's reason (EVAL Story 6 scenario 2)", async () => {
  const promptfoo = new InMemoryPromptfoo();
  promptfoo.resultByPrompt.set("write a parser", promptfooResult(1_000, [{ assertionType: "agent-rubric", pass: false, reason: "It names a variable data." }]));
  const { cli } = surfaces(holding([{ prompt: "write a parser", expect: { follow: "plain-names" } }]), promptfoo);

  const { code, result } = await printed(cli, ["eval"]);

  const [rubricAssertion] = promptfoo.evaluatedTests[0]?.assertions ?? [];
  assert.equal(rubricAssertion?.type, "agent-rubric");
  assert.match(rubricAssertion?.value ?? "", /Never name a variable `data`\./);
  assert.equal(code, EXIT_FAILURE);
  assert.match(result, /FAIL\s+1,000 tokens\s+write a parser\n\s+"plain-names" was not followed: It names a variable data\./);
});

test("a guide is handed to the grader as written: what reads as a template in it is not rendered", async () => {
  const promptfoo = new InMemoryPromptfoo();
  const files = {
    ...holding([{ prompt: "write a parser", expect: { follow: "plain-names" } }]),
    [at(".cw/charter/guide/plain-names/index.md")]: primitive(
      "guide",
      "plain-names",
      ["description: Name a variable after what it holds.", 'globs: ["src/**/*.ts"]'],
      "Never write `{{ data }}` or `{% for data in items %}`.",
    ),
  };
  const { cli } = surfaces(files, promptfoo);

  await printed(cli, ["eval"]);

  const [rubricAssertion] = promptfoo.evaluatedTests[0]?.assertions ?? [];
  assert.match(rubricAssertion?.value ?? "", /\{% raw %\}Never write `\{\{ data \}\}` or `\{% for data in items %\}`\.\{% endraw %\}/);
});

test("a case naming a number of tokens is handed to promptfoo as a check of the tokens the agent used, and fails saying how many (EVAL Story 6 scenario 3)", async () => {
  const promptfoo = new InMemoryPromptfoo();
  promptfoo.resultByPrompt.set(
    "plan this feature",
    promptfooResult(30_000, [{ assertionType: "javascript", pass: false, reason: "The agent used 30000 tokens, more than the 20000 this case allows." }]),
  );
  const { cli } = surfaces(holding([{ prompt: "plan this feature", expect: { maxTokens: 20_000 } }]), promptfoo);

  const { code, result } = await printed(cli, ["eval"]);

  const [tokenAssertion] = promptfoo.evaluatedTests[0]?.assertions ?? [];
  assert.equal(tokenAssertion?.type, "javascript");
  assert.match(tokenAssertion?.value ?? "", /tokenUsage/);
  assert.match(tokenAssertion?.value ?? "", /20000/);
  assert.equal(code, EXIT_FAILURE);
  assert.match(result, /The agent used 30000 tokens, more than the 20000 this case allows\./);
});

test("a case promptfoo could not run fails with promptfoo's error", async () => {
  const promptfoo = new InMemoryPromptfoo();
  promptfoo.resultByPrompt.set("plan this feature", { success: false, totalTokens: 0, componentResults: [], error: "Error calling Claude Agent SDK: not signed in" });
  const { cli } = surfaces(holding([{ prompt: "plan this feature", expect: { invoke: "planning" } }]), promptfoo);

  const { code, result } = await printed(cli, ["eval"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(result, /Error calling Claude Agent SDK: not signed in/);
});

test("every case passing passes the run, each case's tokens and the total said (EVAL Story 6 scenario 4)", async () => {
  const promptfoo = new InMemoryPromptfoo();
  promptfoo.resultByPrompt.set("plan this feature", promptfooResult(4_000, [{ assertionType: "skill-used", pass: true, reason: "ok" }]));
  promptfoo.resultByPrompt.set("refactor this", promptfooResult(6_000, [{ assertionType: "skill-used", pass: true, reason: "ok" }]));
  const { cli } = surfaces(
    holding([
      { prompt: "plan this feature", expect: { invoke: "planning", maxTokens: 5_000 } },
      { prompt: "refactor this", expect: { invoke: "refactoring" } },
    ]),
    promptfoo,
  );

  const { code, result } = await printed(cli, ["eval"]);

  assert.equal(code, EXIT_OK);
  assert.match(result, /pass\s+4,000 tokens\s+plan this feature/);
  assert.match(result, /pass\s+6,000 tokens\s+refactor this/);
  assert.match(result, /2 cases passed, 10,000 tokens in all\./);
});

test("each case runs once in a worktree of its own under .cw/eval/.worktrees/ with its charter built, removed afterwards, the working tree left as it was (EVAL Story 6 scenario 5)", async () => {
  const promptfoo = new InMemoryPromptfoo();
  const files = holding([
    { prompt: "plan this feature", expect: { invoke: "planning" } },
    { prompt: "refactor this", expect: { invoke: "refactoring" } },
  ]);
  const { held, vcs, cli } = surfaces(files, promptfoo);

  await printed(cli, ["eval"]);

  assert.equal(promptfoo.evaluatedTests.length, 2);
  const [firstTest, secondTest] = promptfoo.evaluatedTests;
  assert.ok(firstTest !== undefined && secondTest !== undefined);
  // Each in a worktree of its own, where version control ignores it.
  assert.notEqual(firstTest.workingFolder.href, secondTest.workingFolder.href);
  assert.ok(firstTest.workingFolder.href.startsWith(at(".cw/eval/.worktrees/")));
  // The charter was built in the worktree before promptfoo ran the agent there.
  assert.ok(firstTest.builtFiles.some((file) => file.endsWith(".claude/skills/planning/SKILL.md")));
  // Every worktree removed, and the working tree holding exactly what it held.
  assert.deepEqual(vcs.worktreeFolders, []);
  const heldNow = (await held.readFilesRecursively(new URL("file:///"))).map(({ file }) => file.href).sort();
  assert.deepEqual(heldNow, Object.keys(files).sort());
});

test("the worktrees a run stopped halfway left are removed when the next run starts", async () => {
  const promptfoo = new InMemoryPromptfoo();
  const files = {
    ...holding([{ prompt: "plan this feature", expect: { invoke: "planning" } }]),
    [at(".cw/eval/.worktrees/7/README.md")]: "left by a run stopped halfway\n",
  };
  const { held, cli } = surfaces(files, promptfoo);

  await printed(cli, ["eval"]);

  assert.equal(await held.readIfThere(new URL(at(".cw/eval/.worktrees/7/README.md"))), undefined);
});

test("a run with the agent's command line not installed is refused before any case runs, saying what it needs (EVAL Story 6 scenario 6)", async () => {
  const promptfoo = new InMemoryPromptfoo();
  const { cli } = surfaces(holding([{ prompt: "plan this feature", expect: { invoke: "planning" } }]), promptfoo, new InMemoryAgentCli(false));

  const { code, problem } = await printed(cli, ["eval"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problem, /claude's own command line, and it is not installed here/);
  assert.equal(promptfoo.evaluatedTests.length, 0);
});

test("promptfoo not yet on the machine is installed once, saying so, and is not installed again (EVAL Story 6 scenario 7)", async () => {
  const promptfoo = new InMemoryPromptfoo(false);
  const files = holding([{ prompt: "plan this feature", expect: { invoke: "planning" } }]);
  const { reporter, cli } = surfaces(files, promptfoo);

  await printed(cli, ["eval"]);
  await printed(cli, ["eval"]);

  assert.equal(promptfoo.installCount, 1);
  assert.equal(reporter.reports.length, 1);
  assert.match(reporter.reports[0] ?? "", /Installing promptfoo once into ~\/\.cherry-works\/promptfoo\/test/);
  assert.equal(promptfoo.evaluatedTests.length, 2);
});

test("a case naming a skill or a guide the charter does not hold refuses the run before any case runs, naming it", async () => {
  const promptfoo = new InMemoryPromptfoo();
  const { cli } = surfaces(
    holding([
      { prompt: "plan this feature", expect: { invoke: "plannning" } },
      { prompt: "write a parser", expect: { follow: "planning" } },
    ]),
    promptfoo,
  );

  const { code, problem } = await printed(cli, ["eval"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problem, /\.cw\/eval\/skills\.json/);
  assert.match(problem, /holds no skill or playbook called "plannning"/);
  assert.match(problem, /"planning" is a skill, and a case follows a guide/);
  assert.equal(promptfoo.evaluatedTests.length, 0);
});

test("an evaluation file that does not read refuses the run, and none written is said and passes", async () => {
  const promptfoo = new InMemoryPromptfoo();
  const badFiles = { ...holding([]), [at(".cw/eval/skills.json")]: JSON.stringify({ cases: [{ prompt: "plan", expect: {} }] }) };
  const refused = await printed(surfaces(badFiles, promptfoo).cli, ["eval"]);
  assert.equal(refused.code, EXIT_FAILURE);
  assert.match(refused.problem, /\.cw\/eval\/skills\.json/);

  const { [at(".cw/eval/skills.json")]: _evalFile, ...withoutEvals } = holding([]);
  const { code, result } = await printed(surfaces(withoutEvals, promptfoo).cli, ["eval"]);
  assert.equal(code, EXIT_OK);
  assert.match(result, /No evaluation: \.cw\/eval\/ holds no case as last committed\./);
  assert.equal(promptfoo.evaluatedTests.length, 0);
});
