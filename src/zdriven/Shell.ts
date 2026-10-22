import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { ForRunningShellCommands, ShellCommandResult } from "#hexagon/port/zdriven/ForRunningShellCommands.js";

/** DRIVEN ADAPTER: the system shell, as a host runs a hook's command. */
export class Shell implements ForRunningShellCommands {
  runShellCommand(command: string, workingFolder: URL, stdin: string): Promise<ShellCommandResult> {
    return new Promise((resolve) => {
      const childProcess = spawn(command, { shell: true, cwd: fileURLToPath(workingFolder), stdio: "pipe" });
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
