#!/usr/bin/env node
// Says what a change would leave behind if it landed: a stray or temporary
// file, debug output, a leftover marker, a secret. Changes nothing.
//
//   node clean.mjs <target> [--accept <path>[:<line>]]...
//
// The change is what the working tree holds beyond where the current branch
// left <target> — committed on the branch, staged or not, and untracked files
// git does not ignore. Only the lines it adds are looked at. Exit 0 when
// nothing is found, 1 with a finding per line, 2 when <target> is no commit.
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { basename, extname } from "node:path";

const args = process.argv.slice(2);
const target = args.find((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--accept");
const accepted = new Set(args.flatMap((arg, index) => (args[index - 1] === "--accept" ? [arg] : [])));

const git = (...gitArgs) => execFileSync("git", ["-c", "core.quotePath=false", ...gitArgs], { encoding: "utf8", maxBuffer: 1 << 28 });

if (target === undefined) {
  console.error("usage: node clean.mjs <target> [--accept <path>[:<line>]]...");
  process.exit(2);
}
let base;
try {
  base = git("merge-base", target, "HEAD").trim();
} catch {
  console.error(`no commit ${target} shares history with HEAD: name the branch the change lands in`);
  process.exit(2);
}

// The words are spelt in pieces, so that this file does not hold them.
const MARKER = new RegExp(`\\b(?:${["TO" + "DO", "FIX" + "ME", "X" + "XX", "HA" + "CK"].join("|")})\\b|^(?:<{7}|>{7})(?: |$)`);
const DEBUG = [
  /\bconsole\.(?:log|debug|trace|dir)\s*\(/,
  /(?<![\w.])print\s*\(/,
  /(?<![\w.])(?:breakpoint|var_dump|print_r|dbg!)\s*\(/,
  /\bpdb\.set_trace\s*\(/,
  /^\s*(?:debugger|byebug|binding\.pry)\s*;?\s*$/,
];
// Debug output is looked for in code alone: prose quotes it.
const PROSE = new Set([".md", ".markdown", ".txt", ".rst", ".adoc", ".json", ".yaml", ".yml", ".toml", ".csv", ".lock"]);
const SECRETS = [
  [/-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/, "a private key"],
  [/\bAKIA[0-9A-Z]{16}\b/, "an AWS access key"],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, "a GitHub token"],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/, "a Slack token"],
  [/\bsk-ant-[A-Za-z0-9_-]{20,}/, "an Anthropic API key"],
  [/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/, "an OpenAI API key"],
  [/\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|token)\b["']?\s*[:=]\s*["'][^"'\s]{8,}["']/i, "a password or token assigned in the clear"],
];
const STRAY = [
  [/\.(?:tmp|temp|bak|orig|rej|swp|swo|log)$|~$/, "a temporary file"],
  [/^(?:\.DS_Store|Thumbs\.db)$/, "a file the system left"],
  [/^\.env(?:\..+)?$/, "an environment file"],
];
const KEPT_ENV = /^\.env\.(?:example|sample|template)$/;

const findings = [];
const find = (where, kind, text) => accepted.has(where) || findings.push({ where, kind, text });

function strayFile(path) {
  const name = basename(path);
  if (KEPT_ENV.test(name)) return;
  const [, reason] = STRAY.find(([pattern]) => pattern.test(name)) ?? [];
  if (reason) find(path, "stray", reason);
  else if (/(?:^|\/)(?:tmp|temp)\//.test(path)) find(path, "stray", "a file in a temporary folder");
}

// A line holding a secret is never printed: each of its findings names the
// secret's kind instead.
function addedLine(path, line, text) {
  const where = `${path}:${line}`;
  const [, secret] = SECRETS.find(([pattern]) => pattern.test(text)) ?? [];
  const shown = secret ?? text.trim();
  if (MARKER.test(text)) find(where, "marker", shown);
  if (!PROSE.has(extname(path).toLowerCase()) && DEBUG.some((pattern) => pattern.test(text))) find(where, "debug", shown);
  if (secret) find(where, "secret", secret);
}

// Tracked files: every line the working tree adds beyond the base.
for (const path of git("diff", "--name-only", "--diff-filter=AR", base).split("\n").filter(Boolean)) strayFile(path);
// A hunk's lines are counted, so an added line that reads "+++ " is not taken
// for the next file's header. The prefixes are pinned, whatever diff.noprefix
// says, and git ends a header whose path holds a space with a tab.
let path;
let line = 0;
let linesLeft = 0;
for (const text of git("diff", "--no-color", "--no-ext-diff", "--src-prefix=a/", "--dst-prefix=b/", "--unified=0", base).split("\n")) {
  if (linesLeft > 0) {
    if (text.startsWith("-") || text.startsWith("\\")) continue;
    if (text.startsWith("+") && path !== undefined) addedLine(path, line, text.slice(1));
    line++;
    linesLeft--;
  } else if (text.startsWith("+++ ")) path = text === "+++ /dev/null" ? undefined : text.slice(6).replace(/\t$/, "");
  else if (text.startsWith("@@ ")) {
    const [, start, count = "1"] = /\+(\d+)(?:,(\d+))?/.exec(text);
    line = Number(start);
    linesLeft = Number(count);
  }
}

// Untracked files: every line is added; a binary one is a file alone. A
// folder — a nested repository, a link to one — holds no lines of its own.
for (const untracked of git("ls-files", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean)) {
  strayFile(untracked);
  if (!lstatSync(untracked).isFile()) continue;
  const content = readFileSync(untracked);
  if (content.includes(0)) continue;
  content.toString("utf8").split("\n").forEach((text, index) => addedLine(untracked, index + 1, text));
}

const order = (where) => where.replace(/:(\d+)$/, (_, number) => `:${number.padStart(9, "0")}`);
findings.sort((a, b) => (order(a.where) < order(b.where) ? -1 : order(a.where) > order(b.where) ? 1 : 0));
// The report is flushed before exiting, a pipe on macOS being asynchronous.
// A reader that closes the pipe early ends the run, quietly.
process.exitCode = findings.length === 0 ? 0 : 1;
process.stdout.on("error", (error) => {
  if (error.code !== "EPIPE") throw error;
  process.exit();
});
await new Promise((resolve) =>
  process.stdout.write(
    findings.length === 0
      ? `clean: nothing left behind beyond ${target}\n`
      : findings.map(({ where, kind, text }) => `${where}: ${kind}: ${text}\n`).join(""),
    resolve,
  ),
);
process.exit();
