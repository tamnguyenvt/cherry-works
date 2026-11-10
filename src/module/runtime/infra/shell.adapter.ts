import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { ForRunningShellCommands, ShellCommandResult } from "../app/port/out/running-shell-commands.port.js";
import { FolderAddress, type FolderURL, urlAt } from "../../shared/module.js";

/** DRIVEN ADAPTER: the system shell, as a host runs a hook's command. */
export class Shell implements ForRunningShellCommands {
  readonly #repoFolder: FolderURL;

  constructor(
    /** The repository this works in, every path it is handed from its root:
     *  refused here unless it names a folder (SDK-FR-010). */
    repoFolder: URL,
  ) {
    this.#repoFolder = FolderAddress.urlOf(repoFolder);
  }

  runShellCommand(command: string, workingPath: string, stdin: string): Promise<ShellCommandResult> {
    return new Promise((resolve) => {
      const childProcess = spawn(command, { shell: true, cwd: fileURLToPath(workingPath === "" ? this.#repoFolder : urlAt(this.#repoFolder, `${workingPath}/`)), stdio: "pipe" });
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      childProcess.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
      childProcess.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
      // A shell that cannot start is a command that failed, said as one.
      childProcess.on("error", (raised) => resolve({ exitCode: 1, stdout: "", stderr: `${raised.message}\n` }));
      childProcess.on("close", (exitCode) =>
        resolve({ exitCode: exitCode ?? 1, stdout: Buffer.concat(stdoutChunks).toString(), stderr: Buffer.concat(stderrChunks).toString() }),
      );
      // A command that exits without reading its input closes it under us.
      childProcess.stdin.on("error", () => undefined);
      childProcess.stdin.end(stdin);
    });
  }
}
