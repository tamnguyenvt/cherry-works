// The record of `smell`, run against a repository made for each case.
//
//   node --test .cw/out/script/sdd-smell/smell.test.mjs
import { execFileSync, execSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";

const smellScript = join(dirname(fileURLToPath(import.meta.url)), "smell.mjs");
const finding = { rule: "no-magic-number", line: 3, says: "42 has no name" };
let repositoryFolder;

const hashOf = (text) => createHash("sha256").update(text).digest("hex");
const git = (...args) => execFileSync("git", args, { cwd: repositoryFolder, encoding: "utf8" });
function write(path, text) {
  mkdirSync(dirname(join(repositoryFolder, path)), { recursive: true });
  writeFileSync(join(repositoryFolder, path), text);
}

function repositoryOf(files) {
  repositoryFolder = mkdtempSync(join(tmpdir(), "sdd-smell-"));
  git("init", "-q", "-b", "main");
  write(".git/info/exclude", ".sdd/settings.json\n");
  write(".sdd/settings.json", '{ "specFolder": "docs" }\n');
  for (const [path, text] of Object.entries(files)) write(path, text);
}

function smell(...args) {
  return smellWith("", ...args);
}

function smellWith(input, ...args) {
  const run = spawnSync("node", [smellScript, ...args], { cwd: repositoryFolder, encoding: "utf8", input });
  return { status: run.status, output: run.stdout + run.stderr, stdout: run.stdout };
}

const recordFile = () => join(repositoryFolder, "docs", "code-smell.json");
const record = () => JSON.parse(readFileSync(recordFile(), "utf8"));
const toAssess = () => smell("scan").stdout.split("\n").filter(Boolean).map((line) => line.split("  ")[1]);

afterEach(() => rmSync(repositoryFolder, { recursive: true, force: true }));

test("the scan prints each file with its hash, and what git ignores is not in it", () => {
  repositoryOf({ "a.mjs": "one\n", "b/c.mjs": "two\n", ".gitignore": "built/\n", "built/x.mjs": "three\n" });
  const { status, stdout } = smell("scan");
  assert.equal(status, 0);
  assert.match(stdout, new RegExp(`^${hashOf("one\n")}  a\\.mjs$`, "m"));
  assert.match(stdout, new RegExp(`^${hashOf("two\n")}  b/c\\.mjs$`, "m"));
  assert.doesNotMatch(stdout, /built/);
});

test("only assessed files are persisted, with no leftOut or leave command", () => {
  repositoryOf({ "a.mjs": "one\n", "vendor.min.js": "two\n" });
  smell("record", "a.mjs", hashOf("one\n"));
  assert.deepEqual(Object.keys(record()), ["files"]);
  assert.deepEqual(Object.keys(record().files), ["a.mjs"]);
  assert.ok(toAssess().includes("vendor.min.js"));
  assert.equal(smell("leave", "vendor.min.js", "generated").status, 2);
});

test("the record itself is never assessed or added to leftOut", () => {
  repositoryOf({ "a.mjs": "one\n" });
  smell("record", "a.mjs", hashOf("one\n"));
  assert.deepEqual(toAssess(), []);
  assert.equal(record().leftOut, undefined);
});

test("a file assessed holds its hash, its date, whether it is good and each finding", () => {
  repositoryOf({ "good.mjs": "one\n", "bad.mjs": "two\n" });
  assert.equal(smell("record", "good.mjs", hashOf("one\n")).status, 0);
  assert.equal(smellWith(JSON.stringify([finding]), "record", "bad.mjs", hashOf("two\n"), "-").status, 0);
  const { files } = record();
  const today = new Date().toISOString().slice(0, 10);
  assert.deepEqual(files["good.mjs"], { hash: hashOf("one\n"), assessed: today, good: true, findings: [] });
  assert.deepEqual(files["bad.mjs"], { hash: hashOf("two\n"), assessed: today, good: false, findings: [{ ...finding, id: files["bad.mjs"].findings[0].id }] });
});

test("nothing outside the record is changed", () => {
  repositoryOf({ "a.mjs": "one\n" });
  smell("scan");
  smell("record", "a.mjs", hashOf("one\n"));
  assert.equal(readFileSync(join(repositoryFolder, "a.mjs"), "utf8"), "one\n");
  assert.equal(existsSync(`${recordFile()}.tmp`), false);
});

test("an unchanged file is not assessed again; a new or changed one is", () => {
  repositoryOf({ "a.mjs": "one\n", "b.mjs": "two\n" });
  smell("record", "a.mjs", hashOf("one\n"));
  smell("record", "b.mjs", hashOf("two\n"));
  assert.deepEqual(toAssess(), []);
  write("b.mjs", "changed\n");
  write("c.mjs", "new\n");
  assert.deepEqual(toAssess(), ["b.mjs", "c.mjs"]);
});

test("a file changed after the scan keeps the hash assessed, so it comes back", () => {
  repositoryOf({ "a.mjs": "one\n" });
  smell("record", "a.mjs", hashOf("one\n"));
  write("a.mjs", "changed\n");
  assert.ok(toAssess().includes("a.mjs"));
  assert.equal(record().files["a.mjs"].hash, hashOf("one\n"));
});

test("a rescan asked for brings unchanged files back, their entries kept until assessed", () => {
  repositoryOf({ "a.mjs": "one\n" });
  smell("record", "a.mjs", hashOf("one\n"));
  const { stdout } = smell("scan", "--again");
  assert.match(stdout, /a\.mjs/);
  assert.doesNotMatch(stdout, /settings/);
  assert.ok(record().files["a.mjs"]);
});

test("a deleted entry is assessed again", () => {
  repositoryOf({ "a.mjs": "one\n" });
  smell("record", "a.mjs", hashOf("one\n"));
  const edited = record();
  delete edited.files["a.mjs"];
  writeFileSync(recordFile(), JSON.stringify(edited));
  assert.deepEqual(toAssess(), ["a.mjs"]);
});

test("a run stopped halfway keeps what it assessed and gives only the others", () => {
  repositoryOf({ "a.mjs": "one\n", "b.mjs": "two\n", "c.mjs": "three\n" });
  smell("record", "a.mjs", hashOf("one\n"));
  assert.deepEqual(toAssess(), ["b.mjs", "c.mjs"]);
  assert.ok(record().files["a.mjs"]);
});

test("entries of gone files are dropped on the next explicit write", () => {
  repositoryOf({ "a.mjs": "one\n", "b.mjs": "two\n" });
  smell("record", "a.mjs", hashOf("one\n"));
  smell("record", "b.mjs", hashOf("two\n"));
  rmSync(join(repositoryFolder, "a.mjs"));
  rmSync(join(repositoryFolder, "b.mjs"));
  smell("scan");
  assert.ok(record().files["a.mjs"]);
  write("c.mjs", "three\n");
  smell("record", "c.mjs", hashOf("three\n"));
  assert.equal(record().files["a.mjs"], undefined);
  assert.equal(record().files["b.mjs"], undefined);
});

test("a file whose folder became a file is gone, and its entry dropped", () => {
  repositoryOf({ "a/b.mjs": "one\n" });
  git("add", "-A");
  smell("record", "a/b.mjs", hashOf("one\n"));
  rmSync(join(repositoryFolder, "a"), { recursive: true });
  write("a", "now a file\n");
  assert.equal(smell("scan").status, 0);
  assert.ok(record().files["a/b.mjs"]);
  smell("record", "a", hashOf("now a file\n"));
  assert.equal(record().files["a/b.mjs"], undefined);
});

test("legacy exclusions are ignored on reads and removed on explicit writes", () => {
  repositoryOf({ "a.mjs": "one\n" });
  write("docs/code-smell.json", JSON.stringify({ leftOut: { "a.mjs": { hash: hashOf("one\n"), why: "generated" } }, files: {} }));
  const before = readFileSync(recordFile(), "utf8");
  assert.ok(toAssess().includes("a.mjs"));
  assert.equal(readFileSync(recordFile(), "utf8"), before);
  smell("record", "a.mjs", hashOf("one\n"));
  assert.deepEqual(Object.keys(record()), ["files"]);
});

test("the file a run killed mid-write left behind is not assessed, and the record stays good", () => {
  repositoryOf({ "a.mjs": "one\n" });
  smell("record", "a.mjs", hashOf("one\n"));
  write("docs/code-smell.json.tmp", "{ half");
  const { status, stdout } = smell("scan");
  assert.equal(status, 0);
  assert.doesNotMatch(stdout, /\.tmp/);
  assert.ok(record().files["a.mjs"]);
});

test("a link planted where the record is written changes nothing it points to", () => {
  repositoryOf({ "a.mjs": "one\n" });
  mkdirSync(join(repositoryFolder, "docs"));
  symlinkSync("../a.mjs", `${recordFile()}.tmp`);
  assert.equal(smell("scan").status, 0);
  assert.equal(readFileSync(join(repositoryFolder, "a.mjs"), "utf8"), "one\n");
  assert.equal(existsSync(recordFile()), false);
  assert.equal(lstatSync(`${recordFile()}.tmp`).isSymbolicLink(), true);
});

test("a record that cannot be read stops the run and is left as it was", () => {
  repositoryOf({ "a.mjs": "one\n" });
  write("docs/code-smell.json", "{ broken");
  for (const args of [["scan"], ["record", "a.mjs", hashOf("one\n")]]) {
    const { status, output } = smell(...args);
    assert.equal(status, 2);
    assert.match(output, /code-smell\.json/);
  }
  assert.equal(readFileSync(recordFile(), "utf8"), "{ broken");
});

test("a finding holding a quote or a shell word is kept as it was written", () => {
  repositoryOf({ "a.mjs": "one\n" });
  const says = "doesn't name it; $(touch pwned) `id`";
  const input = JSON.stringify([{ ...finding, says }]);
  assert.equal(smellWith(input, "record", "a.mjs", hashOf("one\n"), "-").status, 0);
  assert.equal(record().files["a.mjs"].findings[0].says, says);
  assert.equal(existsSync(join(repositoryFolder, "pwned")), false);
});

test("a file not assessed returns on every scan", () => {
  repositoryOf({ "a.mjs": "one\n" });
  assert.deepEqual(toAssess(), ["a.mjs"]);
  assert.deepEqual(toAssess(), ["a.mjs"]);
  assert.equal(existsSync(recordFile()), false);
});

test("a link is excluded without creating a record", () => {
  repositoryOf({ "a.mjs": "one\n" });
  symlinkSync("missing.mjs", join(repositoryFolder, "link.mjs"));
  assert.ok(!toAssess().includes("link.mjs"));
  assert.equal(existsSync(recordFile()), false);
});

test("a name that is not UTF-8, gone from the working tree, is dropped like any file gone", () => {
  repositoryOf({ "a.mjs": "one\n" });
  execSync(`git update-index --add --cacheinfo 100644,$(git hash-object -w a.mjs),$(printf 'bad\\377.mjs')`, { cwd: repositoryFolder, shell: "/bin/sh" });
  assert.equal(smell("scan").status, 0);
  assert.equal(existsSync(recordFile()), false);
});

test("a name holding a line break leaves the scan without creating a record", () => {
  repositoryOf({ "a.mjs": "one\n", "two\nlines.mjs": "two\n" });
  assert.ok(!smell("scan").stdout.includes("two"));
  assert.equal(existsSync(recordFile()), false);
  rmSync(join(repositoryFolder, "two\nlines.mjs"));
  smell("scan");
  assert.equal(existsSync(recordFile()), false);
});

test("files named as what every object inherits are files like any other", () => {
  const names = ["constructor", "toString", "__proto__"];
  repositoryOf(Object.fromEntries(names.map((name) => [name, "one\n"])));
  for (const name of names) assert.ok(toAssess().includes(name), name);
  for (const name of names) assert.equal(smell("record", name, hashOf("one\n")).status, 0);
  assert.deepEqual(toAssess(), []);
  assert.equal(Object.keys(record().files).length, 3);
});

test("a file that cannot be read stops the scan with the record left as it was", () => {
  repositoryOf({ "a.mjs": "one\n", "gone.mjs": "two\n" });
  smell("record", "gone.mjs", hashOf("two\n"));
  const before = readFileSync(recordFile(), "utf8");
  rmSync(join(repositoryFolder, "gone.mjs"));
  chmodSync(join(repositoryFolder, "a.mjs"), 0o000);
  const { status } = smell("scan");
  chmodSync(join(repositoryFolder, "a.mjs"), 0o644);
  assert.equal(status, 2);
  assert.equal(readFileSync(recordFile(), "utf8"), before);
});

test("a spec folder outside the repository is refused", () => {
  repositoryOf({ "a.mjs": "one\n" });
  for (const folder of ["..", "../elsewhere", "/tmp"]) {
    write(".sdd/settings.json", JSON.stringify({ specFolder: folder }));
    const { status, output } = smell("scan");
    assert.equal(status, 2, folder);
    assert.match(output, /outside the repository/);
  }
});

test("a spec folder written as an absolute path inside the repository keeps the record out of the scan", () => {
  repositoryOf({ "a.mjs": "one\n" });
  write(".sdd/settings.json", JSON.stringify({ specFolder: join(repositoryFolder, "docs") }));
  smell("record", "a.mjs", hashOf("one\n"));
  assert.deepEqual(toAssess(), []);
  assert.equal(record().leftOut, undefined);
});

test("a spec folder that is a link to a folder outside is refused, and nothing is written there", () => {
  repositoryOf({ "a.mjs": "one\n" });
  const elsewhere = mkdtempSync(join(tmpdir(), "sdd-smell-elsewhere-"));
  symlinkSync(elsewhere, join(repositoryFolder, "docs"));
  const { status, output } = smell("scan");
  assert.equal(status, 2);
  assert.match(output, /outside the repository/);
  assert.deepEqual(readdirSync(elsewhere), []);
  rmSync(elsewhere, { recursive: true });
});

test("a broken settings file stops the run with exit 2", () => {
  repositoryOf({ "a.mjs": "one\n" });
  for (const text of ["{ broken", '{ "specFolder": 5 }']) {
    write(".sdd/settings.json", text);
    const { status, output } = smell("scan");
    assert.equal(status, 2, text);
    assert.match(output, /settings\.json cannot be read/);
  }
});

test("a record of the wrong shape stops the run and is left as it was", () => {
  repositoryOf({ "a.mjs": "one\n" });
  for (const text of ["[]", "5", "null", '{ "file": {} }', '{ "leftOut": {}, "files": [] }']) {
    write("docs/code-smell.json", text);
    assert.equal(smell("scan").status, 2, text);
    assert.equal(readFileSync(recordFile(), "utf8"), text);
  }
});

test("a result that is not one is refused, and nothing is written", () => {
  repositoryOf({ "a.mjs": "one\n" });
  for (const args of [
    ["record", "a.mjs", "nothash"],
    ["record", "a.mjs", hashOf("one\n"), JSON.stringify([finding])],
    ["leave", "a.mjs"],
    ["leave", "gone.mjs", "why"],
    ["record", "gone.mjs", hashOf("one\n")],
    ["record", "./a.mjs", hashOf("one\n")],
    ["leave", "./a.mjs", "why"],
    ["leave", "../outside.mjs", "why"],
    ["scan", "--resan"],
    ["unknown"],
  ]) assert.equal(smell(...args).status, 2, args.join(" "));
  for (const input of ["not json", JSON.stringify([{ rule: "r" }]), JSON.stringify([{ ...finding, line: 0 }])]) {
    assert.equal(smellWith(input, "record", "a.mjs", hashOf("one\n"), "-").status, 2, input);
  }
  assert.equal(existsSync(recordFile()), false);
});


test("review groups waiting findings by rule and file without changing the record", () => {
  repositoryOf({ "a.mjs": "one\n", "b.mjs": "two\n" });
  for (const path of ["a.mjs", "b.mjs"]) smellWith(JSON.stringify([finding]), "record", path, hashOf(path === "a.mjs" ? "one\n" : "two\n"), "-");
  const before = readFileSync(recordFile(), "utf8");
  const run = smell("findings");
  assert.equal(run.status, 0);
  assert.match(run.stdout, /no-magic-number/);
  assert.match(run.stdout, /a\.mjs:3/);
  assert.match(run.stdout, /b\.mjs:3/);
  assert.equal(readFileSync(recordFile(), "utf8"), before);
});

test("skip and agree persist on an unchanged rescan and reset for changed content", () => {
  repositoryOf({ "a.mjs": "one\n" });
  const findings = [finding, { ...finding, line: 5 }];
  const assess = (hash) => smellWith(JSON.stringify(findings), "record", "a.mjs", hash, "-");
  assess(hashOf("one\n"));
  assert.equal(smell("findings", record().files["a.mjs"].findings[0].id, "skip").status, 0);
  assert.equal(smell("findings", record().files["a.mjs"].findings[1].id, "agree").status, 0);
  assess(hashOf("one\n"));
  assert.deepEqual(record().files["a.mjs"].findings.map(item => item.status), ["skipped", "agreed"]);
  assert.match(smell("findings").stdout, /0 waiting, 1 skipped, 1 agreed/);
  write("a.mjs", "changed\n");
  assess(hashOf("changed\n"));
  assert.deepEqual(record().files["a.mjs"].findings.map(({ id, ...item }) => item), findings);
});

test("a rule can be marked across a file and unmatched or stale requests leave the record alone", () => {
  repositoryOf({ "a.mjs": "one\n" });
  smellWith(JSON.stringify([finding, { ...finding, line: 5 }]), "record", "a.mjs", hashOf("one\n"), "-");
  for (const item of record().files["a.mjs"].findings) assert.equal(smell("findings", item.id, "skip").status, 0);
  assert.ok(record().files["a.mjs"].findings.every(item => item.status === "skipped"));
  const before = readFileSync(recordFile(), "utf8");
  for (const args of [["skip", "a.mjs", "missing"], ["agree", "a.mjs", finding.rule, "0"], ["skip", "a.mjs", finding.rule, "3", "extra"]]) assert.equal(smell(...args).status, 2);
  write("a.mjs", "changed\n");
  assert.equal(smell("agree", "a.mjs", finding.rule).status, 2);
  assert.equal(readFileSync(recordFile(), "utf8"), before);
});

test("no waiting findings explicitly reports that nothing remains to agree", () => {
  repositoryOf({ "a.mjs": "one\n" });
  const run = smell("findings");
  assert.equal(run.status, 0);
  assert.match(run.stdout, /No finding left to agree/);
  assert.equal(existsSync(recordFile()), false);
});


test("scan is read-only before any assessment, including an explicit rescan", () => {
  repositoryOf({ "a.mjs": "one\n" });
  for (const args of [["scan"], ["scan", "--again"]]) {
    const run = smell(...args);
    assert.equal(run.status, 0);
    assert.match(run.stdout, /a\.mjs/);
    assert.equal(existsSync(recordFile()), false);
    assert.equal(existsSync(join(repositoryFolder, "docs")), false);
  }
});

test("scan preserves record bytes and modification time when files change or disappear", () => {
  repositoryOf({ "a.mjs": "one\n", "b.mjs": "two\n" });
  smell("record", "a.mjs", hashOf("one\n"));
  smell("record", "b.mjs", hashOf("two\n"));
  const before = readFileSync(recordFile(), "utf8");
  const modified = lstatSync(recordFile()).mtimeMs;
  write("a.mjs", "changed\n");
  rmSync(join(repositoryFolder, "b.mjs"));
  for (const args of [["scan"], ["scan", "--again"]]) {
    assert.equal(smell(...args).status, 0);
    assert.equal(readFileSync(recordFile(), "utf8"), before);
    assert.equal(lstatSync(recordFile()).mtimeMs, modified);
  }
});


test("scan --again ignores an unreadable old record and lists every assessable file", () => {
  repositoryOf({ "a.mjs": "one\n", "b.mjs": "two\n", ".gitignore": "ignored.mjs\n", "ignored.mjs": "ignored\n" });
  write("docs/code-smell.json", "{ broken");
  const before = readFileSync(recordFile(), "utf8");
  const run = smell("scan", "--again");
  assert.equal(run.status, 0);
  assert.match(run.stdout, /a\.mjs/);
  assert.match(run.stdout, /b\.mjs/);
  assert.doesNotMatch(run.stdout, /ignored\.mjs|code-smell\.json/);
  assert.equal(run.output, run.stdout);
  assert.equal(readFileSync(recordFile(), "utf8"), before);
  assert.equal(smell("scan").status, 2);
});

test("old scan command names are rejected", () => {
  repositoryOf({ "a.mjs": "one\n" });
  assert.equal(smell("snapshot").status, 2);
  assert.equal(smell("scan", "--rescan").status, 2);
  assert.equal(existsSync(recordFile()), false);
});


test("each finding gets a unique stable id and findings <id> skip changes only that finding", () => {
  repositoryOf({ "a.mjs": "one\n", "b.mjs": "two\n" });
  const input = JSON.stringify([finding, finding]);
  smellWith(input, "record", "a.mjs", hashOf("one\n"), "-");
  smellWith(JSON.stringify([finding]), "record", "b.mjs", hashOf("two\n"), "-");
  const ids = Object.values(record().files).flatMap(entry => entry.findings.map(item => item.id));
  assert.ok(ids.every(id => typeof id === "string" && id.length > 0));
  assert.equal(new Set(ids).size, 3);
  assert.ok(smell("findings").stdout.includes(ids[0]));
  assert.equal(smell("findings", ids[0], "skip").status, 0);
  assert.equal(record().files["a.mjs"].findings[0].status, "skipped");
  assert.equal(record().files["a.mjs"].findings[1].status, undefined);
  smellWith(input, "record", "a.mjs", hashOf("one\n"), "-");
  assert.deepEqual(record().files["a.mjs"].findings.map(item => item.id), ids.slice(0, 2));
  assert.equal(record().files["a.mjs"].findings[0].status, "skipped");
  const before = readFileSync(recordFile(), "utf8");
  assert.equal(smell("findings", "unknown", "skip").status, 2);
  assert.equal(smell("findings", ids[1], "delete").status, 2);
  assert.equal(smell("skip", "a.mjs", finding.rule).status, 2);
  write("a.mjs", "changed\n");
  assert.equal(smell("findings", ids[1], "skip").status, 2);
  assert.equal(readFileSync(recordFile(), "utf8"), before);
});


test("legacy findings get ids without a read-side write and caller ids cannot override them", () => {
  repositoryOf({ "a.mjs": "one\n" });
  const legacy = { files: { "a.mjs": { hash: hashOf("one\n"), assessed: "2026-11-03", good: false, findings: [finding] } } };
  write("docs/code-smell.json", JSON.stringify(legacy));
  const before = readFileSync(recordFile(), "utf8");
  const report = smell("findings");
  assert.equal(report.status, 0);
  const id = report.stdout.match(/\[([0-9a-f]{64})\]/)[1];
  assert.equal(readFileSync(recordFile(), "utf8"), before);
  for (const args of [["findings", id], ["findings", id, "skip", "reason", "extra"]]) assert.equal(smell(...args).status, 2);
  assert.equal(readFileSync(recordFile(), "utf8"), before);
  assert.equal(smell("findings", id, "skip").status, 0);
  assert.equal(record().files["a.mjs"].findings[0].id, id);
  smellWith(JSON.stringify([{ ...finding, id: "caller-id" }]), "record", "a.mjs", hashOf("one\n"), "-");
  assert.equal(record().files["a.mjs"].findings[0].id, id);
  assert.equal(record().files["a.mjs"].findings[0].status, "skipped");
});


test("agreement preserves findings skipped by id at the same rule and line", () => {
  repositoryOf({ "a.mjs": "one\n" });
  const input = JSON.stringify([finding, { ...finding, says: "another issue at this location" }]);
  smellWith(input, "record", "a.mjs", hashOf("one\n"), "-");
  const skippedId = record().files["a.mjs"].findings[0].id;
  assert.equal(smell("findings", skippedId, "skip").status, 0);
  assert.equal(smell("findings", skippedId, "agree", "accepted").status, 2);
  assert.equal(smell("findings", record().files["a.mjs"].findings[1].id, "agree").status, 0);
  assert.deepEqual(record().files["a.mjs"].findings.map(item => item.status), ["skipped", "agreed"]);
  assert.equal(smell("findings", record().files["a.mjs"].findings[1].id, "agree").status, 0);
  smellWith(input, "record", "a.mjs", hashOf("one\n"), "-");
  assert.deepEqual(record().files["a.mjs"].findings.map(item => item.status), ["skipped", "agreed"]);
});


test("optional skip reason is saved verbatim and survives unchanged assessments", () => {
  repositoryOf({ "a.mjs": "one\n" });
  const assess = hash => smellWith(JSON.stringify([{ ...finding, reason: "untrusted" }]), "record", "a.mjs", hash, "-");
  assess(hashOf("one\n"));
  let item = record().files["a.mjs"].findings[0];
  assert.equal(item.reason, undefined);
  const reason = "Accepted trade-off; doesn't need fixing $(touch pwned)";
  assert.equal(smell("findings", item.id, "skip", reason).status, 0);
  assert.equal(record().files["a.mjs"].findings[0].reason, reason);
  assert.equal(smell("findings", item.id, "skip").status, 0);
  assess(hashOf("one\n"));
  item = record().files["a.mjs"].findings[0];
  assert.equal(item.reason, reason);
  assert.equal(item.status, "skipped");
  write("a.mjs", "changed\n");
  assess(hashOf("changed\n"));
  item = record().files["a.mjs"].findings[0];
  assert.equal(item.reason, undefined);
  assert.equal(item.status, undefined);
  assert.equal(existsSync(join(repositoryFolder, "pwned")), false);
});


test("findings <id> agree accepts an optional reason for exactly one finding", () => {
  repositoryOf({ "a.mjs": "one\n" });
  const input = JSON.stringify([finding, finding]);
  smellWith(input, "record", "a.mjs", hashOf("one\n"), "-");
  const ids = record().files["a.mjs"].findings.map(item => item.id);
  const reason = "Accepted story; keep behavior $(touch pwned)";
  assert.equal(smell("findings", ids[1], "agree", reason).status, 0);
  assert.equal(record().files["a.mjs"].findings[0].status, undefined);
  assert.equal(record().files["a.mjs"].findings[1].reason, reason);
  assert.equal(smell("findings", ids[1], "agree").status, 0);
  smellWith(input, "record", "a.mjs", hashOf("one\n"), "-");
  assert.equal(record().files["a.mjs"].findings[1].reason, reason);
  assert.equal(record().files["a.mjs"].findings[1].status, "agreed");
  assert.equal(smell("agree", "a.mjs", finding.rule).status, 2);
  const before = readFileSync(recordFile(), "utf8");
  assert.equal(smell("findings", "unknown", "agree", reason).status, 2);
  write("a.mjs", "changed\n");
  assert.equal(smell("findings", ids[0], "agree", reason).status, 2);
  assert.equal(readFileSync(recordFile(), "utf8"), before);
  smellWith(input, "record", "a.mjs", hashOf("changed\n"), "-");
  assert.ok(record().files["a.mjs"].findings.every(item => item.reason === undefined && item.status === undefined));
  assert.equal(existsSync(join(repositoryFolder, "pwned")), false);
});
