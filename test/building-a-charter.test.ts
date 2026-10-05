import { test } from "node:test";
import assert from "node:assert/strict";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import type { DataDTOs } from "../src/hexagon/port/driver/dtos/index.js";
import { InMemoryTokenCounter } from "../src/zdriven/InMemoryTokenCounter.js";
import { InMemoryAgentCli } from "../src/zdriven/InMemoryAgentCli.js";
import { InMemoryMcpServers } from "../src/zdriven/InMemoryMcpServers.js";
import { InMemorySecrets } from "../src/zdriven/InMemorySecrets.js";
import { InMemoryAuthorizing } from "../src/zdriven/InMemoryAuthorizing.js";

const repo = new URL("file:///repo/");
const root = new URL(".cw/charter/", repo);

const primitive = (kind: string, id: string, headers: readonly string[] = [], body = `The body of ${id}.`) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: What ${id} is for, in one line.`, ...headers, "---", "", body, ""].join(
    "\n",
  );

const guide = (id: string, body?: string) => primitive("guide", id, ['globs: ["src/**/*.ts"]'], body);
const posture = (id: string, allow: string, deny: string) =>
  primitive("posture", id, [`allow: ["${allow}"]`, `deny: ["${deny}"]`]);

const at = (path: string) => new URL(path, root).href;

const inRepo = (path: string) => new URL(path, repo).href;

/** What the engine's own session primitives put under the workspace on every
 *  build, beside the authored charter's files (EVAL-FR-008, EVAL-FR-014). */
const sessionCounterPaths = [
  ".cw/out/skill/cw-session-cost/index.md",
  ".cw/out/script/cw-session-tokens-counter/index.md",
  ".cw/out/script/cw-session-tokens-counter/sessionTokensCounter.mjs",
  ".cw/out/sensor/cw-session-tokens-counter-on-stop/index.md",
];
/** The Stop hook the engine's own sensor compiles to in Claude's settings. */
const sessionCounterStopHook = { hooks: [{ type: "command", command: 'node ".cw/out/script/cw-session-tokens-counter/sessionTokensCounter.mjs"' }] };

/** What a repository answered at setup, kept in its own settings: which agents
 *  it compiles its charter for (FR-033). Every repository a build test authors
 *  says so, because one naming none has no host surface to build. */
const settingsFile = inRepo(".cw/settings.json");
const compilingFor = (...agents: readonly string[]) => ({
  [settingsFile]: `${JSON.stringify({ agents }, undefined, 2)}\n`,
});

/** A charter on files a test can both write into and read back out of: the
 *  build puts its files where the next build finds them, which is what makes a
 *  second build over a changed charter the real thing. */
/** A build over these files; given `mcpServers` and `secrets`, it asks each
 *  mcp origin for its tools through them (EVAL-FR-031), and otherwise asks none. */
const building = (files: Readonly<Record<string, string>>, mcpServers?: InMemoryMcpServers, secrets?: InMemorySecrets) => {
  const held = new InMemoryFileReaders(files);
  const charterAuthoringApp = new CharterAuthoring(
    repo,
    held,
    new YamlParser(),
    new InMemoryFileOutput(held),
    new InMemoryVCS(),
    new InMemoryTokenCounter(),
    { claude: new InMemoryAgentCli() },
    mcpServers,
    secrets,
    mcpServers === undefined ? undefined : new InMemoryAuthorizing(),
  );
  return { held, build: () => charterAuthoringApp.build(), doctor: () => charterAuthoringApp.doctor() };
};

/** Every file one build put down, whether it was there before or not. */
const wrote = (built: DataDTOs.PlanSummary["data"]) => [...built.added, ...built.edited];

/** What a build did, where it did anything: a test asking for the files takes
 *  the charter holding for granted, and says so here rather than in every
 *  assertion after it. */
const filesOf = (planSummaryDTO: DataDTOs.PlanSummary | DataDTOs.FaultsByFile): DataDTOs.PlanSummary["data"] => {
  assert.ok(planSummaryDTO.type === "PlanSummary", "this build was refused, and the test expected it to run");
  return planSummaryDTO.data;
};

/** What one file holds after a build. */
const contentsOf = async (held: InMemoryFileReaders, path: string) => held.read(new URL(path, repo));

test("a build puts down everything one reading of the charter produces (FR-021)", async () => {
  const { held, build } = building({ ...compilingFor("claude"), [at("guide/no-any/index.md")]: guide("no-any") });

  const built = filesOf(await build());

  assert.deepEqual(built.added, [
    ".cw/out/catalog.json",
    ".cw/out/mcp-origins.json",
    ".cw/out/CHARTER.md",
    ".cw/out/skill/cw-author/index.md",
    ...sessionCounterPaths,
    ".cw/out/guide/no-any/index.md",
    "CLAUDE.md",
    ".claude/settings.json",
    ".mcp.json",
    ".claude/skills/cw-author/SKILL.md",
    ".claude/skills/cw-session-cost/SKILL.md",
    ".claude/rules/no-any.md",
  ]);
  assert.deepEqual(built.deleted, []);
  assert.ok((await contentsOf(held, ".cw/out/guide/no-any/index.md")).includes("The body of no-any."));
  assert.ok((await contentsOf(held, ".claude/rules/no-any.md")).includes("@../../.cw/out/guide/no-any/index.md"));
});

test("an id holding / is built as one file in its kind's folder, each / as -, and into a host file named the same way (FR-141)", async () => {
  const { held, build } = building({ ...compilingFor("claude"), [at("guide/mfbs/no-any/index.md")]: guide("mfbs/no-any") });

  const built = filesOf(await build());
  const catalogue = JSON.parse(await contentsOf(held, ".cw/out/catalog.json")) as readonly { id: string; file: string }[];

  assert.ok(built.added.includes(".cw/out/guide/mfbs/no-any/index.md"));
  assert.ok(built.added.includes(".claude/rules/mfbs-no-any.md"));
  assert.equal(catalogue.find((entry) => entry.id === "mfbs/no-any")?.file, ".cw/out/guide/mfbs/no-any/index.md");
});

test("what the engine brings is compiled to the agent's skill surface, and nothing is written for it under the workspace (FR-021, FR-022)", async () => {
  const { held, build } = building(compilingFor("claude"));

  const built = filesOf(await build());

  assert.ok(built.added.includes(".claude/skills/cw-author/SKILL.md"));
  assert.ok((await contentsOf(held, ".claude/skills/cw-author/SKILL.md")).includes("name: cw-author"));
  assert.deepEqual(
    wrote(built).filter((path) => path.startsWith(".cw/") && !path.startsWith(".cw/out/")),
    [],
  );
});

test("a skill an earlier engine brought and this one does not is taken away by the next build (FR-021)", async () => {
  const { held, build } = building(compilingFor("claude"));
  await build();
  // What an engine that once shipped another skill left behind: compiled and
  // stamped the way this one compiles its own.
  const builtinSkillFile = await contentsOf(held, ".claude/skills/cw-author/SKILL.md");
  held.write(new URL(".claude/skills/cw-retired/SKILL.md", repo), builtinSkillFile.replaceAll("cw-author", "cw-retired"));

  const built = filesOf(await build());

  assert.deepEqual(built.deleted, [".claude/skills/cw-retired/SKILL.md"]);
  await assert.rejects(() => contentsOf(held, ".claude/skills/cw-retired/SKILL.md"));
});

test("a projection whose primitive is gone is taken away by the next build (FR-020)", async () => {
  const { held, build } = building({
    ...compilingFor("claude"),
    [at("guide/no-any/index.md")]: guide("no-any"),
    [at("agent/ship/index.md")]: primitive("agent", "ship", ['tools: ["Bash"]']),
  });
  await build();
  held.remove(new URL("agent/ship/index.md", root));

  const built = filesOf(await build());

  // Its compiled document goes with it, as every projection of it does (FR-139).
  assert.deepEqual(built.deleted, [".cw/out/agent/ship/index.md", ".claude/agents/ship.md"]);
  await assert.rejects(() => contentsOf(held, ".cw/out/agent/ship/index.md"));
  await assert.rejects(() => contentsOf(held, ".claude/agents/ship.md"));
});

test("a compiled file someone edited by hand is written back over (FR-020)", async () => {
  const { held, build } = building({
    ...compilingFor("claude"),
    [at("guide/no-any/index.md")]: guide("no-any", "Never write `any`."),
  });
  await build();
  held.write(new URL(".claude/rules/no-any.md", repo), "Whatever someone typed in here.");

  await build();

  assert.ok((await contentsOf(held, ".claude/rules/no-any.md")).includes("@../../.cw/out/guide/no-any/index.md"));
});

test("a file the charter never wrote is left alone, wherever it sits", async () => {
  const { held, build } = building({
    ...compilingFor("claude"),
    [at("guide/no-any/index.md")]: guide("no-any"),
    // Under a directory this build owns nothing of: a build writes where the
    // charter says and reaches for nothing else.
    [inRepo("src/index.ts")]: "export const one = 1;\n",
  });

  const built = filesOf(await build());

  assert.deepEqual(built.deleted, []);
  assert.equal(await contentsOf(held, "src/index.ts"), "export const one = 1;\n");
});

test("every posture lands in the one settings file its host reads, merged (FR-018)", async () => {
  const { held, build } = building({
    ...compilingFor("claude"),
    [at("posture/sandboxed/index.md")]: posture("sandboxed", "Read(**)", "Bash(rm:*)"),
    [at("posture/no-network/index.md")]: posture("no-network", "Read(**)", "WebFetch"),
    [at("sensor/ci-failed/index.md")]: primitive("sensor", "ci-failed", ["signal: PostToolUse", "run: ./bin/report-ci"]),
  });

  const built = filesOf(await build());

  assert.equal(wrote(built).filter((path) => path === ".claude/settings.json").length, 1);
  assert.deepEqual(JSON.parse(await contentsOf(held, ".claude/settings.json")), {
    // Each thing once, however many primitives asked for it.
    // In the order the files sort in: `posture/no-network/index.md` before
    // `posture/sandboxed/index.md`.
    permissions: { allow: ["Read(**)"], deny: ["WebFetch", "Bash(rm:*)"] },
    hooks: { PostToolUse: [{ hooks: [{ type: "command", command: "./bin/report-ci" }] }], Stop: [sessionCounterStopHook] },
  });
});

test("the entry file its host reads unasked is sent to the charter (FR-051)", async () => {
  const { held, build } = building({ ...compilingFor("claude"), [at("guide/no-any/index.md")]: guide("no-any") });

  const built = filesOf(await build());

  assert.ok(wrote(built).includes("CLAUDE.md"));
  const entry = await contentsOf(held, "CLAUDE.md");
  assert.match(entry, /<!-- CHERRYWORKS START -->[\s\S]*<!-- CHERRYWORKS END -->/);
  assert.ok(entry.includes(".cw/out/CHARTER.md"));
  // A pointer and not a charter: no primitive of it reaches that file, whatever
  // the charter holds (SC-005).
  assert.ok(!entry.includes("The body of no-any."));
});

test("where the entry file sends a reader is where the build put the orientation (FR-051)", async () => {
  const { held, build } = building({ ...compilingFor("claude"), [at("guide/no-any/index.md")]: guide("no-any") });

  const built = filesOf(await build());

  // Read from the repository, which is where that file sits: the link is the
  // path the build wrote the orientation at, and not a path relative to
  // anything else.
  const [link] = /\]\(\.\/(.+?)\)/.exec(await contentsOf(held, "CLAUDE.md"))?.slice(1) ?? [];
  assert.equal(link, ".cw/out/CHARTER.md");
  assert.ok(wrote(built).includes(link ?? ""));
});

test("everything outside the section of an entry file is left exactly as it was (FR-051)", async () => {
  const { held, build } = building({
    ...compilingFor("claude"),
    [at("guide/no-any/index.md")]: guide("no-any"),
    [inRepo("CLAUDE.md")]: "# Notes\n\nWhat somebody wrote here long before a charter.\n",
  });

  await build();

  const entry = await contentsOf(held, "CLAUDE.md");
  assert.ok(entry.startsWith("# Notes\n\nWhat somebody wrote here long before a charter.\n"));
  assert.ok(entry.includes("<!-- CHERRYWORKS START -->"));
});

test("a section already in the entry file is written in place, and stays one section (FR-051)", async () => {
  const { held, build } = building({
    ...compilingFor("claude"),
    [at("guide/no-any/index.md")]: guide("no-any"),
    [inRepo("CLAUDE.md")]: ["<!-- CHERRYWORKS START -->", "What an older build put here.", "<!-- CHERRYWORKS END -->", ""].join(
      "\n",
    ),
  });

  await build();

  const entry = await contentsOf(held, "CLAUDE.md");
  assert.equal(entry.match(/<!-- CHERRYWORKS START -->/g)?.length, 1);
  assert.ok(!entry.includes("What an older build put here."));
});

test("a second build leaves the entry file byte for byte as the first did (SC-007)", async () => {
  const { held, build } = building({
    ...compilingFor("claude"),
    [at("guide/no-any/index.md")]: guide("no-any"),
    [inRepo("CLAUDE.md")]: "# Notes\n\nSomebody's own paragraph.\n",
  });
  await build();
  const afterTheFirst = await contentsOf(held, "CLAUDE.md");

  const built = filesOf(await build());

  assert.equal(await contentsOf(held, "CLAUDE.md"), afterTheFirst);
  assert.ok(built.unchanged.includes("CLAUDE.md"));
});

test("a repository compiling for no agent has no entry file written for it (FR-019, FR-051)", async () => {
  const { held, build } = building({ ...compilingFor(), [at("guide/no-any/index.md")]: guide("no-any") });

  const built = filesOf(await build());

  assert.ok(!wrote(built).includes("CLAUDE.md"));
  await assert.rejects(() => contentsOf(held, "CLAUDE.md"));
});

test("a charter with an error builds nothing at all, and says which files (FR-009)", async () => {
  const { held, build } = building({
    [at("guide/no-any/index.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]', 'mixins: ["nowhere"]']),
  });

  const planSummaryDTO = await build();

  assert.ok(planSummaryDTO.type === "FaultsByFile");
  assert.deepEqual(Object.keys(planSummaryDTO.data.files), [".cw/charter/guide/no-any/index.md"]);
  await assert.rejects(() => contentsOf(held, ".cw/out/CHARTER.md"));
});

test("a body naming [[<id>]] no layer holds stops the build (FR-143, FR-162)", async () => {
  for (const mentionedReference of ["[[missing]]", "[[team/missing]]"]) {
    const { build } = building({
      ...compilingFor("claude"),
      [at("guide/no-any/index.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]'], `Take the requirements from ${mentionedReference}.`),
    });

    const planSummaryDTO = await build();

    assert.equal(planSummaryDTO.type, "FaultsByFile", mentionedReference);
  }
});

test("a build writes every mcp origin the charter's mcps reach to mcp-origins.json, with the name each id is served under (FR-145)", async () => {
  const { held, build } = building({
    [at("guide/no-any/index.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]'], "Read [[mfbs/billing]]."),
    [at("mcp/mfbs/billing/index.md")]: primitive("mcp", "mfbs/billing", [
      "endpoint: https://api.githubcopilot.com/mcp/",
      "path: acme/billing",
      "auth: [oauth, token]",
      "tools: [search_code, get_file_contents]",
    ]),
  });

  filesOf(await build());

  assert.deepEqual(JSON.parse(await contentsOf(held, ".cw/out/mcp-origins.json")), {
    origins: [
      {
        ids: ["mfbs/billing"],
        names: { "mfbs/billing": "mfbs_05a0" },
        address: "https://api.githubcopilot.com/mcp/",
        endpoint: "https://api.githubcopilot.com/mcp/",
        path: "acme/billing",
        auth: ["oauth", "token"],
      },
    ],
  });
});

const LINEAR = "https://mcp.linear.app/mcp";
const linearDeclared = {
  [at("mcp/linear/index.md")]: primitive("mcp", "linear", [`endpoint: ${LINEAR}`, "auth: [token]", "tools: [list_issues, create_issue]"]),
};
const toolNamed = (name: string) => ({ name, description: `${name} at linear`, inputSchema: { type: "object", properties: { team: { type: "string" } } } });

test("a build asks each mcp origin for its tools and keeps those its mcps declare, with what each takes, beside it (EVAL-FR-031)", async () => {
  const mcpServers = new InMemoryMcpServers();
  mcpServers.servers.set(LINEAR, { tools: ["create_issue", "list_issues", "delete_team"].map(toolNamed) });
  const secrets = new InMemorySecrets();
  await secrets.writeSecret(LINEAR, JSON.stringify({ address: LINEAR, method: "token", accessToken: "linear token" }));
  const { held, build } = building(linearDeclared, mcpServers, secrets);

  filesOf(await build());

  const [linearOrigin] = JSON.parse(await contentsOf(held, ".cw/out/mcp-origins.json")).origins;
  assert.deepEqual(linearOrigin.tools, [toolNamed("create_issue"), toolNamed("list_issues")]);
  assert.deepEqual(mcpServers.connected, [{ address: LINEAR, accessToken: "linear token" }]);
  assert.deepEqual(mcpServers.closed, [LINEAR]);
});

/** What a build that was refused says, under each file. */
const faultsOf = (planSummaryDTO: DataDTOs.PlanSummary | DataDTOs.FaultsByFile) => {
  assert.ok(planSummaryDTO.type === "FaultsByFile", "this build ran, and the test expected it refused");
  return JSON.stringify(planSummaryDTO.data);
};

test("an mcp origin the build cannot ask for its tools stops the build, under the mcp's file, and writes nothing (EVAL-FR-031)", async () => {
  const mcpServers = new InMemoryMcpServers();
  mcpServers.servers.set(LINEAR, { tools: ["list_issues", "create_issue"].map(toolNamed) });
  const { held, build } = building(linearDeclared, mcpServers, new InMemorySecrets());

  const faultsText = faultsOf(await build());

  assert.match(faultsText, /mcp\/linear\/index\.md/);
  assert.match(faultsText, /not signed in/);
  assert.match(faultsText, /cw mcp auth linear/);
  assert.equal(await held.readIfThere(new URL(".cw/out/mcp-origins.json", repo)), undefined);
});

test("a tool an mcp declares that its mcp origin does not list stops the build, naming the tools it lists (EVAL-FR-031)", async () => {
  const mcpServers = new InMemoryMcpServers();
  mcpServers.servers.set(LINEAR, { tools: ["list_issues"].map(toolNamed) });
  const secrets = new InMemorySecrets();
  await secrets.writeSecret(LINEAR, JSON.stringify({ address: LINEAR, method: "token", accessToken: "linear token" }));
  const { build } = building(linearDeclared, mcpServers, secrets);

  const faultsText = faultsOf(await build());

  assert.match(faultsText, /mcp\/linear\/index\.md/);
  assert.match(faultsText, /no tool .*create_issue/);
  assert.match(faultsText, /list_issues/);
});

test("without the mcp origins to ask, a build keeps the tools the last build kept (EVAL-FR-031)", async () => {
  const keptTools = [toolNamed("create_issue"), toolNamed("list_issues")];
  const { held, build } = building({
    ...linearDeclared,
    [new URL(".cw/out/mcp-origins.json", repo).href]: JSON.stringify({ origins: [{ ids: ["linear"], address: LINEAR, endpoint: LINEAR, auth: ["token"], tools: keptTools }] }),
  });

  filesOf(await build());

  const [linearOrigin] = JSON.parse(await contentsOf(held, ".cw/out/mcp-origins.json")).origins;
  assert.deepEqual(linearOrigin.tools, keptTools);
});

test("a charter with no mcp still writes the list, empty, for the server to find (FR-145, FR-152)", async () => {
  const { held, build } = building({ [at("guide/no-any/index.md")]: guide("no-any") });

  filesOf(await build());

  assert.equal(await contentsOf(held, ".cw/out/mcp-origins.json"), '{\n  "origins": []\n}\n');
});

test("a charter with an mcp gives the host one cw entry, beside the repository's own left untouched (FR-146)", async () => {
  const { held, build } = building({
    ...compilingFor("claude"),
    [at("guide/no-any/index.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]'], "Read [[billing]]."),
    [at("mcp/billing/index.md")]: primitive("mcp", "billing", ["endpoint: https://mcp.example.com/", "auth: [oauth]", "tools: [search]"]),
    [inRepo(".mcp.json")]: `${JSON.stringify({ mcpServers: { mine: { command: "my-server", args: ["--stdio"] } } }, undefined, 2)}\n`,
  });

  filesOf(await build());

  assert.deepEqual(JSON.parse(await contentsOf(held, ".mcp.json")), {
    mcpServers: {
      mine: { command: "my-server", args: ["--stdio"] },
      cw: { command: "cw", args: ["mcp", "serve"] },
    },
  });
});

test("the cw entry is written before the charter holds any mcp, so an mcp origin added later needs no setup (FR-146)", async () => {
  const { held, build } = building({ ...compilingFor("claude"), [at("guide/no-any/index.md")]: guide("no-any") });

  filesOf(await build());

  assert.deepEqual(JSON.parse(await contentsOf(held, ".mcp.json")), { mcpServers: { cw: { command: "cw", args: ["mcp", "serve"] } } });
});

test("a repository compiling for no agent has no MCP configuration written for it (FR-146)", async () => {
  const { held, build } = building({ [at("guide/no-any/index.md")]: guide("no-any") });

  filesOf(await build());

  await assert.rejects(() => contentsOf(held, ".mcp.json"));
});

test("what the repository set in the host's settings is kept beside the charter's, at every depth (FR-018)", async () => {
  const { held, build } = building({
    ...compilingFor("claude"),
    [at("posture/sandboxed/index.md")]: posture("sandboxed", "Read(**)", "Bash(rm:*)"),
    [inRepo(".claude/settings.json")]: `${JSON.stringify({ model: "opus", permissions: { additionalDirectories: ["../shared"] } })}\n`,
  });

  filesOf(await build());

  assert.deepEqual(JSON.parse(await contentsOf(held, ".claude/settings.json")), {
    model: "opus",
    permissions: { additionalDirectories: ["../shared"], allow: ["Read(**)"], deny: ["Bash(rm:*)"] },
    hooks: { Stop: [sessionCounterStopHook] },
  });
});

/** A script kept as its file and the one file of its folder. */
const script = (id: string) => ({
  [at(`script/${id}/index.md`)]: primitive("script", id, [`executionPath: ./run.sh`], "Takes no argument."),
  [at(`script/${id}/run.sh`)]: "#!/usr/bin/env bash\n",
});

test("once compiled, an mcp origin, a script or a template a body names is a link to the file the catalogue names for it, from the document holding it (FR-147)", async () => {
  const { held, build } = building({
    ...compilingFor("claude"),
    [at("guide/no-any/index.md")]: primitive(
      "guide",
      "no-any",
      ['globs: ["src/**/*.ts"]'],
      "Take the requirements from [[github/billing]], run [[check]], and fill [[note]].",
    ),
    [at("mcp/github/billing/index.md")]: primitive("mcp", "github/billing", ["endpoint: https://api.githubcopilot.com/mcp/", "auth: [oauth]", "tools: [search_code]"]),
    ...script("check"),
    [at("template/note/index.md")]: primitive("template", "note", [], "Released."),
  });

  filesOf(await build());

  const compiledDocument = await contentsOf(held, ".cw/out/guide/no-any/index.md");
  assert.ok(
    compiledDocument.includes(
      "Take the requirements from [github/billing](../../mcp/github/billing/index.md), run [check](../../script/check/index.md), and fill [note](../../template/note/index.md).",
    ),
  );
  // Each link opens from the document holding it.
  for (const [, target] of compiledDocument.matchAll(/\]\(((?:\.\.\/)+[^)]+)\)/g))
    assert.notEqual(await held.readIfThere(new URL(target ?? "", new URL(".cw/out/guide/no-any/index.md", repo))), undefined, target);
});

test("a name alone in a code span keeps the span as the link's text; one inside a longer span, a fenced block or a link is left as written (FR-147)", async () => {
  const body = [
    "Run `[[check]]` first.",
    "Try `cw explain [[check]]` when unsure.",
    "See [why](https://example.com/why).",
    "",
    "```sh",
    "cw explain [[check]]",
    "```",
    "",
    "Then [[check]] again.",
  ].join("\n");
  const { held, build } = building({ [at("skill/release/index.md")]: primitive("skill", "release", ['triggers: ["release"]'], body), ...script("check") });

  filesOf(await build());

  assert.ok(
    (await contentsOf(held, ".cw/out/skill/release/index.md")).includes(
      [
        "Run [`check`](../../script/check/index.md) first.",
        "Try `cw explain [[check]]` when unsure.",
        "See [why](https://example.com/why).",
        "",
        "```sh",
        "cw explain [[check]]",
        "```",
        "",
        "Then [check](../../script/check/index.md) again.",
      ].join("\n"),
    ),
  );
});

