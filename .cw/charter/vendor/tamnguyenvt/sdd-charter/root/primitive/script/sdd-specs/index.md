---
kind: script
id: sdd-specs
description: Link every id the specs cite, check the specs against plan.json, and list the stories that can start now.
executionPath: ./specs.mjs
---

The spec set's one tool. It reads the spec folder from `.sdd/settings.json`
(`"specFolder"`, `specs` when there is none), from the repository's root.
Node 20 or later, nothing else.

```bash
node .cw/out/script/sdd-specs/specs.mjs link    # anchor every definition, link every citation, across files
node .cw/out/script/sdd-specs/specs.mjs check   # change nothing; exit 1 on any fault
node .cw/out/script/sdd-specs/specs.mjs check --landing "CORE Story 3"   # and on that story with no evidence
node .cw/out/script/sdd-specs/specs.mjs ready   # stories not Done whose dependencies are all Done
node .cw/out/script/sdd-specs/specs.mjs report [--labels <file>]  # write <spec folder>/report.html, the roadmap drawn
node .cw/out/script/sdd-specs/specs.mjs doctor  # whether settings, spec folder and manifest are set up; change nothing; exit 1 on any fault
node .cw/out/script/sdd-specs/specs.mjs row specs/handoff/core-3.md "review" "sdd-review-agent" "failed: one risk"  # add a row to a note's timeline
```

`--if-changed` makes `link` and `check` do nothing when `git status` reports
nothing under the spec folder.

**link** gives each `- **CORE-FR-001**` and `- **CORE-SC-001**` an anchor,
and turns every citation — `CORE-FR-001`, `CORE-SC-001`, `CORE Story 3` — into
a link to where it is defined, in whichever file of the folder, written from
the file citing it. Code spans and fenced blocks are left as written.

**check** fails on: a citation nothing defines; an id defined twice, or in a
file whose prefix is not its own (`spec-core.md` defines `CORE-…` only); a
story with no `**Status**: Todo | In Progress | Done` line right under its
heading; a story missing from `plan.json`, or one there that no spec holds; a
dependency on no story; a dependency cycle; a stale link; a story `In Progress`
with no handoff note at `handoff/<prefix>-<n>.md` (`handoff/core-3.md` for CORE
Story 3) — unless `manifest.md` says `**Handoff notes**: ignored` — or a note
there for a story `Todo` — a `Done` story keeps its note; evidence on the
`plan.json` entry of a story that is not `Done`, or evidence that is not `{
"summary": "<one line>", "date": "yyyy-mm-dd" }`. A bug fix's note,
`handoff/fix-<slug>.md`, is left alone, unless it is a FIX spec's story note. A
`Done` story with no evidence passes, as the stories landed before evidence was
kept; with `--landing "<story id>"`, which /sdd-finish passes for the story it
lands, that story with no evidence fails. Notes are not read as specs: what
they cite is neither linked nor checked.

**doctor** prints a line per item, `pass` or `fail` with its reason, and for
a fault its fix: `.sdd/settings.json` names a spec folder — where there is no
settings file, the one line says the repository is not set up, fix /sdd-init;
the folder exists; `manifest.md` answers every `- **<Field>**:` line of the
[[sdd-manifest]] template, read beside this script — each one missing, left
as the template's text or keeping one of its `[placeholders]` a line of its
own, fix the /sdd-init question on it. It checks the spec set alone; the
engine's health is `cw doctor`'s.

**row** adds a row at the end of a handoff note's timeline, from the step,
the agent and the result given: its number on from the last row, the date and
time it runs, and its round on from the last row of the same step, the step
matched whatever its case. A row already there is never changed, but the
template's `[placeholder]` row gives way to the first. A note with no
timeline gets one at its end, its row 1 saying the steps before it are not in
it, and a `## Timeline` heading with no table gets its header; nothing else of
the note changes. A `|` or a line break in a cell is kept
from breaking the table. With no note there, a file outside `<spec folder>/handoff/`, or a cell
left out, it changes nothing and exits 1. A note's line endings are kept.

Its tests, beside it:

```bash
node --test .cw/out/script/sdd-specs/specs.test.mjs
```

**ready** lists, in `plan.json` order, every story not `Done` whose
`dependsOn` are all `Done` — the ones that can be built now, side by side.

**report** writes `report.html` into the spec folder: one self-contained page,
no script, light and dark. A column per depth of dependency, a box per story —
`Done` grey with green text, `In Progress` pink with a green dot, ready with a
solid border, waiting dashed — and an arrow from each story to every story
waiting on it. With more than five `Done` stories, all but the five with the
latest evidence date — a story with no evidence date counting as the oldest,
and of one date the later in `plan.json` the later — are one group alone in the
leftmost column, saying how many it holds: folded when the page opens, one
arrow from it to each story depending on any of them; clicking it unfolds
them, clicking again folds them.
A box links to its story in its spec; hovering it shows the full title, status
and dependencies. Below it, the code smell record, `code-smell.json` in the
spec folder: how many files were assessed and good, then each finding by rule,
waiting, skipped or agreed, with its reason; with no record, or one it cannot
read, it says so and the roadmap is drawn as before. The record is only read.
The file is generated, so `report` adds `report.html` to the spec folder's
`.gitignore` when it is not there.

## Report labels

For a non-English **Document language** in the manifest, `report` requires
`--labels <file>` and refuses to overwrite a report without complete labels.
The agent prepares this temporary JSON outside the repository, translated
into the document language. `language` must match the manifest exactly;
`lang` is an HTML language code. `messages` holds every key below (the values
shown are English); placeholders are required unchanged. With no manifest
answer, English is used. Existing story titles and findings are kept.

```json
{
  "language": "English", "lang": "en",
  "messages": {
    "roadmap": "Roadmap", "smells": "Code smells", "todo": "Todo", "done": "Done", "active": "In Progress",
    "ready": "Ready", "blocked": "Waiting", "waiting": "waiting", "skipped": "skipped", "agreed": "agreed",
    "missingStory": "not in the specs", "after": "after {stories}", "group": "{count} done", "aria": "Roadmap of {count} stories",
    "noSmells": "No code smell has been assessed: there is no {path}.",
    "unreadableSmells": "The code smell record {path} could not be read: {why}.",
    "smellCounts": "{files} files assessed, {good} good; findings: {waiting} waiting, {skipped} skipped, {agreed} agreed."
  }
}
```

`doctor` reads `.sdd/settings.local.json` for a nonempty `language`; missing
or unreadable preferences produce only a hint pointing to /sdd-init. It never
reads machine-wide SDD settings or writes personal settings. An absent
**Document language** is accepted as English for older manifests.
