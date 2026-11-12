import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { answerOf, faultOf, faultTextOf } from "./answer-of.js";
import { authoringCharterOf, loadCharterRoot } from "./use-cases-of.js";

const repoPath = new URL("file:///repo/");
const skillMarkdown =
  "---\nname: grill-me\ndescription: Ask questions.\nuser-invocable: false\n---\nAsk another skill for help.\n";
const guideMarkdown = "---\nkind: guide\nid: published\ndescription: Published.\n---\nOriginal body.\n";

function createVendoringFixture(sourceFiles: Record<string, string>, heldFiles: Record<string, string> = {}) {
  const fileReader = new InMemoryFileReaders(heldFiles);
  const fileWriter = new InMemoryFileOutput(fileReader);
  const sourceFetcher = new InMemorySources(fileReader);
  sourceFetcher.sourceFilesBySource["team/source"] = sourceFiles;
  const charterAuthoringApp = authoringCharterOf(fileReader, fileWriter, new InMemoryReporter(), { sourceFetcher });
  return { fileReader, fileWriter, sourceFetcher, charterAuthoringApp };
}

test("inject converts a skill with assets into the own charter despite dirty work, without vendor files or build (CORE Story 34 scenarios 1, 7)", async () => {
  const { charterAuthoringApp, fileReader, sourceFetcher } = createVendoringFixture(
    { "skills/grill/SKILL.md": skillMarkdown, "skills/grill/examples/a.md": "Example" },
    { "file:///repo/work.txt": "Uncommitted" },
  );
  await charterAuthoringApp.injectVendor("team/source", "v1", ["grill-me"]);
  const injectedMarkdown = await fileReader.readIfThere(
    new URL(".cw/charter/primitive/skill/grill-me/index.md", repoPath),
  );
  assert.match(injectedMarkdown!, /disable-user-invocation: true/);
  assert.match(injectedMarkdown!, /Ask another skill for help/);
  assert.equal(
    await fileReader.readIfThere(new URL(".cw/charter/primitive/skill/grill-me/examples/a.md", repoPath)),
    "Example",
  );
  assert.equal(await fileReader.readIfThere(new URL("work.txt", repoPath)), "Uncommitted");
  assert.deepEqual(await fileReader.readFilesRecursively(new URL(".cw/charter/vendor/", repoPath)), []);
  assert.deepEqual(await fileReader.readFilesRecursively(new URL(".cw/out/", repoPath)), []);
  assert.deepEqual(sourceFetcher.fetchedSources, [{ source: "team/source", version: "v1" }]);
});

test("inject takes single and gathered charters with assets and explicit or default selection (scenario 2)", async () => {
  for (const sourceFolder of [".cw/charter/primitive", "charters/baseline/.cw/charter/primitive"]) {
    for (const charterNames of sourceFolder.startsWith("charters/") ? [[], ["baseline"]] : [[]]) {
      const { charterAuthoringApp, fileReader } = createVendoringFixture({
        [`${sourceFolder}/guide/published/index.md`]: guideMarkdown,
        [`${sourceFolder}/guide/published/example.md`]: "Asset",
      });
      await charterAuthoringApp.injectVendor("team/source", undefined, [], charterNames);
      assert.equal(
        await fileReader.readIfThere(new URL(".cw/charter/primitive/guide/published/index.md", repoPath)),
        guideMarkdown,
      );
      assert.equal(
        await fileReader.readIfThere(new URL(".cw/charter/primitive/guide/published/example.md", repoPath)),
        "Asset",
      );
    }
  }
});

test("injected primitives are editable and deletable own primitives, absent from vendor management (scenarios 3, 4)", async () => {
  const { charterAuthoringApp, fileReader, fileWriter } = createVendoringFixture({
    ".cw/charter/primitive/guide/published/index.md": guideMarkdown,
  });
  await charterAuthoringApp.injectVendor("team/source");
  const primitivePath = ".cw/charter/primitive/guide/published/index.md";
  await fileWriter.writeFile(primitivePath, guideMarkdown.replace("Original body.", "Edited body."));
  const charterRoot = await loadCharterRoot(fileReader);
  assert.equal(
    charterRoot.primitives.find((primitive) => primitive.headers.id === "published")?.body.trim(),
    "Edited body.",
  );
  assert.deepEqual(answerOf(await charterAuthoringApp.listVendors()).data.folders, []);
  await fileWriter.deleteFile(primitivePath);
  assert.equal(
    (await loadCharterRoot(fileReader)).primitives.some((primitive) => primitive.headers.id === "published"),
    false,
  );
});

