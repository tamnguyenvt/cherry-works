import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { Promptfoo } from "../src/module/runtime/infra/promptfoo.adapter.js";

const FAKE_PROMPTFOO = `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const config = JSON.parse(fs.readFileSync(process.argv[process.argv.indexOf("-c") + 1], "utf8"));
fs.writeFileSync(path.join(process.cwd(), "..", "captured.json"), JSON.stringify(config));
fs.writeFileSync(process.argv[process.argv.indexOf("-o") + 1], JSON.stringify({results:{results:[{success:false,response:{sessionId:"test-session",output:"Verification incomplete",raw:JSON.stringify({items:[{type:"command_execution",command:"cat instructions.md",status:"completed",exit_code:0}]}),tokenUsage:{total:123}},gradingResult:{componentResults:[{pass:false,reason:"Missing skill: planning",assertion:{type:"skill-used"}}]}}]}}));
process.exit(100);
`;

for (const agentName of ["claude", "codex"] as const) {
  test(`promptfoo runs and grades with ${agentName}, and keeps each case under the log as it ran: its prompt, the agent, whether it passed and why, the tools called and the agent's session record (CORE Story 55 scenario 31, EVAL-FR-040)`, async () => {
    const temporaryFolderPath = await mkdtemp(join(tmpdir(), "cw-promptfoo-"));
    try {
      const sessionFolderPath = join(temporaryFolderPath, agentName === "codex" ? "sessions" : "projects");
      await mkdir(sessionFolderPath, { recursive: true });
      const sessionFilePath = join(
        sessionFolderPath,
        agentName === "codex" ? "rollout-test-session.jsonl" : "test-session.jsonl",
      );
      await writeFile(sessionFilePath, "{}\n");
      const promptfooRunner = new Promptfoo(
        pathToFileURL(`${temporaryFolderPath}/`),
        pathToFileURL(`${temporaryFolderPath}/`),
        [sessionFolderPath],
      );
      const executableFolderPath = join(promptfooRunner.installFolderPath, "node_modules", ".bin");
      await mkdir(executableFolderPath, { recursive: true });
      const executableFilePath = join(executableFolderPath, "promptfoo");
      await writeFile(executableFilePath, FAKE_PROMPTFOO);
      await chmod(executableFilePath, 0o755);
      const testReport = await promptfooRunner.evaluateTest({
        provider: agentName,
        description: "planning",
        prompt: "plan",
        workingPath: "",
        assertions: [
          { type: "skill-used", value: "planning" },
          { type: "agent-rubric", value: "Use plain names" },
          { type: "javascript", config: { readFilePath: "instructions.md" } },
        ],
      });
      assert.equal(testReport.success, false);
      assert.equal(testReport.totalTokens, 123);
      assert.match(testReport.componentResults[0]?.reason ?? "", /Missing skill/);
      const providerConfiguration = JSON.parse(
        await readFile(join(promptfooRunner.installFolderPath, "captured.json"), "utf8"),
      );
      const expectedProviderId = agentName === "codex" ? "openai:codex-sdk" : "anthropic:claude-agent-sdk";
      const readAssertion = providerConfiguration.tests[0].assert[2];
      assert.equal(readAssertion.type, "javascript");
      const gradeRead = new Function("context", readAssertion.value);
      assert.equal(
        gradeRead({
          providerResponse: {
            raw: JSON.stringify({
              items: [{ type: "command_execution", command: "cat instructions.md", status: "completed", exit_code: 0 }],
            }),
          },
        }).pass,
        true,
      );
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
      assert.equal(
        (await readdir(join(temporaryFolderPath, ".cw/log/eval/runs"))).some((fileName) => fileName.startsWith("run-")),
        true,
      );
      assert.equal(testReport.sessionId, "test-session");
      assert.equal(testReport.sessionPath, sessionFilePath);
      assert.ok(testReport.logPath);
      const savedLogs = await promptfooRunner.readLogs(testReport.logPath);
      assert.equal(savedLogs.length, 1);
      assert.equal(savedLogs[0]?.logPath.startsWith(join(temporaryFolderPath, ".cw/log/")), true);
      assert.equal(savedLogs[0]?.prompt, "plan");
      assert.equal(savedLogs[0]?.provider, agentName);
      assert.equal(JSON.parse(await readFile(savedLogs[0]!.logPath, "utf8")).agent, agentName);
      assert.equal(savedLogs[0]?.success, false);
      assert.deepEqual(savedLogs[0]?.unmetReasons, ["Missing skill: planning"]);
      assert.equal(savedLogs[0]?.answer, "Verification incomplete");
      assert.match(savedLogs[0]?.toolCalls[0] ?? "", /cat instructions.md/);
      assert.equal(savedLogs[0]?.sessionPath, sessionFilePath);
      assert.equal(
        JSON.parse(await readFile(savedLogs[0]!.outputPath, "utf8")).results.results[0].response.sessionId,
        "test-session",
      );
      assert.equal((await promptfooRunner.readLogs()).length, 1);
      assert.equal(
        (
          await new Promptfoo(
            pathToFileURL(`${join(temporaryFolderPath, "unrelated")}/`),
            pathToFileURL(`${temporaryFolderPath}/`),
            [],
          ).readLogs()
        ).length,
        0,
      );
      assert.equal(await promptfooRunner.isInstalled(), false);
    } finally {
      await rm(temporaryFolderPath, { recursive: true, force: true });
    }
  });
}

