import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import type { FaultDTOs } from "#module/shared/module.js";
import type { EngineApps } from "./command.interface.js";

/**
 * One repeatable `k=v` flag, read into the record it was typed as: every
 * `--<paramName> name=value` on the command line, under the names it gave them.
 *
 * The name is what precedes the first `=` and the value is everything after it,
 * so a value holding an `=` is typed as it reads. A flag with no `=`, or one
 * with nothing before it, names nothing to put a value under, and is refused
 * here quoting the flag as it was typed — nothing behind this is handed a
 * record it could not read. What comes back then is what to report, in place of
 * the record.
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
export function parseKVParams(
  typedParams: readonly string[],
  paramName: string,
): Record<string, readonly string[]> | string {
  // Nothing inherited: a name every object already has — `__proto__` above all
  // — is a name like any other here, and reaches whoever asked for these to be
  // refused as one they do not take, rather than being swallowed by the object
  // it was being written into.
  const valuesByParamKey: Record<string, string[]> = Object.create(null);
  for (const typedParam of typedParams) {
    const separatorIndex = typedParam.indexOf("=");
    if (separatorIndex <= 0)
      return `"--${paramName} ${typedParam}" names nothing to put a value under.\n  Type each one as --${paramName} name=value, once per name.\n`;
    const paramKey = typedParam.slice(0, separatorIndex);
    valuesByParamKey[paramKey] = [...(valuesByParamKey[paramKey] ?? []), typedParam.slice(separatorIndex + 1)];
  }
  return valuesByParamKey;
}

/**
 * Everything wrong with one workspace, written out for the terminal: each file,
 * and every fault under it (SC-003).
 *
 * Ordered by file so two runs over one charter read the same way. What it reads
 * is what a command was answered with, each file already named from the
 * repository: the path an author would type.
 */
export function printFaultsByFile({ data: { files: faultsByFilePath } }: FaultDTOs.FaultsByFile): string {
  return (
    Object.keys(faultsByFilePath)
      .sort()
      // One fault: what is wrong, and under it the next move.
      .map((filePath) =>
        [
          filePath,
          ...(faultsByFilePath[filePath] ?? []).flatMap(({ data: { severity, message, fix } }) => [
            `  ${severity}: ${message}`,
            ...(fix ? [`         ${fix}`] : []),
          ]),
          "",
        ].join("\n"),
      )
      .join("")
  );
}

/** One fault a use case answered with, written out for the terminal: what is
 *  wrong, and under it the next move. */
export function printFault({ data: { message, fix } }: FaultDTOs.Fault): string {
  return `${message}\n  ${fix}\n`;
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
 * exited with a failure or there is none.
 */
export async function editInEditor(cwd: string, filePath: string): Promise<string | undefined> {
  const editorCommand = process.env.VISUAL || process.env.EDITOR;
  if (!editorCommand)
    return 'Neither $VISUAL nor $EDITOR is set, so there is no editor to open it in.\n  Set one, as in "export EDITOR=vim".\n';

  // The file is handed over as "$1" rather than written into the command, so
  // a path with a space in it is one argument.
  const exitCode = await new Promise<number | null>((resolve, reject) =>
    spawn("sh", ["-c", `${editorCommand} "$1"`, editorCommand, `${cwd}/${filePath}`], { stdio: "inherit" })
      .once("error", reject)
      .once("exit", resolve),
  );
  return exitCode === 0 ? undefined : `${editorCommand} exited with ${exitCode} on ${filePath}.\n`;
}

/**
 * What a use case answered, every address under this folder said as the path
 * from it, as a developer reads it: `file:///work/repo/.cw/charter/…` is
 * `.cw/charter/…` run from `/work/repo`. The engine says where something is
 * kept as whatever keeps it says it, and only the command line knows where it
 * runs (CORE-FR-213). Said so where a value is an address, a key is one, or a
 * fault's words name one; what a primitive says in its body or headers is
 * left as it was written. An address anywhere else, in another scheme or under
 * another folder, is said as it is.
 */
export function showPathsFromFolder<Answer>(useCaseAnswer: Answer, folderPath: string): Answer {
  const folderHref = pathToFileURL(`${folderPath.replace(/\/$/, "")}/`).href;
  const addressPattern = new RegExp(`${folderHref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\s"'\`]*)`, "g");
  const decodePath = (escapedPath: string) => {
    try {
      return decodeURIComponent(escapedPath);
    } catch {
      return escapedPath;
    }
  };
  const showPathOf = (address: string) =>
    address.startsWith(folderHref) ? decodePath(address.slice(folderHref.length)) : address;
  /** Where something is kept is said under these keys alone, and as a key
   *  where answers are grouped by file. */
  const keptKeys = ["file", "folder", "folders"];
  const showPathsIn = (answerValue: unknown, valueKey: string | undefined): unknown => {
    if (typeof answerValue === "string") {
      if (valueKey === "message" || valueKey === "fix")
        return answerValue.replace(addressPattern, (_address, escapedPath: string) => decodePath(escapedPath));
      return valueKey !== undefined && keptKeys.includes(valueKey) ? showPathOf(answerValue) : answerValue;
    }
    if (Array.isArray(answerValue)) return answerValue.map((element) => showPathsIn(element, valueKey));
    // What a DTO holds is read as its fields, a value of the domain handed on
    // in one included; bytes, a date or a collection is said as it is.
    if (
      answerValue !== null &&
      typeof answerValue === "object" &&
      !ArrayBuffer.isView(answerValue) &&
      !(answerValue instanceof Date) &&
      !(answerValue instanceof Map) &&
      !(answerValue instanceof Set)
    )
      return Object.fromEntries(
        Object.entries(answerValue).map(([entryKey, entryValue]) => [
          showPathOf(entryKey),
          showPathsIn(entryValue, entryKey.startsWith(folderHref) ? undefined : entryKey),
        ]),
      );
    return answerValue;
  };
  return showPathsIn(useCaseAnswer, undefined) as Answer;
}

/** One use case, every answer of it with its addresses under this folder
 *  said as paths from it, as `showPathsFromFolder` says them. What an mcp
 *  origin's tool answered is forwarded as it answered (CORE-FR-214). */
export function wrapAppToShowPaths<App extends object>(useCaseApp: App, folderPath: string): App {
  return new Proxy(useCaseApp, {
    get: (target, memberName) => {
      const appMember: unknown = Reflect.get(target, memberName);
      if (typeof appMember !== "function") return appMember;
      return async (...operationArguments: unknown[]) => {
        const operationAnswer: unknown = await appMember.apply(target, operationArguments);
        const isToolAnswer =
          operationAnswer !== null &&
          typeof operationAnswer === "object" &&
          (operationAnswer as { type?: unknown }).type === "ToolAnswer";
        return isToolAnswer ? operationAnswer : showPathsFromFolder(operationAnswer, folderPath);
      };
    },
  });
}

/** The context a command runs with, every use case in it answering where
 *  something is kept as the path from the folder the command line runs in —
 *  the portal's and the mcp server's too, reached from here. */
export function showPathsInApps<Apps extends EngineApps>(engineApps: Apps, cwd: string): Apps {
  return {
    ...engineApps,
    charterAuthoringApp: wrapAppToShowPaths(engineApps.charterAuthoringApp, cwd),
    charterBuildingApp: wrapAppToShowPaths(engineApps.charterBuildingApp, cwd),
    charterRuntimeApp: wrapAppToShowPaths(engineApps.charterRuntimeApp, cwd),
  };
}
