import assert from "node:assert/strict";
import { test } from "node:test";
import { CharterDTOs } from "../src/module/charter/app/port/in/charter.dto.js";
import { ClaudeProjection } from "../src/module/charter/infra/claude/claude-projection.adapter.js";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import type { Answer, ForRunningAgentCli } from "../src/module/runtime/app/port/out/running-agent-cli.port.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { WorkspaceDTOs } from "../src/module/workspace/app/port/in/workspace.dto.js";
import { Commander } from "../src/presentation/cli/cli.commander.js";
import { EXIT_FAILURE, EXIT_OK } from "../src/presentation/cli/commands/command.interface.js";
import { wrapAppToShowPaths } from "../src/presentation/cli/commands/helper.js";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { buildPortalRoutes } from "../src/presentation/portal/portal.routes.js";
import { authoringCharterOf, buildingCharterOf, commandLineOf, workspaceSettingsLoaderOf } from "./use-cases-of.js";

const repoPath = new URL("file:///repo/");
const at = (path: string) => new URL(path, repoPath).href;

const primitive = (kind: string, id: string, headers: readonly string[], body: string) =>
  ["---", `kind: ${kind}`, `id: ${id}`, ...headers, "---", "", body, ""].join("\n");

/** A charter holding a guide loaded on every turn, one loaded when a file it
 *  names is touched, a skill and a subagent, each pinned down by a case so no
 *  warning is said of it. */
const holding = (settings: object = { agents: ["claude"] }) => ({
  [at(".cw/settings.json")]: `${JSON.stringify(settings)}\n`,
  [at(".cw/charter/primitive/guide/plain-words/index.md")]: primitive(
    "guide",
    "plain-words",
    ["description: Write in plain words."],
    "Write every sentence in plain words, whole, with no shorthand. ".repeat(20),
  ),
  [at(".cw/charter/primitive/guide/no-any/index.md")]: primitive(
    "guide",
    "no-any",
    ["description: Reject the any type.", 'globs: ["src/**/*.ts"]'],
    "Never write any.",
  ),
  [at(".cw/charter/primitive/skill/refactoring/index.md")]: primitive(
    "skill",
    "refactoring",
    ["description: Change how code is structured without changing what it does.", 'triggers: ["refactor this"]'],
    "Refactor.",
  ),
  [at(".cw/charter/primitive/agent/reviewer/index.md")]: primitive(
    "agent",
    "reviewer",
    ["description: Review a diff.", 'tools: ["Read"]'],
    "Review.",
  ),
  [at(".cw/charter/test/guides.json")]: JSON.stringify({
    cases: [
      { do: { touchFile: "src/one.ts" }, expect: { activate: "no-any" } },
      { do: { touchFile: "README.md" }, expect: { activate: "plain-words" } },
    ],
  }),
});

/** The command line and the routes over one repository held in memory, the
 *  agent's command line installed or not. */
const surfaces = (files: Readonly<Record<string, string>>, agentCli: ForRunningAgentCli = new InMemoryAgentCli()) => {
  const fileReaders = new InMemoryFileReaders(files);
  const sourceFetcher = new InMemorySources();
  const charterAuthoringApp = authoringCharterOf(
    fileReaders,
    new InMemoryFileOutput(fileReaders),
    new InMemoryReporter(),
    { sourceFetcher },
  );
  const charterRuntimeApp = buildingCharterOf(
    fileReaders,
    new InMemoryFileOutput(fileReaders),
    new InMemoryTokenCounter(),
    {
      claude: agentCli,
    },
    new InMemoryReporter(),
  );
  const cli = new Commander(
    commandLineOf(
      fileReaders,
      new InMemoryFileOutput(fileReaders),
      { charterAuthoringApp, charterRuntimeApp },
      "/repo",
    ),
    COMMANDS,
  );
  return {
    portalRoutes: buildPortalRoutes(
      wrapAppToShowPaths(charterAuthoringApp, "/repo"),
      wrapAppToShowPaths(charterRuntimeApp, "/repo"),
      workspaceSettingsLoaderOf(fileReaders),
    ),
    fileReaders,
    cli,
  };
};

