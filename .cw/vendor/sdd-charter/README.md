# SDD Charter

A [Cherry Works](https://github.com/tamnguyenvt/cherry-works) charter for
spec-driven development. Your product is specified in a spec set — an index,
one spec per part, a roadmap of story dependencies — and your coding agent
takes each story from request to `Done`, stopping for your yes at each step,
and lands the work exactly the way you told it to.

## Install

```bash
cw vendor add https://github.com/tamnguyenvt/sdd-charter
cw build
```

Then ask your agent `/sdd-init`. In a repository that already has specs, it
finds them and proposes how they become a spec set. It then asks how you want
work carried out — worktrees, parallel or linear, commits, merge or pull
request — with recommendations drawn from your history, and writes it down.

## Use

| Ask your agent | What it does |
|---|---|
| `/sdd-init` | Surveys the repository, offers to refactor the specs it already has (one big spec, Spec Kit folders, a PRD) into a spec set, asks how work is done and finished, and writes `.sdd/settings.json` and `<specs>/manifest.md`. |
| `/sdd-plan <what you want>` | Clarifies, then writes the phase's stories, FR and SC into the right spec, and their dependencies into `plan.json`. |
| `/sdd-implement` | Draws the roadmap, asks which spec, takes a ready story, then spec gate, test first, verify, review, and marks it `Done`. |
| `/sdd-bug-fix <the bug>` | On a `fix/` branch from your development branch: reproduces the bug with evidence, reports the root cause and the fix for your yes, fixes it test first, reviews, verifies, and finishes into the development branch. |
| `/sdd-status` | Every story with its status, and which can be built now. |
| `/sdd-report` | Draws the roadmap into `report.html`: what is done, in progress, ready and waiting, and what waits on what. |

## The spec set

```text
.sdd/settings.json        { "specFolder": "specs" }
specs/
├── spec.md               index: one row per spec, its prefix and scope
├── spec-core.md          CORE Story 1…, CORE-FR-001…, CORE-SC-001…
├── spec-billing.md       BILLING Story 1…, BILLING-FR-001…
├── plan.json             every story and what it depends on
├── manifest.md           how work is carried out and finished here
└── ADR.md                decisions that shape every later story
```

```markdown
### CORE Story 4 - Reset a password (Priority: P2)

**Status**: Todo
…
1. **Given** a user who forgot it, **When** they ask, **Then** a link is mailed (CORE-FR-012).
```

```json
{ "stories": [
  { "id": "CORE Story 3", "title": "Sign in", "dependsOn": [] },
  { "id": "CORE Story 4", "title": "Reset a password", "dependsOn": ["CORE Story 3"] },
  { "id": "BILLING Story 1", "title": "Pay an invoice", "dependsOn": ["CORE Story 3"] }
] }
```

- **What and why, never how.** How a story is built is decided when it is
  implemented, and lives in the code.
- **Status** sits under each story's heading: `Todo`, `In Progress`, `Done`.
- **Roadmap apart from the prose.** Once CORE Story 3 is `Done`, CORE Story 4
  and BILLING Story 1 are both ready and can be built side by side.
- **Ids are cited, not copied.** When the agent stops with the spec folder
  changed, a hook links every id across files and checks the set against
  `plan.json`, and refuses to stop while either fails.

## What it holds

- Playbooks: `sdd-plan`, `sdd-implement`, `sdd-bug-fix`.
- Skills: `sdd-init`, `sdd-finish`, `sdd-cleanup`, `sdd-status`, `sdd-report`,
  `sdd-analyze`, `sdd-verify`, `sdd-review`, `sdd-learn`.
- Guides: `sdd-spec-format` (on the spec set's files),
  `sdd-learnings-go-to-the-inbox`.
- Sensor `sdd-specs-on-stop`; script `sdd-specs` (`link`, `check`, `ready`, `report`;
  Node 20+, no dependencies); templates `sdd-spec-index`, `sdd-spec`,
  `sdd-manifest`.
