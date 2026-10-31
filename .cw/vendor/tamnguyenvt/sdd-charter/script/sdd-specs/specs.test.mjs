// The handoff note and evidence rules of `check`, and `doctor`, run against
// spec folders and repositories made for each case.
//
//   node --test .cw/out/script/sdd-specs/specs.test.mjs
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";

const specsScript = join(dirname(fileURLToPath(import.meta.url)), "specs.mjs");
let repositoryFolder;

// A spec set of two stories, with the statuses given, the notes given, the
// evidence given on each story's roadmap entry, and a manifest saying how
// handoff notes are kept where one is given.
function specSetOf({ statuses, notes = [], handoffNotes, evidence = [] }) {
  repositoryFolder = mkdtempSync(join(tmpdir(), "sdd-specs-"));
  mkdirSync(join(repositoryFolder, ".sdd"));
  mkdirSync(join(repositoryFolder, "specs", "handoff"), { recursive: true });
  writeFileSync(join(repositoryFolder, ".sdd", "settings.json"), '{ "specFolder": "specs" }');
  writeFileSync(
    join(repositoryFolder, "specs", "spec-core.md"),
    statuses.map((status, index) => `### CORE Story ${index + 1} - Story ${index + 1} (Priority: P1)\n\n**Status**: ${status}\n\nText.\n`).join("\n"),
  );
  writeFileSync(
    join(repositoryFolder, "specs", "plan.json"),
    JSON.stringify({
      stories: statuses.map((_, index) => ({ id: `CORE Story ${index + 1}`, title: `Story ${index + 1}`, dependsOn: [], ...(evidence[index] && { evidence: evidence[index] }) })),
    }),
  );
  for (const [name, text] of notes) writeFileSync(join(repositoryFolder, "specs", "handoff", name), text);
  if (handoffNotes) writeFileSync(join(repositoryFolder, "specs", "manifest.md"), `# Manifest\n\n## Committing\n\n- **Handoff notes**: ${handoffNotes}\n`);
}

function check(...flags) {
  const run = spawnSync("node", [specsScript, "check", ...flags], { cwd: repositoryFolder, encoding: "utf8" });
  return { status: run.status, output: run.stdout + run.stderr };
}

afterEach(() => rmSync(repositoryFolder, { recursive: true, force: true }));

test("a story In Progress with no note fails, naming the note", () => {
  specSetOf({ statuses: ["In Progress", "Todo"] });
  const { status, output } = check();
  assert.equal(status, 1);
  assert.match(output, /specs\/handoff\/core-1\.md: missing/);
});

test("a story In Progress with its note passes", () => {
  specSetOf({ statuses: ["In Progress", "Todo"], notes: [["core-1.md", "## Done\n"]] });
  assert.equal(check().status, 0);
});

test("a Done story keeps its note: check passes", () => {
  specSetOf({ statuses: ["Done", "Todo"], notes: [["core-1.md", "## Done\n"]] });
  const { status, output } = check();
  assert.equal(status, 0, output);
});

test("a Done story keeps its note: check --landing passes on it", () => {
  specSetOf({ statuses: ["Done", "Todo"], notes: [["core-1.md", "## Done\n"]], evidence: [{ summary: "node --test: 1 pass", date: "2026-10-29" }] });
  const { status, output } = check("--landing", "CORE Story 1");
  assert.equal(status, 0, output);
});

test("a note for a Todo story fails", () => {
  specSetOf({ statuses: ["Todo", "Todo"], notes: [["core-2.md", "## Done\n"]] });
  const { status, output } = check();
  assert.equal(status, 1);
  assert.match(output, /core-2\.md: a handoff note for CORE Story 2, which is Todo/);
});

test("a note for no story fails", () => {
  specSetOf({ statuses: ["Todo", "Todo"], notes: [["core-9.md", "## Done\n"]] });
  const { status, output } = check();
  assert.equal(status, 1);
  assert.match(output, /specs\/handoff\/core-9\.md: a handoff note for no story/);
});

test("a bug fix's note, fix-<slug>.md, is not taken for a story's", () => {
  specSetOf({ statuses: ["Todo", "Done"], notes: [["fix-ready-lists-done.md", "## Done\n"]] });
  const { status, output } = check();
  assert.equal(status, 0, output);
});