/** What one command printed to each stream, and its exit status. */
const printed = async (cli: Commander, argv: readonly string[]) => {
  const results: string[] = [];
  const problems: string[] = [];
  const kept = { out: process.stdout.write, err: process.stderr.write };
  process.stdout.write = ((text: string) => (results.push(String(text)), true)) as typeof kept.out;
  process.stderr.write = ((text: string) => (problems.push(String(text)), true)) as typeof kept.err;
  try {
    return { code: await cli.runCommandLine(argv), text: results.join(""), problem: problems.join("") };
  } finally {
    process.stdout.write = kept.out;
    process.stderr.write = kept.err;
  }
};

/** Every listed line, `<tokens>  <kind>  <id>`, as tokens, kind and id. */
const listedLoads = (text: string) =>
  text.split("\n").flatMap((line) => {
    const [, tokens, kind, id] = line.match(/^ +([\d,]+) {2}(\S+) +(\S+)/) ?? [];
    return tokens === undefined ? [] : [{ tokens: Number(tokens.replaceAll(",", "")), kind, id }];
  });

test("the prediction lists what a session opens with, the largest first, with its total said to be an estimate (EVAL-FR-001, EVAL-FR-002)", async () => {
  const { cli } = surfaces(holding());

  const { code, text } = await printed(cli, ["context"]);

  assert.equal(code, EXIT_OK);
  const [sessionPart = ""] = text.split("Loaded when");
  const sessionLoads = listedLoads(sessionPart);
  assert.deepEqual(
    sessionLoads.map(({ id }) => id).sort(),
    // The skills the engine brings are loaded as one authored here is.
    ["CHARTER.md", "CLAUDE.md", "cw-author", "plain-words", "refactoring", "reviewer"],
  );
  assert.deepEqual(
    sessionLoads.map(({ tokens }) => tokens),
    sessionLoads.map(({ tokens }) => tokens).sort((one, other) => other - one),
  );
  const total = sessionLoads.reduce((sum, { tokens }) => sum + tokens, 0);
  assert.match(text, new RegExp(`${total.toLocaleString("en-US")} tokens in all, estimated`));
  // A guide loaded on every turn is its rule and the whole guide, past a
  // skill's one line.
  const tokensOf = (id: string) => sessionLoads.find((load) => load.id === id)!.tokens;
  assert.ok(tokensOf("plain-words") > 200);
  assert.ok(tokensOf("refactoring") < 30);
});

// How close the scaled count comes to the real agent's (EVAL-SC-002) is
// measured against the real `claude` by `cw context --agent=claude`, never here.
test("the estimate is the tokenizer's count scaled to the agent's own (EVAL-FR-002)", async () => {
  const agentCli = new InMemoryAgentCli();
  const { cli } = surfaces(holding(), agentCli);
  // The text a skill puts there, as the agent's command line was handed it.
  await printed(cli, ["context", "--agent=claude"]);
  const refactoringPrompt = agentCli.prompts.find((prompt) => prompt.startsWith("refactoring:"))!;

  const { text } = await printed(cli, ["context"]);

  // One token a word, here, scaled to claude's.
  const refactoringWords = refactoringPrompt.split(/\s+/).filter((word) => word !== "").length;
  assert.equal(
    listedLoads(text).find(({ id }) => id === "refactoring")?.tokens,
    Math.round(refactoringWords * new ClaudeProjection(new InMemoryFileReaders()).tokenFactor),
  );
});

test("a guide naming files is listed apart, as loaded when one is touched, and is not in the total (EVAL-FR-003)", async () => {
  const { portalRoutes } = surfaces(holding());

  const answer = await portalRoutes.request("/charter/root/context");

  assert.equal(answer.status, 200);
  const [mainContext] = CharterDTOs.MainContexts.parse(await answer.json()).data.contexts;
  assert.ok(mainContext !== undefined);
  assert.deepEqual(
    mainContext.data.fileLoads.map(({ data: { id, globs } }) => ({ id, globs })),
    [{ id: "no-any", globs: ["src/**/*.ts"] }],
  );
  assert.ok(mainContext.data.sessionLoads.every(({ data: { id } }) => id !== "no-any"));
  assert.equal(
    mainContext.data.totalTokens,
    mainContext.data.sessionLoads.reduce((sum, { data: { tokens } }) => sum + tokens, 0),
  );
});

