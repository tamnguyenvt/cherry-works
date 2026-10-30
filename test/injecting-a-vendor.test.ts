import { test } from "node:test";
import assert from "node:assert/strict";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { loadCharterRoot } from "../src/hexagon/service/charterRepo.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";

const repoPath = new URL("file:///repo/");
const skillMarkdown = "---\nname: grill-me\ndescription: Ask questions.\nuser-invocable: false\n---\nAsk another skill for help.\n";
const guideMarkdown = "---\nkind: guide\nid: published\ndescription: Published.\n---\nOriginal body.\n";

function createVendoringFixture(sourceFiles: Record<string, string>, heldFiles: Record<string, string> = {}) {
  const fileReader = new InMemoryFileReaders(heldFiles);
  const fileWriter = new InMemoryFileOutput(fileReader);
  const vcs = new InMemoryVCS(true, false, fileReader);
  vcs.sourceFilesBySource["team/source"] = sourceFiles;
  const yamlParser = new YamlParser();
  const charterVendoringApp = new CharterVendoring(repoPath, fileReader, vcs, fileWriter, yamlParser);
  return { fileReader, fileWriter, vcs, yamlParser, charterVendoringApp };
}

test("inject converts a skill with assets into the own charter despite dirty work, without vendor files or build (CORE Story 34 scenarios 1, 7)", async () => {
  const { charterVendoringApp, fileReader, vcs } = createVendoringFixture({ "skills/grill/SKILL.md": skillMarkdown, "skills/grill/examples/a.md": "Example" }, { "file:///repo/work.txt": "Uncommitted" });
  await charterVendoringApp.inject("team/source", "v1", ["grill-me"]);
  const injectedMarkdown = await fileReader.readIfThere(new URL(".cw/charter/skill/grill-me/index.md", repoPath));
  assert.match(injectedMarkdown!, /disable-user-invocation: true/);
  assert.match(injectedMarkdown!, /Ask another skill for help/);
  assert.equal(await fileReader.readIfThere(new URL(".cw/charter/skill/grill-me/examples/a.md", repoPath)), "Example");
  assert.equal(await fileReader.readIfThere(new URL("work.txt", repoPath)), "Uncommitted");
  assert.deepEqual(await fileReader.readFilesRecursively(new URL(".cw/vendor/", repoPath)), []);
  assert.deepEqual(await fileReader.readFilesRecursively(new URL(".cw/out/", repoPath)), []);
  assert.deepEqual(vcs.fetched, [{ source: "team/source", version: "v1" }]);
});

test("inject takes single and gathered charters with assets and explicit or default selection (scenario 2)", async () => {
  for (const sourceFolder of [".cw/charter", "charters/baseline/.cw/charter"]) {
    for (const charterNames of sourceFolder.startsWith("charters/") ? [[], ["baseline"]] : [[]]) {
      const { charterVendoringApp, fileReader } = createVendoringFixture({ [`${sourceFolder}/guide/published/index.md`]: guideMarkdown, [`${sourceFolder}/guide/published/example.md`]: "Asset" });
      await charterVendoringApp.inject("team/source", undefined, [], charterNames);
      assert.equal(await fileReader.readIfThere(new URL(".cw/charter/guide/published/index.md", repoPath)), guideMarkdown);
      assert.equal(await fileReader.readIfThere(new URL(".cw/charter/guide/published/example.md", repoPath)), "Asset");
    }
  }
});

test("injected primitives are editable and deletable own primitives, absent from vendor management (scenarios 3, 4)", async () => {
  const { charterVendoringApp, fileReader, fileWriter, yamlParser } = createVendoringFixture({ ".cw/charter/guide/published/index.md": guideMarkdown });
  await charterVendoringApp.inject("team/source");
  const primitivePath = new URL(".cw/charter/guide/published/index.md", repoPath);
  await fileWriter.write(primitivePath, guideMarkdown.replace("Original body.", "Edited body."));
  const charterRoot = await loadCharterRoot(repoPath, fileReader, yamlParser);
  assert.equal(charterRoot.primitives.find((primitive) => primitive.headers.id === "published")?.body.trim(), "Edited body.");
  assert.deepEqual(await charterVendoringApp.installed(), []);
  await fileWriter.delete(primitivePath);
  assert.equal((await loadCharterRoot(repoPath, fileReader, yamlParser)).primitives.some((primitive) => primitive.headers.id === "published"), false);
});

