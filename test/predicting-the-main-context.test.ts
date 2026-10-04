import { test } from "node:test";
import assert from "node:assert/strict";
import { api } from "../src/driver/portal/routes.js";
import { Commander } from "../src/driver/cli/Commander.js";
import { COMMANDS } from "../src/driver/cli/commands/index.js";
import { EXIT_FAILURE, EXIT_OK } from "../src/driver/cli/commands/Command.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { TestAuthoring } from "../src/hexagon/application/TestAuthoring.js";
import { CLAUDE_TOKEN_FACTOR } from "../src/hexagon/domain/services/context/claudeMainContextFactory.js";
import { DataDTOs, OutcomeDTOs } from "../src/hexagon/port/driver/dtos/index.js";
import { InMemoryAgentCli } from "../src/zdriven/InMemoryAgentCli.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryTokenCounter } from "../src/zdriven/InMemoryTokenCounter.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import { noPlacesReached } from "./no-places.js";
import { noSessionsKept } from "./no-sessions.js";

const repoPath = new URL("file:///repo/");
const at = (path: string) => new URL(path, repoPath).href;

const primitive = (kind: string, id: string, headers: readonly string[], body: string) =>
  ["---", `kind: ${kind}`, `id: ${id}`, ...headers, "---", "", body, ""].join("\n");

/** A charter holding a guide loaded on every turn, one loaded when a file it
 *  names is touched, a skill and a subagent, each pinned down by a case so no
 *  warning is said of it. */
const holding = (settings: object = { agents: ["claude"] }) => ({
  [at(".cw/settings.json")]: `${JSON.stringify(settings)}\n`,
  [at(".cw/charter/guide/plain-words/index.md")]: primitive(
    "guide",
    "plain-words",
    ["description: Write in plain words."],
    "Write every sentence in plain words, whole, with no shorthand. ".repeat(20),
  ),
  [at(".cw/charter/guide/no-any/index.md")]: primitive(
    "guide",
    "no-any",
    ["description: Reject the any type.", 'globs: ["src/**/*.ts"]'],
    "Never write any.",
  ),
  [at(".cw/charter/skill/refactoring/index.md")]: primitive(
    "skill",
    "refactoring",
    ["description: Change how code is structured without changing what it does.", 'triggers: ["refactor this"]'],
    "Refactor.",
  ),
  [at(".cw/charter/agent/reviewer/index.md")]: primitive(
    "agent",
    "reviewer",
    ["description: Review a diff.", 'tools: ["Read"]'],
    "Review.",
  ),
  [at(".cw/test/guides.json")]: JSON.stringify({
    cases: [
      { do: { touchFile: "src/one.ts" }, expect: { activate: "no-any" } },
      { do: { touchFile: "README.md" }, expect: { activate: "plain-words" } },
    ],
  }),
});

/** The command line and the routes over one repository held in memory, the
 *  agent's command line installed or not. */
const surfaces = (files: Readonly<Record<string, string>>, agentCli = new InMemoryAgentCli()) => {
  const held = new InMemoryFileReaders(files);
  const vcs = new InMemoryVCS();
  const charterAuthoringApp = new CharterAuthoring(repoPath, held, new YamlParser(), new InMemoryFileOutput(held), vcs, new InMemoryTokenCounter(), {
    claude: agentCli,
  });
  const charterVendoringApp = new CharterVendoring(repoPath, held, vcs);
  const testAuthoringApp = new TestAuthoring(repoPath, held, new InMemoryFileOutput(held));
  const cli = new Commander({ cwd: "/repo", version: "0.0.0", charterAuthoringApp, charterVendoringApp, testAuthoringApp, mcpConnectingApp: noPlacesReached, sessionReviewingApp: noSessionsKept }, COMMANDS);
  return { portalRoutes: api(charterAuthoringApp, charterVendoringApp, testAuthoringApp), held, cli };
};