test("a mixin's body lent to a primitive holds its links as that primitive's document reads them, and a placeholder is left as written (FR-147)", async () => {
  const { held, build } = building({
    [at("mixin/checked/index.md")]: primitive("mixin", "checked", [], "Always run [[check]], never [[<id>]]."),
    [at("skill/release/index.md")]: primitive("skill", "release", ['triggers: ["release"]', 'mixins: ["checked"]'], "Tag it."),
    ...script("check"),
  });

  filesOf(await build());

  assert.ok((await contentsOf(held, ".cw/out/skill/release/index.md")).includes("Always run [check](../../script/check/index.md), never [[<id>]]."));
});

test("a template's body names a script as a link, as any compiled document does (FR-147)", async () => {
  const { held, build } = building({
    [at("template/note/index.md")]: primitive("template", "note", [], "Checked by [[check]]."),
    [at("skill/release/index.md")]: primitive("skill", "release", ['triggers: ["release"]'], "Fill [[note]]."),
    ...script("check"),
  });

  filesOf(await build());

  assert.ok((await contentsOf(held, ".cw/out/template/note/index.md")).includes("Checked by [check](../../script/check/index.md)."));
});
test("a sensor's run naming a script is, in the command its host runs, the built file's path from the repository's root (FR-169)", async () => {
  const { held, build } = building({
    ...compilingFor("claude"),
    [at("sensor/check-on-stop/index.md")]: primitive("sensor", "check-on-stop", ["signal: Stop", 'run: "[[release/check]] --strict"']),
    [at("script/release/check/index.md")]: primitive("script", "release/check", ["executionPath: ./bin/run.sh"], ""),
    [at("script/release/check/bin/run.sh")]: "#!/usr/bin/env bash\n",
  });

  filesOf(await build());

  assert.deepEqual(JSON.parse(await contentsOf(held, ".claude/settings.json")).hooks, {
    Stop: [sessionCounterStopHook, { hooks: [{ type: "command", command: ".cw/out/script/release/check/bin/run.sh --strict" }] }],
  });
  assert.notEqual(await held.readIfThere(new URL(".cw/out/script/release/check/bin/run.sh", repo)), undefined);
});

