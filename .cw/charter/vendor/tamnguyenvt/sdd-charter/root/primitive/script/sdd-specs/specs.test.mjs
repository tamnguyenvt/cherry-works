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

test("report draws every Done story left of every story not Done, the ready ones in one column, each waiting one right of what it waits on", () => {
  specSetOf({ statuses: ["Done", "Done", "Done", "Todo", "In Progress", "Todo"] });
  const dependsOn = [[], ["CORE Story 1"], ["CORE Story 2"], [], ["CORE Story 1"], ["CORE Story 4"]];
  writeFileSync(
    join(repositoryFolder, "specs", "plan.json"),
    JSON.stringify({ stories: dependsOn.map((dependencies, index) => ({ id: `CORE Story ${index + 1}`, title: `Story ${index + 1}`, dependsOn: dependencies })) }),
  );
  spawnSync("node", [specsScript, "report"], { cwd: repositoryFolder, encoding: "utf8" });
  const html = readFileSync(join(repositoryFolder, "specs", "report.html"), "utf8");
  const columnById = Object.fromEntries(
    [...html.matchAll(/class="story \w+" transform="translate\((\d+),\d+\)">\n  <title>(CORE Story \d+)/g)].map(([, x, id]) => [id, Number(x)]),
  );
  const columnOf = (number) => columnById[`CORE Story ${number}`];
  for (const done of [1, 2, 3]) for (const notDone of [4, 5, 6]) assert.ok(columnOf(done) < columnOf(notDone), `${done} left of ${notDone}`);
  assert.equal(columnOf(4), columnOf(5));
  assert.ok(columnOf(4) > columnOf(3) && columnOf(6) > columnOf(4));
});