test("each mcp is counted by the names of the tools the server lists for it, and no schema (EVAL-FR-029)", async () => {
  const { portalRoutes } = surfaces({
    ...holding(),
    [at(".cw/charter/primitive/mcp/linear/index.md")]: primitive(
      "mcp",
      "linear",
      [
        "description: Issues.",
        "endpoint: https://mcp.linear.app/mcp",
        "auth: [token]",
        "tools: [list_issues, create_issue]",
      ],
      "Read the issues.",
    ),
  });

  const answer = await portalRoutes.request("/charter/root/context");

  const [mainContext] = CharterDTOs.MainContexts.parse(await answer.json()).data.contexts;
  const linearLoad = mainContext?.data.sessionLoads.find(({ data: { id } }) => id === "linear");
  assert.equal(linearLoad?.data.kind, "mcp");
  assert.ok((linearLoad?.data.tokens ?? 0) > 0);
});

/** Every line listed counted exactly, `<estimated>  <exact>  <difference>  <kind>  <id>`. */
const comparedLoads = (text: string) =>
  text.split("\n").flatMap((line) => {
    const [, estimatedTokens, exactTokens, difference, kind, id] =
      line.match(/^ +([\d,]+) +([\d,]+) +(\S+%|n\/a) {2}(\S+) +(\S+)/) ?? [];
    return estimatedTokens === undefined
      ? []
      : [
          {
            estimatedTokens: Number(estimatedTokens.replaceAll(",", "")),
            exactTokens: Number(exactTokens!.replaceAll(",", "")),
            difference,
            kind,
            id,
          },
        ];
  });

/** An agent's command line that sends the model the estimate's own count of
 *  a prompt, a tenth over, and nothing of its own for next to nothing: close
 *  enough to the estimate that no warning is said. */
class CloseAgentCli implements ForRunningAgentCli {
  readonly prompts: string[] = [];

  async isInstalled(): Promise<boolean> {
    return true;
  }

  async askAgent(prompt: string): Promise<Answer> {
    this.prompts.push(prompt);
    const promptWords = prompt.split(/\s+/).filter((word) => word !== "").length;
    const tokenFactor = new ClaudeProjection(new InMemoryFileReaders()).tokenFactor;
    return {
      resultText: "",
      usage: {
        inputTokens: prompt === "." ? 0 : Math.round(promptWords * tokenFactor * 1.1),
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      },
    };
  }
}

test("counted exactly for the agent named, each primitive is listed with its estimate, its exact count and how far apart they are, the totals too (CORE Story 55 scenario 34, EVAL-FR-004, EVAL Story 1 scenario 3)", async () => {
  const agentCli = new InMemoryAgentCli();
  const { cli } = surfaces(holding(), agentCli);
  const { text: estimatedText } = await printed(cli, ["context"]);

  const { code, text } = await printed(cli, ["context", "--agent=claude"]);

  assert.equal(code, EXIT_OK);
  assert.match(text, /claude opens a session with, estimated and counted exactly by claude:/);
  // The command line sends two tokens a word of what it is given, and
  // one word of next to nothing is what it is measured against.
  const refactoringPrompt = agentCli.prompts.find((prompt) => prompt.startsWith("refactoring:"))!;
  const refactoringWords = refactoringPrompt.split(/\s+/).filter((word) => word !== "").length;
  const compared = comparedLoads(text);
  const refactoringLoad = compared.find(({ id }) => id === "refactoring")!;
  assert.equal(refactoringLoad.exactTokens, 2 * refactoringWords - 2);
  // Each estimate is the one `cw context` says, beside it.
  assert.deepEqual(
    compared
      .filter(({ kind }) => kind !== "in")
      .map(({ estimatedTokens, kind, id }) => ({ tokens: estimatedTokens, kind, id }))
      .sort((left, right) => left.id!.localeCompare(right.id!)),
    listedLoads(estimatedText).sort((left, right) => left.id!.localeCompare(right.id!)),
  );
  // How far apart, as a share of the exact count.
  const refactoringDifference =
    ((refactoringLoad.estimatedTokens - refactoringLoad.exactTokens) / refactoringLoad.exactTokens) * 100;
  assert.equal(
    refactoringLoad.difference,
    `${refactoringDifference > 0 ? "+" : ""}${refactoringDifference.toFixed(1)}%`,
  );
  // The totals, of what a session opens with alone.
  const [sessionPart = ""] = text.split("Loaded when");
  const sessionLoads = comparedLoads(sessionPart).filter(({ id }) => id !== "all");
  const totalLine = text.split("\n").find((line) => line.endsWith("in all"))!;
  const [, estimatedTotal, exactTotal] = totalLine.match(/^ +([\d,]+) +([\d,]+) +\S+%/) ?? [];
  assert.equal(
    Number(estimatedTotal!.replaceAll(",", "")),
    sessionLoads.reduce((sum, { estimatedTokens }) => sum + estimatedTokens, 0),
  );
  assert.equal(
    Number(exactTotal!.replaceAll(",", "")),
    sessionLoads.reduce((sum, { exactTokens }) => sum + exactTokens, 0),
  );
  assert.ok(agentCli.prompts.includes("."));
  // A guide naming files is listed apart, with both counts too.
  assert.ok(comparedLoads(text.split("Loaded when")[1] ?? "").some(({ id }) => id === "no-any"));
});

