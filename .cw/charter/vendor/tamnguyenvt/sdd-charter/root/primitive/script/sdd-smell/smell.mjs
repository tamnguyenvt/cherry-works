#!/usr/bin/env node
// Keeps the code smell record: what /sdd-code-smell assessed, so that a run
// knows what it need not assess again. Changes no file but the record, and the
// temporary file it is written through.
//
//   node smell.mjs scan [--again]             print "<hash>  <path>" of each file to assess
//   node smell.mjs record <path> <hash> [-]        write a file's result, with -, its findings as JSON on stdin
//
// The spec folder is read from .sdd/settings.json ("specFolder"), from the
// repository's root; "specs" when there is none. Exit 0, or 2 on a request
// that cannot be met, the record left as it was.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const [command, ...args] = process.argv.slice(2);
let specFolder;
let recordFile;

// The real path of the nearest folder that exists, and what is not made yet below it.
function whereItLeads(path) {
  return existsSync(path) ? realpathSync(path) : join(whereItLeads(dirname(path)), basename(path));
}

function readSettings() {
  const settingsFile = join(".sdd", "settings.json");
  let settings = {};
  if (existsSync(settingsFile)) {
    try {
      settings = JSON.parse(readFileSync(settingsFile, "utf8"));
    } catch (error) {
      throw new Error(`${settingsFile} cannot be read: ${error.message}`);
    }
  }
  specFolder = settings?.specFolder ?? "specs";
  if (typeof specFolder !== "string") throw new Error(`${settingsFile} cannot be read: specFolder is not a path`);
  const isOutside = (path) => path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path);
  const outside = new Error(`${settingsFile} cannot be read: specFolder ${specFolder} is outside the repository`);
  // Judged by where it leads, a link included; kept relative, as git lists the record.
  const inside = relative(realpathSync(process.cwd()), whereItLeads(resolve(specFolder)));
  if (isOutside(inside)) throw outside;
  specFolder = inside || ".";
  recordFile = join(specFolder, "code-smell.json");
}

function refuse(reason) {
  console.error(reason);
  process.exitCode = 2;
}

// Identity follows the assessed content and location; repeated findings remain distinct.
function withIds(path, hash, findings) {
  const occurrences = new Map();
  return findings.map((finding) => {
    const location = JSON.stringify([finding.rule, finding.line]);
    const occurrence = occurrences.get(location) ?? 0;
    occurrences.set(location, occurrence + 1);
    const id = createHash("sha256").update(JSON.stringify([path, hash, finding.rule, finding.line, occurrence])).digest("hex");
    return { ...finding, id };
  });
}

function readRecord() {
  if (!existsSync(recordFile)) return { files: Object.create(null) };
  let record;
  try {
    record = JSON.parse(readFileSync(recordFile, "utf8"));
  } catch (error) {
    throw new Error(`${recordFile} cannot be read: ${error.message}`);
  }
  const isEntries = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
  if (!isEntries(record) || !isEntries(record.files)) throw new Error(`${recordFile} cannot be read: it is no code smell record`);
  // No prototype, for a file named `constructor` or `__proto__` is a file like any other.
  const files = Object.assign(Object.create(null), record.files);
  for (const [path, entry] of Object.entries(files)) entry.findings = withIds(path, entry.hash, entry.findings);
  return { files };
}

// Written whole and renamed, so that a run stopped here leaves the record whole.
function writeRecord(record) {
  // Reconcile saved decisions only when a caller explicitly writes a result.
  const present = new Set(repositoryFiles().files.filter((path) => lstatSync(path).isFile()));
  for (const path of Object.keys(record.files)) if (!present.has(path)) delete record.files[path];
  mkdirSync(specFolder, { recursive: true });
  const sorted = (entries) => Object.fromEntries(Object.entries(entries).sort(([a], [b]) => (a < b ? -1 : 1)));
  const text = `${JSON.stringify({ files: sorted(record.files) }, null, 2)}\n`;
  // Never through what stands at that path: the repository may hold a link there.
  rmSync(`${recordFile}.tmp`, { force: true });
  writeFileSync(`${recordFile}.tmp`, text, { flag: "wx" });
  renameSync(`${recordFile}.tmp`, recordFile);
}

// What stands at a path, or nothing where it is gone, a folder of its included.
function statOf(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return undefined;
    throw error;
  }
}

// What git tracks or would add, and the names no line of the scan can hold,
// each with why. A file deleted but still tracked is gone.
function repositoryFiles() {
  const listed = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { maxBuffer: 1 << 28 });
  const names = new Set();
  const unlisted = new Map();
  for (let start = 0, end; (end = listed.indexOf(0, start)) !== -1; start = end + 1) {
    const name = listed.subarray(start, end);
    const text = name.toString();
    const why = !Buffer.from(text).equals(name) ? "a name that is not UTF-8, cannot be read" : text.includes("\n") ? "a name that holds a line break, cannot be listed" : null;
    if (why === null) names.add(text);
    else if (statOf(Buffer.from(name))) unlisted.set(text, why);
  }
  return { files: [...names].filter((path) => statOf(path)).sort(), unlisted };
}

