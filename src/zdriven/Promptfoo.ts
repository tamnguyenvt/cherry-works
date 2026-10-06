import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
// Types only, off the promptfoo this pins: what is written to it and read
// back is held to its own shapes, and nothing of it is bundled.
import type { OutputFile, UnifiedConfig } from "promptfoo";
import { DrivenFault, type ForRunningPromptfoo, type PromptfooTest, type PromptfooTestResult } from "#hexagon/port/zdriven/ForRunningPromptfoo.js";

const run = promisify(execFile);

/** The promptfoo installed, and the Claude Agent SDK its Claude Code provider
 *  runs the agent with: pinned, so every machine grades the same way. Kept
 *  equal to the promptfoo in `devDependencies`, whose types this reads. */
const PROMPTFOO_VERSION = "0.123.1";
const CLAUDE_AGENT_SDK_VERSION = "0.3.289";

/** What `promptfoo eval` exits with when a test failed, as against an error. */
const PROMPTFOO_FAILED_TEST_EXIT_CODE = 100;

/** promptfoo's own telemetry and update checks, off. */
const PROMPTFOO_QUIET_ENV = { PROMPTFOO_DISABLE_TELEMETRY: "1", PROMPTFOO_DISABLE_UPDATE: "1" };

/**
 * DRIVEN ADAPTER: promptfoo, installed with npm into a folder of its own and run
 * as `promptfoo eval` (EVAL-FR-020, EVAL-FR-032).
 *
 * The agent is run by promptfoo's `anthropic:claude-agent-sdk` provider in the
 * working folder: the project's settings, every skill, edits accepted, and no
 * command, since no one is there to allow one. An `agent-rubric` is graded by
 * the same provider in the same folder, reading and searching only, with no
 * settings of the project's to sway it. Both run on whatever Claude Code is
 * signed in with, or the key the environment sets.
 *
 * The provider finds the SDK from where the configuration is, so each test is
 * written into a folder under the one it is installed in, and taken away
 * afterwards. Nothing of a run is kept in promptfoo's own store
 * (`--no-write`): what the agent did stays in the run.
 */
export class Promptfoo implements ForRunningPromptfoo {
  readonly installFolderPath: string;

  /** `cherryWorksFolderPath`: this engine's own folder on the machine. */
  constructor(cherryWorksFolderPath: string) {
    this.installFolderPath = join(cherryWorksFolderPath, "promptfoo", PROMPTFOO_VERSION);
  }

  async isInstalled(): Promise<boolean> {
    return Promise.all([
      access(join(this.installFolderPath, "node_modules", ".bin", "promptfoo")),
      access(join(this.installFolderPath, "node_modules", "@anthropic-ai", "claude-agent-sdk", "package.json")),
    ]).then(
      () => true,
      () => false,
    );
  }

  async install(): Promise<void> {
    await mkdir(this.installFolderPath, { recursive: true });
    await writeFile(join(this.installFolderPath, "package.json"), `${JSON.stringify({ private: true })}\n`);
    try {
      await run(
        "npm",
        ["install", "--no-audit", "--no-fund", "--silent", `promptfoo@${PROMPTFOO_VERSION}`, `@anthropic-ai/claude-agent-sdk@${CLAUDE_AGENT_SDK_VERSION}`],
        { cwd: this.installFolderPath, maxBuffer: 64 * 1024 * 1024 },
      );
    } catch (raised) {
      throw new DrivenFault(`Installing promptfoo failed: ${raised}`, `Check that npm can reach the registry, then run "cw eval" again.`);
    }
  }

  async evaluate({ description, prompt, workingFolder, assertions }: PromptfooTest): Promise<PromptfooTestResult> {
    const workingFolderPath = fileURLToPath(workingFolder);
    const runFolderPath = await mkdtemp(join(this.installFolderPath, "run-"));
    try {
      const configFilePath = join(runFolderPath, "promptfooconfig.json");
      const outputFilePath = join(runFolderPath, "output.json");
      const isAgentGraded = assertions.some(({ type }) => type === "agent-rubric");
      const promptfooConfig = {
        description,
        prompts: ["{{prompt}}"],
        providers: [
          {
            id: "anthropic:claude-agent-sdk",
            config: {
              working_dir: workingFolderPath,
              setting_sources: ["project"],
              permission_mode: "acceptEdits",
              skills: "all",
              append_allowed_tools: ["Write", "Edit", "MultiEdit"],
              apiKeyRequired: false,
            },
          },
        ],
        tests: [
          {
            vars: { prompt },
            ...(isAgentGraded
              ? {
                  options: {
                    provider: {
                      id: "anthropic:claude-agent-sdk",
                      config: {
                        working_dir: workingFolderPath,
                        setting_sources: [],
                        allowed_tools: ["Read", "Glob", "Grep"],
                        permission_mode: "default",
                        apiKeyRequired: false,
                      },
                    },
                  },
                }
              : {}),
            assert: assertions.map(({ type, value }) => ({ type, value })),
          },
        ],
      } satisfies Partial<UnifiedConfig>;
      await writeFile(configFilePath, JSON.stringify(promptfooConfig));
      try {
        await run(join(this.installFolderPath, "node_modules", ".bin", "promptfoo"), ["eval", "-c", configFilePath, "-o", outputFilePath, "--no-table", "--no-cache", "--no-write"], {
          cwd: runFolderPath,
          env: { ...process.env, ...PROMPTFOO_QUIET_ENV },
          maxBuffer: 64 * 1024 * 1024,
        });
      } catch (raised) {
        // A test failing is an answer, not an error.
        if ((raised as { code?: unknown }).code !== PROMPTFOO_FAILED_TEST_EXIT_CODE)
          throw new DrivenFault(`"promptfoo eval" stopped with an error: ${(raised as { stderr?: string }).stderr?.trim() || raised}`, 'Check that "claude" runs and is signed in here.');
      }
      const {
        results: { results: testResults },
      } = JSON.parse(await readFile(outputFilePath, "utf8")) as OutputFile;
      const [testResult] = testResults;
      if (testResult === undefined) throw new DrivenFault('"promptfoo eval" wrote no result.', 'Run "cw eval" again.');
      return {
        success: testResult.success,
        totalTokens: testResult.response?.tokenUsage?.total ?? 0,
        componentResults: (testResult.gradingResult?.componentResults ?? []).map(({ pass, reason, assertion }) => ({
          assertionType: assertion?.type ?? "",
          pass,
          reason: reason ?? "",
        })),
        ...(testResult.error === undefined || testResult.error === null ? {} : { error: testResult.error }),
      };
    } finally {
      await rm(runFolderPath, { recursive: true, force: true });
    }
  }
}
