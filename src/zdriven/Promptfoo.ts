import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
// Types only, off the promptfoo this pins: what is written to it and read
// back is held to its own shapes, and nothing of it is bundled.
import type { OutputFile, UnifiedConfig } from "promptfoo";
import { z } from "zod";
import { AdapterFault, type ForRunningPromptfoo, type PromptfooTest, type PromptfooTestResult, type PromptfooLog } from "#hexagon/port/zdriven/ForRunningPromptfoo.js";

const run = promisify(execFile);

/** The promptfoo and agent SDK versions installed: pinned so every machine
 *  grades the same way. Kept
 *  equal to the promptfoo in `devDependencies`, whose types this reads. */
const PROMPTFOO_VERSION = "0.123.1";
const CLAUDE_AGENT_SDK_VERSION = "0.3.289";
const CODEX_SDK_VERSION = "0.166.0";

/** What `promptfoo eval` exits with when a test failed, as against an error. */
const PROMPTFOO_FAILED_TEST_EXIT_CODE = 100;

/** promptfoo's own telemetry and update checks, off. */
const PROMPTFOO_QUIET_ENV = { PROMPTFOO_DISABLE_TELEMETRY: "1", PROMPTFOO_DISABLE_UPDATE: "1" };

const PromptfooLogSchema = z.object({
  logPath: z.string(), createdAt: z.string(), agent: z.enum(["claude", "codex"]), prompt: z.string(),
  workingFolderPath: z.string(), outputPath: z.string(), stdoutPath: z.string(), stderrPath: z.string(),
  success: z.boolean(), totalTokens: z.number(), unmetReasons: z.array(z.string()), answer: z.string(),
  toolCalls: z.array(z.string()), sessionId: z.string().optional(), sessionPath: z.string().optional(), error: z.string().optional(),
});

/**
 * DRIVEN ADAPTER: promptfoo, installed with npm into a folder of its own and run
 * as `promptfoo eval` (EVAL-FR-020, EVAL-FR-032).
 *
 * The selected agent runs through its promptfoo SDK provider in the working
 * folder. Claude Code uses the project's settings, every skill, edits accepted, and no
 * command, since no one is there to allow one. An `agent-rubric` is graded by
 * the same provider in the same folder, reading and searching only, with no
 * settings of the project's to sway it. Codex uses workspace-write for the
 * case and read-only for grading, without approval prompts or retries. Both
 * use the selected agent's sign-in, or the key the environment sets.
 *
 * The provider finds the SDK from where the configuration is, so each test is
 * written into a folder under the one it is installed in. Configuration, raw
 * output, stdout, stderr and a readable case manifest are retained there.
 * Nothing is written to promptfoo's own store (`--no-write`).
 */
export class Promptfoo implements ForRunningPromptfoo {
  readonly installFolderPath: string;

