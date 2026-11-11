import assert from "node:assert/strict";
import { test } from "node:test";
import { tomlTableOf } from "../src/module/charter/domain/libs/toml.lib.js";
import { AgentProvider } from "../src/module/charter/domain/models/agent/agent-provider.js";
import { CompileService } from "../src/module/charter/domain/services/compile.service.js";
import { CodexComponentFactory } from "../src/module/charter/infra/codex/codex-component.factory.js";
import { CodexEntryFile } from "../src/module/charter/infra/codex/codex-entry-file.js";
import { CodexProjection } from "../src/module/charter/infra/codex/codex-projection.adapter.js";
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
  const output = CompileService.compileCharterRoot(charter, [new AgentProvider("codex")]);
  assert.deepEqual(fileReaders.calls, []);
  const codexComponents = CodexComponentFactory.create(charter, output);
  const scopedComponent = codexComponents.find(
    (component) => component instanceof CodexEntryFile && component.folder === "src",
  );
  assert.ok(scopedComponent);
  assert.match(scopedComponent.document, /Follow this scoped guide/);
  const configComponent = codexComponents.find((component) => component.kind === "config");
  assert.ok(configComponent);
  const settings = tomlTableOf(configComponent.document);
  assert.equal(settings["project_doc_max_bytes"], 1_048_576n);
  assert.equal(await fileReaders.readIfThere(inRepo("src/AGENTS.md")), undefined);
  const { projectionPlan } = await new CodexProjection(fileReaders).createAgentProjectionPlan(charter, output);
  assert.match(
    projectionPlan.find((writePlan) => writePlan.path === "src/AGENTS.md")!.contents as string,
    /Follow this scoped guide/,
  );
  assert.equal(await fileReaders.read(inRepo("AGENTS.md")), rootText);
});

test("compilation depends only on the charter, not existing provider files", async () => {
  const fileReaders = new InMemoryFileReaders({
    [inRepo("AGENTS.override.md").href]: "User override.",
    [inRepo(".codex/config.toml").href]: 'sandbox_mode = "read-only"\n',
  });
  const charter = await loadCharterRoot(fileReaders);
  fileReaders.calls.length = 0;
  const firstOutput = CompileService.compileCharterRoot(charter, [new AgentProvider("codex")]);
  assert.deepEqual(fileReaders.calls, []);
  fileReaders.write(inRepo(".codex/config.toml"), "not valid TOML");
  const secondOutput = CompileService.compileCharterRoot(charter, [new AgentProvider("codex")]);
  assert.deepEqual(secondOutput.compiledParts, firstOutput.compiledParts);
  assert.deepEqual(fileReaders.calls, []);
  assert.ok(
    !firstOutput.compiledParts.some((compiledPart) => compiledPart.outputPart.id.endsWith("codex-entry-files.json")),
  );
});
