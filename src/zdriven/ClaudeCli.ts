import { execFile, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { DrivenFault, type ForRunningAgentCli, type PromptUsage } from "#hexagon/port/zdriven/ForRunningAgentCli.js";

/** How many runs of `claude` are under way at once. */
const RUNS_AT_ONCE = 4;

/**
 * DRIVEN ADAPTER: Claude Code's own command line, `claude -p`, run headless on
 * the developer's own sign-in: no key of this engine's (EVAL-FR-004).
 *
 * Each prompt is run in an empty folder of its own, with no tool, no MCP server
 * and no settings file, so the model is sent Claude Code's own instructions
 * and the prompt, and the same instructions on every run. Its usage is read off
 * the JSON it prints, of the first message sent: a model answering at length
 * can run on into a second, whose input the total adds again. At most
 * `RUNS_AT_ONCE` run together.
 */
export class ClaudeCli implements ForRunningAgentCli {
  #runsUnderWay = 0;
  readonly #waitingRuns: (() => void)[] = [];

  async isInstalled(): Promise<boolean> {
    try {
      await promisify(execFile)("claude", ["--version"]);
      return true;
    } catch {
      return false;
    }
  }

  async promptUsage(prompt: string): Promise<PromptUsage> {
    if (this.#runsUnderWay >= RUNS_AT_ONCE) await new Promise<void>((resolve) => this.#waitingRuns.push(resolve));
    this.#runsUnderWay++;
    let emptyFolder: string | undefined;
    try {
      emptyFolder = await mkdtemp(join(tmpdir(), "cw-claude-"));
      const printedJson = await new Promise<string>((resolve, reject) => {
        const claudeProcess = spawn(
          "claude",
          ["-p", "--output-format", "json", "--tools", "", "--strict-mcp-config", "--setting-sources", ""],
          { cwd: emptyFolder, stdio: ["pipe", "pipe", "pipe"] },
        );
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
      type InputUsage = { input_tokens: number; cache_creation_input_tokens: number; cache_read_input_tokens: number };
      const { is_error: isError, result: resultText, usage } = JSON.parse(printedJson) as {
        is_error?: boolean;
        result?: string;
        usage: InputUsage & { iterations?: readonly InputUsage[] };
      };
      // A run the model never answered, such as one not signed in, is said
      // rather than read as a count.
      if (isError === true) throw new DrivenFault(`"claude -p" answered with an error: ${resultText ?? ""}`.trim(), 'Check that "claude" runs and is signed in here.');
      const firstMessageUsage = usage.iterations?.[0] ?? usage;
      return {
        inputTokens: firstMessageUsage.input_tokens,
        cacheCreationInputTokens: firstMessageUsage.cache_creation_input_tokens,
        cacheReadInputTokens: firstMessageUsage.cache_read_input_tokens,
      };
    } finally {
      if (emptyFolder !== undefined) await rm(emptyFolder, { recursive: true, force: true });
      this.#runsUnderWay--;
      this.#waitingRuns.shift()?.();
    }
  }
}
