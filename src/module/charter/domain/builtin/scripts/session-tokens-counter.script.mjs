#!/usr/bin/env node
// The session's tokens so far, its subagents' included, kept as one line of
// <session id>/session-analysis.jsonl each time the agent stops
// (EVAL-FR-008, EVAL-FR-009): under ~/.cherry-works/<the repository's path,
// each character that is not a letter or a digit a dash>/, or the
// sessionAnalysisFolder of .cw/settings.json. The developer is shown one line, as a Stop hook's
// systemMessage the model is never sent, when the session crosses a mark
// (EVAL-FR-010). Whatever goes wrong, nothing is shown or kept and the agent
// stops as it would have (EVAL-FR-011).
import { appendFile, mkdir, readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";

const DEFAULT_SESSION_CONTEXT_MARK = 100000;
const USAGE_FIELDS = {
  input: "input_tokens",
  output: "output_tokens",
  cacheWrite: "cache_creation_input_tokens",
  cacheRead: "cache_read_input_tokens",
};

/** Each message of one transcript, once: a message written as several lines,
 *  one per block, is the last of them. A line that is not JSON, or an
 *  assistant message whose usage is not the shape counted, is a transcript
 *  that cannot be read. */
function assistantMessagesOf(transcriptText) {
  const messageById = new Map();
  for (const line of transcriptText.split("\n")) {
    if (line.trim() === "") continue;
    const transcriptLine = JSON.parse(line);
    if (transcriptLine.type !== "assistant") continue;
    const usage = transcriptLine.message && transcriptLine.message.usage;
    if (!usage || Object.values(USAGE_FIELDS).some((field) => typeof usage[field] !== "number"))
      throw new Error("an assistant message whose usage is not the shape counted");
    messageById.set(transcriptLine.message.id, transcriptLine.message);
  }
  return [...messageById.values()];
}

try {
  let stopEventText = "";
  for await (const chunk of process.stdin) stopEventText += chunk;
  const stopEvent = JSON.parse(stopEventText);
  const repositoryFolder = stopEvent.cwd || process.cwd();

  const transcriptPath = stopEvent.transcript_path;
  const mainMessages = assistantMessagesOf(await readFile(transcriptPath, "utf8"));
  if (mainMessages.length === 0) throw new Error("a session with nothing to count");
  const subagentsFolder = join(dirname(transcriptPath), basename(transcriptPath, ".jsonl"), "subagents");
  const subagentFiles = (await readdir(subagentsFolder).catch(() => [])).filter((subagentFile) => subagentFile.endsWith(".jsonl"));
  const subagentMessages = [];
  for (const subagentFile of subagentFiles) subagentMessages.push(...assistantMessagesOf(await readFile(join(subagentsFolder, subagentFile), "utf8")));

  const tokens = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
  for (const message of [...mainMessages, ...subagentMessages])
    for (const [kind, field] of Object.entries(USAGE_FIELDS)) tokens[kind] += message.usage[field];
  const totalTokens = tokens.input + tokens.output + tokens.cacheWrite + tokens.cacheRead;

  const repositorySettings = JSON.parse(await readFile(join(repositoryFolder, ".cw", "settings.json"), "utf8").catch(() => "{}"));
  const sessionContextMark = Number.isInteger(repositorySettings.sessionContextMark) && repositorySettings.sessionContextMark > 0 ? repositorySettings.sessionContextMark : DEFAULT_SESSION_CONTEXT_MARK;

  // A folder the repository set that is no absolute path or path under ~/
  // is refused by cw doctor, and left aside here: a relative one would land
  // in the repository. Each session keeps a folder of its own in it, named
  // by its id, which is letters, digits and dashes or nothing is kept.
  if (!/^[A-Za-z0-9_-]+$/.test(stopEvent.session_id)) throw new Error("a session id that names no folder");
  const sessionsFolder = /^(\/|~\/)/.test(repositorySettings.sessionAnalysisFolder)
    ? repositorySettings.sessionAnalysisFolder.replace(/^~(?=\/)/, homedir())
    : join(homedir(), ".cherry-works", repositoryFolder.replace(/[^A-Za-z0-9]/g, "-"));
  const sessionFolder = join(sessionsFolder, stopEvent.session_id);
  const logFile = join(sessionFolder, "session-analysis.jsonl");

  // The session's total at the last stop kept of it, to tell whether this
  // one crossed a mark.
  const keptLines = (await readFile(logFile, "utf8").catch(() => "")).split("\n").filter((line) => line !== "");
  let previousTotalTokens = 0;
  try {
    previousTotalTokens = JSON.parse(keptLines[keptLines.length - 1] || "{}").total || 0;
  } catch {}

  const sessionLine = {
    time: new Date().toISOString(),
    sessionId: stopEvent.session_id,
    repository: repositoryFolder,
    model: mainMessages[mainMessages.length - 1].model,
    tokens,
    total: totalTokens,
  };
  // One write per line, appended: two stops writing at once each keep their
  // own line.
  await mkdir(sessionFolder, { recursive: true });
  await appendFile(logFile, JSON.stringify(sessionLine) + "\n");

  if (Math.floor(previousTotalTokens / sessionContextMark) < Math.floor(totalTokens / sessionContextMark)) {
    const tokensText = (tokenCount) => tokenCount.toLocaleString("en-US");
    process.stdout.write(
      JSON.stringify({
        systemMessage:
          "This session has used " + tokensText(totalTokens) + " tokens, subagents included: " +
          tokensText(tokens.input) + " input, " + tokensText(tokens.output) + " output, " +
          tokensText(tokens.cacheWrite) + " written to the cache, " + tokensText(tokens.cacheRead) + " read from it.",
      }),
    );
  }
} catch {}