test("totals more than 15% apart are warned of, and the count still succeeds (CORE Story 55 scenario 34, EVAL-FR-004, EVAL-SC-002)", async () => {
  // Two tokens a word, against the estimate's 1.43: far past 15%.
  const { cli } = surfaces(holding(), new InMemoryAgentCli());

  const { code, problem } = await printed(cli, ["context", "--agent=claude"]);

  assert.equal(code, EXIT_OK);
  assert.match(problem, /The estimate is [\d.]+% from the exact count, past the 15% EVAL-SC-002 allows\./);
});

test("totals within 15% are said to be within it, and no warning is said (CORE Story 55 scenario 34, EVAL-FR-004, EVAL-SC-002)", async () => {
  const { cli } = surfaces(holding(), new CloseAgentCli());

  const { code, text, problem } = await printed(cli, ["context", "--agent=claude"]);

  assert.equal(code, EXIT_OK);
  assert.equal(problem, "");
  assert.match(text, /Within the 15% EVAL-SC-002 allows\./);
});

test("with no agent named, the estimate is listed alone, and no agent's command line is run (CORE Story 55 scenario 35, EVAL-FR-004)", async () => {
  const agentCli = new InMemoryAgentCli();
  const { cli } = surfaces(holding({ agents: ["claude", "codex"] }), agentCli);

  const { code, text, problem } = await printed(cli, ["context"]);

  assert.equal(code, EXIT_OK);
  assert.equal(problem, "");
  assert.match(text, /claude opens a session with:/);
  assert.match(text, /codex opens a session with:/);
  assert.match(text, /in all, estimated/);
  assert.doesNotMatch(text, /exact/);
  assert.deepEqual(agentCli.prompts, []);
});

