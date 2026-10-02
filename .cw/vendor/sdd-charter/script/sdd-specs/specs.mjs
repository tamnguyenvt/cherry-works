#!/usr/bin/env node
// The spec set's one tool: links every id the specs cite to where it is
// defined, checks the specs and plan.json against each other, and says which
// stories can be started now.
//
//   node specs.mjs link  [--if-changed]   rewrite the spec files' links and anchors
//   node specs.mjs check [--if-changed]   change nothing; exit 1 on any fault
//   node specs.mjs ready                  the stories whose dependencies are Done
//   node specs.mjs report                 write <spec folder>/report.html, the roadmap drawn
//
// The spec folder is read from .sdd/settings.json ("specFolder"), from the
// repository's root; "specs" when there is none.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

const [command = "check", ...flags] = process.argv.slice(2);
const settingsFile = join(".sdd", "settings.json");
const specFolder = existsSync(settingsFile) ? JSON.parse(readFileSync(settingsFile, "utf8")).specFolder ?? "specs" : "specs";
const planFile = join(specFolder, "plan.json");
const STATUSES = ["Todo", "In Progress", "Done"];

if (flags.includes("--if-changed")) {
  let changed = "x";
  try {
    changed = execFileSync("git", ["status", "--porcelain", "--", specFolder], { encoding: "utf8" });
  } catch {}
  if (changed.trim() === "") process.exit(0);
}
if (!existsSync(specFolder)) {
  console.error(`no spec folder at ${specFolder}: run /sdd-init, or set "specFolder" in ${settingsFile}`);
  process.exit(1);
}

// Every markdown file of the folder cites; spec-<key>.md files define, each
// under the prefix its key makes: spec-core.md defines CORE-FR-001 and CORE Story 1.
const markdownFiles = readdirSync(specFolder).filter((name) => name.endsWith(".md")).map((name) => join(specFolder, name));
const prefixOf = (file) => /^spec-([a-z0-9-]+)\.md$/.exec(basename(file))?.[1].replace(/-/g, "").toUpperCase();

const ANCHOR = /<a id="[^"]*"><\/a>/g;
const GENERATED_LINK = /\[([A-Z][A-Z0-9]*-(?:FR|SC)-\d+|[A-Z][A-Z0-9]* Story \d+)\]\([^)\s]*\)/g;
const ITEM_DEFINITION = /^(- )\*\*([A-Z][A-Z0-9]*)-((?:FR|SC)-\d+)\*\*/;
const STORY_HEADING = /^#{2,4} ([A-Z][A-Z0-9]*) Story (\d+) - (.*?)(?: \(Priority: [^)]*\))?\s*$/;
const CITATION = /(?<![\w.[-])([A-Z][A-Z0-9]*-(?:FR|SC)-\d{3}|[A-Z][A-Z0-9]* Story \d+)(?![\w-]|\.\d)/g;

// The slug GitHub and VS Code both give a heading.
function headingSlugsOf(text) {
  const slugsByHeading = new Map();
  const seenSlugCounts = new Map();
  for (const line of text.split("\n")) {
    const heading = /^#{1,6} (.*?)#*\s*$/.exec(line)?.[1];
    if (heading === undefined) continue;
    const base = heading.trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "").replace(/ /g, "-");
    const seen = seenSlugCounts.get(base) ?? 0;
    seenSlugCounts.set(base, seen + 1);
    slugsByHeading.set(heading, seen ? `${base}-${seen}` : base);
  }
  return slugsByHeading;
}

const faults = [];
const originalTextByFile = new Map(markdownFiles.map((file) => [file, readFileSync(file, "utf8")]));
const plainTextByFile = new Map([...originalTextByFile].map(([file, text]) => [file, text.replace(ANCHOR, "").replace(GENERATED_LINK, "$1")]));

