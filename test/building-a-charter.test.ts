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
  const { held, build } = building({ ...compilingFor("claude"), [at("guide/no-any.md")]: guide("no-any") });

  const built = filesOf(await build());

  assert.deepEqual(built.added, [
    ".cw/out/catalog.json",
    ".cw/out/catalog.min.json",
    ".cw/out/CHARTER.md",
    ".cw/out/guide/no-any.md",
    ".cw/out/skill/cw-author.md",
    "CLAUDE.md",
    ".claude/skills/skill-cw-author/SKILL.md",
    ".claude/rules/guide-no-any.md",
  ]);
  assert.deepEqual(built.deleted, []);
  assert.ok((await contentsOf(held, ".claude/rules/guide-no-any.md")).includes("The body of no-any."));
});

test("an id holding / is built into the folders it names, and into a host file named without it (FR-141)", async () => {
  const { held, build } = building({ ...compilingFor("claude"), [at("guide/mfbs/no-any.md")]: guide("mfbs/no-any") });

  const built = filesOf(await build());
  const catalogue = JSON.parse(await contentsOf(held, ".cw/out/catalog.json")) as readonly { identity: string; file: string }[];

  assert.ok(built.added.includes(".cw/out/guide/mfbs/no-any.md"));
  assert.ok(built.added.includes(".claude/rules/guide-mfbs-no-any.md"));
  assert.equal(catalogue.find((entry) => entry.identity === "guide:mfbs/no-any")?.file, ".cw/out/guide/mfbs/no-any.md");
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
    [at("guide/no-any.md")]: guide("no-any"),
    [at("command/ship.md")]: primitive("command", "ship"),
  });
  await build();
  held.remove(new URL("command/ship.md", root));

  const built = filesOf(await build());

  // Its compiled document goes with it, as every projection of it does (FR-139).
  assert.deepEqual(built.deleted, [".cw/out/command/ship.md", ".claude/commands/ship.md"]);
  await assert.rejects(() => contentsOf(held, ".cw/out/command/ship.md"));
  await assert.rejects(() => contentsOf(held, ".claude/commands/ship.md"));
});

test("a compiled file someone edited by hand is written back over (FR-020)", async () => {
  const { held, build } = building({
    ...compilingFor("claude"),
    [at("guide/no-any.md")]: guide("no-any", "Never write `any`."),
  });
  await build();
  held.write(new URL(".claude/rules/guide-no-any.md", repo), "Whatever someone typed in here.");

  await build();

  assert.ok((await contentsOf(held, ".claude/rules/guide-no-any.md")).includes("Never write `any`."));
});

test("a file the charter never wrote is left alone, wherever it sits", async () => {
  const { held, build } = building({
    ...compilingFor("claude"),
    [at("guide/no-any.md")]: guide("no-any"),
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
    [at("posture/sandboxed.md")]: posture("sandboxed", "Read(**)", "Bash(rm:*)"),
    [at("posture/no-network.md")]: posture("no-network", "Read(**)", "WebFetch"),
    [at("sensor/ci-failed.md")]: primitive("sensor", "ci-failed", ["signal: PostToolUse", "run: ./bin/report-ci"]),
  });

  const built = filesOf(await build());

  assert.equal(wrote(built).filter((path) => path === ".claude/settings.json").length, 1);
  assert.deepEqual(JSON.parse(await contentsOf(held, ".claude/settings.json")), {
    // Each thing once, however many primitives asked for it.
    // In the order the files sort in: `posture/no-network.md` before
    // `posture/sandboxed.md`.
    permissions: { allow: ["Read(**)"], deny: ["WebFetch", "Bash(rm:*)"] },
    hooks: { PostToolUse: [{ hooks: [{ type: "command", command: "./bin/report-ci" }] }] },
  });
});

test("the entry file its host reads unasked is sent to the charter (FR-051)", async () => {
  const { held, build } = building({ ...compilingFor("claude"), [at("guide/no-any.md")]: guide("no-any") });

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
  const { held, build } = building({ ...compilingFor("claude"), [at("guide/no-any.md")]: guide("no-any") });

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
    [at("guide/no-any.md")]: guide("no-any"),
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
    [at("guide/no-any.md")]: guide("no-any"),
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
    [at("guide/no-any.md")]: guide("no-any"),
    [inRepo("CLAUDE.md")]: "# Notes\n\nSomebody's own paragraph.\n",
  });
  await build();
  const afterTheFirst = await contentsOf(held, "CLAUDE.md");

  const built = filesOf(await build());

  assert.equal(await contentsOf(held, "CLAUDE.md"), afterTheFirst);
  assert.ok(built.unchanged.includes("CLAUDE.md"));
});