test("counted exactly with no command line installed is refused, saying the estimate needs nothing (CORE Story 55 scenario 36, EVAL-FR-004)", async () => {
  const agentCli = new InMemoryAgentCli(false);
  const { cli } = surfaces(holding(), agentCli);

  const { code, problem } = await printed(cli, ["context", "--agent=claude"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problem, /not installed/);
  assert.match(problem, /"cw context" with no agent named: the estimate needs nothing/);
  assert.deepEqual(agentCli.prompts, []);
});

test("counted exactly for an agent it cannot count through is refused, saying the estimate needs nothing (CORE Story 55 scenario 36, EVAL-FR-004)", async () => {
  const agentCli = new InMemoryAgentCli();
  const { cli } = surfaces(holding({ agents: ["claude", "codex"] }), agentCli);

  const { code, problem } = await printed(cli, ["context", "--agent=codex"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problem, /not supported for codex yet/);
  assert.match(problem, /"cw context" with no agent named: the estimate needs nothing/);
  assert.deepEqual(agentCli.prompts, []);
});

test("counted exactly for an agent the repository does not compile for is refused, saying the estimate needs nothing, and nothing is counted (CORE Story 55 scenario 36, EVAL-FR-004)", async () => {
  const agentCli = new InMemoryAgentCli();
  const { cli } = surfaces(holding({ agents: ["codex"] }), agentCli);

  const { code, problem } = await printed(cli, ["context", "--agent=claude"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problem, /does not compile for claude/);
  assert.match(problem, /"cw context" with no agent named: the estimate needs nothing/);
  assert.deepEqual(agentCli.prompts, []);
});

test("a build says the predicted total in one line (EVAL-FR-005)", async () => {
  const { cli, portalRoutes } = surfaces(holding());
  const predicted = CharterDTOs.MainContexts.parse(await (await portalRoutes.request("/charter/root/context")).json());

  const { code, text } = await printed(cli, ["build"]);

  assert.equal(code, EXIT_OK);
  const totalTokens = predicted.data.contexts[0]!.data.totalTokens.toLocaleString("en-US");
  assert.equal(text.split("\n").filter((line) => line.includes(totalTokens)).length, 1);
  assert.match(text, new RegExp(`claude opens a session with about ${totalTokens} tokens of the charter`));
});

test("the health check warns once the total passes the repository's ceiling, naming both (EVAL-FR-006)", async () => {
  const { cli, portalRoutes } = surfaces(holding({ agents: ["claude"], mainContextCeiling: 100 }));
  const { portalRoutes: underCeilingRoutes } = surfaces(holding());

  const { text } = await printed(cli, ["doctor"]);
  const problemCountOf = async (routes: typeof portalRoutes) =>
    CharterDTOs.DoctorOutcome.parse(await (await routes.request("/charter/root/health")).json()).data.problemCount;

  // A warning, as every other: said, and no question the more unwell for it.
  assert.equal(await problemCountOf(portalRoutes), await problemCountOf(underCeilingRoutes));
  assert.match(text, /⚠ Context: {2}claude opens a session with about [\d,]+ tokens, past the ceiling of 100\./);
});

test("the health check is quiet under the 20,000 a repository setting none is held to (EVAL-FR-006)", async () => {
  const { cli, portalRoutes } = surfaces(holding());

  const { text } = await printed(cli, ["doctor"]);
  const doctorOutcome = CharterDTOs.DoctorOutcome.parse(
    await (await portalRoutes.request("/charter/root/health")).json(),
  );

  assert.match(
    text,
    /✔ Context: {2}good \(claude opens a session with about [\d,]+ tokens, within the ceiling of 20,000\)\./,
  );
  assert.equal(doctorOutcome.data.mainContextCeiling, 20_000);
  assert.equal(doctorOutcome.data.mainContexts[0]?.agent, "claude");
});

test("the portal is given the same list and total the command prints, and the whole settings (EVAL-FR-007)", async () => {
  const { cli, portalRoutes } = surfaces(holding({ agents: ["claude"], mainContextCeiling: 30_000 }));

  const { text } = await printed(cli, ["context"]);
  const [mainContext] = CharterDTOs.MainContexts.parse(
    await (await portalRoutes.request("/charter/root/context")).json(),
  ).data.contexts;
  const settings = WorkspaceDTOs.WorkspaceSettings.parse(await (await portalRoutes.request("/settings")).json());

  assert.deepEqual(
    listedLoads(text),
    [...mainContext!.data.sessionLoads, ...mainContext!.data.fileLoads].map(({ data: { tokens, kind, id } }) => ({
      tokens,
      kind,
      id,
    })),
  );
  assert.deepEqual(settings.data, { isSetUp: true, agents: ["claude"], mainContextCeiling: 30_000 });
});

test("setup keeps the ceiling it is given, and the one already set when given none (EVAL-FR-006)", async () => {
  const { cli, fileReaders } = surfaces(holding());

  assert.equal((await printed(cli, ["init", "--agent", "claude", "--mainContextCeiling", "5000"])).code, EXIT_OK);
  assert.deepEqual(JSON.parse((await fileReaders.readIfThere(new URL(".cw/settings.json", repoPath)))!), {
    agents: ["claude"],
    mainContextCeiling: 5000,
  });

  assert.equal((await printed(cli, ["init", "--agent", "claude"])).code, EXIT_OK);
  assert.deepEqual(JSON.parse((await fileReaders.readIfThere(new URL(".cw/settings.json", repoPath)))!), {
    agents: ["claude"],
    mainContextCeiling: 5000,
  });
});

test("a repository compiling for no agent is told nothing is loaded", async () => {
  const { cli } = surfaces(holding({ agents: [] }));

  const { code, text } = await printed(cli, ["context"]);

  assert.equal(code, EXIT_OK);
  assert.match(text, /No agent is chosen/);
});
