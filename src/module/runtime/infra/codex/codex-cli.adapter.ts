import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { AgentCli } from "../agent-cli.base.js";

/** Check the Codex CLI used by promptfoo without asking a model. */
export class CodexCli extends AgentCli {
  async isInstalled(): Promise<boolean> {
    try {
      await promisify(execFile)("codex", ["--version"]);
      return true;
    } catch {
      return false;
    }
  }
}
