import assert from "node:assert/strict";
import { test } from "node:test";
import { outputPath } from "../src/module/charter/domain/constants.js";
import { CharterOutputService } from "../src/module/charter/domain/services/charter-output.service.js";
import { CodexComponentFactory } from "../src/module/charter/infra/codex/codex-component.factory.js";
import { CodexEntryFile } from "../src/module/charter/infra/codex/codex-entry-file.js";
import { CodexProjection } from "../src/module/charter/infra/codex/codex-projection.adapter.js";
import { TomlLib } from "../src/module/shared/domain/libs/toml.lib.js";
import { AgentProvider } from "../src/module/shared/domain/value-objects/agent-provider.value-object.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { loadCharterRoot } from "./use-cases-of.js";

const repo = new URL("file:///repo/");
const inRepo = (path: string) => new URL(path, repo);

test("compilation supplies scoped instruction components without reading provider files", async () => {
  const rootText = "User instructions.\n";
  const guideText = "Follow this scoped guide.\n".repeat(2000);
  const fileReaders = new InMemoryFileReaders({
    [inRepo("AGENTS.md").href]: rootText,
    [inRepo(".cw/charter/primitive/guide/types/index.md").href]:
      `---\nkind: guide\nid: types\ndescription: TypeScript guidance.\nglobs: ["src/**/*.ts"]\n---\n\n${guideText}`,
  });
  const charter = await loadCharterRoot(fileReaders);
  fileReaders.calls.length = 0;
  const output = CharterOutputService.compileCharterRoot(charter, [new AgentProvider("codex")]);
  assert.deepEqual(fileReaders.calls, []);
  const codexComponents = CodexComponentFactory.create(charter, output);
  const scopedComponent = codexComponents.find(
    (component) => component instanceof CodexEntryFile && component.folder === "src",
  );
  assert.ok(scopedComponent);
  assert.match(scopedComponent.document, /Follow this scoped guide/);
  const configComponent = codexComponents.find((component) => component.kind === "config");
  assert.ok(configComponent);
  const settings = TomlLib.parseTomlTable(configComponent.document);
  assert.equal(settings["project_doc_max_bytes"], 1_048_576n);
  assert.equal(await fileReaders.readIfThere(inRepo("src/AGENTS.md")), undefined);
  const { writePlans } = await new CodexProjection(fileReaders).createAgentProjectionPlan(charter, output);
  assert.match(
    writePlans.find((writePlan) => writePlan.path === "src/AGENTS.md")!.contents as string,
    /Follow this scoped guide/,
  );
  assert.equal(await fileReaders.readFile(inRepo("AGENTS.md")), rootText);
});

test("compilation depends only on the charter, not existing provider files", async () => {
  const fileReaders = new InMemoryFileReaders({
    [inRepo("AGENTS.override.md").href]: "User override.",
    [inRepo(".codex/config.toml").href]: 'sandbox_mode = "read-only"\n',
  });
  const charter = await loadCharterRoot(fileReaders);
  fileReaders.calls.length = 0;
  const firstOutput = CharterOutputService.compileCharterRoot(charter, [new AgentProvider("codex")]);
  assert.deepEqual(fileReaders.calls, []);
  fileReaders.writeFile(inRepo(".codex/config.toml"), "not valid TOML");
  const secondOutput = CharterOutputService.compileCharterRoot(charter, [new AgentProvider("codex")]);
  assert.deepEqual(secondOutput.charterOutputItems, firstOutput.charterOutputItems);
  assert.deepEqual(fileReaders.calls, []);
  assert.ok(
    !firstOutput.charterOutputItems.some((charterOutputItem) =>
      outputPath.getPath(charterOutputItem).endsWith("codex-entry-files.json"),
    ),
  );
});
