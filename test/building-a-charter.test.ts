import { test } from "node:test";
import assert from "node:assert/strict";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import type { DataDTOs } from "../src/hexagon/port/driver/dtos/index.js";

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
const building = (files: Readonly<Record<string, string>>) => {
  const held = new InMemoryFileReaders(files);
  const charterAuthoringApp = new CharterAuthoring(repo, held, new YamlParser(), new InMemoryFileOutput(held), new InMemoryVCS());
  return { held, build: () => charterAuthoringApp.build() };
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
    ".cw/out/guide/no-any/index.md",
    ".cw/out/skill/cw-author/index.md",
    "CLAUDE.md",
    ".mcp.json",
    ".claude/skills/skill-cw-author/SKILL.md",
    ".claude/rules/guide-no-any.md",
  ]);
  assert.deepEqual(built.deleted, []);
  assert.ok((await contentsOf(held, ".cw/out/guide/no-any/index.md")).includes("The body of no-any."));
  assert.ok((await contentsOf(held, ".claude/rules/guide-no-any.md")).includes("@../../.cw/out/guide/no-any/index.md"));
});

test("an id holding / is built as one file in its kind's folder, each / as -, and into a host file named the same way (FR-141)", async () => {
  const { held, build } = building({ ...compilingFor("claude"), [at("guide/mfbs/no-any/index.md")]: guide("mfbs/no-any") });

  const built = filesOf(await build());
  const catalogue = JSON.parse(await contentsOf(held, ".cw/out/catalog.json")) as readonly { identity: string; file: string }[];

  assert.ok(built.added.includes(".cw/out/guide/mfbs/no-any/index.md"));
  assert.ok(built.added.includes(".claude/rules/guide-mfbs-no-any.md"));
  assert.equal(catalogue.find((entry) => entry.identity === "guide:mfbs/no-any")?.file, ".cw/out/guide/mfbs/no-any/index.md");
});

test("what the engine brings is compiled to the agent's skill surface, and nothing is written for it under the workspace (FR-021, FR-022)", async () => {
  const { held, build } = building(compilingFor("claude"));

  const built = filesOf(await build());

  assert.ok(built.added.includes(".claude/skills/skill-cw-author/SKILL.md"));
  assert.ok((await contentsOf(held, ".claude/skills/skill-cw-author/SKILL.md")).includes("name: skill-cw-author"));
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
  const builtinSkillFile = await contentsOf(held, ".claude/skills/skill-cw-author/SKILL.md");
  held.write(new URL(".claude/skills/skill-cw-retired/SKILL.md", repo), builtinSkillFile.replaceAll("cw-author", "cw-retired"));

  const built = filesOf(await build());

  assert.deepEqual(built.deleted, [".claude/skills/skill-cw-retired/SKILL.md"]);
  await assert.rejects(() => contentsOf(held, ".claude/skills/skill-cw-retired/SKILL.md"));
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
  assert.deepEqual(built.deleted, [".cw/out/agent/ship/index.md", ".claude/agents/agent-ship.md"]);
  await assert.rejects(() => contentsOf(held, ".cw/out/agent/ship/index.md"));
  await assert.rejects(() => contentsOf(held, ".claude/agents/agent-ship.md"));
});