/** promptfoo standing in for itself: the agent answers each prompt as a test
 *  set, and every JavaScript assertion handed in is run on that answer, as
 *  promptfoo runs it. */
const GRADING_PROMPTFOO = `#!/usr/bin/env node
const fs = require("node:fs");
const config = JSON.parse(fs.readFileSync(process.argv[process.argv.indexOf("-c") + 1], "utf8"));
const workingFolderPath = config.providers[0].config.working_dir;
const providerResponseByPrompt = {
  "read the guide": { output: "Done.", metadata: { toolCalls: [{ name: "Read", input: { file_path: workingFolderPath + "/docs/guide.md" }, output: "the guide", is_error: false }] } },
  "mention the guide": { output: "I read docs/guide.md." },
};
const providerResponse = providerResponseByPrompt[config.tests[0].vars.prompt];
const componentResults = config.tests[0].assert.map((assertion) => ({ ...new Function("context", assertion.value)({ providerResponse }), assertion: { type: assertion.type } }));
const success = componentResults.every(({ pass }) => pass);
fs.writeFileSync(process.argv[process.argv.indexOf("-o") + 1], JSON.stringify({ results: { results: [{ success, response: { ...providerResponse, tokenUsage: { total: 10 } }, gradingResult: { componentResults } }] } }));
process.exit(success ? 0 : 100);
`;

test("a case expecting a read passes where the agent's tools read the file, and fails naming it where the agent only mentioned it (CORE Story 55 scenario 29, EVAL-FR-039, EVAL-FR-020)", async () => {
  const temporaryFolderPath = await mkdtemp(join(tmpdir(), "cw-promptfoo-read-"));
  try {
    const promptfooRunner = new Promptfoo(
      pathToFileURL(`${temporaryFolderPath}/`),
      pathToFileURL(`${temporaryFolderPath}/`),
      [],
    );
    const executableFolderPath = join(promptfooRunner.installFolderPath, "node_modules", ".bin");
    await mkdir(executableFolderPath, { recursive: true });
    await writeFile(join(executableFolderPath, "promptfoo"), GRADING_PROMPTFOO);
    await chmod(join(executableFolderPath, "promptfoo"), 0o755);
    const readExpectingTest = (prompt: string) => ({
      provider: "claude",
      description: "reading",
      prompt,
      workingPath: "",
      assertions: [{ type: "javascript" as const, config: { readFilePath: "docs/guide.md" } }],
    });

    const readTestResult = await promptfooRunner.evaluateTest(readExpectingTest("read the guide"));
    const mentionTestResult = await promptfooRunner.evaluateTest(readExpectingTest("mention the guide"));

    assert.equal(readTestResult.success, true);
    assert.equal(mentionTestResult.success, false);
    assert.match(mentionTestResult.componentResults[0]?.reason ?? "", /docs\/guide\.md/);
  } finally {
    await rm(temporaryFolderPath, { recursive: true, force: true });
  }
});