/** What one command printed to each stream, and its exit status. */
const printed = async (cli: Commander, argv: readonly string[]) => {
  const results: string[] = [];
  const problems: string[] = [];
  const kept = { out: process.stdout.write, err: process.stderr.write };
  process.stdout.write = ((text: string) => (results.push(String(text)), true)) as typeof kept.out;
  process.stderr.write = ((text: string) => (problems.push(String(text)), true)) as typeof kept.err;
  try {
    return { code: await cli.run(argv), text: results.join(""), problem: problems.join("") };
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
    // The skill the engine brings is loaded as one authored here is.
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

test("the estimate is the tokenizer's count scaled to the agent's own (EVAL-SC-002)", async () => {
  const agentCli = new InMemoryAgentCli();
  const { cli } = surfaces(holding(), agentCli);
  // The text a skill puts there, as the agent's command line was handed it.
  await printed(cli, ["context", "--exact"]);
  const refactoringPrompt = agentCli.prompts.find((prompt) => prompt.startsWith("refactoring:"))!;

  const { text } = await printed(cli, ["context"]);

  // One token a word, here, scaled to claude's.
  const refactoringWords = refactoringPrompt.split(/\s+/).filter((word) => word !== "").length;
  assert.equal(listedLoads(text).find(({ id }) => id === "refactoring")?.tokens, Math.round(refactoringWords * CLAUDE_TOKEN_FACTOR));
});

test("a guide naming files is listed apart, as loaded when one is touched, and is not in the total (EVAL-FR-003)", async () => {
  const { portalRoutes } = surfaces(holding());

  const answer = await portalRoutes.request("/charter/root/context");

  assert.equal(answer.status, 200);
  const [mainContext] = DataDTOs.MainContexts.parse(await answer.json()).data.contexts;
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

test("counted exactly, each number is the agent's own command line's, and said to be exact (EVAL-FR-004)", async () => {
  const agentCli = new InMemoryAgentCli();
  const { cli } = surfaces(holding(), agentCli);

  const { code, text } = await printed(cli, ["context", "--exact"]);

  assert.equal(code, EXIT_OK);
  assert.match(text, /in all, counted exactly by claude/);
  // The command line sends two tokens a word of what it is given, and
  // one word of next to nothing is what it is measured against.
  const refactoringPrompt = agentCli.prompts.find((prompt) => prompt.startsWith("refactoring:"))!;
  const refactoringWords = refactoringPrompt.split(/\s+/).filter((word) => word !== "").length;
  assert.equal(listedLoads(text).find(({ id }) => id === "refactoring")?.tokens, 2 * refactoringWords - 2);
  assert.ok(agentCli.prompts.includes("."));
});

test("counted exactly with no command line installed is refused, saying the estimate needs nothing (EVAL-FR-004)", async () => {
  const agentCli = new InMemoryAgentCli(false);
  const { cli } = surfaces(holding(), agentCli);

  const { code, problem } = await printed(cli, ["context", "--exact"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problem, /not installed/);
  assert.match(problem, /without --exact/);
  assert.deepEqual(agentCli.prompts, []);
});

test("a build says the predicted total in one line (EVAL-FR-005)", async () => {
  const { cli, portalRoutes } = surfaces(holding());
  const predicted = DataDTOs.MainContexts.parse(await (await portalRoutes.request("/charter/root/context")).json());

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
    OutcomeDTOs.DoctorOutcome.parse(await (await routes.request("/charter/root/health")).json()).data.problemCount;

  // A warning, as every other: said, and no question the more unwell for it.
  assert.equal(await problemCountOf(portalRoutes), await problemCountOf(underCeilingRoutes));
  assert.match(text, /Context: {2}claude opens a session with about [\d,]+ tokens, past the ceiling of 100\./);
});

test("the health check is quiet under the 20,000 a repository setting none is held to (EVAL-FR-006)", async () => {
  const { cli, portalRoutes } = surfaces(holding());

  const { text } = await printed(cli, ["doctor"]);
  const doctorOutcome = OutcomeDTOs.DoctorOutcome.parse(await (await portalRoutes.request("/charter/root/health")).json());

  assert.match(text, /Context: {2}claude opens a session with about [\d,]+ tokens, within the ceiling of 20,000\./);
  assert.equal(doctorOutcome.data.mainContextCeiling, 20_000);
  assert.equal(doctorOutcome.data.mainContexts[0]?.agent, "claude");
});

test("the portal is given the same list and total the command prints, and the whole settings (EVAL-FR-007)", async () => {
  const { cli, portalRoutes } = surfaces(holding({ agents: ["claude"], mainContextCeiling: 30_000 }));

  const { text } = await printed(cli, ["context"]);
  const [mainContext] = DataDTOs.MainContexts.parse(await (await portalRoutes.request("/charter/root/context")).json()).data.contexts;
  const settings = DataDTOs.WorkspaceSettings.parse(await (await portalRoutes.request("/settings")).json());

  assert.deepEqual(
    listedLoads(text),
    [...mainContext!.data.sessionLoads, ...mainContext!.data.fileLoads].map(({ data: { tokens, kind, id } }) => ({ tokens, kind, id })),
  );
  assert.deepEqual(settings.data, { agents: ["claude"], mainContextCeiling: 30_000 });
});

test("setup keeps the ceiling it is given, and the one already set when given none (EVAL-FR-006)", async () => {
  const { cli, held } = surfaces(holding());

  assert.equal((await printed(cli, ["init", "--agent", "claude", "--mainContextCeiling", "5000"])).code, EXIT_OK);
  assert.deepEqual(JSON.parse((await held.readIfThere(new URL(".cw/settings.json", repoPath)))!), { agents: ["claude"], mainContextCeiling: 5000 });

  assert.equal((await printed(cli, ["init", "--agent", "claude"])).code, EXIT_OK);
  assert.deepEqual(JSON.parse((await held.readIfThere(new URL(".cw/settings.json", repoPath)))!), { agents: ["claude"], mainContextCeiling: 5000 });
});

test("a repository compiling for no agent is told nothing is loaded", async () => {
  const { cli } = surfaces(holding({ agents: [] }));

  const { code, text } = await printed(cli, ["context"]);

  assert.equal(code, EXIT_OK);
  assert.match(text, /No agent is chosen/);
});