test("a compiled file someone edited by hand is written back over (FR-020)", async () => {
  const { held, build } = building({
    ...compilingFor("claude"),
    [at("guide/no-any/index.md")]: guide("no-any", "Never write `any`."),
  });
  await build();
  held.write(new URL(".claude/rules/guide-no-any.md", repo), "Whatever someone typed in here.");

  await build();

  assert.ok((await contentsOf(held, ".claude/rules/guide-no-any.md")).includes("@../../.cw/out/guide/no-any/index.md"));
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
    hooks: { PostToolUse: [{ hooks: [{ type: "command", command: "./bin/report-ci" }] }] },
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

test("a body naming a place, a script or a template no layer holds stops the build (FR-143, FR-162)", async () => {
  for (const mentionedIdentity of ["mcp:missing", "script:missing", "template:missing"]) {
    const { build } = building({
      ...compilingFor("claude"),
      [at("guide/no-any/index.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]'], `Take the requirements from ${mentionedIdentity}.`),
    });

    const planSummaryDTO = await build();

    assert.equal(planSummaryDTO.type, "FaultsByFile", mentionedIdentity);
  }
});

test("a build writes every place the charter's mcps reach to mcp-origins.json, with the name each identity is served under (FR-145)", async () => {
  const { held, build } = building({
    [at("guide/no-any/index.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]'], "Read mcp:mfbs/billing."),
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
        identities: ["mcp:mfbs/billing"],
        names: { "mcp:mfbs/billing": "mfbs_19e4" },
        address: "https://api.githubcopilot.com/mcp/",
        endpoint: "https://api.githubcopilot.com/mcp/",
        path: "acme/billing",
        auth: ["oauth", "token"],
      },
    ],
  });
});

test("a charter with no mcp still writes the list, empty, for the server to find (FR-145, FR-152)", async () => {
  const { held, build } = building({ [at("guide/no-any/index.md")]: guide("no-any") });

  filesOf(await build());

  assert.equal(await contentsOf(held, ".cw/out/mcp-origins.json"), '{\n  "origins": []\n}\n');
});

test("a charter with an mcp gives the host one cw entry, beside the repository's own left untouched (FR-146)", async () => {
  const { held, build } = building({
    ...compilingFor("claude"),
    [at("guide/no-any/index.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]'], "Read mcp:billing."),
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

test("the cw entry is written before the charter holds any mcp, so a place added later needs no setup (FR-146)", async () => {
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
  });
});

/** A script kept as its file and the one file of its folder. */
const script = (id: string) => ({
  [at(`script/${id}/index.md`)]: primitive("script", id, [`executionPath: ./run.sh`], "Takes no argument."),
  [at(`script/${id}/run.sh`)]: "#!/usr/bin/env bash\n",
});

test("once compiled, a place, a script or a template a body names is a link to the file the catalogue names for it, from the document holding it (FR-147)", async () => {
  const { held, build } = building({
    ...compilingFor("claude"),
    [at("guide/no-any/index.md")]: primitive(
      "guide",
      "no-any",
      ['globs: ["src/**/*.ts"]'],
      "Take the requirements from mcp:github/billing, run script:check, and fill template:note.",
    ),
    [at("mcp/github/billing/index.md")]: primitive("mcp", "github/billing", ["endpoint: https://api.githubcopilot.com/mcp/", "auth: [oauth]", "tools: [search_code]"]),
    ...script("check"),
    [at("template/note/index.md")]: primitive("template", "note", [], "Released."),
  });

  filesOf(await build());

  const compiledDocument = await contentsOf(held, ".cw/out/guide/no-any/index.md");
  assert.ok(
    compiledDocument.includes(
      "Take the requirements from [mcp:github/billing](../../mcp/github/billing/index.md), run [script:check](../../script/check/index.md), and fill [template:note](../../template/note/index.md).",
    ),
  );
  // Each link opens from the document holding it.
  for (const [, target] of compiledDocument.matchAll(/\]\(((?:\.\.\/)+[^)]+)\)/g))
    assert.notEqual(await held.readIfThere(new URL(target ?? "", new URL(".cw/out/guide/no-any/index.md", repo))), undefined, target);
});

test("a name alone in a code span keeps the span as the link's text; one inside a longer span, a fenced block or a link is left as written (FR-147)", async () => {
  const body = [
    "Run `script:check` first.",
    "Try `cw explain script:check` when unsure.",
    "See [script:check](https://example.com/why).",
    "",
    "```sh",
    "cw explain script:check",
    "```",
    "",
    "Then script:check again.",
  ].join("\n");
  const { held, build } = building({ [at("skill/release/index.md")]: primitive("skill", "release", ['triggers: ["release"]'], body), ...script("check") });

  filesOf(await build());

  assert.ok(
    (await contentsOf(held, ".cw/out/skill/release/index.md")).includes(
      [
        "Run [`script:check`](../../script/check/index.md) first.",
        "Try `cw explain script:check` when unsure.",
        "See [script:check](https://example.com/why).",
        "",
        "```sh",
        "cw explain script:check",
        "```",
        "",
        "Then [script:check](../../script/check/index.md) again.",
      ].join("\n"),
    ),
  );
});

test("a mixin's body lent to a primitive holds its links as that primitive's document reads them, and a placeholder is left as written (FR-147)", async () => {
  const { held, build } = building({
    [at("mixin/checked/index.md")]: primitive("mixin", "checked", [], "Always run script:check, never script:<id>."),
    [at("skill/release/index.md")]: primitive("skill", "release", ['triggers: ["release"]', 'mixins: ["checked"]'], "Tag it."),
    ...script("check"),
  });

  filesOf(await build());

  assert.ok((await contentsOf(held, ".cw/out/skill/release/index.md")).includes("Always run [script:check](../../script/check/index.md), never script:<id>."));
});

test("a template's body names a script as a link, as any compiled document does (FR-147)", async () => {
  const { held, build } = building({
    [at("template/note/index.md")]: primitive("template", "note", [], "Checked by script:check."),
    [at("skill/release/index.md")]: primitive("skill", "release", ['triggers: ["release"]'], "Fill template:note."),
    ...script("check"),
  });

  filesOf(await build());

  assert.ok((await contentsOf(held, ".cw/out/template/note/index.md")).includes("Checked by [script:check](../../script/check/index.md)."));
});
test("a sensor's run naming a script is, in the command its host runs, the built file's path from the repository's root (FR-169)", async () => {
  const { held, build } = building({
    ...compilingFor("claude"),
    [at("sensor/check-on-stop/index.md")]: primitive("sensor", "check-on-stop", ["signal: Stop", 'run: "script:release/check --strict"']),
    [at("script/release/check/index.md")]: primitive("script", "release/check", ["executionPath: ./bin/run.sh"], ""),
    [at("script/release/check/bin/run.sh")]: "#!/usr/bin/env bash\n",
  });

  filesOf(await build());

  assert.deepEqual(JSON.parse(await contentsOf(held, ".claude/settings.json")).hooks, {
    Stop: [{ hooks: [{ type: "command", command: ".cw/out/script/release/check/bin/run.sh --strict" }] }],
  });
  assert.notEqual(await held.readIfThere(new URL(".cw/out/script/release/check/bin/run.sh", repo)), undefined);
});

test("a sensor's run naming a script no layer holds stops the build, under the sensor's file (FR-162)", async () => {
  const { build } = building({ [at("sensor/check-on-stop/index.md")]: primitive("sensor", "check-on-stop", ["signal: Stop", "run: script:missing"]) });

  const planSummaryDTO = await build();

  assert.ok(planSummaryDTO.type === "FaultsByFile");
  const [file, faults] = Object.entries(planSummaryDTO.data.files)[0] ?? [];
  assert.equal(file, ".cw/charter/sensor/check-on-stop/index.md");
  assert.match(faults?.[0]?.data.message ?? "", /names "script:missing"/);
});

test("a warning is not an error: a charter that only warns still builds (FR-005)", async () => {
  const { build } = building({
    [at("guide/no-any/index.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]', "rationale: corpus:gone"]),
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
    ".cw/out/guide/no-any/index.md",
    ".cw/out/skill/cw-author/index.md",
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