test("inject refuses own, vendor, builtin and repeated id collisions before writing any file (scenario 5)", async () => {
  for (const existingPath of [
    ".cw/charter/primitive/guide/published/index.md",
    ".cw/charter/vendor/team/rules/root/primitive/guide/published/index.md",
    "builtin",
    "repeat",
  ]) {
    const primitiveId = existingPath === "builtin" ? "cw-author" : "published";
    const { charterAuthoringApp, fileReader } = createVendoringFixture(
      {
        ".cw/charter/primitive/guide/published/index.md": guideMarkdown.replace("id: published", `id: ${primitiveId}`),
        "skills/grill/SKILL.md": skillMarkdown,
      },
      existingPath.startsWith(".cw/") ? { [new URL(existingPath, repoPath).href]: guideMarkdown } : {},
    );
    if (existingPath === "repeat") await charterAuthoringApp.injectVendor("team/source");
    const beforeFiles = await fileReader.readFilesRecursively(repoPath);
    const { message } = faultOf(await charterAuthoringApp.injectVendor("team/source"));
    assert.match(message, /index\.md/);
    assert.match(message, new RegExp(primitiveId));
    assert.match(message, /claim|already/);
    assert.deepEqual(await fileReader.readFilesRecursively(repoPath), beforeFiles);
  }
});

test("source and selection failures write nothing, just as vendor add does (scenario 6)", async () => {
  for (const failureKind of ["unreachable", "nested", "skill", "charter"]) {
    const { charterAuthoringApp, fileReader, sourceFetcher } = createVendoringFixture({
      ".cw/charter/primitive/guide/published/index.md": guideMarkdown,
    });
    if (failureKind === "unreachable") sourceFetcher.unreachableSources.push("team/source");
    if (failureKind === "nested")
      sourceFetcher.sourceFilesBySource["team/source"]![".cw/charter/vendor/other/guide/x/index.md"] = guideMarkdown;
    faultOf(
      await charterAuthoringApp.injectVendor(
        "team/source",
        undefined,
        failureKind === "skill" ? ["missing"] : [],
        failureKind === "charter" ? ["missing"] : [],
      ),
    );
    assert.deepEqual(await fileReader.readFilesRecursively(repoPath), []);
  }
});

test("a mixed selection keeps nested index assets and declares no source provenance", async () => {
  const { charterAuthoringApp, fileReader } = createVendoringFixture({
    "charters/baseline/.cw/charter/primitive/guide/published/index.md": guideMarkdown,
    "charters/baseline/.cw/charter/primitive/guide/published/examples/index.md": "Nested asset",
    "skills/grill/SKILL.md": skillMarkdown,
  });
  await charterAuthoringApp.injectVendor("team/source", undefined, ["grill-me"], ["baseline"]);
  assert.equal(
    await fileReader.readIfThere(new URL(".cw/charter/primitive/guide/published/examples/index.md", repoPath)),
    "Nested asset",
  );
  const authoredFiles = await fileReader.readFilesRecursively(repoPath);
  assert.equal(authoredFiles.length, 3);
  assert.equal(
    authoredFiles.some(({ contents }) => contents.includes("team/source")),
    false,
  );
});

test("incoming collisions and overlapping folders refuse the whole injection", async () => {
  for (const collisionKind of ["id", "nested", "existing-asset"]) {
    const sourceFiles: Record<string, string> = {
      "charters/first/.cw/charter/primitive/guide/published/index.md": guideMarkdown,
      "charters/second/.cw/charter/primitive/guide/other/index.md": guideMarkdown.replace(
        "id: published",
        collisionKind === "id" ? "id: published" : "id: published/child",
      ),
    };
    const existingFiles =
      collisionKind === "existing-asset"
        ? { "file:///repo/.cw/charter/primitive/guide/published/example.txt": "Keep this" }
        : {};
    const { charterAuthoringApp, fileReader } = createVendoringFixture(sourceFiles, existingFiles);
    const beforeFiles = await fileReader.readFilesRecursively(repoPath);
    assert.match(
      faultTextOf(await charterAuthoringApp.injectVendor("team/source")),
      collisionKind === "id"
        ? /claim id "published"/
        : /claim overlapping primitive folders at \.cw\/charter\/primitive\/guide\/published[/a-z]*\/index\.md\.\n {2}Inject primitives whose folders are apart from the existing files\./,
    );
    assert.deepEqual(await fileReader.readFilesRecursively(repoPath), beforeFiles);
  }
});