test("a FIX spec's story In Progress keeps its own note, fix-1.md", () => {
  specSetOf({ statuses: ["Todo"], notes: [] });
  writeFileSync(join(repositoryFolder, "specs", "spec-fix.md"), "### FIX Story 1 - Story 1 (Priority: P1)\n\n**Status**: In Progress\n\nText.\n");
  writeFileSync(join(repositoryFolder, "specs", "spec-core.md"), "");
  writeFileSync(join(repositoryFolder, "specs", "plan.json"), JSON.stringify({ stories: [{ id: "FIX Story 1", title: "Story 1", dependsOn: [] }] }));
  writeFileSync(join(repositoryFolder, "specs", "handoff", "fix-1.md"), "## Done\n");
  const { status, output } = check();
  assert.equal(status, 0, output);
});

test("a note is not read as a spec: what it cites is not checked", () => {
  specSetOf({ statuses: ["In Progress", "Todo"], notes: [["core-1.md", "Waits on CORE Story 7.\n"]] });
  assert.equal(check().status, 0);
});

test("where notes are ignored, a story In Progress with no note passes", () => {
  specSetOf({ statuses: ["In Progress", "Todo"], handoffNotes: "ignored — `handoff/` is in the spec folder's `.gitignore`" });
  assert.equal(check().status, 0);
});

test("where notes are ignored, a Done story's note still passes", () => {
  specSetOf({ statuses: ["Done", "Todo"], notes: [["core-1.md", "## Done\n"]], handoffNotes: "ignored" });
  assert.equal(check().status, 0);
});

test("where notes are committed, a story In Progress with no note fails", () => {
  specSetOf({ statuses: ["In Progress", "Todo"], handoffNotes: "committed — a story's handoff note is committed with its work" });
  assert.equal(check().status, 1);
});

const proof = { summary: "node --test: 30 pass, 0 fail; check of sdd-specs passed", date: "2026-10-27" };

test("evidence on a Done story's roadmap entry passes", () => {
  specSetOf({ statuses: ["Done", "Todo"], evidence: [proof] });
  assert.equal(check().status, 0);
});

test("a Done story with no evidence passes", () => {
  specSetOf({ statuses: ["Done", "Todo"] });
  assert.equal(check().status, 0);
});

test("evidence for a story In Progress fails", () => {
  specSetOf({ statuses: ["In Progress", "Todo"], notes: [["core-1.md", "## Done\n"]], evidence: [proof] });
  const { status, output } = check();
  assert.equal(status, 1);
  assert.match(output, /specs\/plan\.json: "CORE Story 1" has evidence, but is In Progress; remove it/);
});

test("evidence for a Todo story fails", () => {
  specSetOf({ statuses: ["Todo", "Todo"], evidence: [, proof] });
  const { status, output } = check();
  assert.equal(status, 1);
  assert.match(output, /"CORE Story 2" has evidence, but is Todo; remove it/);
});

test("evidence with no date fails", () => {
  specSetOf({ statuses: ["Done", "Todo"], evidence: [{ summary: proof.summary }] });
  const { status, output } = check();
  assert.equal(status, 1);
  assert.match(output, /"CORE Story 1" has evidence that is not \{ "summary": "<one line>", "date": "yyyy-mm-dd" \}/);
});

test("evidence of more than one line fails", () => {
  specSetOf({ statuses: ["Done", "Todo"], evidence: [{ ...proof, summary: "tests pass\rand more" }] });
  const { status, output } = check();
  assert.equal(status, 1);
  assert.match(output, /"CORE Story 1" has evidence that is not/);
});

test("evidence with an empty summary fails", () => {
  specSetOf({ statuses: ["Done", "Todo"], evidence: [{ summary: "", date: proof.date }] });
  assert.match(check().output, /"CORE Story 1" has evidence that is not/);
});

test("evidence with a date that is no day fails", () => {
  specSetOf({ statuses: ["Done", "Todo"], evidence: [{ ...proof, date: "2026-13-45" }] });
  assert.match(check().output, /"CORE Story 1" has evidence that is not/);
});

test("a story landing Done with no evidence fails, though plain check passes", () => {
  specSetOf({ statuses: ["Done", "Todo"] });
  assert.equal(check().status, 0);
  const { status, output } = check("--landing", "CORE Story 1");
  assert.equal(status, 1);
  assert.match(output, /specs\/plan\.json: "CORE Story 1" lands with no evidence; write what proved it and the date/);
});

test("a story landing Done with its evidence passes", () => {
  specSetOf({ statuses: ["Done", "Todo"], evidence: [proof] });
  assert.equal(check("--landing", "CORE Story 1").status, 0);
});