test("file-read assertions grade successful tool evidence, not mentions, failures or ambiguous shell commands (CORE Story 55 scenario 29, EVAL-FR-039)", async () => {
  const { gradeFileRead } = await import("../src/module/runtime/infra/promptfoo.adapter.js");
  const expectedPath = ".cw/out/skill/sdd-verify/index.md";
  const commandItem = (command: string, exitCode = 0) => ({
    type: "command_execution",
    command,
    status: "completed",
    exit_code: exitCode,
  });
  const gradeResponse = (items: unknown[]) => gradeFileRead({ raw: JSON.stringify({ items }) }, expectedPath, "/repo");
  assert.equal(gradeResponse([commandItem(`cat .cw/out/CHARTER.md ${expectedPath}`)]).pass, true);
  assert.equal(gradeResponse([commandItem(`/bin/zsh -lc 'cat /repo/${expectedPath}'`)]).pass, true);
  assert.equal(gradeResponse([commandItem(`cat './${expectedPath}'`)]).pass, true);
  for (const command of [
    `echo ${expectedPath}`,
    `cat ${expectedPath}.other`,
    `cat ${expectedPath} || true`,
    `false; cat ${expectedPath}`,
    `echo 'cat ${expectedPath}'`,
    `cat missing # ${expectedPath}`,
    `cat ${expectedPath} > /tmp/copy`,
  ]) {
    assert.equal(gradeResponse([commandItem(command)]).pass, false, command);
  }
  assert.equal(gradeResponse([commandItem(`cat ${expectedPath}`, 1)]).pass, false);
  assert.equal(gradeResponse([{ type: "agent_message", text: `I read ${expectedPath}` }]).pass, false);
  assert.equal(gradeFileRead({ raw: "invalid" }, expectedPath, "/repo").pass, false);
  assert.equal(gradeFileRead({}, expectedPath, "/repo").pass, false);
  assert.equal(
    gradeFileRead(
      {
        metadata: {
          toolCalls: [
            { name: "Read", input: { file_path: `/repo/${expectedPath}` }, output: "contents", is_error: false },
          ],
        },
      },
      expectedPath,
      "/repo",
    ).pass,
    true,
  );
  assert.equal(
    gradeFileRead(
      {
        metadata: {
          toolCalls: [{ name: "Read", input: { file_path: `/repo/${expectedPath}` }, output: "error", is_error: true }],
        },
      },
      expectedPath,
      "/repo",
    ).pass,
    false,
  );
  assert.equal(
    gradeFileRead(
      { metadata: { toolCalls: [{ name: "Read", input: { file_path: `/repo/${expectedPath}` }, is_error: false }] } },
      expectedPath,
      "/repo",
    ).pass,
    false,
  );
  // The assertion must also work after serialization, without module closures.
  const serializedGrade = new Function(
    "response",
    `return (${gradeFileRead.toString()})(response, ${JSON.stringify(expectedPath)}, "/repo");`,
  );
  assert.equal(serializedGrade({ raw: JSON.stringify({ items: [commandItem(`cat ${expectedPath}`)] }) }).pass, true);
});

