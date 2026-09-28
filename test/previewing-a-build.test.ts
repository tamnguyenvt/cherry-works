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

const at = (path: string) => new URL(path, root).href;
const inRepo = (path: string) => new URL(path, repo).href;

const compilingFor = (...agents: readonly string[]) => ({
  [inRepo(".cw/settings.json")]: `${JSON.stringify({ agents }, undefined, 2)}\n`,
});

/** A charter on files a preview reads and a build writes into: the two are asked
 *  the same questions of one repository, which is the whole of what a preview
 *  claims (FR-022). */
const previewing = (files: Readonly<Record<string, string>>) => {
  const held = new InMemoryFileReaders(files);
  const charterAuthoringApp = new CharterAuthoring(repo, held, new YamlParser(), new InMemoryFileOutput(held), new InMemoryVCS());
  return { held, build: () => charterAuthoringApp.build(), preview: () => charterAuthoringApp.preview() };
};

/** Every file of one repository and what it holds, to be compared with the same
 *  after a preview: what a preview must leave exactly as it found it. */
const everything = async (held: InMemoryFileReaders) =>
  (await held.readFilesRecursively(repo)).map(({ file, contents }) => `${file.href} ${contents}`).sort();

/** What one preview said about the files it named, path by change. */
/** What a preview of a charter that does not hold says: nothing about any
 *  file. */
const nothing: DataDTOs.PlanSummary["data"] = { added: [], edited: [], deleted: [], unchanged: [] };

/** What a preview would do, where the charter held; and what stopped it, where
 *  it did not. */
const planOf = (planSummaryDTO: DataDTOs.PlanSummary | DataDTOs.FaultsByFile) =>
  planSummaryDTO.type === "PlanSummary" ? planSummaryDTO.data : undefined;
const faultsOf = (planSummaryDTO: DataDTOs.PlanSummary | DataDTOs.FaultsByFile) =>
  planSummaryDTO.type === "FaultsByFile" ? planSummaryDTO.data : undefined;

const changed = ({ added, edited, deleted, unchanged }: DataDTOs.PlanSummary["data"]) =>
  Object.fromEntries([
    ...added.map((path) => [path, "create"] as const),
    ...edited.map((path) => [path, "update"] as const),
    ...deleted.map((path) => [path, "delete"] as const),
    ...unchanged.map((path) => [path, "unchanged"] as const),
  ]);

test("a repository that has never been built would have every file created (FR-022)", async () => {
  const { held, preview } = previewing({ ...compilingFor("claude"), [at("guide/no-any.md")]: guide("no-any") });
  const before = await everything(held);

  const planSummaryDTO = await preview();
  const [previewed, faultsByFiles] = [planOf(planSummaryDTO), faultsOf(planSummaryDTO)];

  assert.equal(faultsByFiles, undefined);
  assert.deepEqual(changed(previewed ?? nothing), {
    ".cw/out/catalog.json": "create",
    ".cw/out/catalog.min.json": "create",
    ".cw/out/mcp-origins.json": "create",
    ".cw/out/CHARTER.md": "create",
    ".cw/out/skill/cw-author.md": "create",
    ".cw/out/guide/no-any.md": "create",
    "CLAUDE.md": "create",
    ".mcp.json": "create",
    ".claude/rules/guide-no-any.md": "create",
    ".claude/skills/skill-cw-author/SKILL.md": "create",
  });
  // The whole of what a preview promises: it said all that, and wrote none of it.
  assert.deepEqual(await everything(held), before);
});

test("a repository built from the charter as it stands has every file unchanged (SC-007)", async () => {
  const { held, build, preview } = previewing({ ...compilingFor("claude"), [at("guide/no-any.md")]: guide("no-any") });
  await build();
  const before = await everything(held);

  const previewed = planOf(await preview());

  assert.deepEqual([...(previewed?.added ?? []), ...(previewed?.edited ?? []), ...(previewed?.deleted ?? [])], []);
  assert.deepEqual(await everything(held), before);
});

test("a rule edited since the last build would be updated, and its listings with it (FR-022)", async () => {
  const { held, build, preview } = previewing({ ...compilingFor("claude"), [at("guide/no-any.md")]: guide("no-any") });
  await build();
  held.write(new URL("guide/no-any.md", root), guide("no-any", "Never write `any`."));

  const previewed = planOf(await preview());

  assert.deepEqual(changed(previewed ?? nothing), {
    // The listings say what a primitive is for and not what its body holds, so a
    // changed body leaves them exactly as they were.
    ".cw/out/catalog.json": "unchanged",
    ".cw/out/catalog.min.json": "unchanged",
    ".cw/out/mcp-origins.json": "unchanged",
    ".cw/out/CHARTER.md": "unchanged",
    // The compiled document holds the body, so it changes with it; the engine's
    // own skill does not.
    ".cw/out/guide/no-any.md": "update",
    ".cw/out/skill/cw-author.md": "unchanged",
    // The section in the entry file is a pointer and says nothing of any
    // primitive, so no edit to a body reaches it.
    "CLAUDE.md": "unchanged",
    ".mcp.json": "unchanged",
    ".claude/rules/guide-no-any.md": "update",
    ".claude/skills/skill-cw-author/SKILL.md": "unchanged",
  });
});

test("a projection whose primitive is gone would be deleted, and is not (FR-020, FR-022)", async () => {
  const { held, build, preview } = previewing({
    ...compilingFor("claude"),
    [at("guide/no-any.md")]: guide("no-any"),
    [at("command/ship.md")]: primitive("command", "ship"),
  });
  await build();
  held.remove(new URL("command/ship.md", root));

  const previewed = planOf(await preview());

  assert.equal(changed(previewed ?? nothing)[".claude/commands/ship.md"], "delete");
  // Said, and still there: nothing is taken away until a build takes it.
  assert.ok(await held.read(new URL(".claude/commands/ship.md", repo)));
});

test("a host's settings file the charter has nothing more to say to is unchanged (FR-018)", async () => {
  const { held, build, preview } = previewing({
    ...compilingFor("claude"),
    [at("posture/sandboxed.md")]: primitive("posture", "sandboxed", ['allow: ["Read(**)"]', 'deny: ["Bash(rm:*)"]']),
    [inRepo(".claude/settings.json")]: `${JSON.stringify({ model: "opus" })}\n`,
  });
  await build();
  const before = await everything(held);

  const previewed = planOf(await preview());

  // What the repository set for itself is no part of the comparison: what the
  // charter would write into that file is already there.
  assert.equal(changed(previewed ?? nothing)[".claude/settings.json"], "unchanged");
  assert.deepEqual(await everything(held), before);
});

test("a charter with an error previews nothing, and says which files (FR-009)", async () => {
  const { preview } = previewing({
    [at("guide/no-any.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]', 'mixins: ["nowhere"]']),
  });

  const planSummaryDTO = await preview();
  const [previewed, faultsByFiles] = [planOf(planSummaryDTO), faultsOf(planSummaryDTO)];

  assert.deepEqual(changed(previewed ?? nothing), {});
  assert.deepEqual(Object.keys(faultsByFiles?.files ?? {}), [".cw/charter/guide/no-any.md"]);
});
