/**
 * DRIVEN PORT — the shell of this machine: one command line run in a folder,
 * handed text on its standard input, and what it exited with and wrote.
 *
 * A command that fails is answered as its exit code and what it wrote, never
 * raised: whether that is wrong is the caller's to say.
 */
export interface ForRunningShellCommands {
  /** Run `command` in `workingFolder` through the shell, `stdin` written to it,
   *  and answer once it has exited. */
  runShellCommand(command: string, workingFolder: URL, stdin: string): Promise<ShellCommandResult>;
}

/** What one command line came to. */
export interface ShellCommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}
