import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ForCheckingAgentCli } from "#hexagon/port/zdriven/ForRunningAgentCli.js";

/** Check the Codex CLI used by promptfoo without asking a model. */
export class CodexCli implements ForCheckingAgentCli {
  async isInstalled(): Promise<boolean> {
    try {
      await promisify(execFile)("codex", ["--version"]);
      return true;
    } catch {
      return false;
    }
  }
}
