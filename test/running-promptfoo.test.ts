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
fs.writeFileSync(process.argv[process.argv.indexOf("-o") + 1], JSON.stringify({results:{results:[{success:false,response:{sessionId:"test-session",output:"Verification incomplete",raw:JSON.stringify({items:[{type:"command_execution",command:"cat instructions.md",status:"completed",exit_code:0}]}),tokenUsage:{total:123}},gradingResult:{componentResults:[{pass:false,reason:"Missing skill: planning",assertion:{type:"skill-used"}}]}}]}}));
process.exit(100);
`;

for (const agentName of ["claude", "codex"] as const) {
  test(`promptfoo runs and grades with ${agentName}, preserves failed assertions, raw artifacts and agent session links`, async () => {
    const temporaryFolderPath = await mkdtemp(join(tmpdir(), "cw-promptfoo-"));
    try {
      const sessionFolderPath = join(temporaryFolderPath, agentName === "codex" ? "sessions" : "projects");
      await mkdir(sessionFolderPath, { recursive: true });
      const sessionFilePath = join(sessionFolderPath, agentName === "codex" ? "rollout-test-session.jsonl" : "test-session.jsonl");
      await writeFile(sessionFilePath, "{}\n");
      const promptfooRunner = new Promptfoo(temporaryFolderPath, [sessionFolderPath]);
      const executableFolderPath = join(promptfooRunner.installFolderPath, "node_modules", ".bin");
      await mkdir(executableFolderPath, { recursive: true });
      const executableFilePath = join(executableFolderPath, "promptfoo");
      await writeFile(executableFilePath, FAKE_PROMPTFOO);
      await chmod(executableFilePath, 0o755);
      const testReport = await promptfooRunner.evaluate({ agent: agentName, description: "planning", prompt: "plan", workingFolder: pathToFileURL(temporaryFolderPath), assertions: [{ type: "skill-used", value: "planning" }, { type: "agent-rubric", value: "Use plain names" }, { type: "file-read", value: "instructions.md" }] });
      assert.equal(testReport.success, false);
      assert.equal(testReport.totalTokens, 123);
      assert.match(testReport.componentResults[0]?.reason ?? "", /Missing skill/);
      const providerConfiguration = JSON.parse(await readFile(join(promptfooRunner.installFolderPath, "captured.json"), "utf8"));
      const expectedProviderId = agentName === "codex" ? "openai:codex-sdk" : "anthropic:claude-agent-sdk";
      const readAssertion = providerConfiguration.tests[0].assert[2];
      assert.equal(readAssertion.type, "javascript");
      const gradeRead = new Function("context", readAssertion.value);
      assert.equal(gradeRead({ providerResponse: { raw: JSON.stringify({ items: [{ type: "command_execution", command: "cat instructions.md", status: "completed", exit_code: 0 }] }) } }).pass, true);
      assert.equal(gradeRead({ providerResponse: { output: "I read instructions.md" } }).pass, false);
      assert.equal(providerConfiguration.providers[0].id, expectedProviderId);
      assert.equal(providerConfiguration.tests[0].options.provider.id, expectedProviderId);
      assert.equal(providerConfiguration.providers[0].config.working_dir, temporaryFolderPath);
      if (agentName === "codex") {
        assert.equal(providerConfiguration.providers[0].config.codex_path_override, "codex");
        assert.equal(providerConfiguration.providers[0].config.sandbox_mode, "workspace-write");
        assert.equal(providerConfiguration.providers[0].config.approval_policy, "never");
        assert.equal(providerConfiguration.tests[0].options.provider.config.sandbox_mode, "read-only");
      }
      assert.equal((await readdir(promptfooRunner.installFolderPath)).some((fileName) => fileName.startsWith("run-")), true);
      assert.equal(testReport.sessionId, "test-session");
      assert.equal(testReport.sessionPath, sessionFilePath);
      assert.ok(testReport.logPath);
      const savedLogs = await promptfooRunner.readLogs(pathToFileURL(temporaryFolderPath), testReport.logPath);
      assert.equal(savedLogs.length, 1);
      assert.equal(savedLogs[0]?.answer, "Verification incomplete");
      assert.match(savedLogs[0]?.toolCalls[0] ?? "", /cat instructions.md/);
      assert.equal(savedLogs[0]?.sessionPath, sessionFilePath);
      assert.equal(JSON.parse(await readFile(savedLogs[0]!.outputPath, "utf8")).results.results[0].response.sessionId, "test-session");
      assert.equal((await promptfooRunner.readLogs(pathToFileURL(temporaryFolderPath))).length, 1);
      assert.equal((await promptfooRunner.readLogs(pathToFileURL(join(temporaryFolderPath, "unrelated")))).length, 0);
      assert.equal(await promptfooRunner.isInstalled(), false);
    } finally {
      await rm(temporaryFolderPath, { recursive: true, force: true });
    }
  });
}

test("file-read assertions grade successful tool evidence, not mentions, failures or ambiguous shell commands", async () => {
  const { gradeFileRead } = await import("../src/zdriven/Promptfoo.js");
  const expectedPath = ".cw/out/skill/sdd-verify/index.md";
  const commandItem = (command: string, exitCode = 0) => ({ type: "command_execution", command, status: "completed", exit_code: exitCode });
  const gradeResponse = (items: unknown[]) => gradeFileRead({ raw: JSON.stringify({ items }) }, expectedPath, "/repo");
  assert.equal(gradeResponse([commandItem(`cat .cw/out/CHARTER.md ${expectedPath}`)]).pass, true);
  assert.equal(gradeResponse([commandItem(`/bin/zsh -lc 'cat /repo/${expectedPath}'`)]).pass, true);
  assert.equal(gradeResponse([commandItem(`cat './${expectedPath}'`)]).pass, true);
  for (const command of [`echo ${expectedPath}`, `cat ${expectedPath}.other`, `cat ${expectedPath} || true`, `false; cat ${expectedPath}`, `echo 'cat ${expectedPath}'`, `cat missing # ${expectedPath}`, `cat ${expectedPath} > /tmp/copy`]) {
    assert.equal(gradeResponse([commandItem(command)]).pass, false, command);
  }
  assert.equal(gradeResponse([commandItem(`cat ${expectedPath}`, 1)]).pass, false);
  assert.equal(gradeResponse([{ type: "agent_message", text: `I read ${expectedPath}` }]).pass, false);
  assert.equal(gradeFileRead({ raw: "invalid" }, expectedPath, "/repo").pass, false);
  assert.equal(gradeFileRead({}, expectedPath, "/repo").pass, false);
  assert.equal(gradeFileRead({ metadata: { toolCalls: [{ name: "Read", input: { file_path: `/repo/${expectedPath}` }, output: "contents", is_error: false }] } }, expectedPath, "/repo").pass, true);
  assert.equal(gradeFileRead({ metadata: { toolCalls: [{ name: "Read", input: { file_path: `/repo/${expectedPath}` }, output: "error", is_error: true }] } }, expectedPath, "/repo").pass, false);
  assert.equal(gradeFileRead({ metadata: { toolCalls: [{ name: "Read", input: { file_path: `/repo/${expectedPath}` }, is_error: false }] } }, expectedPath, "/repo").pass, false);
  // The assertion must also work after serialization, without module closures.
  const serializedGrade = new Function("response", `return (${gradeFileRead.toString()})(response, ${JSON.stringify(expectedPath)}, "/repo");`);
  assert.equal(serializedGrade({ raw: JSON.stringify({ items: [commandItem(`cat ${expectedPath}`)] }) }).pass, true);
});

