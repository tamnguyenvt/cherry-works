import { test } from "node:test";
import assert from "node:assert/strict";
import { compile } from "../src/hexagon/domain/services/compile/compileService.js";
import { loadCharterRoot } from "../src/hexagon/service/charterRepo.js";
import { planForProjection } from "../src/hexagon/service/buildService.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import { TomlParser } from "../src/zdriven/TomlParser.js";

const repo = new URL("file:///repo/");
const inRepo = (path: string) => new URL(path, repo);
const tomlParser = new TomlParser();

test("compilation supplies scoped instruction components without reading provider files", async () => {
  const rootText = "User instructions.\n";
  const guideText = "Follow this scoped guide.\n".repeat(2000);
  const fileReaders = new InMemoryFileReaders({
    [inRepo("AGENTS.md").href]: rootText,
    [inRepo(".cw/charter/guide/types/index.md").href]: '---\nkind: guide\nid: types\ndescription: TypeScript guidance.\nglobs: ["src/**/*.ts"]\n---\n\n' + guideText,
  });
  const charter = await loadCharterRoot(repo, fileReaders, new YamlParser());
  fileReaders.calls.length = 0;
  const output = compile(charter, ["codex"]);
  assert.deepEqual(fileReaders.calls, []);
  const scopedComponent = output.providerComponents.find((component) => component.path === "src/AGENTS.md");
  assert.ok(scopedComponent);
  assert.equal(scopedComponent.projectionPolicy, "upsertWithMarker");
  assert.match(scopedComponent.document, /Follow this scoped guide/);
  const configComponent = output.providerComponents.find((component) => component.path === ".codex/config.toml");
  assert.ok(configComponent);
  const settings = tomlParser.parse(configComponent.document);
  assert.equal(settings["project_doc_max_bytes"], 1_048_576n);
  assert.equal(await fileReaders.readIfThere(inRepo("src/AGENTS.md")), undefined);
  const projectionPlan = await planForProjection(repo, output, fileReaders, tomlParser);
  assert.match(projectionPlan.find((plannedFile) => plannedFile.path === "src/AGENTS.md")!.contents!, /Follow this scoped guide/);
  assert.equal(await fileReaders.read(inRepo("AGENTS.md")), rootText);
});

test("compilation depends only on the charter, not existing provider files", async () => {
  const fileReaders = new InMemoryFileReaders({
    [inRepo("AGENTS.override.md").href]: "User override.",
    [inRepo(".codex/config.toml").href]: 'sandbox_mode = "read-only"\n',
  });
  const charter = await loadCharterRoot(repo, fileReaders, new YamlParser());
  fileReaders.calls.length = 0;
  const firstOutput = compile(charter, ["codex"]);
  assert.deepEqual(fileReaders.calls, []);
  fileReaders.write(inRepo(".codex/config.toml"), "not valid TOML");
  const secondOutput = compile(charter, ["codex"]);
  assert.deepEqual(secondOutput.projections, firstOutput.projections);
  assert.deepEqual(fileReaders.calls, []);
  assert.ok(!firstOutput.projections.some((projection) => projection.file.endsWith("codex-entry-files.json")));
});