test("inject refuses own, vendor, builtin and repeated id collisions before writing any file (scenario 5)", async () => {
  for (const existingPath of [".cw/charter/guide/published/index.md", ".cw/vendor/team/rules/guide/published/index.md", "builtin", "repeat"]) {
    const primitiveId = existingPath === "builtin" ? "cw-author" : "published";
    const { charterVendoringApp, fileReader } = createVendoringFixture({ ".cw/charter/guide/published/index.md": guideMarkdown.replace("id: published", `id: ${primitiveId}`), "skills/grill/SKILL.md": skillMarkdown }, existingPath.startsWith(".cw/") ? { [new URL(existingPath, repoPath).href]: guideMarkdown } : {});
    if (existingPath === "repeat") await charterVendoringApp.inject("team/source");
    const beforeFiles = await fileReader.readFilesRecursively(repoPath);
    await assert.rejects(charterVendoringApp.inject("team/source"), (fault: Error) => {
      assert.match(fault.message, /index\.md/);
      assert.match(fault.message, new RegExp(primitiveId));
      assert.match(fault.message, /claim|already/);
      return true;
    });
    assert.deepEqual(await fileReader.readFilesRecursively(repoPath), beforeFiles);
  }
});

test("source and selection failures write nothing, just as vendor add does (scenario 6)", async () => {
  for (const failureKind of ["unreachable", "nested", "skill", "charter"]) {
    const { charterVendoringApp, fileReader, vcs } = createVendoringFixture({ ".cw/charter/guide/published/index.md": guideMarkdown });
    if (failureKind === "unreachable") vcs.unreachableSources.push("team/source");
    if (failureKind === "nested") vcs.sourceFilesBySource["team/source"]![".cw/vendor/other/guide/x/index.md"] = guideMarkdown;
    await assert.rejects(charterVendoringApp.inject("team/source", undefined, failureKind === "skill" ? ["missing"] : [], failureKind === "charter" ? ["missing"] : []));
    assert.deepEqual(await fileReader.readFilesRecursively(repoPath), []);
  }
});

test("a mixed selection keeps nested index assets and declares no source provenance", async () => {
  const { charterVendoringApp, fileReader } = createVendoringFixture({
    "charters/baseline/.cw/charter/guide/published/index.md": guideMarkdown,
    "charters/baseline/.cw/charter/guide/published/examples/index.md": "Nested asset",
    "skills/grill/SKILL.md": skillMarkdown,
  });
  await charterVendoringApp.inject("team/source", undefined, ["grill-me"], ["baseline"]);
  assert.equal(await fileReader.readIfThere(new URL(".cw/charter/guide/published/examples/index.md", repoPath)), "Nested asset");
  const authoredFiles = await fileReader.readFilesRecursively(repoPath);
  assert.equal(authoredFiles.length, 3);
  assert.equal(authoredFiles.some(({ contents }) => contents.includes("team/source")), false);
});

test("incoming collisions and overlapping folders refuse the whole injection", async () => {
  for (const collisionKind of ["id", "nested", "existing-asset"]) {
    const sourceFiles: Record<string, string> = {
      "charters/first/.cw/charter/guide/published/index.md": guideMarkdown,
      "charters/second/.cw/charter/guide/other/index.md": guideMarkdown.replace("id: published", collisionKind === "id" ? "id: published" : "id: published/child"),
    };
    const existingFiles = collisionKind === "existing-asset" ? { "file:///repo/.cw/charter/guide/published/example.txt": "Keep this" } : {};
    const { charterVendoringApp, fileReader } = createVendoringFixture(sourceFiles, existingFiles);
    const beforeFiles = await fileReader.readFilesRecursively(repoPath);
    await assert.rejects(charterVendoringApp.inject("team/source"), /claim/);
    assert.deepEqual(await fileReader.readFilesRecursively(repoPath), beforeFiles);
  }
});
