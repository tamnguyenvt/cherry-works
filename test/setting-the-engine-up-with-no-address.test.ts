import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { PrimitiveLayer } from "../src/module/charter/domain/models/primitive/primitive-layer.value-object.js";
import { RawPrimitive } from "../src/module/charter/domain/models/primitive/raw-primitive.js";
import { FileCharterRepository } from "../src/module/charter/infra/file-charter.repository.js";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { AdapterFault } from "../src/module/shared/domain/models/adapter.fault.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { authoringCharterOf } from "./use-cases-of.js";

const repositoryUrl = new URL("../", import.meta.url);
const hexagonFolderUrl = new URL("src/module/", repositoryUrl);

/** Every source file of the hexagon's use cases, services, domain and ports,
 *  from the hexagon's folder; the address an adapter is set up on aside, as
 *  what the adapters are handed and the hexagon never is. */
const hexagonFilePaths = ["shared/", "charter/", "runtime/"].flatMap((moduleFolderPath) =>
  ["app/", "domain/"].flatMap((folderPath) =>
    readdirSync(new URL(`${moduleFolderPath}${folderPath}`, hexagonFolderUrl), { recursive: true, encoding: "utf8" })
      .filter((filePath) => filePath.endsWith(".ts") && !filePath.endsWith("folder-address.port.ts"))
      .map((filePath) => `${moduleFolderPath}${folderPath}${filePath}`),
  ),
);

test("no use case is set up with an address, and nothing the hexagon says or asks of its storage is one (CORE Story 46 scenario 1, CORE-FR-217, CORE-FR-218, CORE-SC-061)", () => {
  const addressUses = hexagonFilePaths.flatMap((filePath) =>
    readFileSync(new URL(filePath, hexagonFolderUrl), "utf8")
      .split("\n")
      .flatMap((sourceLine, lineIndex) =>
        /:\s*(?:readonly\s+)?URL\b|<URL>|URL\[\]|\b(?:repo|home)Path\b/.test(sourceLine)
          ? [`${filePath}:${lineIndex + 1}`]
          : [],
      ),
  );
  assert.deepEqual(addressUses, []);
});

test("one use case set up on each repository's storage answers for that repository, saying where each primitive is kept as that storage says it (CORE Story 46 scenario 1, CORE-FR-217, CORE-FR-213)", async () => {
  const guideOf = (guideId: string) =>
    `---\nkind: guide\nid: ${guideId}\ndescription: A guide of ${guideId}.\n---\nKeep it.\n`;
  const charterAppOn = (repoFolder: URL, guideId: string) => {
    const fileReaders = new InMemoryFileReaders(
      { [new URL(`.cw/charter/primitive/guide/${guideId}/index.md`, repoFolder).href]: guideOf(guideId) },
      repoFolder,
    );
    return authoringCharterOf(fileReaders, new InMemoryFileOutput(fileReaders), new InMemoryReporter());
  };

  for (const [repoFolder, guideId] of [
    [new URL("memory://a/"), "guide-of-a"],
    [new URL("file:///work/b/"), "guide-of-b"],
  ] as const) {
    const explanationOutcome = await charterAppOn(repoFolder, guideId).explainPrimitive(guideId);
    assert.equal(explanationOutcome.type, "ExplanationOutcome", JSON.stringify(explanationOutcome));
    assert.equal(
      explanationOutcome.data.primitive.data.file,
      new URL(`.cw/charter/primitive/guide/${guideId}/index.md`, repoFolder).href,
    );
  }
});

test("a path starting at / or stepping out with .. reaches nothing outside the repository an adapter is set up on (CORE Story 46, CORE-FR-044)", async () => {
  const fileReaders = new InMemoryFileReaders(
    { "file:///outside.md": "Not the repository's." },
    new URL("file:///work/repo/"),
  );
  const fileOutput = new InMemoryFileOutput(fileReaders);
  for (const outsidePath of ["/outside.md", "../../outside.md", ".cw/../../../outside.md"]) {
    await assert.rejects(
      fileReaders.readIfThere(outsidePath),
      (fault: unknown) =>
        fault instanceof AdapterFault && /no path inside the folder this was set up on/.test(fault.message),
      outsidePath,
    );
    await assert.rejects(fileOutput.writeFile(outsidePath, "written"), AdapterFault, outsidePath);
  }
  const charterRepository = new FileCharterRepository(fileReaders, fileOutput, new InMemorySources(fileReaders));
  await assert.rejects(
    charterRepository.addPrimitive(
      new RawPrimitive(PrimitiveLayer.REPO, "guide", "../../../../outside", "written", [], ""),
    ),
    /would land outside/,
  );
  assert.equal(await fileReaders.readFile(new URL("file:///outside.md")), "Not the repository's.");
});
