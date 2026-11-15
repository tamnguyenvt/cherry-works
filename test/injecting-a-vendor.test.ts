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

test("inject takes single and gathered charters with assets and explicit or default selection (scenario 2) (CORE Story 34 scenario 2)", async () => {
  for (const charterNames of [[], ["baseline"]]) {
    const { charterAuthoringApp, fileReader } = createVendoringFixture({
      "charters/baseline/.cw/charter/primitive/guide/published/index.md": guideMarkdown,
      "charters/baseline/.cw/charter/primitive/guide/published/example.md": "Asset",
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
});

test("injected primitives are edited and deleted as own primitives, nothing refused as vendored, and no vendor command lists, updates or removes them (CORE Story 34 scenarios 3, 4, CORE-FR-200, CORE Story 55 scenario 8)", async () => {
  const { charterAuthoringApp, fileReader, sourceFetcher } = createVendoringFixture({
    "charters/baseline/.cw/charter/primitive/guide/published/index.md": guideMarkdown,
  });
  await charterAuthoringApp.injectVendor("team/source");
  const primitiveUrl = new URL(".cw/charter/primitive/guide/published/index.md", repoPath);
  assert.equal(answerOf(await charterAuthoringApp.openPrimitive("published")).data.layerName, "repo");

  // Nothing names the source it came from, and no vendor command reaches it.
  assert.equal(
    (await fileReader.readFilesRecursively(repoPath)).some(({ contents }) => contents.includes("team/source")),
    false,
  );
  assert.deepEqual(answerOf(await charterAuthoringApp.listVendors()).data.folders, []);
  for (const vendorName of ["team/source/baseline", "team/source"])
    assert.match(faultTextOf(await charterAuthoringApp.removeVendor(vendorName)), /No vendor folder is named/);
  assert.equal(await fileReader.readIfThere(primitiveUrl), guideMarkdown);
  assert.deepEqual(sourceFetcher.fetchedSources, [{ source: "team/source" }], "nothing brings it up to date");

  const { hash: openedHash } = answerOf(await charterAuthoringApp.openPrimitive("published")).data;
  answerOf(
    await charterAuthoringApp.rewritePrimitive("published", { description: "Published." }, "Edited body.", openedHash),
  );
  const charterRoot = await loadCharterRoot(fileReader);
  assert.equal(
    charterRoot.primitives.find((primitive) => primitive.headers.id === "published")?.body.trim(),
    "Edited body.",
  );
  answerOf(await charterAuthoringApp.removePrimitive("published"));
  assert.equal(await fileReader.readIfThere(primitiveUrl), undefined);
  assert.equal(
    (await loadCharterRoot(fileReader)).primitives.some((primitive) => primitive.headers.id === "published"),
    false,
  );
});

test("inject refuses own, vendor, builtin and repeated id collisions before writing any file, naming both files (CORE Story 34 scenario 5, CORE-FR-194, CORE Story 55 scenario 8)", async () => {
  for (const existingPath of [
    ".cw/charter/primitive/guide/published/index.md",
    ".cw/charter/vendor/team/rules/root/primitive/guide/published/index.md",
    "builtin",
    "repeat",
  ]) {
    const primitiveId = existingPath === "builtin" ? "cw-author" : "published";
    const { charterAuthoringApp, fileReader } = createVendoringFixture(
      {
        "charters/baseline/.cw/charter/primitive/guide/published/index.md": guideMarkdown.replace(
          "id: published",
          `id: ${primitiveId}`,
        ),
        "skills/grill/SKILL.md": skillMarkdown,
      },
      existingPath.startsWith(".cw/") ? { [new URL(existingPath, repoPath).href]: guideMarkdown } : {},
    );
    if (existingPath === "repeat") await charterAuthoringApp.injectVendor("team/source");
    const beforeFiles = await fileReader.readFilesRecursively(repoPath);
    const { message } = faultOf(await charterAuthoringApp.injectVendor("team/source"));
    // Both files are named: the one already claiming the id, and the one
    // the source would have put down.
    const heldFilePath =
      existingPath === "builtin"
        ? "(built into cw)/skill/cw-author/index.md"
        : existingPath === "repeat"
          ? ".cw/charter/primitive/guide/published/index.md"
          : existingPath;
    assert.ok(message.includes(heldFilePath), message);
    assert.ok(message.includes(" and charters/baseline/.cw/charter/primitive/guide/published/index.md "), message);
    assert.ok(message.includes(`claim id "${primitiveId}"`), message);
    assert.deepEqual(await fileReader.readFilesRecursively(repoPath), beforeFiles);
  }
});

test("source and selection failures write nothing, and say why as vendor add says it (CORE Story 34 scenario 6, CORE-FR-198, CORE Story 55 scenario 8)", async () => {
  for (const failureKind of ["unreachable", "nested", "skill", "charter"]) {
    // One fixture failing the same way for each command: what vendor add says
    // is what inject is held to.
    const [injectOutcomeText, addOutcomeText] = await Promise.all(
      (["injectVendor", "addVendor"] as const).map(async (vendorMethodName) => {
        const { charterAuthoringApp, fileReader, sourceFetcher } = createVendoringFixture({
          "charters/baseline/.cw/charter/primitive/guide/published/index.md": guideMarkdown,
        });
        if (failureKind === "unreachable") sourceFetcher.unreachableSources.push("team/source");
        if (failureKind === "nested")
          sourceFetcher.sourceFilesBySource["team/source"]![
            "charters/baseline/.cw/charter/vendor/other/guide/x/index.md"
          ] = guideMarkdown;
        const refusalText = faultTextOf(
          await charterAuthoringApp[vendorMethodName](
            "team/source",
            undefined,
            failureKind === "skill" ? ["missing"] : [],
            failureKind === "charter" ? ["missing"] : [],
          ),
        );
        assert.deepEqual(await fileReader.readFilesRecursively(repoPath), [], `${vendorMethodName} ${failureKind}`);
        return refusalText;
      }),
    );
    assert.equal(injectOutcomeText, addOutcomeText, failureKind);
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