  /** `cherryWorksFolderPath`: this engine's own folder on the machine. */
  constructor(cherryWorksFolderPath: string, private readonly agentSessionFolders: readonly string[] = [join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "sessions"), join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "archived_sessions"), join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "projects")]) {
    this.installFolderPath = join(cherryWorksFolderPath, "promptfoo", PROMPTFOO_VERSION);
  }

  async isInstalled(): Promise<boolean> {
    return Promise.all([
      access(join(this.installFolderPath, "node_modules", ".bin", "promptfoo")),
      access(join(this.installFolderPath, "node_modules", "@anthropic-ai", "claude-agent-sdk", "package.json")),
      access(join(this.installFolderPath, "node_modules", "@openai", "codex-sdk", "package.json")),
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
        ["install", "--no-audit", "--no-fund", "--silent", `promptfoo@${PROMPTFOO_VERSION}`, `@anthropic-ai/claude-agent-sdk@${CLAUDE_AGENT_SDK_VERSION}`, `@openai/codex-sdk@${CODEX_SDK_VERSION}`],
        { cwd: this.installFolderPath, maxBuffer: 64 * 1024 * 1024 },
      );
    } catch (raised) {
      throw new AdapterFault(`Installing promptfoo failed: ${raised}`, `Check that npm can reach the registry, then run "cw eval" again.`);
    }
  }

  async evaluate({ agent, description, prompt, workingFolder, assertions }: PromptfooTest): Promise<PromptfooTestResult> {
    const workingFolderPath = fileURLToPath(workingFolder);
    const runFolderPath = await mkdtemp(join(this.installFolderPath, "run-"));
    const logFilePath = join(runFolderPath, "case.json");
    const stdoutPath = join(runFolderPath, "stdout.log");
    const stderrPath = join(runFolderPath, "stderr.log");
    const outputFilePath = join(runFolderPath, "output.json");
    const createdAt = new Date().toISOString();
    const logBase = { logPath: logFilePath, createdAt, agent, prompt, workingFolderPath, outputPath: outputFilePath, stdoutPath, stderrPath };
    await Promise.all([writeFile(stdoutPath, ""), writeFile(stderrPath, "")]);
    try {
      const configFilePath = join(runFolderPath, "promptfooconfig.json");
      const isAgentGraded = assertions.some(({ type }) => type === "agent-rubric");
      const providerId = agent === "codex" ? "openai:codex-sdk" : "anthropic:claude-agent-sdk";
      const providerConfig = agent === "codex"
        ? { working_dir: workingFolderPath, codex_path_override: "codex", sandbox_mode: "workspace-write", approval_policy: "never", maxRetries: 0 }
        : { working_dir: workingFolderPath, setting_sources: ["project"], permission_mode: "acceptEdits", skills: "all", append_allowed_tools: ["Write", "Edit", "MultiEdit"], apiKeyRequired: false };
      const graderConfig = agent === "codex"
        ? { working_dir: workingFolderPath, codex_path_override: "codex", sandbox_mode: "read-only", approval_policy: "never", maxRetries: 0, cli_config: { project_doc_max_bytes: 0 } }
        : { working_dir: workingFolderPath, setting_sources: [], allowed_tools: ["Read", "Glob", "Grep"], permission_mode: "default", apiKeyRequired: false };
      const promptfooConfig = {
        description,
        prompts: ["{{prompt}}"],
        providers: [{ id: providerId, config: providerConfig }],
        tests: [
          {
            vars: { prompt },
            ...(isAgentGraded
              ? {
                  options: {
                    provider: {
                      id: providerId,
                      config: graderConfig,
                    },
                  },
                }
              : {}),
            assert: assertions.map(({ type, value }) => type === "file-read"
              ? { type: "javascript" as const, value: `return (${gradeFileRead.toString()})(context.providerResponse, ${JSON.stringify(value)}, ${JSON.stringify(workingFolderPath)});` }
              : { type, value }),
          },
        ],
      } satisfies Partial<UnifiedConfig>;
      await writeFile(configFilePath, JSON.stringify(promptfooConfig));
      try {
        const processOutput = await run(join(this.installFolderPath, "node_modules", ".bin", "promptfoo"), ["eval", "-c", configFilePath, "-o", outputFilePath, "--no-table", "--no-cache", "--no-write"], {
          cwd: runFolderPath,
          env: { ...process.env, ...PROMPTFOO_QUIET_ENV },
          maxBuffer: 64 * 1024 * 1024,
        });
        await Promise.all([writeFile(stdoutPath, processOutput.stdout), writeFile(stderrPath, processOutput.stderr)]);
      } catch (raised) {
        const processFault = raised as { stdout?: string; stderr?: string };
        await Promise.all([writeFile(stdoutPath, processFault.stdout ?? ""), writeFile(stderrPath, processFault.stderr ?? "")]);
        // A test failing is an answer, not an error.
        if ((raised as { code?: unknown }).code !== PROMPTFOO_FAILED_TEST_EXIT_CODE)
          throw new AdapterFault(`"promptfoo eval" stopped with an error: ${(raised as { stderr?: string }).stderr?.trim() || raised}`, `Check that "${agent}" runs and is signed in here.`);
      }
      const {
        results: { results: testResults },
      } = JSON.parse(await readFile(outputFilePath, "utf8")) as OutputFile;
      const [testResult] = testResults;
      if (testResult === undefined) throw new AdapterFault('"promptfoo eval" wrote no result.', 'Run "cw eval" again.');
      const sessionId = (testResult.response as { sessionId?: string } | undefined)?.sessionId;
      const sessionPath = sessionId === undefined ? undefined : await this.findSessionLog(agent, sessionId);
      const promptfooResult: PromptfooTestResult = {
        logPath: logFilePath,
        ...(sessionId === undefined ? {} : { sessionId }),
        ...(sessionPath === undefined ? {} : { sessionPath }),
        success: testResult.success,
        totalTokens: testResult.response?.tokenUsage?.total ?? 0,
        componentResults: (testResult.gradingResult?.componentResults ?? []).map(({ pass, reason, assertion }) => ({
          assertionType: assertion?.type ?? "",
          pass,
          reason: reason ?? "",
        })),
        ...(testResult.error === undefined || testResult.error === null ? {} : { error: testResult.error }),
      };
      let rawResponse: { items?: unknown[] } = {};
      try {
        const providerRaw = testResult.response?.raw;
        rawResponse = typeof providerRaw === "string" ? JSON.parse(providerRaw) : providerRaw as typeof rawResponse ?? {};
      } catch { /* Keep the raw output artifact even when it is not structured. */ }
      const metadataCalls = (testResult.response?.metadata as { toolCalls?: unknown[] } | undefined)?.toolCalls;
      const traceItems = [...(Array.isArray(rawResponse?.items) ? rawResponse.items : []), ...(Array.isArray(metadataCalls) ? metadataCalls : [])];
      const savedLog: PromptfooLog = {
        ...logBase, ...promptfooResult,
        unmetReasons: promptfooResult.componentResults.filter(({ pass }) => !pass).map(({ reason }) => reason),
        answer: typeof testResult.response?.output === "string" ? testResult.response.output : JSON.stringify(testResult.response?.output ?? ""),
        toolCalls: traceItems.filter((traceItem) => traceItem && typeof traceItem === "object" && ("command" in traceItem || "name" in traceItem || "tool" in traceItem)).map((traceItem) => JSON.stringify(traceItem)),
      };
      await writeFile(logFilePath, JSON.stringify(savedLog, null, 2) + "\n", { mode: 0o600 });
      return promptfooResult;
    } catch (raised) {
      const errorMessage = raised instanceof Error ? raised.message : String(raised);
      await writeFile(logFilePath, JSON.stringify({ ...logBase, success: false, totalTokens: 0, unmetReasons: [errorMessage], error: errorMessage, answer: "", toolCalls: [] }, null, 2) + "\n", { mode: 0o600 });
      throw new AdapterFault(`${errorMessage} Log: ${logFilePath}`, `Read it with "cw eval-analyze --log ${logFilePath}".`);
    }
  }

  /** Resolve only existing local session files, never manufacture a path from an id. */
  private async findSessionLog(agent: "claude" | "codex", sessionId: string): Promise<string | undefined> {
    if (!/^[A-Za-z0-9-]+$/.test(sessionId)) return undefined;
    const pendingFolders = this.agentSessionFolders.filter((folderPath) => agent === "codex" ? !folderPath.endsWith("projects") : folderPath.endsWith("projects"));
    while (pendingFolders.length) {
      const folderPath = pendingFolders.pop()!;
      let folderEntries;
      try { folderEntries = await readdir(folderPath, { withFileTypes: true }); }
      catch (raised) {
        if (["ENOENT", "EACCES", "EPERM"].includes((raised as NodeJS.ErrnoException).code ?? "")) continue;
        throw raised;
      }
      for (const folderEntry of folderEntries) {
        const entryPath = join(folderPath, folderEntry.name);
        if (folderEntry.isDirectory()) pendingFolders.push(entryPath);
        else if (folderEntry.isFile() && folderEntry.name.endsWith(".jsonl") && (folderEntry.name === `${sessionId}.jsonl` || folderEntry.name.endsWith(`-${sessionId}.jsonl`))) return entryPath;
      }
    }
    return undefined;
  }

  async readLogs(repositoryFolder: URL, logFilePath?: string): Promise<readonly PromptfooLog[]> {
    const repositoryFolderPath = fileURLToPath(repositoryFolder).replace(/\/$/, "");
    let logFilePaths: string[];
    if (logFilePath !== undefined) logFilePaths = [resolve(repositoryFolderPath, logFilePath)];
    else {
      let folderEntries;
      try { folderEntries = await readdir(this.installFolderPath, { withFileTypes: true }); }
      catch (raised) {
        if ((raised as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw raised;
      }
      logFilePaths = folderEntries.filter((folderEntry) => folderEntry.isDirectory() && folderEntry.name.startsWith("run-")).map((folderEntry) => join(this.installFolderPath, folderEntry.name, "case.json"));
    }
    const savedLogs: PromptfooLog[] = [];
    for (const savedLogPath of logFilePaths) {
      let savedLogText;
      try { savedLogText = await readFile(savedLogPath, "utf8"); }
      catch (raised) {
        if (logFilePath === undefined && (raised as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw new AdapterFault(`Cannot read evaluation log ${savedLogPath}: ${raised}`, "Pass an existing case.json path printed by cw eval.");
      }
      const savedLogParse = PromptfooLogSchema.safeParse((() => { try { return JSON.parse(savedLogText); } catch { return undefined; } })());
      if (!savedLogParse.success) {
        if (logFilePath === undefined) continue;
        throw new AdapterFault(`Invalid evaluation log: ${savedLogPath}`, "Pass a case.json path written by cw eval.");
      }
      const savedLog = savedLogParse.data;
      if (logFilePath === undefined && savedLog.workingFolderPath !== repositoryFolderPath && !savedLog.workingFolderPath.startsWith(`${repositoryFolderPath}/.cw/eval/.worktrees/`)) continue;
      const { sessionId, sessionPath, error, ...requiredFields } = savedLog;
      savedLogs.push({ ...requiredFields,
        ...(sessionId === undefined ? {} : { sessionId }),
        ...(sessionPath === undefined ? {} : { sessionPath }),
        ...(error === undefined ? {} : { error }),
      });
    }
    return savedLogs.sort((leftLog, rightLog) => rightLog.createdAt.localeCompare(leftLog.createdAt)).slice(0, 20);
  }
}

/** Grade only explicit successful reads in provider tool evidence, never assistant text.
 * Kept self-contained because promptfoo executes its source as a JavaScript assertion. */
export function gradeFileRead(providerResponse: unknown, expectedFilePath: string, workingFolderPath: string): { pass: boolean; score: number; reason: string } {
  const response = providerResponse as { raw?: string | { items?: unknown[] }; metadata?: { toolCalls?: unknown[] } } | undefined;
  let rawResponse: { items?: unknown[] } = {};
  try {
    rawResponse = typeof response?.raw === "string" ? JSON.parse(response.raw) : response?.raw ?? {};
  } catch { /* Missing or malformed trace is not evidence. */ }
  const toolCalls = [...(Array.isArray(rawResponse?.items) ? rawResponse.items : []), ...(Array.isArray(response?.metadata?.toolCalls) ? response.metadata.toolCalls : [])];
  let hasReadEvidence = false;
  for (const toolCall of toolCalls) {
    if (!toolCall || typeof toolCall !== "object") continue;
    const toolRecord = toolCall as { type?: string; name?: string; input?: { file_path?: string }; output?: unknown; is_error?: boolean; command?: string; status?: string; exit_code?: number };
    let readFilePaths: string[] = [];
    if (toolRecord.name === "Read" && toolRecord.is_error === false && toolRecord.output !== undefined && typeof toolRecord.input?.file_path === "string") {
      readFilePaths = [toolRecord.input.file_path];
    } else if (toolRecord.type === "command_execution" && toolRecord.status === "completed" && toolRecord.exit_code === 0 && typeof toolRecord.command === "string") {
      let commandText = toolRecord.command.trim();
      // Codex records shell wrappers as well as bare commands. Unwrap only a literal argument.
      const shellMatch = commandText.match(/^(?:\/bin\/)?(?:ba|z|)sh -l?c '([^']*)'$/);
      if (shellMatch) commandText = shellMatch[1]!;
      // Fail closed for compound commands, substitutions, redirects, globs and comments.
      if (/[;&|<>`$*?\[\]{}\\\n\r#]/.test(commandText)) continue;
      const commandTokens = commandText.match(/"[^"\n]*"|'[^'\n]*'|[^\s"']+/g) ?? [];
      if (commandTokens.join(" ") !== commandText.replace(/\s+/g, " ")) continue;
      const commandArguments = commandTokens.map((token) => /^['"]/.test(token) ? token.slice(1, -1) : token);
      if (commandArguments[0] !== "cat" && commandArguments[0] !== "/bin/cat") continue;
      const fileArguments = commandArguments.slice(1);
      if (fileArguments[0] === "--") fileArguments.shift();
      if (!fileArguments.length || fileArguments.some((filePath) => filePath.startsWith("-") || filePath === "")) continue;
      readFilePaths = fileArguments;
    }
    for (const readFilePath of readFilePaths) {
      const pathParts = (readFilePath.startsWith("/") ? readFilePath : `${workingFolderPath}/${readFilePath}`).split("/");
      const normalizedParts: string[] = [];
      for (const pathPart of pathParts) {
        if (pathPart === "..") normalizedParts.pop();
        else if (pathPart && pathPart !== ".") normalizedParts.push(pathPart);
      }
      const normalizedPath = `/${normalizedParts.join("/")}`;
      if (normalizedPath === `${workingFolderPath.replace(/\/$/, "")}/${expectedFilePath}`) hasReadEvidence = true;
    }
  }
  return { pass: hasReadEvidence, score: hasReadEvidence ? 1 : 0, reason: hasReadEvidence ? `Read ${expectedFilePath} successfully.` : `No successful read evidence for ${expectedFilePath}. Supported evidence: Claude Read or a completed Codex cat command with exit code 0.` };
}
