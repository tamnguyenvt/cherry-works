import assert from "node:assert/strict";
import { test } from "node:test";
import prompts from "prompts";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import type { ForKeepingWorktrees } from "../src/module/runtime/app/port/out/keeping-worktrees.port.js";
import type { PromptfooTestResult } from "../src/module/runtime/app/port/out/running-promptfoo.port.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryPromptfoo } from "../src/module/runtime/infra/in-memory/in-memory-promptfoo.adapter.js";
import { InMemoryWorktrees } from "../src/module/runtime/infra/in-memory/in-memory-worktrees.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { Commander } from "../src/presentation/cli/cli.commander.js";
import { EXIT_FAILURE, EXIT_OK } from "../src/presentation/cli/commands/command.interface.js";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { authoringCharterOf, commandLineOf, runningCharterOf } from "./use-cases-of.js";

const repoPath = new URL("file:///repo/");
const at = (path: string) => new URL(path, repoPath).href;

const primitive = (kind: string, id: string, headers: readonly string[], body: string) =>
  ["---", `kind: ${kind}`, `id: ${id}`, ...headers, "---", "", body, ""].join("\n");

/** A charter holding a planning skill, a refactoring skill and a naming guide,
 *  and the evaluation cases this repository wrote for it. */
const holding = (evalCases: readonly object[]) => ({
  [at(".cw/settings.json")]: `${JSON.stringify({ agents: ["claude"] })}\n`,
  [at(".cw/charter/primitive/skill/planning/index.md")]: primitive(
    "skill",
    "planning",
    ["description: Plan a feature.", 'triggers: ["plan this feature"]'],
    "Plan it.",
  ),
  [at(".cw/charter/primitive/skill/refactoring/index.md")]: primitive(
    "skill",
    "refactoring",
    ["description: Change how code is structured.", 'triggers: ["refactor this"]'],
    "Refactor it.",
  ),
  [at(".cw/charter/primitive/guide/plain-names/index.md")]: primitive(
    "guide",
    "plain-names",
    ["description: Name a variable after what it holds.", 'globs: ["src/**/*.ts"]'],
    "Never name a variable `data`.",
  ),
  [at(".cw/charter/test/guides.json")]: JSON.stringify({
    cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: "plain-names" } }],
  }),
  [at(".cw/charter/eval/skills.json")]: JSON.stringify({ cases: evalCases }),
});

/** How promptfoo graded one test: each assertion's pass and reason, and the
 *  tokens the agent used. */
const promptfooResult = (
  totalTokens: number,
  componentResults: PromptfooTestResult["componentResults"] = [],
): PromptfooTestResult => ({
  success: componentResults.every(({ pass }) => pass),
  totalTokens,
  componentResults,
});

/** The command line over one repository held in memory, promptfoo and the
 *  agent's command line answering as a test says. */
const surfaces = (
  files: Readonly<Record<string, string>>,
  promptfoo: InMemoryPromptfoo,
  agentCli = new InMemoryAgentCli(),
  isVersioned = true,
  worktreesOf: (
    fileReaders: InMemoryFileReaders,
  ) => ForKeepingWorktrees & { readonly worktreePaths: readonly string[] } = (fileReaders) =>
    new InMemoryWorktrees(fileReaders, isVersioned),
) => {
  const fileReaders = new InMemoryFileReaders(files);
  const sourceFetcher = new InMemorySources(fileReaders);
  const worktrees = worktreesOf(fileReaders);
  promptfoo.workingFolderFileReaders = fileReaders;
  const fileOutput = new InMemoryFileOutput(fileReaders);
  const reporter = new InMemoryReporter();
  const charterRuntimeApp = runningCharterOf(fileReaders, reporter, {
    fileWriter: fileOutput,
    tokenCounter: new InMemoryTokenCounter(),
    worktreeKeeper: worktrees,
    agentCliByProvider: { claude: agentCli, codex: agentCli },
    promptfooRunner: promptfoo,
  });
  const cli = new Commander(
    commandLineOf(
      fileReaders,
      fileOutput,
      {
        charterAuthoringApp: authoringCharterOf(fileReaders, fileOutput, new InMemoryReporter(), { sourceFetcher }),
        charterRuntimeApp,
      },
      "/repo",
    ),
    COMMANDS,
  );
  return { fileReaders, worktrees, reporter, cli };
};

