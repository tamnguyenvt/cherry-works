import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { stripVTControlCharacters } from "node:util";
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
      return printProblem(
        `"--${paramName} ${typedParam}" names nothing to put a value under.`,
        `Type each one as --${paramName} name=value, once per name.`,
      );
    const paramKey = typedParam.slice(0, separatorIndex);
    valuesByParamKey[paramKey] = [...(valuesByParamKey[paramKey] ?? []), typedParam.slice(separatorIndex + 1)];
  }
  return valuesByParamKey;
}

/** What a status asks of the developer: nothing, a step to take, or a fault to
 *  fix (CORE-FR-238). */
export type Standing = "good" | "todo" | "fault";

/** Each status by its mark, told apart with no colour at all (CORE-FR-238). */
const MARK_BY_STANDING = { good: "✔", todo: "⚠", fault: "✘" } as const;

/** The terminal's colour of each status, and of what an answer sets apart:
 *  a heading, and an id or a path among the words around it. */
const SGR_CODE_BY_STANDING = { good: "32", todo: "33", fault: "31" } as const;
const HEADING_SGR_CODE = "1";
const MENTION_SGR_CODE = "36";

/** How wide an answer is laid out where no terminal says how wide: a file or
 *  another command reads the same lines on every run. */
const ANSWER_WIDTH = 80;

/** One label and its value, laid out in two aligned columns; a value of
 *  several lines is each of them, under its own column. */
export type AnswerRow = readonly [label: string, value: string | readonly string[]];

/** Text in one style, kept through any styled text inside it: a mark in a
 *  heading ends its own colour, and the heading goes on bold after it. */
const formatColouredText = (text: string, sgrCode: string) =>
  `\x1b[${sgrCode}m${text.replaceAll("\x1b[0m", `\x1b[0m\x1b[${sgrCode}m`)}\x1b[0m`;

/** One line of an answer that is a status: its mark, in its colour, then
 *  what it says. Where the answer goes with no colour, the command line takes
 *  the colour off and the mark is what is left. */
export function formatStatusLine(standing: Standing, lineText: string): string {
  return `${formatColouredText(MARK_BY_STANDING[standing], SGR_CODE_BY_STANDING[standing])} ${lineText}`;
}

/** A heading over one part of an answer (CORE-FR-237). */
export function formatHeading(headingText: string): string {
  return formatColouredText(headingText, HEADING_SGR_CODE);
}

/** An id or a path, set apart from the words around it (CORE-FR-237). */
export function formatMention(idOrPath: string): string {
  return formatColouredText(idOrPath, MENTION_SGR_CODE);
}

/**
 * Rows of an answer, each label and its value in one aligned column (CORE-FR-237):
 * the labels as wide as the widest of them, every value starting where the
 * others do, and one too long for the terminal wrapped beneath its own
 * column, at a space, so no id or path is broken. Off a terminal it is laid
 * out at a width of its own, the same on every run, and so where either
 * stream is not one. Rows read one to a line,
 * as what an agent surveys by, are not wrapped at all.
 */
export function layAnswerRows(answerRows: readonly AnswerRow[], indentText = "  ", isWrapped = true): string[] {
  const countVisibleCharacters = (text: string) => stripVTControlCharacters(text).length;
  const labelWidth = Math.max(0, ...answerRows.map(([label]) => countVisibleCharacters(label)));
  const valueIndentText = " ".repeat(indentText.length + labelWidth + 2);
  // An answer goes to either stream, so it is as wide as the terminal only
  // where both are one.
  const answerWidth =
    process.stdout.isTTY && process.stderr.isTTY && process.stdout.columns ? process.stdout.columns : ANSWER_WIDTH;
  const valueWidth = isWrapped ? Math.max(20, answerWidth - valueIndentText.length) : Number.POSITIVE_INFINITY;
  return answerRows.flatMap(([label, rowValue]) => {
    const valueLines = (typeof rowValue === "string" ? [rowValue] : rowValue)
      .flatMap((valueText) => valueText.split("\n"))
      .flatMap((valueLine) => {
        const wrappedLines: string[] = [];
        for (const valueWord of valueLine.split(" ")) {
          const lastLine = wrappedLines.at(-1);
          // A word wider than the column, such as a long path, stays on the
          // line it follows: a line of its own would be as wide.
          if (
            lastLine !== undefined &&
            (countVisibleCharacters(`${lastLine} ${valueWord}`) <= valueWidth ||
              countVisibleCharacters(valueWord) > valueWidth)
          )
            wrappedLines[wrappedLines.length - 1] = `${lastLine} ${valueWord}`;
          else wrappedLines.push(valueWord);
        }
        return wrappedLines;
      });
    const labelText = `${indentText}${label}${" ".repeat(labelWidth - countVisibleCharacters(label))}`;
    return valueLines.length === 0
      ? [labelText.trimEnd()]
      : valueLines.map((valueLine, lineIndex) =>
          lineIndex === 0 ? `${labelText}  ${valueLine}` : `${valueIndentText}${valueLine}`,
        );
  });
}

/**
 * Everything wrong with one workspace, written out for the terminal: each file,
 * and every fault and warning under it, marked (SC-003, CORE-FR-237).
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
          formatMention(filePath),
          // Every fault of one file in one column, the faults and warnings
          // together.
          ...layAnswerRows(
            (faultsByFilePath[filePath] ?? []).map(({ data: { severity, message, fix } }) => [
              formatStatusLine(severity === "error" ? "fault" : "todo", `${severity}:`),
              fix ? [message, fix] : message,
            ]),
          ),
          "",
        ].join("\n"),
      )
      .join("")
  );
}

/** One fault a use case answered with, written out for the terminal: what is
 *  wrong, marked, and under it the next move. */
export function printFault({ data: { message, fix } }: FaultDTOs.Fault): string {
  return printProblem(message, fix);
}

/** A fault a command found itself, written out as `printFault` writes one a
 *  use case answered with: what is wrong, marked, and the next move under it. */
export function printProblem(message: string, fix?: string, standing: Standing = "fault"): string {
  return `${formatStatusLine(standing, message)}\n${fix === undefined ? "" : `  ${fix}\n`}`;
}

/** One fault of a `cw run` command, written as it always was: with no mark
 *  and no colour (CORE-FR-240). */
export function printRunFault({ data: { message, fix } }: FaultDTOs.Fault): string {
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
    return printProblem(
      "Neither $VISUAL nor $EDITOR is set, so there is no editor to open it in.",
      'Set one, as in "export EDITOR=vim".',
    );

  // The file is handed over as "$1" rather than written into the command, so
  // a path with a space in it is one argument.
  const exitCode = await new Promise<number | null>((resolve, reject) =>
    spawn("sh", ["-c", `${editorCommand} "$1"`, editorCommand, `${cwd}/${filePath}`], { stdio: "inherit" })
      .once("error", reject)
      .once("exit", resolve),
  );
  return exitCode === 0 ? undefined : printProblem(`${editorCommand} exited with ${exitCode} on ${filePath}.`);
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

/** The words one command is typed by, without the arguments it takes: the name
 *  says where the command sits, and `<id>` is not a place. */
export function listCommandWords(name: string): readonly string[] {
  return name.split(" ").filter((word) => !word.startsWith("<") && !word.startsWith("["));
}