test("a promptfoo process error preserves stderr and a readable failure log even without an agent session", async () => {
  const temporaryFolderPath = await mkdtemp(join(tmpdir(), "cw-promptfoo-error-"));
  try {
    const promptfooRunner = new Promptfoo(
      pathToFileURL(`${temporaryFolderPath}/`),
      pathToFileURL(`${temporaryFolderPath}/`),
      [],
    );
    const executableFolderPath = join(promptfooRunner.installFolderPath, "node_modules", ".bin");
    await mkdir(executableFolderPath, { recursive: true });
    const executableFilePath = join(executableFolderPath, "promptfoo");
    await writeFile(
      executableFilePath,
      '#!/usr/bin/env node\nconsole.error("provider unavailable"); process.exit(2);\n',
    );
    await chmod(executableFilePath, 0o755);
    await assert.rejects(
      promptfooRunner.evaluateTest({
        provider: "codex",
        description: "error",
        prompt: "read",
        workingPath: "",
        assertions: [],
      }),
      /provider unavailable.*Log:/s,
    );
    const savedLogs = await promptfooRunner.readLogs();
    assert.equal(savedLogs.length, 1);
    assert.equal(savedLogs[0]?.success, false);
    assert.match(savedLogs[0]?.error ?? "", /provider unavailable/);
    assert.match(await readFile(savedLogs[0]!.stderrPath, "utf8"), /provider unavailable/);
    assert.equal(savedLogs[0]?.sessionId, undefined);
    assert.equal(savedLogs[0]?.sessionPath, undefined);
    await assert.rejects(promptfooRunner.readLogs("missing.json"), /Cannot read evaluation log/);
    const invalidLogPath = join(temporaryFolderPath, "invalid.json");
    await writeFile(invalidLogPath, "{}");
    await assert.rejects(promptfooRunner.readLogs(invalidLogPath), /Invalid evaluation log/);
  } finally {
    await rm(temporaryFolderPath, { recursive: true, force: true });
  }
});

test("kept results are read again with no agent and no promptfoo installed, one by the path a run said or the latest twenty of the repository (CORE Story 55 scenario 32, EVAL-FR-041)", async () => {
  const temporaryFolderPath = await mkdtemp(join(tmpdir(), "cw-promptfoo-kept-"));
  try {
    const promptfooRunner = new Promptfoo(
      pathToFileURL(`${temporaryFolderPath}/`),
      pathToFileURL(`${temporaryFolderPath}/`),
      [],
    );
    const keptLogPaths: string[] = [];
    for (let caseIndex = 0; caseIndex < 21; caseIndex++) {
      const runFolderPath = join(temporaryFolderPath, ".cw/log/eval/runs", `run-${caseIndex}`);
      await mkdir(runFolderPath, { recursive: true });
      const keptLogPath = join(runFolderPath, "case.json");
      keptLogPaths.push(keptLogPath);
      await writeFile(
        keptLogPath,
        JSON.stringify({
          logPath: keptLogPath,
          createdAt: new Date(Date.UTC(2026, 9, 1, 12, caseIndex)).toISOString(),
          agent: "claude",
          prompt: `case ${caseIndex}`,
          workingFolderPath: temporaryFolderPath,
          outputPath: join(runFolderPath, "output.json"),
          stdoutPath: join(runFolderPath, "stdout.log"),
          stderrPath: join(runFolderPath, "stderr.log"),
          success: caseIndex % 2 === 0,
          totalTokens: 10,
          unmetReasons: [],
          answer: "",
          toolCalls: [],
        }),
      );
    }

    const latestLogs = await promptfooRunner.readLogs();
    const namedLogs = await promptfooRunner.readLogs(keptLogPaths[0]);

    assert.equal(await promptfooRunner.isInstalled(), false);
    assert.equal(latestLogs.length, 20);
    assert.equal(latestLogs[0]?.prompt, "case 20");
    assert.equal(
      latestLogs.some(({ prompt }) => prompt === "case 0"),
      false,
    );
    assert.deepEqual(
      namedLogs.map(({ prompt }) => prompt),
      ["case 0"],
    );
  } finally {
    await rm(temporaryFolderPath, { recursive: true, force: true });
  }
});
