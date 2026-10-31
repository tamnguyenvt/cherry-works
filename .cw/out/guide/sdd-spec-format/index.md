---
kind: guide
id: sdd-spec-format
description: The shape of a spec set — spec.md as index, spec-<key>.md with prefixed ids, plan.json, manifest.md, ADR.md, quality.md — what and why, never how.
globs: ["**/spec.md", "**/spec-*.md", "**/plan.json", "**/manifest.md", "**/ADR.md", "**/quality.md"]
rationale: sdd-concept
---

A repository's specs live in one folder, the one `.sdd/settings.json` names
(`{ "specFolder": "specs" }`); /sdd-init creates both. The folder holds:

| File | What it is |
|---|---|
| `spec.md` | the index: one row per spec — its file, its prefix, what part of the product it covers. No stories. |
| `spec-<key>.md` | one part of the product: what it must do and why. Its ids carry the prefix its key makes, upper-cased without hyphens: `spec-core.md` is `CORE`. |
| `plan.json` | every story of every spec, once, and the stories it depends on: the roadmap; a `Done` story's entry also holds the evidence that proved it. |
| `manifest.md` | how work is carried out and finished here, as the user chose it (/sdd-init). |
| `ADR.md` | the decisions that change how every later story is built or written. |
| `quality.md` | the checklist a quality pass (/sdd-quality) checks the code and the specs against, from [sdd-quality-doc](../../template/sdd-quality-doc/index.md): written by /sdd-init, kept and edited by the project; under `## Last pass` at its end, the report of the last pass, rewritten by each. |
| `report.html` | the roadmap drawn from `plan.json` and the statuses (/sdd-report); generated, never edited, and ignored by the folder's `.gitignore`. |
| `handoff/` | one note per story `In Progress`, `<prefix>-<n>.md`, and per bug fix not yet landed, `fix-<slug>.md`, from [sdd-handoff](../../template/sdd-handoff/index.md): what is done, what remains, the decisions taken, what blocks it — nothing the spec says. Kept once the story is `Done` or the fix lands; committed or ignored as `manifest.md` says. Never linked or checked as a spec. |
| `mockup/` | designs, when there are any. |

A part grows in its own spec, extended in place; a new part gets a new
`spec-<key>.md` from [sdd-spec](../../template/sdd-spec/index.md) and a row in `spec.md`. Split a spec when it
holds two parts a reader would look for separately.

## A spec

Title, `**Created**`, `**Updated**`, `**Input**` (each request appended as
`Then: "…"`); `## Overview`; `## Clarifications` (`### Session yyyy-mm-dd`,
`- Q: … → A: …`); `## User Scenarios & Testing` with its stories, then
`### Edge Cases`; `## Requirements` with `### Functional Requirements` and
`### Key Entities`; `## Success Criteria`; `## Assumptions`; `## Out of Scope`.

```markdown
### CORE Story 7 - Export a report as PDF (Priority: P2)

**Status**: Todo

<the journey in plain language>

**Why this priority**: …

**Independent Test**: …

**Acceptance Scenarios**:

1. **Given** …, **When** …, **Then** … (CORE-FR-031).

---
```

- **Status** sits on its own line right under the heading: `Todo`,
  `In Progress` or `Done`, and nothing else. Never in the heading, so its
  anchor never changes. Only /sdd-implement moves it.
- One story is one reviewable change; a bigger one is split.
- `- **CORE-FR-012**: The system MUST …` — one testable behaviour.
  `- **CORE-SC-004**: …` — a measurable, technology-agnostic outcome.
- Story, FR and SC numbers run once within a spec and are never reused or
  renumbered. A dropped requirement is deleted and every citation fixed.

## plan.json

```json
{
  "stories": [
    { "id": "CORE Story 3", "title": "Sign in", "dependsOn": [],
      "evidence": { "summary": "npm test: 41 pass, 0 fail; signed in by hand as a new user", "date": "2026-10-27" } },
    { "id": "CORE Story 4", "title": "Reset a password", "dependsOn": ["CORE Story 3"] },
    { "id": "BILLING Story 1", "title": "Pay an invoice", "dependsOn": ["CORE Story 3"] }
  ]
}
```

Every story of every spec, once, in the order it is to be built; `title` as
its heading says it; `dependsOn` the stories that must be `Done` first, in any
spec. No status here — the spec's status line is the one. `evidence` is set
by /sdd-implement when it sets the story `Done`: one line of what /sdd-verify
ran and what it showed, and the date it was produced. A story set back from
`Done` loses its evidence. Stories whose dependencies are all `Done` can be
built side by side: `ready` of [sdd-specs](../../script/sdd-specs/index.md) lists them.

## Citing

Cite by id, as plain text: CORE-FR-012, CORE-SC-004, CORE Story 3 scenario 2,
from any file of the folder. Never restate a requirement elsewhere.
[sdd-specs](../../script/sdd-specs/index.md) links each id to where it is defined, across files, when the
agent stops ([sdd-specs-on-stop](../../sensor/sdd-specs-on-stop/index.md)). Never hand-edit a generated link or
`<a id>` anchor.

## ADR.md

One `## ADR-<nnn>: <decision>` per decision that changes how every later story
is built or written — a model dropped, a naming rule, a breaking format —
numbered once, with **Decision**, **Why** (short, plain) and
**Consequences**, and a line citing the story and FR it came from. A decision
one story alone needs stays in the code. An ADR is never rewritten; a reversal
is a new one that says which it replaces.

## Never in a spec

File names, class names, libraries, endpoints, schemas, task lists. How a
story is built is decided when it is implemented and lives in the code. At
most three `[NEEDS CLARIFICATION: …]` markers at a time; the clarify step of /sdd-plan resolves
them before the story they block is implemented.

<!-- Generated by cherry-works. Do not edit; edit the charter and build again. -->