// Written as the scan writes it, so that the next scan finds its entry.
const isListed = (path) => repositoryFiles().files.includes(path);

const hashOf = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

function scan(flags) {
  if (flags.some((flag) => flag !== "--again")) return refuse("usage: node smell.mjs scan [--again]");
  const again = flags.includes("--again");
  const record = again ? { files: Object.create(null) } : readRecord();
  const recordPath = recordFile.split("\\").join("/");
  // A run killed mid-write leaves its temporary file, which is not the repository's.
  const listed = repositoryFiles();
  const files = listed.files.filter((path) => path !== `${recordPath}.tmp`);
  const assessable = files.filter((path) => path !== recordPath && lstatSync(path).isFile());
  const lines = [];
  for (const path of assessable) {
    const hash = hashOf(path);
    if (again || record.files[path]?.hash !== hash) lines.push(`${hash}  ${path}`);
  }
  if (lines.length > 0) process.stdout.write(`${lines.join("\n")}\n`);
}

function parseFindings(json) {
  let findings;
  try {
    findings = JSON.parse(json);
  } catch {
    return null;
  }
  const isFinding = (item) => typeof item?.rule === "string" && item.rule !== "" && Number.isInteger(item.line) && item.line > 0 && typeof item.says === "string" && item.says !== "";
  return Array.isArray(findings) && findings.every(isFinding) ? findings : null;
}

function recordResult([path, hash, source]) {
  if (!path || !/^[0-9a-f]{64}$/.test(hash ?? "") || ![undefined, "-"].includes(source)) return refuse("usage: node smell.mjs record <path> <hash> [-]");
  let findings = parseFindings(source === "-" ? readFileSync(0, "utf8") : "[]");
  if (findings === null) return refuse('findings must be a JSON list of { "rule", "line", "says" }');
  if (!isListed(path)) return refuse(`${path} is no file of the scan`);
  const record = readRecord();
  const previous = record.files[path];
  findings = withIds(path, hash, findings);
  for (const finding of findings) {
    // Review decisions belong to the assessed content, never to caller-supplied marks.
    delete finding.status;
    delete finding.reason;
    const kept = previous?.hash === hash && previous.findings.find((old) => old.id === finding.id);
    if (["skipped", "agreed"].includes(kept?.status)) finding.status = kept.status;
    if (["skipped", "agreed"].includes(kept?.status) && typeof kept.reason === "string") finding.reason = kept.reason;
  }
  record.files[path] = { hash, assessed: new Date().toISOString().slice(0, 10), good: findings.length === 0, findings };
  writeRecord(record);
}

function findings(flags) {
  if (flags.length) {
    if (![2, 3].includes(flags.length) || !["skip", "agree"].includes(flags[1])) return refuse("usage: node smell.mjs findings [<id> skip|agree [reason]]");
    const record = readRecord();
    const matches = Object.entries(record.files).flatMap(([path, entry]) => entry.findings.filter((finding) => finding.id === flags[0]).map((finding) => ({ path, entry, finding })));
    if (matches.length !== 1) return refuse(`${flags[0]}: no unique matching finding`);
    const { path, entry, finding } = matches[0];
    if (!isListed(path) || !lstatSync(path).isFile() || hashOf(path) !== entry.hash) return refuse(`${path} has no current assessment`);
    const status = flags[1] === "skip" ? "skipped" : "agreed";
    if (status === "agreed" && finding.status === "skipped") return refuse(`${flags[0]} is skipped`);
    if (finding.status !== status) delete finding.reason;
    finding.status = status;
    if (flags[2] !== undefined) finding.reason = flags[2];
    writeRecord(record);
    return;
  }
  const record = readRecord();
  const grouped = new Map();
  let waiting = 0, skipped = 0, agreed = 0;
  for (const [path, entry] of Object.entries(record.files)) {
    for (const finding of entry.findings) {
      if (finding.status === "skipped") { skipped++; continue; }
      if (finding.status === "agreed") { agreed++; continue; }
      waiting++;
      if (!grouped.has(finding.rule)) grouped.set(finding.rule, []);
      grouped.get(finding.rule).push(`[${finding.id}] ${path}:${finding.line}: ${finding.says}`);
    }
  }
  for (const rule of [...grouped.keys()].sort()) console.info(`${rule}\n${grouped.get(rule).map((line) => `  ${line}`).join("\n")}`);
  console.info(`${waiting} waiting, ${skipped} skipped, ${agreed} agreed`);
  if (!waiting) console.info("No finding left to agree.");
}

const commands = { scan, record: recordResult, findings };
if (!Object.hasOwn(commands, command ?? "")) refuse("usage: node smell.mjs scan|record|findings");
else {
  try {
    readSettings();
    commands[command](args);
  } catch (error) {
    refuse(error.message);
  }
}
