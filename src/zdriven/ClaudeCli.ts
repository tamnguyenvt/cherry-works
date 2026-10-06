import { execFile, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { DrivenFault, type Answer, type ForRunningAgentCli } from "#hexagon/port/zdriven/ForRunningAgentCli.js";

/** How many runs of `claude` are under way at once. */
const PARALLEL_RUNNER_COUNT = 4;

/**
 * DRIVEN ADAPTER: Claude Code's own command line, `claude -p`, run headless.
 *
 * Each prompt is run in an empty folder of its own, with nothing loaded, so
 * the model is sent Claude Code's own instructions and the prompt, and the
 * same instructions on every run. A count is read off the JSON it prints, of
 * the first message sent: a model answering at length can run on into a
 * second, whose input the total adds again. It runs on whatever `claude` is
 * signed in with: no key of this engine's (EVAL-FR-004). At most
 * `PARALLEL_RUNNER_COUNT` run together.
 */
export class ClaudeCli implements ForRunningAgentCli {
  #runningCount = 0;
  readonly #queue: (() => void)[] = [];

  async isInstalled(): Promise<boolean> {
    try {
      await promisify(execFile)("claude", ["--version"]);
      return true;
    } catch {
      return false;
    }
  }

  async ask(prompt: string): Promise<Answer> {
    type InputUsage = { input_tokens: number; cache_creation_input_tokens: number; cache_read_input_tokens: number };
    const { result: resultText, usage } = JSON.parse(await this.#runInSandbox(prompt)) as {
      result?: string;
      usage: InputUsage & { iterations?: readonly InputUsage[] };
    };
    const firstMessageUsage = usage.iterations?.[0] ?? usage;
    return {
      resultText: resultText ?? "",
      usage: {
        inputTokens: firstMessageUsage.input_tokens,
        cacheCreationInputTokens: firstMessageUsage.cache_creation_input_tokens,
        cacheReadInputTokens: firstMessageUsage.cache_read_input_tokens,
      },
    };
  }

  /** What `claude -p` printed as JSON for a prompt run in an empty folder with
   *  nothing loaded, the folder taken away afterwards; waiting its turn behind
   *  `PARALLEL_RUNNER_COUNT` others. A run that stopped with an error, or the
   *  model never answered, such as one not signed in, is raised rather than
   *  read. */
  async #runInSandbox(prompt: string): Promise<string> {
    if (this.#runningCount >= PARALLEL_RUNNER_COUNT) await new Promise<void>((resolve) => this.#queue.push(resolve));
    this.#runningCount++;
    let emptyFolder: string | undefined;
    try {
      emptyFolder = await mkdtemp(join(tmpdir(), "cw-claude-"));
      const printedJson = await new Promise<string>((resolve, reject) => {
        // Nothing of its own loaded: no tool, no MCP server and no settings file.
        const claudeProcess = spawn("claude", ["-p", "--output-format", "json", "--tools", "", "--strict-mcp-config", "--setting-sources", ""], {
          cwd: emptyFolder,
          stdio: ["pipe", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        claudeProcess.stdout.on("data", (chunk) => (stdout += chunk));
        claudeProcess.stderr.on("data", (chunk) => (stderr += chunk));
        claudeProcess.on("error", reject);
        claudeProcess.on("close", (code) =>
          code === 0
            ? resolve(stdout)
            : reject(new DrivenFault(`"claude -p" stopped with status ${code}: ${stderr.trim()}`, 'Check that "claude" runs and is signed in here.')),
        );
        claudeProcess.stdin.end(prompt);
      });
      const { is_error: isError, result: resultText } = JSON.parse(printedJson) as { is_error?: boolean; result?: string };
      if (isError === true) throw new DrivenFault(`"claude -p" answered with an error: ${resultText ?? ""}`.trim(), 'Check that "claude" runs and is signed in here.');
      return printedJson;
    } finally {
      if (emptyFolder !== undefined) await rm(emptyFolder, { recursive: true, force: true });
      this.#runningCount--;
      this.#queue.shift()?.();
    }
  }
}
