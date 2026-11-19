import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { answerOf, faultOf, faultTextOf } from "./answer-of.js";
import { authoringCharterOf, loadCharterRoot } from "./use-cases-of.js";

const repoPath = new URL("file:///repo/");
const guideMarkdown = "---\nkind: guide\nid: published\ndescription: Published.\n---\nOriginal body.\n";

function createVendoringFixture(sourceFiles: Record<string, string>, heldFiles: Record<string, string> = {}) {
  const fileReader = new InMemoryFileReaders(heldFiles);
  const fileWriter = new InMemoryFileOutput(fileReader);
  const sourceFetcher = new InMemorySources(fileReader);
  sourceFetcher.sourceFilesBySource["team/source"] = sourceFiles;
  const charterAuthoringApp = authoringCharterOf(fileReader, fileWriter, new InMemoryReporter(), { sourceFetcher });
  return { fileReader, fileWriter, sourceFetcher, charterAuthoringApp };
}

test("inject writes a charter with its assets as the repository's own, despite work in hand, with no cw-vendor.json and nothing built (CORE Story 34 scenarios 1, 7, CORE-FR-198, CORE-FR-199, VENDOR Story 3 scenario 22)", async () => {
  const { charterAuthoringApp, fileReader, sourceFetcher } = createVendoringFixture(
    {
      ".cw/charter/baseline/primitive/guide/published/index.md": guideMarkdown,
      ".cw/charter/baseline/primitive/guide/published/examples/a.md": "Example",
    },
    { "file:///repo/work.txt": "Uncommitted" },
  );
  answerOf(await charterAuthoringApp.injectVendor("team/source", "v1", ["baseline"]));
  assert.equal(
    await fileReader.readIfThere(new URL(".cw/charter/baseline/primitive/guide/published/index.md", repoPath)),
    guideMarkdown,
  );
  assert.equal(
    await fileReader.readIfThere(new URL(".cw/charter/baseline/primitive/guide/published/examples/a.md", repoPath)),
    "Example",
  );
  assert.equal(await fileReader.readIfThere(new URL("work.txt", repoPath)), "Uncommitted");
  assert.equal(await fileReader.readIfThere(new URL(".cw/charter/baseline/cw-vendor.json", repoPath)), undefined);
  assert.deepEqual(await fileReader.readFilesRecursively(new URL(".cw/out/", repoPath)), []);
  assert.deepEqual(sourceFetcher.fetchedSources, [{ source: "team/source", version: "v1" }]);
});

test("inject takes a charter with assets whether named or taken by default (CORE Story 34 scenario 2, VENDOR Story 3 scenario 22)", async () => {
  for (const charterNames of [[], ["baseline"]]) {
    const { charterAuthoringApp, fileReader } = createVendoringFixture({
      ".cw/charter/baseline/primitive/guide/published/index.md": guideMarkdown,
      ".cw/charter/baseline/primitive/guide/published/example.md": "Asset",
    });
    await charterAuthoringApp.injectVendor("team/source", undefined, charterNames);
    assert.equal(
      await fileReader.readIfThere(new URL(".cw/charter/baseline/primitive/guide/published/index.md", repoPath)),
      guideMarkdown,
    );
    assert.equal(
      await fileReader.readIfThere(new URL(".cw/charter/baseline/primitive/guide/published/example.md", repoPath)),
      "Asset",
    );
  }
});

