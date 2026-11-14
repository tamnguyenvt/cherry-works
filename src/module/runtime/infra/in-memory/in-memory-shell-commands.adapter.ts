import type { ForRunningShellCommands, ShellCommandResult } from "../../app/port/out/running-shell-commands.port.js";

/** One command line run, as it was handed over. */
export interface ShellCommandRun {
  readonly command: string;
  readonly workingPath: string;
  readonly stdin: string;
}

/**
 * A shell held in memory: each command answers what a test says, a turn of
 * the event loop after it is started, and one it says nothing of is not
 * found. Every run is kept in the order started, every command in the order
 * finished, and how many were running at once at most.
 */
export class InMemoryShellCommands implements ForRunningShellCommands {
  readonly runs: ShellCommandRun[] = [];
  readonly finishedCommands: string[] = [];
  mostRunningAtOnce = 0;
  #runningCount = 0;

  constructor(private readonly resultByCommand: Readonly<Record<string, ShellCommandResult>> = {}) {}

  async runShellCommand(command: string, workingPath: string, stdin: string): Promise<ShellCommandResult> {
    this.runs.push({ command, workingPath, stdin });
    this.#runningCount += 1;
    this.mostRunningAtOnce = Math.max(this.mostRunningAtOnce, this.#runningCount);
    await new Promise((resolve) => setTimeout(resolve, 0));
    this.#runningCount -= 1;
    this.finishedCommands.push(command);
    return this.resultByCommand[command] ?? { exitCode: 127, stdout: "", stderr: `${command}: command not found\n` };
  }
}