test("a repository compiling for no agent has no entry file written for it (FR-019, FR-051)", async () => {
  const { held, build } = building({ ...compilingFor(), [at("guide/no-any.md")]: guide("no-any") });

  const built = filesOf(await build());

  assert.ok(!wrote(built).includes("CLAUDE.md"));
  await assert.rejects(() => contentsOf(held, "CLAUDE.md"));
});

test("a charter with an error builds nothing at all, and says which files (FR-009)", async () => {
  const { held, build } = building({
    [at("guide/no-any.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]', 'mixins: ["nowhere"]']),
  });

  const planSummaryDTO = await build();

  assert.ok(planSummaryDTO.type === "FaultsByFile");
  assert.deepEqual(Object.keys(planSummaryDTO.data.files), [".cw/charter/guide/no-any.md"]);
  await assert.rejects(() => contentsOf(held, ".cw/out/CHARTER.md"));
});

test("a guide naming an mcp no layer holds builds nothing, the error under the guide (FR-143)", async () => {
  const { held, build } = building({
    [at("guide/no-any.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]', 'mcps: ["mcp:missing"]']),
  });

  const planSummaryDTO = await build();

  assert.ok(planSummaryDTO.type === "FaultsByFile");
  assert.deepEqual(Object.keys(planSummaryDTO.data.files), [".cw/charter/guide/no-any.md"]);
  await assert.rejects(() => contentsOf(held, ".cw/out/CHARTER.md"));
});

test("a warning is not an error: a charter that only warns still builds (FR-005)", async () => {
  const { build } = building({
    [at("guide/no-any.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]', "rationale: corpus:gone"]),
  });

  const built = filesOf(await build());

  assert.ok(wrote(built).includes(".cw/out/CHARTER.md"));
});

test("building twice over an unchanged charter writes the same files and takes nothing away (SC-007)", async () => {
  const { build } = building({ ...compilingFor("claude"), [at("guide/no-any.md")]: guide("no-any") });

  const first = filesOf(await build());
  const second = filesOf(await build());

  // The same files, and none of them reported gone or changed: the second build
  // wrote every one the first did, and each already said what the charter says.
  assert.deepEqual(second.unchanged, wrote(first));
  assert.deepEqual(wrote(second), []);
  assert.deepEqual(second.deleted, []);
});

test("a charter naming no agent still gets the surface every reader shares (FR-019)", async () => {
  const { build } = building({ [at("guide/no-any.md")]: guide("no-any") });

  const built = filesOf(await build());

  assert.deepEqual(built.added, [
    ".cw/out/catalog.json",
    ".cw/out/catalog.min.json",
    ".cw/out/CHARTER.md",
    ".cw/out/guide/no-any.md",
    ".cw/out/skill/cw-author.md",
  ]);
});

test("an agent this engine cannot compile for stops the build before it reads a charter (FR-033)", async () => {
  const { build } = building({ ...compilingFor("nowhere"), [at("guide/no-any.md")]: guide("no-any") });

  // Raised rather than reported: settings this engine cannot act on leave it
  // nothing to build against, and the user is sent back to `cw init`.
  await assert.rejects(build, /compiles for "nowhere"/);
});

test("what the charter speaks for is replaced; the rest of a host's settings is left alone (FR-018)", async () => {
  const { held, build } = building({
    ...compilingFor("claude"),
    [at("posture/sandboxed.md")]: posture("sandboxed", "Read(**)", "Bash(rm:*)"),
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
    [at("posture/sandboxed.md")]: posture("sandboxed", "Read(**)", "Bash(rm:*)"),
  });
  await build();
  held.remove(new URL("posture/sandboxed.md", root));

  const built = filesOf(await build());

  // The posture's compiled document is the charter's and goes; the settings it
  // wrote into are the repository's too, and stay.
  assert.deepEqual(built.deleted, [".cw/out/posture/sandboxed.md"]);
  assert.ok(await contentsOf(held, ".claude/settings.json"));
});

test("settings that do not read stop the build before it reads a charter (FR-009)", async () => {
  const { build } = building({ [settingsFile]: "not json at all\n", [at("guide/no-any.md")]: guide("no-any") });

  await assert.rejects(build, /not JSON/);
});