/** What one command printed to each stream, and its exit status. */
const printed = async (cli: Commander, argv: readonly string[]) => {
  const results: string[] = [];
  const problems: string[] = [];
  const [stdoutWrite, stderrWrite] = [process.stdout.write, process.stderr.write];
  process.stdout.write = ((chunk: string) => results.push(chunk) > 0) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string) => problems.push(chunk) > 0) as typeof process.stderr.write;
  try {
    const code = await cli.runCommandLine(argv);
    return { code, outputText: results.join(""), problem: problems.join("") };
  } finally {
    process.stdout.write = stdoutWrite;
    process.stderr.write = stderrWrite;
  }
};

test("a case expecting a skill is handed to promptfoo as skill-used, and passes or fails as promptfoo grades it, saying which skills were invoked (EVAL Story 6 scenario 1)", async () => {
  const promptfoo = new InMemoryPromptfoo();
  promptfoo.resultByPrompt.set(
    "plan this feature: export",
    promptfooResult(1_200, [{ assertionType: "skill-used", pass: true, reason: "All required skills used" }]),
  );
  promptfoo.resultByPrompt.set(
    "refactor this file",
    promptfooResult(800, [
      {
        assertionType: "skill-used",
        pass: false,
        reason: "Missing required skill(s): refactoring. Actual skills: planning",
      },
    ]),
  );
  const { cli } = surfaces(
    holding([
      { prompt: "plan this feature: export", expect: { invoke: "planning" } },
      { prompt: "refactor this file", expect: { invoke: "refactoring" } },
    ]),
    promptfoo,
  );

  const { code, outputText } = await printed(cli, ["eval"]);

  assert.deepEqual(promptfoo.evaluatedTests[0]?.assertions, [{ type: "skill-used", value: "planning" }]);
  assert.equal(code, EXIT_FAILURE);
  assert.match(outputText, /pass\s+1,200 tokens\s+plan this feature: export/);
  assert.match(
    outputText,
    /FAIL\s+800 tokens\s+refactor this file\n\s+Missing required skill\(s\): refactoring\. Actual skills: planning/,
  );
  assert.match(outputText, /1 of 2 cases failed, 2,000 tokens in all\./);
});

test("a case expecting a guide followed is handed to promptfoo as an agent-rubric with the guide, and fails with the grader's reason (EVAL Story 6 scenario 2)", async () => {
  const promptfoo = new InMemoryPromptfoo();
  promptfoo.resultByPrompt.set(
    "write a parser",
    promptfooResult(1_000, [{ assertionType: "agent-rubric", pass: false, reason: "It names a variable data." }]),
  );
  const { cli } = surfaces(holding([{ prompt: "write a parser", expect: { follow: "plain-names" } }]), promptfoo);

  const { code, outputText } = await printed(cli, ["eval"]);

  const [rubricAssertion] = promptfoo.evaluatedTests[0]?.assertions ?? [];
  assert.equal(rubricAssertion?.type, "agent-rubric");
  assert.ok(rubricAssertion !== undefined && "value" in rubricAssertion);
  assert.match(rubricAssertion.value, /Never name a variable `data`\./);
  assert.equal(code, EXIT_FAILURE);
  assert.match(
    outputText,
    /FAIL\s+1,000 tokens\s+write a parser\n\s+"plain-names" was not followed: It names a variable data\./,
  );
});

test("a guide is handed to the grader as written: what reads as a template in it is not rendered", async () => {
  const promptfoo = new InMemoryPromptfoo();
  const files = {
    ...holding([{ prompt: "write a parser", expect: { follow: "plain-names" } }]),
    [at(".cw/charter/primitive/guide/plain-names/index.md")]: primitive(
      "guide",
      "plain-names",
      ["description: Name a variable after what it holds.", 'globs: ["src/**/*.ts"]'],
      "Never write `{{ data }}` or `{% for data in items %}`.",
    ),
  };
  const { cli } = surfaces(files, promptfoo);

  await printed(cli, ["eval"]);

  const [rubricAssertion] = promptfoo.evaluatedTests[0]?.assertions ?? [];
  assert.ok(rubricAssertion !== undefined && "value" in rubricAssertion);
  assert.match(
    rubricAssertion.value,
    /\{% raw %\}Never write `\{\{ data \}\}` or `\{% for data in items %\}`\.\{% endraw %\}/,
  );
});