test("landing a story that is not in plan.json fails", () => {
  specSetOf({ statuses: ["Done", "Todo"], evidence: [proof] });
  assert.match(check("--landing", "CORE Story 7").output, /"CORE Story 7" lands, but is no story in plan\.json/);
});

// `doctor`: a repository set up in full, every answer the sdd-manifest template
// asks for given, short of what is left out.
const manifestTemplate = join(dirname(specsScript), "..", "..", "template", "sdd-manifest", "index.md");
const manifestFields = [...readFileSync(manifestTemplate, "utf8").matchAll(/^- \*\*([^*]+)\*\*:/gm)].map((match) => match[1]);

function setUpRepository({ settings = true, leaveOut = [], answers = {} } = {}) {
  repositoryFolder = mkdtempSync(join(tmpdir(), "sdd-doctor-"));
  if (!settings) return;
  mkdirSync(join(repositoryFolder, ".sdd"));
  mkdirSync(join(repositoryFolder, "specs"));
  writeFileSync(join(repositoryFolder, ".sdd", "settings.json"), '{ "specFolder": "specs" }');
  const lines = manifestFields.filter((field) => !leaveOut.includes(field)).map((field) => `- **${field}**: ${answers[field] ?? "answered"}`);
  writeFileSync(join(repositoryFolder, "specs", "manifest.md"), `# Manifest\n\n${lines.join("\n")}\n`);
}

function doctor() {
  const run = spawnSync(process.execPath, [specsScript, "doctor"], { cwd: repositoryFolder, encoding: "utf8" });
  return { status: run.status, output: run.stdout + run.stderr, stderr: run.stderr };
}

test("doctor passes each item of a repository set up in full, with its reason, and checks nothing else", () => {
  setUpRepository();
  const { status, output } = doctor();
  assert.equal(status, 0, output);
  for (const item of ["settings", "spec folder", "manifest"]) assert.match(output, new RegExp(`^pass  ${item} +\\S`, "m"));
  assert.equal(output.trim().split("\n").length, 3);
});