// The report of a spec set of the stories given, each { status, dependsOn,
// date }, the date its evidence's; its folded and unfolded drawings, and the
// boxes and arrows of each.
function roadmapOf(stories) {
  specSetOf({ statuses: stories.map((story) => story.status) });
  writeFileSync(
    join(repositoryFolder, "specs", "plan.json"),
    JSON.stringify({
      stories: stories.map((story, index) => ({
        id: `CORE Story ${index + 1}`, title: `Story ${index + 1}`, dependsOn: (story.dependsOn ?? []).map((number) => `CORE Story ${number}`),
        ...(story.date && { evidence: { summary: "tests pass", date: story.date } }),
      })),
    }),
  );
  const run = spawnSync("node", [specsScript, "report"], { cwd: repositoryFolder, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const html = readFileSync(join(repositoryFolder, "specs", "report.html"), "utf8");
  const drawingOf = (id) => {
    const svg = new RegExp(`<svg id="${id}"[\\s\\S]*?</svg>`).exec(html)?.[0];
    if (svg === undefined) return undefined;
    const boxes = [...svg.matchAll(/<a href="([^"]*)"><g class="story (\w+)" transform="translate\((\d+),(\d+)\)">\n  <title>([^\n<]*)/g)].map(
      ([, href, state, x, y, title]) => ({ href, state, x: Number(x), y: Number(y), title, id: /^CORE Story \d+/.exec(title)?.[0] }),
    );
    const edges = [...svg.matchAll(/<path class="edge[^"]*" d="M(\d+),(\d+) H[-\d.]+ V(\d+) H(\d+)"/g)].map(([, x, y, endY, endX]) => ({ x: Number(x), y: Number(y), endX: Number(endX), endY: Number(endY) }));
    return { boxes, edges };
  };
  return { html, folded: drawingOf("folded"), unfolded: drawingOf("unfolded") };
}

const BOX = { width: 170, height: 54 };
const groupOf = (drawing) => drawing.boxes.filter((box) => box.state === "group");
const startsAt = (edge, box) => edge.x === box.x + BOX.width && edge.y === box.y + BOX.height / 2;
const endsAt = (edge, box) => edge.endX === box.x - 4 && edge.endY === box.y + BOX.height / 2;

test("report folds every Done story but the five with the latest evidence date into one group in its leftmost column, saying how many it holds", () => {
  const latest = [3, 8, 12, 20, 27];
  const stories = Array.from({ length: 30 }, (_, index) => ({
    status: "Done", date: latest.includes(index + 1) ? `2026-11-0${latest.indexOf(index + 1) + 5}` : `2026-10-${String(index % 28 + 1).padStart(2, "0")}`,
  }));
  const { folded } = roadmapOf([...stories, { status: "Todo", dependsOn: [30] }]);
  const done = folded.boxes.filter((box) => box.state === "done");
  assert.deepEqual(done.map((box) => box.id).sort(), latest.map((number) => `CORE Story ${number}`).sort());
  const [group, ...others] = groupOf(folded);
  assert.equal(others.length, 0);
  assert.match(group.title, /^25 /);
  assert.ok(folded.boxes.filter((box) => box !== group).every((box) => box.x > group.x), "the group alone in the leftmost column");
  assert.ok(done.length + 1 <= 6, "at most six boxes for the Done stories");
});

test("report counts a Done story with no evidence date as the oldest, and of one date the later in the roadmap as the later", () => {
  const stories = [1, 2, 3, 4, 5, 6].map(() => ({ status: "Done", date: "2026-11-01" }));
  const { folded } = roadmapOf([...stories, { status: "Done" }]);
  const done = folded.boxes.filter((box) => box.state === "done").map((box) => box.id);
  assert.deepEqual(done.sort(), [2, 3, 4, 5, 6].map((number) => `CORE Story ${number}`).sort());
  assert.match(groupOf(folded)[0].title, /^2 /);
});

test("report with five Done stories or fewer draws no group, every story as before", () => {
  const { html, folded, unfolded } = roadmapOf([...[1, 2, 3, 4, 5].map(() => ({ status: "Done", date: "2026-11-01" })), { status: "Todo", dependsOn: [5] }]);
  assert.equal(unfolded, undefined);
  assert.equal(groupOf(folded).length, 0);
  assert.equal(folded.boxes.length, 6);
  assert.doesNotMatch(html, /story group/);
});

test("report opens folded; the group unfolds into its stories, each drawn with its arrows, and folds again", () => {
  const stories = Array.from({ length: 8 }, (_, index) => ({ status: "Done", date: `2026-11-0${index + 1}`, dependsOn: index === 1 ? [1] : [] }));
  const { html, folded, unfolded } = roadmapOf(stories);
  assert.match(html, /\.roadmap\.unfolded \{ display: none; \}/);
  assert.match(html, /\.roadmap\.unfolded:target \{ display: block; \}/);
  assert.match(html, /\.roadmap\.unfolded:target ~ \.roadmap\.folded \{ display: none; \}/);
  assert.equal(groupOf(folded)[0].href, "#unfolded");
  const [group] = groupOf(unfolded);
  assert.equal(group.href, "#folded");
  assert.ok(unfolded.boxes.every((box) => box === group || box.x > group.x));
  assert.deepEqual(unfolded.boxes.filter((box) => box.state === "done").map((box) => box.id).sort(), stories.map((_, index) => `CORE Story ${index + 1}`).sort());
  for (const box of unfolded.boxes.filter((one) => one.state === "done")) assert.match(box.href, /^spec-core\.md#core-story-\d+/);
  const [first, second] = ["CORE Story 1", "CORE Story 2"].map((id) => unfolded.boxes.find((box) => box.id === id));
  assert.equal(unfolded.edges.filter((edge) => startsAt(edge, first) && endsAt(edge, second)).length, 1);
});

test("report draws one arrow from the folded group to each story drawn that depends on a story it holds", () => {
  const stories = Array.from({ length: 8 }, (_, index) => ({ status: "Done", date: `2026-11-0${index + 1}` }));
  const { folded } = roadmapOf([...stories, { status: "Todo", dependsOn: [1, 2] }, { status: "Todo", dependsOn: [3, 9] }, { status: "Todo", dependsOn: [8] }]);
  const [group] = groupOf(folded);
  const fromGroup = folded.edges.filter((edge) => startsAt(edge, group));
  const boxOf = (number) => folded.boxes.find((box) => box.id === `CORE Story ${number}`);
  assert.equal(fromGroup.length, 2);
  for (const number of [9, 10]) assert.equal(fromGroup.filter((edge) => endsAt(edge, boxOf(number))).length, 1);
  assert.equal(folded.edges.filter((edge) => endsAt(edge, boxOf(10))).length, 2);
  assert.equal(fromGroup.filter((edge) => endsAt(edge, boxOf(11))).length, 0);
});

test("report with a group draws the stories not Done and the code smell section as before", () => {
  const stories = Array.from({ length: 7 }, (_, index) => ({ status: "Done", date: `2026-11-0${index + 1}` }));
  const { html, folded, unfolded } = roadmapOf([...stories, { status: "In Progress", dependsOn: [1] }, { status: "Todo" }, { status: "Todo", dependsOn: [9] }]);
  const notDone = (drawing) => drawing.boxes.filter((box) => !["done", "group"].includes(box.state)).map(({ href, state, title }) => ({ href, state, title }));
  assert.deepEqual(notDone(folded), notDone(unfolded));
  assert.deepEqual(notDone(folded).map((box) => box.state), ["active", "ready", "blocked"]);
  assert.match(html, /No code smell has been assessed/);
});

// The report of a two-story spec set, with the code smell record written as
// given beside it; none where none is given.
function reportWith(codeSmellRecord) {
  specSetOf({ statuses: ["Done", "Todo"] });
  if (codeSmellRecord !== undefined) writeFileSync(join(repositoryFolder, "specs", "code-smell.json"), codeSmellRecord);
  const run = spawnSync("node", [specsScript, "report"], { cwd: repositoryFolder, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  return readFileSync(join(repositoryFolder, "specs", "report.html"), "utf8");
}

test("report shows the code smell record's files and its findings by rule, agreed or skipped", () => {
  const html = reportWith(
    JSON.stringify({
      files: {
        "src/a.mjs": { hash: "1", assessed: "2026-11-03", good: true, findings: [] },
        "src/b.mjs": {
          hash: "2",
          assessed: "2026-11-03",
          good: false,
          findings: [
            { id: "f1", rule: "no-magic-number", line: 3, says: "42 has <no> name", status: "skipped", reason: "kept on purpose" },
            { id: "f2", rule: "no-magic-number", line: 9, says: "7 has no name", status: "agreed" },
            { id: "f3", rule: "small-functions", line: 20, says: "too long" },
          ],
        },
      },
    }),
  );
  assert.match(html, /<svg/);
  assert.match(html, /2 files assessed, 1 good/);
  assert.match(html, /no-magic-number[\s\S]*src\/b\.mjs:3[\s\S]*42 has &#60;no&#62; name[\s\S]*skipped[\s\S]*kept on purpose[\s\S]*src\/b\.mjs:9[\s\S]*agreed[\s\S]*small-functions[\s\S]*src\/b\.mjs:20[\s\S]*waiting/);
});

test("report files a finding under its record entry's path, whatever path the finding itself carries", () => {
  const html = reportWith(JSON.stringify({ files: { "src/c.mjs": { hash: "3", assessed: "2026-11-03", good: false, findings: [{ rule: "r", line: 1, path: 5 }] } } }));
  assert.match(html, /<svg/);
  assert.match(html, /src\/c\.mjs:1/);
});

test("report with no code smell record draws the roadmap and says none has been assessed", () => {
  const html = reportWith();
  assert.match(html, /<svg/);
  assert.match(html, /No code smell has been assessed/);
});

test("report with a code smell record it cannot read draws the roadmap and says so", () => {
  for (const record of ["{ not json", '{ "files": [1] }']) {
    const html = reportWith(record);
    assert.match(html, /<svg/);
    assert.match(html, /could not be read/);
    rmSync(repositoryFolder, { recursive: true, force: true });
  }
});

const proof ={ summary: "node --test: 30 pass, 0 fail; check of sdd-specs passed", date: "2026-10-27" };

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
  assert.equal(output.trim().split("\n").length, 4);
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
  assert.equal(offered.length, manifestFields.length - 1);
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

test("doctor hints at local language without failing or requiring document language", () => {
  setUpRepository({ leaveOut: ["Document language"] });
  const { status, output } = doctor();
  assert.equal(status, 0, output);
  assert.match(output, /hint  language +.*settings\.local\.json.*\/sdd-init/);
});

test("doctor reads language only from this repository and leaves local settings untouched", () => {
  setUpRepository();
  const file = join(repositoryFolder, ".sdd", "settings.local.json");
  const text = '{"language":"Tiếng Việt","other":true}\n';
  writeFileSync(file, text);
  const { status, output } = doctor();
  assert.equal(status, 0, output);
  assert.doesNotMatch(output, /hint  language/);
  assert.equal(readFileSync(file, "utf8"), text);
});

test("doctor treats malformed local settings as no language and reports it once", () => {
  setUpRepository();
  writeFileSync(join(repositoryFolder, ".sdd", "settings.local.json"), '{broken');
  const { status, output } = doctor();
  assert.equal(status, 0, output);
  assert.equal((output.match(/could not read/g) ?? []).length, 1);
  assert.match(output, /\/sdd-init/);
});

test("a non-English roadmap requires translated labels rather than silently using English", () => {
  specSetOf({ statuses: ["Todo"] });
  writeFileSync(join(repositoryFolder, "specs", "manifest.md"), '- **Document language**: Tiếng Việt\n');
  const run = spawnSync(process.execPath, [specsScript, "report"], { cwd: repositoryFolder, encoding: "utf8" });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /--labels/);
  assert.equal(readdirSync(join(repositoryFolder, "specs")).includes("report.html"), false);
});

test("roadmap translates generated prose, escapes labels and keeps story ids and earlier content", () => {
  specSetOf({ statuses: ["Todo"] });
  writeFileSync(join(repositoryFolder, "specs", "manifest.md"), '- **Document language**: Tiếng Việt\n');
  const labelsFile = join(repositoryFolder, "labels.json");
  const labels = { language: "Tiếng Việt", lang: "vi", messages: {
    roadmap: "Lộ trình <dự án>", smells: "Mùi mã", todo: "Chưa làm", done: "Đã xong", active: "Đang làm",
    ready: "Sẵn sàng", blocked: "Đang chờ", waiting: "chờ", skipped: "bỏ qua", agreed: "đồng ý",
    missingStory: "không có trong đặc tả", after: "sau {stories}", group: "{count} story đã xong", aria: "Lộ trình của {count} story",
    noSmells: "Chưa đánh giá mùi mã: không có {path}.",
    unreadableSmells: "Không đọc được {path}: {why}.",
    smellCounts: "{files} tệp đã đánh giá, {good} tốt; {waiting} chờ, {skipped} bỏ qua, {agreed} đồng ý.",
  } };
  writeFileSync(labelsFile, JSON.stringify(labels));
  const run = () => spawnSync(process.execPath, [specsScript, "report", "--labels", labelsFile], { cwd: repositoryFolder, encoding: "utf8" });
  assert.equal(run().status, 0);
  const html = readFileSync(join(repositoryFolder, "specs", "report.html"), "utf8");
  assert.match(html, /<html lang="vi">/);
  assert.match(html, /Lộ trình &#60;dự án&#62;/);
  assert.match(html, /Chưa đánh giá mùi mã/);
  assert.match(html, /Story 1\nChưa làm/);
  assert.match(html, /CORE Story 1/);
  assert.match(html, /Story 1/);
  delete labels.messages.ready;
  writeFileSync(labelsFile, JSON.stringify(labels));
  assert.equal(run().status, 1);
  assert.equal(readFileSync(join(repositoryFolder, "specs", "report.html"), "utf8"), html);
});

// `row`: each row added at the end of a note's timeline, numbered, timed and
// its round numbered on by the tool.
const TEMPLATE_TIMELINE = "## Timeline\n\n| # | When | Step | Round | Agent | Result |\n|---|------|------|-------|-------|--------|\n| [1] | [yyyy-mm-dd hh:mm] | [step] | [1] | [agent] | [result] |\n";

function row(note, ...cells) {
  const run = spawnSync("node", [specsScript, "row", note, ...cells], { cwd: repositoryFolder, encoding: "utf8" });
  return { status: run.status, output: run.stdout + run.stderr };
}
const noteText = () => readFileSync(join(repositoryFolder, "specs", "handoff", "core-1.md"), "utf8");
const rowsOf = (text) => text.split("\n").filter((line) => /^\| \d+ \|/.test(line)).map((line) => line.slice(2, -2).split(" | "));
const NOW = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

test("row replaces the template's row with row 1, timed now, round 1", () => {
  specSetOf({ statuses: ["In Progress", "Todo"], notes: [["core-1.md", `# CORE Story 1 — handoff\n\n## Done\n\n- x\n\n${TEMPLATE_TIMELINE}`]] });
  const run = row("specs/handoff/core-1.md", "baseline", "claude-opus-5", "passed");
  assert.equal(run.status, 0, run.output);
  const rows = rowsOf(noteText());
  assert.equal(rows.length, 1);
  assert.equal(rows[0][0], "1");
  assert.match(rows[0][1], NOW);
  const minutes = Math.abs(new Date(rows[0][1].replace(" ", "T")) - Date.now()) / 60000;
  assert.ok(minutes < 2, `${rows[0][1]} is not now`);
  assert.deepEqual(rows[0].slice(2), ["baseline", "1", "claude-opus-5", "passed"]);
  assert.doesNotMatch(noteText(), /\[yyyy-mm-dd/);
});

test("row numbers on, and numbers a step's round on from its last row", () => {
  specSetOf({ statuses: ["In Progress", "Todo"], notes: [["core-1.md", `# CORE Story 1 — handoff\n\n${TEMPLATE_TIMELINE}\n`]] });
  row("specs/handoff/core-1.md", "review", "sdd-review-agent", "failed");
  row("specs/handoff/core-1.md", "verify", "claude-opus-5", "passed");
  const before = noteText();
  row("specs/handoff/core-1.md", "Review", "sdd-review-agent", "passed");
  const rows = rowsOf(noteText());
  assert.deepEqual(rows.map((cells) => [cells[0], cells[2], cells[3]]), [["1", "review", "1"], ["2", "verify", "1"], ["3", "Review", "2"]]);
  assert.ok(noteText().startsWith(before.trimEnd()), "a row already there was rewritten");
});

test("row starts a timeline at the end of a note that has none, its row 1 saying the steps before are not in it", () => {
  const old = "# CORE Story 1 — handoff\n\n## Done\n\n- Baseline passed.\n\n## Blockers\n\n- None.\n";
  specSetOf({ statuses: ["In Progress", "Todo"], notes: [["core-1.md", old]] });
  assert.equal(row("specs/handoff/core-1.md", "verify", "claude-opus-5", "passed").status, 0);
  assert.ok(noteText().startsWith(old), "the note's own lines changed");
  const rows = rowsOf(noteText());
  assert.deepEqual(rows.map((cells) => [cells[0], cells[2]]), [["1", "note"], ["2", "verify"]]);
  assert.match(rows[0][5], /the steps before this row are not in it/);
});

test("row keeps a cell's bar and line break from breaking the table", () => {
  specSetOf({ statuses: ["In Progress", "Todo"], notes: [["core-1.md", TEMPLATE_TIMELINE]] });
  row("specs/handoff/core-1.md", "answer", "user", "keep a | b\nas it is");
  assert.match(noteText(), /\| answer \| 1 \| user \| keep a \\\| b as it is \|/);
});

test("row refuses a note that is not there, or a cell left out", () => {
  specSetOf({ statuses: ["In Progress", "Todo"] });
  const missing = row("specs/handoff/core-1.md", "baseline", "claude-opus-5", "passed");
  assert.equal(missing.status, 1);
  assert.match(missing.output, /no note at specs\/handoff\/core-1\.md/);
  writeFileSync(join(repositoryFolder, "specs", "handoff", "core-1.md"), TEMPLATE_TIMELINE);
  assert.equal(row("specs/handoff/core-1.md", "baseline", "claude-opus-5").status, 1);
});

test("row writes the table under a Timeline heading that has none, and after every line of a table it cannot read", () => {
  specSetOf({ statuses: ["In Progress", "Todo"], notes: [["core-1.md", "# CORE Story 1 — handoff\n\n## Timeline\n"]] });
  row("specs/handoff/core-1.md", "baseline", "claude-opus-5", "passed");
  assert.ok(noteText().startsWith("# CORE Story 1 — handoff\n"), "a row went above the note's heading");
  assert.match(noteText(), /## Timeline\n\n\| # \| When \| Step \| Round \| Agent \| Result \|\n\|---\|.*\n\| 1 \| [^|]* \| baseline \| 1 \|/);
  writeFileSync(join(repositoryFolder, "specs", "handoff", "core-1.md"), `${noteText()}| 2 | 2026-11-06 10:00 | verify | first | claude-opus-5 | passed |\n`);
  row("specs/handoff/core-1.md", "review", "sdd-review-agent", "passed");
  assert.match(noteText().trimEnd().split("\n").at(-1), /^\| 3 \| [^|]* \| review \| 1 \| sdd-review-agent \| passed \|$/);
});

test("row keeps one blank line under a bare heading, adds only the separator a header lacks, and reads a CRLF note", () => {
  specSetOf({ statuses: ["In Progress", "Todo"], notes: [["core-1.md", "# CORE Story 1 — handoff\n\n## Timeline\n\n"]] });
  row("specs/handoff/core-1.md", "baseline", "claude-opus-5", "passed");
  assert.match(noteText(), /## Timeline\n\n\| # \|/);
  writeFileSync(join(repositoryFolder, "specs", "handoff", "core-1.md"), "## Timeline\n\n| # | When | Step | Round | Agent | Result |\n");
  row("specs/handoff/core-1.md", "baseline", "claude-opus-5", "passed");
  assert.equal(noteText().match(/\| # \| When/g).length, 1);
  assert.match(noteText(), /\| # \| When \| Step \| Round \| Agent \| Result \|\n\|---\|.*\n\| 1 \|/);
  writeFileSync(join(repositoryFolder, "specs", "handoff", "core-1.md"), "# CORE Story 1 — handoff\r\n\r\n" + TEMPLATE_TIMELINE.replace(/\n/g, "\r\n"));
  row("specs/handoff/core-1.md", "baseline", "claude-opus-5", "passed");
  row("specs/handoff/core-1.md", "verify", "claude-opus-5", "passed");
  assert.equal(noteText().match(/## Timeline/g).length, 1);
  assert.deepEqual(rowsOf(noteText()).map((cells) => cells[0]), ["1", "2"]);
});

test("row refuses a file outside the spec folder's handoff folder", () => {
  specSetOf({ statuses: ["In Progress", "Todo"] });
  writeFileSync(join(repositoryFolder, "README.md"), "# Read me\n");
  const run = row("README.md", "baseline", "claude-opus-5", "passed");
  assert.equal(run.status, 1);
  assert.match(run.output, /not a note of specs\/handoff/);
  assert.equal(readFileSync(join(repositoryFolder, "README.md"), "utf8"), "# Read me\n");
});