test("injected primitives are edited and deleted as own primitives, nothing refused as vendored, and no vendor command lists, updates or removes them (CORE Story 34 scenarios 3, 4, CORE-FR-200, CORE Story 55 scenario 8, VENDOR Story 3 scenario 22)", async () => {
  const { charterAuthoringApp, fileReader, sourceFetcher } = createVendoringFixture({
    ".cw/charter/baseline/primitive/guide/published/index.md": guideMarkdown,
  });
  await charterAuthoringApp.injectVendor("team/source");
  const primitiveUrl = new URL(".cw/charter/baseline/primitive/guide/published/index.md", repoPath);
  assert.equal(answerOf(await charterAuthoringApp.openPrimitive("published")).data.layerName, "repo");

  // Nothing names the source it came from, and no vendor command reaches it.
  assert.equal(
    (await fileReader.readFilesRecursively(repoPath)).some(({ contents }) => contents.includes("team/source")),
    false,
  );
  assert.deepEqual(answerOf(await charterAuthoringApp.listVendors()).data.charters, []);
  assert.match(
    faultTextOf(await charterAuthoringApp.removeVendor("baseline")),
    /baseline is a charter this repository authored, not one it installed/,
  );
  assert.match(
    faultTextOf(await charterAuthoringApp.removeVendor("team/source")),
    /No charter is named "team\/source"/,
  );
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

test("inject refuses own, vendor, builtin and repeated id or charter collisions before writing any file, naming both (CORE Story 34 scenario 5, CORE-FR-194, CORE Story 55 scenario 8, VENDOR Story 3 scenario 23)", async () => {
  for (const existingPath of [
    ".cw/charter/team/primitive/guide/published/index.md",
    ".cw/charter/rules/primitive/guide/published/index.md",
    "builtin",
    "repeat",
  ]) {
    const primitiveId = existingPath === "builtin" ? "cw-author" : "published";
    const sourcePrimitivePath = `.cw/charter/baseline/primitive/guide/${primitiveId}/index.md`;
    const { charterAuthoringApp, fileReader } = createVendoringFixture(
      {
        [sourcePrimitivePath]: guideMarkdown.replace("id: published", `id: ${primitiveId}`),
      },
      {
        ...(existingPath.startsWith(".cw/") && { [new URL(existingPath, repoPath).href]: guideMarkdown }),
        ...(existingPath.includes("/rules/") && {
          [new URL(".cw/charter/rules/cw-vendor.json", repoPath).href]:
            `${JSON.stringify({ charter: "rules", source: "team/rules", version: "HEAD" })}\n`,
        }),
      },
    );
    if (existingPath === "repeat") await charterAuthoringApp.injectVendor("team/source");
    const beforeFiles = await fileReader.readFilesRecursively(repoPath);
    const { message } = faultOf(await charterAuthoringApp.injectVendor("team/source"));
    if (existingPath === "repeat") {
      // Injected once, the charter is the repository's own: its name and its
      // folder are named.
      assert.ok(message.includes("baseline is a charter this repository authored"), message);
      assert.ok(message.includes(".cw/charter/baseline"), message);
    } else {
      // Both files are named: the one already claiming the id, and the one
      // the source would have put down.
      const heldFilePath = existingPath === "builtin" ? "(built into cw)/skill/cw-author/index.md" : existingPath;
      assert.ok(message.includes(heldFilePath), message);
      assert.ok(message.includes(` and ${sourcePrimitivePath} `), message);
      assert.ok(message.includes(`claim id "${primitiveId}"`), message);
    }
    assert.deepEqual(await fileReader.readFilesRecursively(repoPath), beforeFiles);
  }
});

test("source and selection failures write nothing, and say why as vendor add says it (CORE Story 34 scenario 6, CORE-FR-198, CORE Story 55 scenario 8, VENDOR Story 3 scenario 20)", async () => {
  for (const failureKind of ["unreachable", "old-layout", "charter"]) {
    // One fixture failing the same way for each command: what vendor add says
    // is what inject is held to.
    const [injectOutcomeText, addOutcomeText] = await Promise.all(
      (["injectVendor", "addVendor"] as const).map(async (vendorMethodName) => {
        const { charterAuthoringApp, fileReader, sourceFetcher } = createVendoringFixture({
          ".cw/charter/baseline/primitive/guide/published/index.md": guideMarkdown,
        });
        if (failureKind === "unreachable") sourceFetcher.unreachableSources.push("team/source");
        if (failureKind === "old-layout")
          sourceFetcher.sourceFilesBySource["team/source"]![".cw/charter/vendor/other/guide/x/index.md"] =
            guideMarkdown;
        const refusalText = faultTextOf(
          await charterAuthoringApp[vendorMethodName](
            "team/source",
            undefined,
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

test("a charter injected keeps nested index assets and declares no source provenance (CORE-FR-200)", async () => {
  const { charterAuthoringApp, fileReader } = createVendoringFixture({
    ".cw/charter/baseline/primitive/guide/published/index.md": guideMarkdown,
    ".cw/charter/baseline/primitive/guide/published/examples/index.md": "Nested asset",
  });
  answerOf(await charterAuthoringApp.injectVendor("team/source", undefined, ["baseline"]));
  assert.equal(
    await fileReader.readIfThere(new URL(".cw/charter/baseline/primitive/guide/published/examples/index.md", repoPath)),
    "Nested asset",
  );
  const authoredFiles = await fileReader.readFilesRecursively(repoPath);
  assert.equal(authoredFiles.length, 2);
  assert.equal(
    authoredFiles.some(({ contents }) => contents.includes("team/source")),
    false,
  );
});

test("incoming id collisions, and a charter whose folder the repository already holds, refuse the whole injection (VENDOR Story 3 scenario 23)", async () => {
  for (const collisionKind of ["id", "existing-asset"]) {
    const sourceFiles: Record<string, string> = {
      ".cw/charter/first/primitive/guide/published/index.md": guideMarkdown,
      [`.cw/charter/second/primitive/guide/${collisionKind === "id" ? "published" : "other"}/index.md`]:
        guideMarkdown.replace("id: published", collisionKind === "id" ? "id: published" : "id: other"),
    };
    const existingFiles =
      collisionKind === "existing-asset"
        ? { "file:///repo/.cw/charter/first/primitive/guide/published/example.txt": "Keep this" }
        : {};
    const { charterAuthoringApp, fileReader } = createVendoringFixture(sourceFiles, existingFiles);
    const beforeFiles = await fileReader.readFilesRecursively(repoPath);
    assert.match(
      faultTextOf(await charterAuthoringApp.injectVendor("team/source")),
      collisionKind === "id"
        ? /claim id "published"/
        : /first is a charter this repository authored, at file:\/\/\/repo\/\.cw\/charter\/first\./,
    );
    assert.deepEqual(await fileReader.readFilesRecursively(repoPath), beforeFiles);
  }
});

test("--as injects the one charter under that name, the repository's own, and is refused for more than one, nothing written (VENDOR Story 3 scenario 29, VENDOR-FR-022)", async () => {
  const sourceFiles = {
    ".cw/charter/lone/primitive/guide/published/index.md": guideMarkdown,
    ".cw/charter/other/primitive/guide/other-published/index.md": guideMarkdown.replace(
      "id: published",
      "id: other-published",
    ),
  };
  const { charterAuthoringApp, fileReader } = createVendoringFixture(sourceFiles);

  answerOf(await charterAuthoringApp.injectVendor("team/source", undefined, ["lone"], "solo"));

  assert.equal(
    await fileReader.readIfThere(new URL(".cw/charter/solo/primitive/guide/published/index.md", repoPath)),
    guideMarkdown,
  );
  assert.equal(await fileReader.readIfThere(new URL(".cw/charter/solo/cw-vendor.json", repoPath)), undefined);
  assert.equal(
    await fileReader.readIfThere(new URL(".cw/charter/lone/primitive/guide/published/index.md", repoPath)),
    undefined,
  );

  const manyFixture = createVendoringFixture(sourceFiles);
  const manyFault = faultOf(await manyFixture.charterAuthoringApp.injectVendor("team/source", undefined, [], "solo"));
  assert.equal(manyFault.name, "AmbiguousAsNameFault");
  assert.deepEqual(await manyFixture.fileReader.readFilesRecursively(new URL(".cw/charter/", repoPath)), []);
});
