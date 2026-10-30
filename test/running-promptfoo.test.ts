import { test } from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Promptfoo } from "../src/zdriven/Promptfoo.js";

const FAKE_PROMPTFOO = `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const config = JSON.parse(fs.readFileSync(process.argv[process.argv.indexOf("-c") + 1], "utf8"));
fs.writeFileSync(path.join(process.cwd(), "..", "captured.json"), JSON.stringify(config));
fs.writeFileSync(process.argv[process.argv.indexOf("-o") + 1], JSON.stringify({results:{results:[{success:false,response:{tokenUsage:{total:123}},gradingResult:{componentResults:[{pass:false,reason:"Missing skill: planning",assertion:{type:"skill-used"}}]}}]}}));
process.exit(100);
`;

for (const agentName of ["claude", "codex"] as const) {
  test(`promptfoo runs and grades with ${agentName}, preserves failed assertions and cleans up`, async () => {
    const temporaryFolderPath = await mkdtemp(join(tmpdir(), "cw-promptfoo-"));
    try {
      const promptfooRunner = new Promptfoo(temporaryFolderPath);
      const executableFolderPath = join(promptfooRunner.installFolderPath, "node_modules", ".bin");
      await mkdir(executableFolderPath, { recursive: true });
      const executableFilePath = join(executableFolderPath, "promptfoo");
      await writeFile(executableFilePath, FAKE_PROMPTFOO);
      await chmod(executableFilePath, 0o755);
      const testReport = await promptfooRunner.evaluate({ agent: agentName, description: "planning", prompt: "plan", workingFolder: pathToFileURL(temporaryFolderPath), assertions: [{ type: "skill-used", value: "planning" }, { type: "agent-rubric", value: "Use plain names" }] });
      assert.equal(testReport.success, false);
      assert.equal(testReport.totalTokens, 123);
      assert.match(testReport.componentResults[0]?.reason ?? "", /Missing skill/);
      const providerConfiguration = JSON.parse(await readFile(join(promptfooRunner.installFolderPath, "captured.json"), "utf8"));
      const expectedProviderId = agentName === "codex" ? "openai:codex-sdk" : "anthropic:claude-agent-sdk";
      assert.equal(providerConfiguration.providers[0].id, expectedProviderId);
      assert.equal(providerConfiguration.tests[0].options.provider.id, expectedProviderId);
      assert.equal(providerConfiguration.providers[0].config.working_dir, temporaryFolderPath);
      if (agentName === "codex") {
        assert.equal(providerConfiguration.providers[0].config.codex_path_override, "codex");
        assert.equal(providerConfiguration.providers[0].config.sandbox_mode, "workspace-write");
        assert.equal(providerConfiguration.providers[0].config.approval_policy, "never");
        assert.equal(providerConfiguration.tests[0].options.provider.config.sandbox_mode, "read-only");
      }
      assert.equal((await readdir(promptfooRunner.installFolderPath)).some((fileName) => fileName.startsWith("run-")), false);
      assert.equal(await promptfooRunner.isInstalled(), false);
    } finally {
      await rm(temporaryFolderPath, { recursive: true, force: true });
    }
  });
}