test("a case naming a number of tokens is handed to promptfoo as a check of the tokens the agent used, and fails saying how many (EVAL Story 6 scenario 3)", async () => {
  const promptfoo = new InMemoryPromptfoo();
  promptfoo.resultByPrompt.set(
    "plan this feature",
    promptfooResult(30_000, [
      {
        assertionType: "javascript",
        pass: false,
        reason: "The agent used 30000 tokens, more than the 20000 this case allows.",
      },
    ]),
  );
  const { cli } = surfaces(holding([{ prompt: "plan this feature", expect: { maxTokens: 20_000 } }]), promptfoo);

  const { code, outputText } = await printed(cli, ["eval"]);

  const [tokenAssertion] = promptfoo.evaluatedTests[0]?.assertions ?? [];
  assert.equal(tokenAssertion?.type, "javascript");
  assert.ok(tokenAssertion !== undefined && "value" in tokenAssertion);
  assert.match(tokenAssertion.value, /tokenUsage/);
  assert.match(tokenAssertion.value, /20000/);
  assert.equal(code, EXIT_FAILURE);
  assert.match(outputText, /The agent used 30000 tokens, more than the 20000 this case allows\./);
});

test("a case promptfoo could not run fails with promptfoo's error", async () => {
  const promptfoo = new InMemoryPromptfoo();
  promptfoo.resultByPrompt.set("plan this feature", {
    success: false,
    totalTokens: 0,
    componentResults: [],
    error: "Error calling Claude Agent SDK: not signed in",
  });
  const { cli } = surfaces(holding([{ prompt: "plan this feature", expect: { invoke: "planning" } }]), promptfoo);

  const { code, outputText } = await printed(cli, ["eval"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(outputText, /Error calling Claude Agent SDK: not signed in/);
});

test("every case passing passes the run, each case's tokens and the total said (EVAL Story 6 scenario 4)", async () => {
  const promptfoo = new InMemoryPromptfoo();
  promptfoo.resultByPrompt.set(
    "plan this feature",
    promptfooResult(4_000, [{ assertionType: "skill-used", pass: true, reason: "ok" }]),
  );
  promptfoo.resultByPrompt.set(
    "refactor this",
    promptfooResult(6_000, [{ assertionType: "skill-used", pass: true, reason: "ok" }]),
  );
  const { cli } = surfaces(
    holding([
      { prompt: "plan this feature", expect: { invoke: "planning", maxTokens: 5_000 } },
      { prompt: "refactor this", expect: { invoke: "refactoring" } },
    ]),
    promptfoo,
  );

  const { code, outputText } = await printed(cli, ["eval"]);

  assert.equal(code, EXIT_OK);
  assert.match(outputText, /pass\s+4,000 tokens\s+plan this feature/);
  assert.match(outputText, /pass\s+6,000 tokens\s+refactor this/);
  assert.match(outputText, /2 cases passed, 10,000 tokens in all\./);
});

test("each case runs once in a worktree of its own under .cw/log/eval/worktrees/ with its charter built, removed afterwards, the working tree left as it was (EVAL Story 6 scenario 5)", async () => {
  const promptfoo = new InMemoryPromptfoo();
  const files = holding([
    { prompt: "plan this feature", expect: { invoke: "planning" } },
    { prompt: "refactor this", expect: { invoke: "refactoring" } },
  ]);
  const { fileReaders, worktrees, cli } = surfaces(files, promptfoo);

  await printed(cli, ["eval"]);

  assert.equal(promptfoo.evaluatedTests.length, 2);
  const [firstTest, secondTest] = promptfoo.evaluatedTests;
  assert.ok(firstTest !== undefined && secondTest !== undefined);
  // Each in a worktree of its own, where version control ignores it.
  assert.notEqual(firstTest.workingPath, secondTest.workingPath);
  assert.ok(firstTest.workingPath.startsWith(".cw/log/eval/worktrees/"));
  // The charter was built in the worktree before promptfoo ran the agent there.
  assert.ok(
    firstTest.builtFilePaths.some((builtFilePath) => builtFilePath.endsWith(".claude/skills/planning/SKILL.md")),
  );
  // Every worktree removed, and the working tree holding exactly what it held.
  assert.deepEqual(worktrees.worktreePaths, []);
  const heldNow = (await fileReaders.readFilesRecursively(new URL("file:///")))
    .map(({ fileUrl }) => fileUrl.href)
    .sort();
  assert.deepEqual(heldNow, Object.keys(files).sort());
});

test("a charter changed and not yet committed is evaluated as it stands: each case's worktree of the last commit is built from it, the working tree left as it was (EVAL Story 6 scenario 5, CORE Story 53 scenario 5, EVAL-FR-021)", async () => {
  const promptfoo = new InMemoryPromptfoo();
  const files = holding([{ prompt: "plan this feature", expect: { invoke: "planning" } }]);
  // The last commit holds the settings and nothing of the charter: the
  // planning skill and its case are written since, and not committed.
  const committedPaths = [".cw/settings.json"];
  /** Worktrees of a last commit that holds only what `committedPaths` names. */
  class LastCommitWorktrees implements ForKeepingWorktrees {
    readonly worktreePaths: string[] = [];
    readonly worktreesFolderPath = ".cw/log/eval/worktrees";
    constructor(private readonly fileReaders: InMemoryFileReaders) {}
    async addWorktree(worktreePath: string): Promise<void> {
      for (const committedPath of committedPaths)
        this.fileReaders.writeFile(
          new URL(`${worktreePath}/${committedPath}`, repoPath),
          (await this.fileReaders.readIfThere(new URL(committedPath, repoPath))) ?? "",
        );
      this.worktreePaths.push(worktreePath);
    }
    async removeWorktree(worktreePath: string): Promise<void> {
      for (const { path } of await this.fileReaders.readFilesRecursively(worktreePath))
        this.fileReaders.removeFile(new URL(path, repoPath));
      this.worktreePaths.splice(this.worktreePaths.indexOf(worktreePath), 1);
    }
  }
  const { fileReaders, worktrees, cli } = surfaces(
    files,
    promptfoo,
    new InMemoryAgentCli(),
    true,
    (heldFiles) => new LastCommitWorktrees(heldFiles),
  );

  const { code } = await printed(cli, ["eval"]);

  assert.equal(code, EXIT_OK);
  const [evaluatedTest] = promptfoo.evaluatedTests;
  assert.ok(evaluatedTest !== undefined);
  // The case was read off the store as it stands, and the worktree, which
  // held none of the charter, was built from it.
  assert.equal(evaluatedTest.prompt, "plan this feature");
  assert.ok(
    evaluatedTest.builtFilePaths.some((builtFilePath) => builtFilePath.endsWith(".claude/skills/planning/SKILL.md")),
  );
  assert.deepEqual(worktrees.worktreePaths, []);
  const heldFileHrefs = (await fileReaders.readFilesRecursively(new URL("file:///")))
    .map(({ fileUrl: heldFileUrl }) => heldFileUrl.href)
    .sort();
  assert.deepEqual(heldFileHrefs, Object.keys(files).sort());
});

test("the worktrees a run stopped halfway left are removed when the next run starts", async () => {
  const promptfoo = new InMemoryPromptfoo();
  const files = {
    ...holding([{ prompt: "plan this feature", expect: { invoke: "planning" } }]),
    [at(".cw/log/eval/worktrees/7/README.md")]: "left by a run stopped halfway\n",
  };
  const { fileReaders, cli } = surfaces(files, promptfoo);

  await printed(cli, ["eval"]);

  assert.equal(await fileReaders.readIfThere(new URL(at(".cw/log/eval/worktrees/7/README.md"))), undefined);
});

test("a run with the agent's command line not installed is refused before any case runs, saying what it needs (EVAL Story 6 scenario 6)", async () => {
  const promptfoo = new InMemoryPromptfoo();
  const { cli } = surfaces(
    holding([{ prompt: "plan this feature", expect: { invoke: "planning" } }]),
    promptfoo,
    new InMemoryAgentCli(false),
  );

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
  assert.match(problem, /\.cw\/charter\/eval\/skills\.json/);
  assert.match(problem, /holds no skill or playbook called "plannning"/);
  assert.match(problem, /"planning" is a skill, and a case follows a guide/);
  assert.equal(promptfoo.evaluatedTests.length, 0);
});

test("an evaluation file that does not read refuses the run, and none written is said and passes", async () => {
  const promptfoo = new InMemoryPromptfoo();
  const badFiles = {
    ...holding([]),
    [at(".cw/charter/eval/skills.json")]: JSON.stringify({ cases: [{ prompt: "plan", expect: {} }] }),
  };
  const refused = await printed(surfaces(badFiles, promptfoo).cli, ["eval"]);
  assert.equal(refused.code, EXIT_FAILURE);
  assert.match(refused.problem, /\.cw\/charter\/eval\/skills\.json/);

  const { [at(".cw/charter/eval/skills.json")]: _evalFile, ...withoutEvals } = holding([]);
  const { code, outputText } = await printed(surfaces(withoutEvals, promptfoo).cli, ["eval"]);
  assert.equal(code, EXIT_OK);
  assert.match(outputText, /No evaluation: \.cw\/charter\/eval\/ holds no case\./);
  assert.equal(promptfoo.evaluatedTests.length, 0);
});

for (const agentName of ["claude", "codex"]) {
  test(`${agentName} named runs unchanged expectations and identifies the agent (EVAL Story 7 scenarios 1, 8)`, async () => {
    const promptfooRunner = new InMemoryPromptfoo();
    promptfooRunner.resultByPrompt.set(
      "plan",
      promptfooResult(123, [{ assertionType: "skill-used", pass: false, reason: "Missing skill: planning" }]),
    );
    const repositoryFiles = {
      ...holding([{ prompt: "plan", expect: { invoke: "planning", follow: "plain-names", maxTokens: 100 } }]),
      [at(".cw/settings.json")]: JSON.stringify({ agents: ["claude", "codex"] }),
    };
    const { cli, worktrees, fileReaders } = surfaces(repositoryFiles, promptfooRunner);
    const commandOutput = await printed(cli, ["eval", `--agent=${agentName}`]);
    assert.equal(commandOutput.code, EXIT_FAILURE);
    assert.match(commandOutput.outputText, new RegExp(`Agent: ${agentName}`));
    assert.match(commandOutput.outputText, /123 tokens/);
    assert.equal(promptfooRunner.evaluatedTests[0]?.provider, agentName);
    assert.deepEqual(
      promptfooRunner.evaluatedTests[0]?.assertions.map(({ type }) => type),
      ["skill-used", "agent-rubric", "javascript"],
    );
    assert.ok(
      promptfooRunner.evaluatedTests[0]?.builtFilePaths.some((filePath) =>
        filePath.endsWith(
          agentName === "codex" ? ".agents/skills/planning/SKILL.md" : ".claude/skills/planning/SKILL.md",
        ),
      ),
    );
    assert.deepEqual(worktrees.worktreePaths, []);
    assert.deepEqual(
      (await fileReaders.readFilesRecursively(new URL("file:///"))).map(({ fileUrl }) => fileUrl.href).sort(),
      Object.keys(repositoryFiles).sort(),
    );
  });
  test(`the one agent chosen, ${agentName}, is taken with none named (EVAL Story 7 scenario 2)`, async () => {
    const promptfooRunner = new InMemoryPromptfoo();
    const repositoryFiles = {
      ...holding([{ prompt: "plan", expect: { invoke: "planning" } }]),
      [at(".cw/settings.json")]: JSON.stringify({ agents: [agentName] }),
    };
    const commandOutput = await printed(surfaces(repositoryFiles, promptfooRunner).cli, ["eval"]);
    assert.equal(commandOutput.code, EXIT_OK);
    assert.equal(promptfooRunner.evaluatedTests[0]?.provider, agentName);
  });
}

for (const selectionCase of [
  { agents: ["claude", "codex"], argv: ["eval"], expectedProblem: /--agent/ },
  { agents: ["claude"], argv: ["eval", "--agent=codex"], expectedProblem: /codex is not chosen/ },
  { agents: [], argv: ["eval"], expectedProblem: /cw init/ },
  { agents: undefined, argv: ["eval"], expectedProblem: /cw init/ },
  { agents: ["claude"], argv: ["eval", "--agent=unknown"], expectedProblem: /claude, codex/ },
  { agents: ["codex"], argv: ["eval"], expectedProblem: /codex.*not installed/, isInstalled: false },
]) {
  test(`an agent named or chosen that is refused, ${JSON.stringify(selectionCase)}, spends no tokens (EVAL Story 7 scenarios 4–7)`, async () => {
    const promptfooRunner = new InMemoryPromptfoo(false);
    const repositoryFiles = { ...holding([{ prompt: "plan", expect: { invoke: "planning" } }]) };
    if (selectionCase.agents === undefined) delete repositoryFiles[at(".cw/settings.json")];
    else repositoryFiles[at(".cw/settings.json")] = JSON.stringify({ agents: selectionCase.agents });
    const commandOutput = await printed(
      surfaces(repositoryFiles, promptfooRunner, new InMemoryAgentCli(selectionCase.isInstalled ?? true)).cli,
      selectionCase.argv,
    );
    assert.equal(commandOutput.code, EXIT_FAILURE);
    assert.match(commandOutput.problem, selectionCase.expectedProblem);
    assert.equal(promptfooRunner.evaluatedTests.length, 0);
    assert.equal(promptfooRunner.installCount, 0);
  });
}

for (const pickedAgentName of ["codex", undefined]) {
  test(`the agent picked at a terminal: ${pickedAgentName ?? "cancelled"} (EVAL Story 7 scenario 3)`, async () => {
    const ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
    prompts.inject([pickedAgentName]);
    try {
      const promptfooRunner = new InMemoryPromptfoo();
      const repositoryFiles = {
        ...holding([{ prompt: "plan", expect: { invoke: "planning" } }]),
        [at(".cw/settings.json")]: JSON.stringify({ agents: ["claude", "codex"] }),
      };
      const commandOutput = await printed(surfaces(repositoryFiles, promptfooRunner).cli, ["eval"]);
      assert.equal(commandOutput.code, pickedAgentName === undefined ? EXIT_FAILURE : EXIT_OK);
      assert.equal(promptfooRunner.evaluatedTests.length, pickedAgentName === undefined ? 0 : 1);
      if (pickedAgentName !== undefined) assert.equal(promptfooRunner.evaluatedTests[0]?.provider, pickedAgentName);
    } finally {
      if (ttyDescriptor === undefined) delete (process.stdin as { isTTY?: boolean }).isTTY;
      else Object.defineProperty(process.stdin, "isTTY", ttyDescriptor);
    }
  });
}

test("invalid agent is refused even when there are no cases", async () => {
  const promptfooRunner = new InMemoryPromptfoo();
  const commandOutput = await printed(surfaces(holding([]), promptfooRunner).cli, ["eval", "--agent=unknown"]);
  assert.equal(commandOutput.code, EXIT_FAILURE);
  assert.match(commandOutput.problem, /Unsupported evaluation agent/);
  assert.equal(promptfooRunner.evaluatedTests.length, 0);
});

test("a read-only expectation is accepted and handed to promptfoo without requiring an invocation", async () => {
  const promptfoo = new InMemoryPromptfoo();
  const { cli } = surfaces(
    holding([{ prompt: "verify this branch", expect: { read: ".cw/out/skill/planning/index.md" } }]),
    promptfoo,
  );
  const { code } = await printed(cli, ["eval"]);
  assert.equal(code, EXIT_OK);
  assert.deepEqual(promptfoo.evaluatedTests[0]?.assertions, [
    { type: "javascript", config: { readFilePath: ".cw/out/skill/planning/index.md" } },
  ]);
});

test("a case expecting a read of an empty, absolute, outside or control-character path is refused before any case runs, naming the path (CORE Story 55 scenario 30, EVAL-FR-039)", async () => {
  for (const filePath of [
    "",
    "/etc/passwd",
    "../secret",
    "a/../secret",
    "a/./file",
    "a//file",
    "C:/secret",
    "a\\file",
    "a\nfile",
    "a\u007ffile",
    "a\u0085file",
    "a/{{x}}",
  ]) {
    const promptfoo = new InMemoryPromptfoo();
    const { cli } = surfaces(holding([{ prompt: "read", expect: { read: filePath } }]), promptfoo);
    const { code, problem } = await printed(cli, ["eval"]);
    assert.equal(code, EXIT_FAILURE, JSON.stringify(filePath));
    assert.ok(problem.includes(JSON.stringify(filePath)), `${JSON.stringify(filePath)} not named in: ${problem}`);
    assert.equal(promptfoo.evaluatedTests.length, 0);
  }
});

test("the run says where each case's result and the agent's session record are kept, and eval-analyze reads them again, in words or as JSON, without running a case (CORE Story 55 scenarios 31 and 32, EVAL-FR-040, EVAL-FR-041)", async () => {
  const promptfoo = new InMemoryPromptfoo();
  promptfoo.resultByPrompt.set("plan", {
    ...promptfooResult(123),
    logPath: "/logs/case.json",
    sessionId: "session-one",
    sessionPath: "/sessions/session-one.jsonl",
  });
  promptfoo.savedLogs.push({
    logPath: "/logs/case.json",
    createdAt: "2026-10-31T02:00:00.000Z",
    provider: "codex",
    prompt: "plan",
    workingFolderPath: "/repo/.cw/log/eval/worktrees/1",
    outputPath: "/logs/output.json",
    stdoutPath: "/logs/stdout.log",
    stderrPath: "/logs/stderr.log",
    success: false,
    totalTokens: 123,
    unmetReasons: ["Missing required skill(s): planning"],
    answer: "I read the instructions.",
    toolCalls: ['{"command":"cat instructions.md","exit_code":0}'],
    sessionId: "session-one",
    sessionPath: "/sessions/session-one.jsonl",
  });
  const { cli } = surfaces(holding([{ prompt: "plan", expect: { invoke: "planning" } }]), promptfoo);
  const evalOutput = await printed(cli, ["eval"]);
  assert.match(evalOutput.outputText, /Log: \/logs\/case.json/);
  assert.match(evalOutput.outputText, /Session log: \/sessions\/session-one.jsonl/);
  const evaluateCount = promptfoo.evaluatedTests.length;
  const analysisOutput = await printed(cli, ["eval-analyze", "--log", "/logs/case.json"]);
  assert.equal(analysisOutput.code, EXIT_OK);
  assert.match(analysisOutput.outputText, /^✘ FAIL codex/);
  assert.match(analysisOutput.outputText, /Missing required skill/);
  assert.match(analysisOutput.outputText, /cat instructions.md/);
  assert.match(analysisOutput.outputText, /I read the instructions/);
  assert.match(analysisOutput.outputText, /^Session log: {2,}\/sessions\/session-one.jsonl$/m);
  const jsonOutput = await printed(cli, ["eval-analyze", "--json"]);
  assert.equal(JSON.parse(jsonOutput.outputText).data.logs[0].sessionId, "session-one");
  assert.equal(JSON.parse(jsonOutput.outputText).data.logs[0].agent, "codex");
  assert.equal(promptfoo.evaluatedTests.length, evaluateCount);
});

test("with no agent and no promptfoo installed, eval-analyze reads a kept result by the path a run said, in words, and the latest as JSON, and runs no agent (CORE Story 55 scenario 32, EVAL-FR-041)", async () => {
  const promptfoo = new InMemoryPromptfoo(false);
  promptfoo.savedLogs.push({
    logPath: "/repo/.cw/log/eval/runs/run-1/case.json",
    createdAt: "2026-10-31T02:00:00.000Z",
    provider: "claude",
    prompt: "read the guide",
    workingFolderPath: "/repo/.cw/log/eval/worktrees/1",
    outputPath: "/repo/.cw/log/eval/runs/run-1/output.json",
    stdoutPath: "/repo/.cw/log/eval/runs/run-1/stdout.log",
    stderrPath: "/repo/.cw/log/eval/runs/run-1/stderr.log",
    success: true,
    totalTokens: 40,
    unmetReasons: [],
    answer: "Read it.",
    toolCalls: ['{"name":"Read","input":{"file_path":"/repo/docs/guide.md"}}'],
  });
  const { cli } = surfaces(holding([]), promptfoo, new InMemoryAgentCli(false));

  const wordsOutput = await printed(cli, ["eval-analyze", "--log", "/repo/.cw/log/eval/runs/run-1/case.json"]);
  const jsonOutput = await printed(cli, ["eval-analyze", "--json"]);

  assert.equal(wordsOutput.code, EXIT_OK);
  assert.match(wordsOutput.outputText, /read the guide/);
  assert.match(wordsOutput.outputText, /docs\/guide\.md/);
  assert.equal(jsonOutput.code, EXIT_OK);
  assert.equal(JSON.parse(jsonOutput.outputText).data.logs[0].prompt, "read the guide");
  assert.equal(promptfoo.evaluatedTests.length, 0);
  assert.equal(promptfoo.installCount, 0);
});

test("eval-analyze explains an empty history without running an agent", async () => {
  const promptfoo = new InMemoryPromptfoo();
  const { cli } = surfaces(holding([]), promptfoo);
  const analysisOutput = await printed(cli, ["eval-analyze"]);
  assert.equal(analysisOutput.code, EXIT_OK);
  assert.match(analysisOutput.outputText, /No saved evaluation log/);
  assert.equal(promptfoo.evaluatedTests.length, 0);
});

test("a case outside a git repository is refused in git's words, naming git init, and nothing is left behind (CORE-FR-206, CORE Story 35 scenario 4)", async () => {
  const promptfoo = new InMemoryPromptfoo();
  const files = holding([{ prompt: "plan this feature", expect: { invoke: "planning" } }]);
  const { cli, worktrees, fileReaders } = surfaces(files, promptfoo, new InMemoryAgentCli(), false);

  const { code, problem } = await printed(cli, ["eval"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problem, /not a git repository/);
  assert.match(problem, /git init/);
  assert.deepEqual(worktrees.worktreePaths, []);
  assert.deepEqual(
    (await fileReaders.readFilesRecursively(repoPath)).map(({ fileUrl }) => fileUrl.href).sort(),
    Object.keys(files).sort(),
  );
});

test("outside a git repository, git refuses before the agent's command line is asked for or promptfoo installed (CORE-FR-206, CORE Story 53 scenario 4)", async () => {
  const promptfoo = new InMemoryPromptfoo(false);
  const files = holding([{ prompt: "plan this feature", expect: { invoke: "planning" } }]);
  const { cli } = surfaces(files, promptfoo, new InMemoryAgentCli(false), false);

  const { code, problem } = await printed(cli, ["eval"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problem, /not a git repository/);
  assert.equal(promptfoo.installCount, 0);
});

test("no case outside a git repository answers that there is none, as in a repository (CORE-FR-206)", async () => {
  const { cli } = surfaces(
    { [at(".cw/settings.json")]: `${JSON.stringify({ agents: ["claude"] })}\n` },
    new InMemoryPromptfoo(),
    new InMemoryAgentCli(),
    false,
  );

  const commandOutput = await printed(cli, ["eval"]);

  assert.equal(commandOutput.code, EXIT_OK);
  assert.match(commandOutput.outputText, /holds no case/);
});

test("a folder of notes and no case outside a git repository answers that there is none (CORE-FR-206)", async () => {
  const { cli } = surfaces(
    {
      [at(".cw/settings.json")]: `${JSON.stringify({ agents: ["claude"] })}\n`,
      [at(".cw/charter/eval/notes.md")]: "# Notes\n",
    },
    new InMemoryPromptfoo(),
    new InMemoryAgentCli(),
    false,
  );

  const commandOutput = await printed(cli, ["eval"]);

  assert.equal(commandOutput.code, EXIT_OK);
  assert.match(commandOutput.outputText, /holds no case/);
});

test("what a stopped run left, and no case, outside a git repository answers that there is none (CORE-FR-206)", async () => {
  const settingsFile = `${JSON.stringify({ agents: ["claude"] })}\n`;
  const { cli } = surfaces(
    { [at(".cw/settings.json")]: settingsFile, [at(".cw/log/eval/worktrees/7/.cw/settings.json")]: settingsFile },
    new InMemoryPromptfoo(),
    new InMemoryAgentCli(),
    false,
  );

  const commandOutput = await printed(cli, ["eval"]);

  assert.equal(commandOutput.code, EXIT_OK);
  assert.match(commandOutput.outputText, /holds no case/);
});
