import type { ForRunningShellCommands, ShellCommandResult } from "#hexagon/port/zdriven/ForRunningShellCommands.js";

/** One command line run, as it was handed over. */
export interface ShellCommandRun {
  readonly command: string;
  readonly workingFolder: URL;
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
  readonly finished: string[] = [];
  mostRunningAtOnce = 0;
  #runningCount = 0;

  constructor(private readonly resultByCommand: Readonly<Record<string, ShellCommandResult>> = {}) {}

  async runShellCommand(command: string, workingFolder: URL, stdin: string): Promise<ShellCommandResult> {
    this.runs.push({ command, workingFolder, stdin });
    this.#runningCount += 1;
    this.mostRunningAtOnce = Math.max(this.mostRunningAtOnce, this.#runningCount);
    await new Promise((resolve) => setTimeout(resolve, 0));
    this.#runningCount -= 1;
    this.finished.push(command);
    return this.resultByCommand[command] ?? { exitCode: 127, stdout: "", stderr: `${command}: command not found\n` };
  }
}
