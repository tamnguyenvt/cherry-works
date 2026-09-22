import { spawn } from "node:child_process";
import { Fault } from "#hexagon/port/driver/ForManagingCharter.js";
import type { DataDTOs } from "#hexagon/port/driver/dtos/index.js";

/**
 * One repeatable `k=v` flag, read into the record it was typed as: every
 * `--<paramName> name=value` on the command line, under the names it gave them.
 *
 * The name is what precedes the first `=` and the value is everything after it,
 * so a value holding an `=` is typed as it reads. A flag with no `=`, or one
 * with nothing before it, names nothing to put a value under, and is refused
 * here quoting the flag as it was typed — nothing behind this is handed a
 * record it could not read.
 *
 * Every value typed under one name is kept, in the order it was typed: whether
 * that name holds a list or holds one value is the caller's to say, and a
 * caller that drops one here could not tell a second value from none.
 *
 * `paramName` is the flag these were typed under, so a refusal names the flag
 * the author typed rather than one this happens to be written for. Whether a
 * name is one the caller takes, and whether a value is one it holds, are both
 * the caller's to say, and it says them the same way whoever answered.
 */
export function parseKVParams(typed: readonly string[], paramName: string): Record<string, readonly string[]> {
  // Nothing inherited: a name every object already has — `__proto__` above all
  // — is a name like any other here, and reaches whoever asked for these to be
  // refused as one they do not take, rather than being swallowed by the object
  // it was being written into.
  const params: Record<string, string[]> = Object.create(null);
  for (const one of typed) {
    const at = one.indexOf("=");
    if (at <= 0)
      throw new Fault(
        `"--${paramName} ${one}" names nothing to put a value under.`,
        `Type each one as --${paramName} name=value, once per name.`,
      );
    (params[one.slice(0, at)] ??= []).push(one.slice(at + 1));
  }
  return params;
}

/**
 * Everything wrong with one workspace, written out for the terminal: each file,
 * and every fault under it (SC-003).
 *
 * Ordered by file so two runs over one charter read the same way. What it reads
 * is what a command was answered with, each file already named from the
 * repository: the path an author would type.
 */
export function toText({ data: { files } }: DataDTOs.FaultsByFile): string {
  return Object.keys(files)
    .sort()
    .map((file) => [file, ...(files[file] ?? []).flatMap(lines), ""].join("\n"))
    .join("");
}

/** One fault: what is wrong, and under it the next move. */
function lines({ data: { severity, message, fix } }: DataDTOs.Fault): readonly string[] {
  return [`  ${severity}: ${message}`, ...(fix ? [`         ${fix}`] : [])];
}

/**
 * The author's own editor on one file of the repository, waited for until it
 * exits (plan §13): what `cw edit` and `cw suite edit` open, since a terminal
 * has an editor and the command line does not rebuild it in prompts.
 *
 * The editor is `$VISUAL`, else `$EDITOR`, run the way git runs it — through
 * the shell, so a value such as `code --wait` carries its own arguments — with
 * the terminal handed over until it exits. Neither set is refused rather than
 * guessed at. What comes back is nothing, or what to report where the editor
 * exited with a failure.
 */
export async function editInEditor(cwd: string, file: string): Promise<string | undefined> {
  const editorCommand = process.env.VISUAL || process.env.EDITOR;
  if (!editorCommand)
    throw new Fault("Neither $VISUAL nor $EDITOR is set, so there is no editor to open it in.", 'Set one, as in "export EDITOR=vim".');

  // The file is handed over as "$1" rather than written into the command, so
  // a path with a space in it is one argument.
  const exitCode = await new Promise<number | null>((resolve, reject) =>
    spawn("sh", ["-c", `${editorCommand} "$1"`, editorCommand, `${cwd}/${file}`], { stdio: "inherit" })
      .once("error", reject)
      .once("exit", resolve),
  );
  return exitCode === 0 ? undefined : `${editorCommand} exited with ${exitCode} on ${file}.\n`;
}