// Where each id is defined, and every story with its title and status.
const targetById = new Map();
const storyById = new Map();
for (const [file, text] of plainTextByFile) {
  const prefix = prefixOf(file);
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    const [, , itemPrefix, itemRest] = ITEM_DEFINITION.exec(line) ?? [];
    if (itemPrefix !== undefined) {
      const id = `${itemPrefix}-${itemRest}`;
      if (itemPrefix !== prefix) faults.push(`${file}:${index + 1}: ${id} is defined in a file whose prefix is ${prefix ?? "none"}`);
      if (targetById.has(id)) faults.push(`${file}:${index + 1}: ${id} is defined twice`);
      targetById.set(id, { file, fragment: id.toLowerCase() });
    }
  });
  for (const [heading, slug] of headingSlugsOf(text)) {
    const [, storyPrefix, storyNumber, title] = STORY_HEADING.exec(`### ${heading}`) ?? [];
    if (storyPrefix === undefined) continue;
    const id = `${storyPrefix} Story ${storyNumber}`;
    if (storyPrefix !== prefix) faults.push(`${file}: ${id} is a story in a file whose prefix is ${prefix ?? "none"}`);
    if (storyById.has(id)) faults.push(`${file}: ${id} is defined twice`);
    const headingLine = lines.findIndex((line) => line.replace(/^#+ /, "") === heading);
    const status = /^\*\*Status\*\*: (.*)$/.exec(lines.slice(headingLine + 1).find((line) => line.trim() !== "") ?? "")?.[1]?.trim();
    if (!STATUSES.includes(status)) faults.push(`${file}:${headingLine + 1}: ${id} has no "**Status**: Todo | In Progress | Done" line right under its heading`);
    storyById.set(id, { file, title, status });
    targetById.set(id, { file, fragment: slug });
  }
}

// plan.json: every story once, with what it depends on.
let plannedStories = [];
if (!existsSync(planFile)) faults.push(`${planFile}: missing; it lists every story and what it depends on`);
else {
  try {
    plannedStories = JSON.parse(readFileSync(planFile, "utf8")).stories ?? [];
  } catch (error) {
    faults.push(`${planFile}: not JSON (${error.message})`);
  }
}
const plannedById = new Map(plannedStories.map((one) => [one.id, one]));
for (const planned of plannedStories) {
  const story = storyById.get(planned.id);
  if (story === undefined) faults.push(`${planFile}: "${planned.id}" is no story in the specs`);
  else if (planned.title !== undefined && planned.title !== story.title) faults.push(`${planFile}: "${planned.id}" is titled "${planned.title}"; its heading says "${story.title}"`);
  for (const dependency of planned.dependsOn ?? [])
    if (!storyById.has(dependency)) faults.push(`${planFile}: "${planned.id}" depends on "${dependency}", which is no story`);
}
for (const id of storyById.keys()) if (!plannedById.has(id)) faults.push(`${planFile}: "${id}" is missing`);
// A dependency cycle leaves its stories never ready.
const visitStates = new Map();
const visit = (id, path) => {
  if (visitStates.get(id) === "done") return;
  if (visitStates.get(id) === "open") return void faults.push(`${planFile}: dependency cycle ${[...path, id].join(" -> ")}`);
  visitStates.set(id, "open");
  for (const dependency of plannedById.get(id)?.dependsOn ?? []) visit(dependency, [...path, id]);
  visitStates.set(id, "done");
};
for (const id of plannedById.keys()) visit(id, []);

if (command === "report") {
  const reportFile = join(specFolder, "report.html");
  writeFileSync(reportFile, reportHtmlOf(plannedStories, storyById, targetById));
  // Generated, so never committed: the spec folder's .gitignore says so.
  const gitignoreFile = join(specFolder, ".gitignore");
  const gitignoreText = existsSync(gitignoreFile) ? readFileSync(gitignoreFile, "utf8") : "";
  if (!gitignoreText.split(/\r?\n/).includes("report.html"))
    writeFileSync(gitignoreFile, `${gitignoreText}${gitignoreText === "" || gitignoreText.endsWith("\n") ? "" : "\n"}report.html\n`);
  console.log(`wrote ${reportFile}`);
  for (const fault of faults) console.error(fault);
  process.exit(0);
}

if (command === "ready") {
  const readyStories = plannedStories.filter(
    (planned) => storyById.get(planned.id)?.status !== "Done" && (planned.dependsOn ?? []).every((dependency) => storyById.get(dependency)?.status === "Done"),
  );
  for (const planned of readyStories) {
    const story = storyById.get(planned.id);
    console.log(`${planned.id}  ${story?.status ?? "?"}  ${story?.title ?? planned.title ?? ""}  (${story ? relative(".", story.file) : "?"})`);
  }
  if (readyStories.length === 0) console.log("No story is ready: every one is Done, or waits on one that is not.");
  for (const fault of faults) console.error(fault);
  process.exit(0);
}

// Every citation linked to where it is defined, from the file citing it.
let staleFiles = 0;
for (const [file, text] of plainTextByFile) {
  let inCodeBlock = false;
  const linkedText = text
    .split("\n")
    .map((line, index) => {
      if (line.startsWith("```")) inCodeBlock = !inCodeBlock;
      if (inCodeBlock || line.startsWith("#")) return line;
      const [definition, listMarker, itemPrefix, itemRest] = ITEM_DEFINITION.exec(line) ?? [];
      const anchored = definition ? `${listMarker}<a id="${`${itemPrefix}-${itemRest}`.toLowerCase()}"></a>**${itemPrefix}-${itemRest}**${line.slice(definition.length)}` : line;
      return anchored
        .split(/(`[^`]*`)/)
        .map((part) =>
          part.startsWith("`")
            ? part
            : part.replace(CITATION, (citation, id) => {
                const target = targetById.get(id);
                if (!target) {
                  faults.push(`${file}:${index + 1}: nothing defines ${citation}`);
                  return citation;
                }
                const href = `${target.file === file ? "" : relative(dirname(file), target.file)}#${target.fragment}`;
                return `[${id}](${href})`;
              }),
        )
        .join("")
        .replace(/(<a id="[^"]*"><\/a>)\*\*\[([^\]]+)\]\([^)]*\)\*\*/, "$1**$2**");
    })
    .join("\n");
  if (linkedText === originalTextByFile.get(file)) continue;
  staleFiles++;
  if (command === "link") writeFileSync(file, linkedText);
  else faults.push(`${file}: stale links; run "node ${relative(".", process.argv[1])} link"`);
}

for (const fault of faults) console.error(fault);
if (command === "link") console.log(`linked ${staleFiles} file(s)`);
if (faults.length > 0) process.exit(1);

// The roadmap as one self-contained page: a column per depth of dependency, a
// box per story coloured by where it stands, an arrow from each story to every
// story waiting on it.
function reportHtmlOf(plannedStories, storyById, targetById) {
  const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
  const plannedById = new Map(plannedStories.map((one) => [one.id, one]));
  const statusOf = (id) => storyById.get(id)?.status ?? "Todo";
  const depthById = new Map();
  const depthOf = (id, seen = new Set()) => {
    if (depthById.has(id)) return depthById.get(id);
    if (seen.has(id)) return 0;
    seen.add(id);
    const dependencies = (plannedById.get(id)?.dependsOn ?? []).filter((dependency) => plannedById.has(dependency));
    const depth = dependencies.length === 0 ? 0 : 1 + Math.max(...dependencies.map((dependency) => depthOf(dependency, seen)));
    depthById.set(id, depth);
    return depth;
  };
  const stateOf = (id) => {
    const status = statusOf(id);
    if (status === "Done") return "done";
    if (status === "In Progress") return "active";
    return (plannedById.get(id)?.dependsOn ?? []).every((dependency) => statusOf(dependency) === "Done") ? "ready" : "blocked";
  };

  const BOX_WIDTH = 170, BOX_HEIGHT = 54, COLUMN_GAP = 100, ROW_GAP = 22, MARGIN = 24;
  const idsByColumn = [];
  for (const planned of plannedStories) (idsByColumn[depthOf(planned.id)] ??= []).push(planned.id);
  const positionById = new Map();
  idsByColumn.forEach((ids, column) =>
    ids.forEach((id, row) => positionById.set(id, { x: MARGIN + column * (BOX_WIDTH + COLUMN_GAP), y: MARGIN + row * (BOX_HEIGHT + ROW_GAP), row })),
  );
  const width = MARGIN * 2 + Math.max(1, idsByColumn.length) * (BOX_WIDTH + COLUMN_GAP) - COLUMN_GAP;
  const height = MARGIN * 2 + Math.max(1, ...idsByColumn.map((ids) => ids?.length ?? 0)) * (BOX_HEIGHT + ROW_GAP) - ROW_GAP;

  const edges = plannedStories.flatMap((planned) =>
    (planned.dependsOn ?? []).filter((dependency) => positionById.has(dependency)).map((dependency) => {
      const from = positionById.get(dependency), to = positionById.get(planned.id);
      const startX = from.x + BOX_WIDTH, startY = from.y + BOX_HEIGHT / 2, endX = to.x - 4, endY = to.y + BOX_HEIGHT / 2;
      // Each story's arrows turn down at a line of their own, so arrows from
      // two stories into one column are not drawn as one.
      const elbowX = to.x - COLUMN_GAP / 2 + ((from.row % 7) - 3) * 9;
      const isBlocked = stateOf(planned.id) === "blocked";
      return `<path class="edge${isBlocked ? " blocked" : ""}" d="M${startX},${startY} H${elbowX} V${endY} H${endX}" marker-end="url(#${isBlocked ? "arrow-blocked" : "arrow"})"/>`;
    }),
  );
  const boxes = plannedStories.map((planned) => {
    const { x, y } = positionById.get(planned.id);
    const story = storyById.get(planned.id);
    const state = stateOf(planned.id);
    const [, prefix, number] = /^([A-Z][A-Z0-9]*) Story (\d+)$/.exec(planned.id) ?? [, planned.id, ""];
    const title = story?.title ?? planned.title ?? "";
    const target = targetById.get(planned.id);
    const href = target ? `${relative(specFolder, target.file)}#${target.fragment}` : "";
    const shortTitle = title.length > 26 ? `${title.slice(0, 25)}…` : title;
    return `<a href="${escapeHtml(href)}"><g class="story ${state}" transform="translate(${x},${y})">
  <title>${escapeHtml(`${planned.id} — ${title}\n${story?.status ?? "not in the specs"}${planned.dependsOn?.length ? `\nafter ${planned.dependsOn.join(", ")}` : ""}`)}</title>
  <rect width="${BOX_WIDTH}" height="${BOX_HEIGHT}" rx="10"/>
  <text class="label" x="14" y="23">${escapeHtml(prefix)} ${escapeHtml(number)}</text>${state === "active" ? `\n  <circle class="dot" cx="${BOX_WIDTH - 16}" cy="18" r="4.5"/>` : ""}
  <text class="title" x="14" y="41">${escapeHtml(shortTitle)}</text>
</g></a>`;
  });

  const counts = { done: 0, active: 0, ready: 0, blocked: 0 };
  for (const planned of plannedStories) counts[stateOf(planned.id)]++;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Roadmap</title>
<style>
  :root { --bg: #ffffff; --panel: #fbfbfc; --line: #e4e6ec; --text: #2b2d33; --muted: #9a9ca3; --edge: #9a9ca3;
    --done-bg: #f2f2f3; --done-text: #3f9d58; --active-bg: #fcebec; --active-line: #e3a1a8; --active-text: #b0283a; --dot: #57b96b; }
  @media (prefers-color-scheme: dark) { :root { --bg: #16171a; --panel: #1c1d21; --line: #33353b; --text: #e6e7ea; --muted: #7d8089; --edge: #7d8089;
    --done-bg: #24262b; --done-text: #6cc483; --active-bg: #3a2226; --active-line: #8a4650; --active-text: #f19aa6; --dot: #6cc483; } }
  body { margin: 0; padding: 24px 16px; background: var(--bg); color: var(--text); font: 14px/1.4 -apple-system, "Segoe UI", Inter, sans-serif; }
  .panel { width: fit-content; max-width: 100%; box-sizing: border-box; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 18px 20px; }
  h1 { margin: 0 0 4px; font-size: 13px; letter-spacing: .18em; color: var(--muted); font-weight: 600; }
  .legend { display: flex; flex-wrap: wrap; gap: 14px; margin: 8px 0 14px; font-size: 12px; color: var(--muted); }
  .legend span::before { content: ""; display: inline-block; width: 12px; height: 12px; border-radius: 4px; margin-right: 6px; vertical-align: -2px; border: 1.5px solid var(--line); }
  .legend .done::before { background: var(--done-bg); } .legend .active::before { background: var(--active-bg); border-color: var(--active-line); }
  .legend .ready::before { background: var(--bg); } .legend .blocked::before { border-style: dashed; }
  .scroll { overflow-x: auto; }
  svg { display: block; }
  a { text-decoration: none; }
  .edge { fill: none; stroke: var(--edge); stroke-width: 2; }
  .edge.blocked { stroke: var(--line); stroke-dasharray: 5 5; }
  .story rect { fill: var(--bg); stroke: var(--line); stroke-width: 1.5; }
  .story .label { font-size: 16px; font-weight: 700; fill: var(--text); }
  .story .title { font-size: 11.5px; fill: var(--muted); }
  .story.done rect { fill: var(--done-bg); } .story.done .label { fill: var(--done-text); }
  .story.active rect { fill: var(--active-bg); stroke: var(--active-line); } .story.active .label { fill: var(--active-text); }
  .story.blocked rect { fill: none; stroke-dasharray: 6 5; } .story.blocked .label, .story.blocked .title { fill: var(--muted); }
  .dot { fill: var(--dot); }
  a:hover .story rect { stroke: var(--edge); }
</style>
</head>
<body>
<div class="panel">
  <h1>ROADMAP</h1>
  <div class="legend">
    <span class="done">Done · ${counts.done}</span><span class="active">In Progress · ${counts.active}</span>
    <span class="ready">Ready · ${counts.ready}</span><span class="blocked">Waiting · ${counts.blocked}</span>
  </div>
  <div class="scroll">
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Roadmap of ${plannedStories.length} stories">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9" fill="none" stroke="var(--edge)" stroke-width="1.8"/></marker>
        <marker id="arrow-blocked" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9" fill="none" stroke="var(--line)" stroke-width="1.8"/></marker>
      </defs>
      ${edges.join("\n      ")}
      ${boxes.join("\n      ")}
    </svg>
  </div>
</div>
</body>
</html>
`;
}