test("a promptfoo process error preserves stderr and a readable failure log even without an agent session", async () => {
  const temporaryFolderPath = await mkdtemp(join(tmpdir(), "cw-promptfoo-error-"));
  try {
    const promptfooRunner = new Promptfoo(temporaryFolderPath, []);
    const executableFolderPath = join(promptfooRunner.installFolderPath, "node_modules", ".bin");
    await mkdir(executableFolderPath, { recursive: true });
    const executableFilePath = join(executableFolderPath, "promptfoo");
    await writeFile(executableFilePath, '#!/usr/bin/env node\nconsole.error("provider unavailable"); process.exit(2);\n');
    await chmod(executableFilePath, 0o755);
    await assert.rejects(promptfooRunner.evaluate({ agent: "codex", description: "error", prompt: "read", workingFolder: pathToFileURL(temporaryFolderPath), assertions: [] }), /provider unavailable.*Log:/s);
    const savedLogs = await promptfooRunner.readLogs(pathToFileURL(temporaryFolderPath));
    assert.equal(savedLogs.length, 1);
    assert.equal(savedLogs[0]?.success, false);
    assert.match(savedLogs[0]?.error ?? "", /provider unavailable/);
    assert.match(await readFile(savedLogs[0]!.stderrPath, "utf8"), /provider unavailable/);
    assert.equal(savedLogs[0]?.sessionId, undefined);
    assert.equal(savedLogs[0]?.sessionPath, undefined);
    await assert.rejects(promptfooRunner.readLogs(pathToFileURL(temporaryFolderPath), "missing.json"), /Cannot read evaluation log/);
    const invalidLogPath = join(temporaryFolderPath, "invalid.json");
    await writeFile(invalidLogPath, "{}");
    await assert.rejects(promptfooRunner.readLogs(pathToFileURL(temporaryFolderPath), invalidLogPath), /Invalid evaluation log/);
  } finally {
    await rm(temporaryFolderPath, { recursive: true, force: true });
  }
});
