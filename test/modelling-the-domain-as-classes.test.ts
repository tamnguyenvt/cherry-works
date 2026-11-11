import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { AgentProvider } from "../src/module/charter/domain/models/agent/agent-provider.js";
import { EvalService } from "../src/module/runtime/domain/services/eval.service.js";

const repositoryUrl = new URL("../", import.meta.url);
/** Each module's domain, and the kernel's (CORE-FR-222). */
const domainFolderUrls = ["shared", "charter", "runtime"].map(
  (moduleName) => new URL(`src/module/${moduleName}/domain/`, repositoryUrl),
);

/** Every source file of the domain's models and value objects, by its URL,
 *  whichever folder of the domain holds it: its services, specifications and
 *  utilities aside, and the assets of the engine's own layer. */
const domainValueFileUrls = domainFolderUrls.flatMap((domainFolderUrl) =>
  readdirSync(domainFolderUrl, { recursive: true, encoding: "utf8" })
    .filter(
      (filePath) =>
        filePath.endsWith(".ts") &&
        !/(^|\/)(libs|builtin|services|specifications)\//.test(filePath) &&
        !/\.(service|specification|lib)\.ts$/.test(filePath),
    )
    .map((filePath) => new URL(filePath, domainFolderUrl)),
);
/** Every file name of the domain, at any depth. */
const domainFileNames = domainFolderUrls.flatMap((domainFolderUrl) =>
  readdirSync(domainFolderUrl, { recursive: true, encoding: "utf8" }).map((filePath) => filePath.split("/").at(-1)!),
);

test("every value of the domain is a class, with no function or constant exported beside it (CORE Story 45 scenario 1)", () => {
  const looseExports = domainValueFileUrls.flatMap((fileUrl) =>
    [...readFileSync(fileUrl, "utf8").matchAll(/^export (?:async )?(?:function|const|let) (\w+)/gm)].map(
      (exportMatch) => `${fileUrl.pathname.split("/src/")[1]}: ${exportMatch[1]}`,
    ),
  );
  assert.deepEqual(looseExports, []);
});

test("the workspace's folders are value objects, and a build's output and the hosts' folders are the projection's, not the domain's (CORE Story 45 scenario 1, CORE-FR-221)", () => {
  assert.ok(domainFileNames.includes("charter-folder.ts"), "the domain holds no charter-folder.ts");
  for (const valueObjectFileName of [
    "out-folder.ts",
    "agent-provider-folder.ts",
    "claude-agent-provider-folder.ts",
    "codex-agent-provider-folder.ts",
  ]) {
    assert.ok(!domainFileNames.includes(valueObjectFileName), `the domain holds ${valueObjectFileName}`);
  }
});

test("an agent is known by its name, not by which object carries it (CORE Story 45 scenario 1)", () => {
  assert.equal(
    EvalService.selectEvaluationAgent(["codex", "codex"], ["claude", "codex"], "codex"),
    new AgentProvider("codex").name,
  );
  assert.equal(String(new AgentProvider("codex")), "codex");
});