test("doctor fails a manifest missing an answer, and offers the one question that writes it", () => {
  setUpRepository({ leaveOut: ["Handoff notes"] });
  const { status, output } = doctor();
  assert.equal(status, 1);
  assert.match(output, /^fail  manifest +specs\/manifest\.md has no \*\*Handoff notes\*\* — fix: ask \/sdd-init's question on \*\*Handoff notes\*\* and write the answer$/m);
  assert.equal(output.match(/^fail/gm).length, 1);
});

test("doctor offers the /sdd-init question that writes a field named otherwise", () => {
  const questions = { Message: "Commit message", "Co-Authored-By": "Commit message", Story: "Finishing", Phase: "Finishing", "Pull request": "Finishing" };
  setUpRepository({ leaveOut: [...Object.keys(questions), "Folder"] });
  const { output } = doctor();
  for (const [field, question] of Object.entries(questions))
    assert.match(output, new RegExp(`has no \\*\\*${field}\\*\\* — fix: ask /sdd-init's question on \\*\\*${question}\\*\\* and write the answer$`, "m"));
  assert.match(output, /has no \*\*Folder\*\* — fix: ask \/sdd-init's question on the spec folder$/m);
});

test("every question doctor offers is one /sdd-init asks", () => {
  const initSkill = join(dirname(specsScript), "..", "..", "skill", "sdd-init", "index.md");
  const questionList = readFileSync(initSkill, "utf8").split(/^## 3\. /m)[1].split(/^## /m)[0];
  const asked = [...questionList.matchAll(/^\d+\. \*\*(.+?)\*\*/gm)].map((match) => match[1].toLowerCase());
  setUpRepository({ leaveOut: manifestFields });
  const offered = [...doctor().output.matchAll(/question on (?:\*\*(.+?)\*\*|the (spec folder))/g)].map((match) => (match[1] ?? match[2]).toLowerCase());
  assert.equal(offered.length, manifestFields.length);
  for (const question of offered) assert.ok(asked.includes(question), `/sdd-init asks no question on ${question}`);
});

test("doctor fails an answer left as the template's text", () => {
  const templateOrder = /^- \*\*Order\*\*:(.*)$/m.exec(readFileSync(manifestTemplate, "utf8"))[1].trim();
  setUpRepository({ answers: { Order: templateOrder } });
  assert.match(doctor().output, /^fail  manifest +specs\/manifest\.md leaves \*\*Order\*\* unanswered — fix: ask \/sdd-init's question on \*\*Order\*\*/m);
});

test("doctor fails an answer keeping a placeholder of the template mid-line", () => {
  setUpRepository({ answers: { "Quality cross-check": "every [5, unless the user names another number] stories" } });
  assert.match(doctor().output, /^fail  manifest +specs\/manifest\.md leaves \*\*Quality cross-check\*\* unanswered/m);
});

test("doctor fails an answer keeping a placeholder nested in the template's choice", () => {
  setUpRepository({ answers: { Worktree: "per story — each story in a git worktree of its own, under `[path]`" } });
  assert.match(doctor().output, /^fail  manifest +specs\/manifest\.md leaves \*\*Worktree\*\* unanswered/m);
});

test("doctor fails an answer that is an empty code span", () => {
  setUpRepository({ answers: { Message: "``" } });
  assert.match(doctor().output, /^fail  manifest +specs\/manifest\.md leaves \*\*Message\*\* unanswered/m);
});

test("doctor passes an answer holding a bracket the template does not", () => {
  setUpRepository({ answers: { "Pull request": "title `[CORE Story 4] <title>`" } });
  assert.equal(doctor().status, 0);
});

test("doctor passes an answer that opens and closes on a bracket of its own", () => {
  setUpRepository({ answers: { "Pull request": "[CORE Story 4] <title> [draft]" } });
  assert.equal(doctor().status, 0);
});

test("doctor says a repository with no settings is not set up, and offers /sdd-init", () => {
  setUpRepository({ settings: false });
  const { status, output } = doctor();
  assert.equal(status, 1);
  assert.match(output, /^fail  settings +no \.sdd\/settings\.json: this repository is not set up for spec-driven development — fix: \/sdd-init$/m);
});

for (const [name, settingsText] of [["that are no JSON", "{"], ["naming a spec folder by no string", '{ "specFolder": 5 }']])
  test(`doctor reports settings ${name}, offering the spec folder question, and does not crash`, () => {
    setUpRepository();
    writeFileSync(join(repositoryFolder, ".sdd", "settings.json"), settingsText);
    const { status, output, stderr } = doctor();
    assert.equal(status, 1);
    assert.match(output, /^fail  settings +\.sdd\/settings\.json names no "specFolder" — fix: ask \/sdd-init's question on the spec folder$/m);
    assert.equal(stderr, "");
  });

test("doctor fails a manifest with no Review answer, offering /sdd-init's question on it", () => {
  setUpRepository({ leaveOut: ["Review"] });
  const { status, output } = doctor();
  assert.equal(status, 1);
  assert.match(output, /^fail  manifest +specs\/manifest\.md has no \*\*Review\*\* — fix: ask \/sdd-init's question on \*\*Review\*\* and write the answer$/m);
});

test("doctor says the folder it checks is assumed when the settings name none", () => {
  setUpRepository();
  writeFileSync(join(repositoryFolder, ".sdd", "settings.json"), "{}");
  const { output } = doctor();
  assert.match(output, /^pass  spec folder specs \(assumed\) exists$/m);
  assert.match(output, /^pass  manifest +specs\/manifest\.md \(assumed\) answers all/m);
});

test("doctor fails a missing spec folder, offering /sdd-init", () => {
  setUpRepository();
  rmSync(join(repositoryFolder, "specs"), { recursive: true });
  assert.match(doctor().output, /^fail  spec folder +no folder at specs — fix: \/sdd-init$/m);
});

test("doctor fails a file standing where the spec folder should be", () => {
  setUpRepository();
  rmSync(join(repositoryFolder, "specs"), { recursive: true });
  writeFileSync(join(repositoryFolder, "specs"), "");
  assert.match(doctor().output, /^fail  spec folder +no folder at specs — fix: \/sdd-init$/m);
});

test("doctor gives the same report twice and changes nothing", () => {
  setUpRepository({ leaveOut: ["Order"] });
  const before = snapshotOf(repositoryFolder);
  const first = doctor();
  assert.deepEqual(doctor(), first);
  assert.deepEqual(snapshotOf(repositoryFolder), before);
});

function snapshotOf(folder) {
  return readdirSync(folder, { recursive: true }).sort().map((name) => {
    const path = join(folder, name);
    return statSync(path).isFile() ? [name, readFileSync(path, "utf8")] : [name];
  });
}