test("a sensor's run naming a script no layer holds stops the build, under the sensor's file (FR-162)", async () => {
  const { build } = building({ [at("sensor/check-on-stop/index.md")]: primitive("sensor", "check-on-stop", ["signal: Stop", 'run: "[[missing]]"']) });

  const planSummaryDTO = await build();

  assert.ok(planSummaryDTO.type === "FaultsByFile");
  const [file, faults] = Object.entries(planSummaryDTO.data.files)[0] ?? [];
  assert.equal(file, ".cw/charter/sensor/check-on-stop/index.md");
  assert.match(faults?.[0]?.data.message ?? "", /names "missing"/);
});

test("a warning is not an error: a charter that only warns still builds (FR-005)", async () => {
  const { build } = building({
    [at("guide/no-any/index.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]', "rationale: gone"]),
  });

  const built = filesOf(await build());

  assert.ok(wrote(built).includes(".cw/out/CHARTER.md"));
});

test("building twice over an unchanged charter writes the same files and takes nothing away (SC-007)", async () => {
  const { build } = building({ ...compilingFor("claude"), [at("guide/no-any/index.md")]: guide("no-any") });

  const first = filesOf(await build());
  const second = filesOf(await build());

  // The same files, and none of them reported gone or changed: the second build
  // wrote every one the first did, and each already said what the charter says.
  assert.deepEqual(second.unchanged, wrote(first));
  assert.deepEqual(wrote(second), []);
  assert.deepEqual(second.deleted, []);
});

test("a charter naming no agent still gets the surface every reader shares (FR-019)", async () => {
  const { build } = building({ [at("guide/no-any/index.md")]: guide("no-any") });

  const built = filesOf(await build());

  assert.deepEqual(built.added, [
    ".cw/out/catalog.json",
    ".cw/out/mcp-origins.json",
    ".cw/out/CHARTER.md",
    ".cw/out/skill/cw-author/index.md",
    ...sessionCounterPaths,
    ".cw/out/guide/no-any/index.md",
  ]);
});

test("an agent this engine cannot compile for stops the build before it reads a charter (FR-033)", async () => {
  const { build } = building({ ...compilingFor("nowhere"), [at("guide/no-any/index.md")]: guide("no-any") });

  // Raised rather than reported: settings this engine cannot act on leave it
  // nothing to build against, and the user is sent back to `cw init`.
  await assert.rejects(build, /compiles for "nowhere"/);
});

test("what the charter speaks for is replaced; the rest of a host's settings is left alone (FR-018)", async () => {
  const { held, build } = building({
    ...compilingFor("claude"),
    [at("posture/sandboxed/index.md")]: posture("sandboxed", "Read(**)", "Bash(rm:*)"),
    [inRepo(".claude/settings.json")]: `${JSON.stringify({ model: "opus", permissions: { allow: ["Edit(**)"] } })}\n`,
  });

  await build();

  assert.deepEqual(JSON.parse(await contentsOf(held, ".claude/settings.json")), {
    // What the repository set for itself and this engine knows nothing about.
    model: "opus",
    // The charter speaks for permissions, so what it says they are is what they
    // are: a permission it no longer asks for is gone, not kept for ever.
    permissions: { allow: ["Read(**)"], deny: ["Bash(rm:*)"] },
    // The engine's own sensor speaks for the hooks, as an authored one would.
    hooks: { Stop: [sessionCounterStopHook] },
  });
});

test("a host's settings file is never taken away, however little the charter says there", async () => {
  const { held, build } = building({
    ...compilingFor("claude"),
    [at("posture/sandboxed/index.md")]: posture("sandboxed", "Read(**)", "Bash(rm:*)"),
  });
  await build();
  held.remove(new URL("posture/sandboxed/index.md", root));

  const built = filesOf(await build());

  // The posture's compiled document is the charter's and goes; the settings it
  // wrote into are the repository's too, and stay.
  assert.deepEqual(built.deleted, [".cw/out/posture/sandboxed/index.md"]);
  assert.ok(await contentsOf(held, ".claude/settings.json"));
});

test("settings that do not read stop the build before it reads a charter (FR-009)", async () => {
  const { build } = building({ [settingsFile]: "not json at all\n", [at("guide/no-any/index.md")]: guide("no-any") });

  await assert.rejects(build, /not JSON/);
});
