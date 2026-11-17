# Quality

The checklist /sdd-quality checks against, item by item. Add, change or drop
items as this project needs; each must be one a pass can find passing or
failing.

## Code against the stories

- Every scenario of a `Done` story is held by a test that would fail without
  it, or by the run its evidence in `plan.json` names.
- Every test and static check the project defines passes, twice in a row,
  none skipped.
- The code of each `Done` story does what its FR say, and no later change
  bent an FR it cites.
- No code does what no FR asks for, and nothing an out of scope excludes is
  built.
- The code keeps the guides that apply to it.

## Specs against each other

- **Consistent** — a term means one thing in every spec, and one thing has
  one term.
- **Complete** — every FR is cited by a story, every scenario cites an FR or
  SC and can be tested, every edge case is answered by an FR, every SC has a
  number to measure.
- **No conflict** — no two FR, stories, clarifications, assumptions or out
  of scope lines contradict each other, in one spec or across specs.
- **Roadmap** — every dependency in `plan.json` is borne out by the stories,
  and `check` passes.
- **Format** — every spec keeps the spec format of the charter's
  `sdd-spec-format` guide.

<!-- Add the checks this project needs, under either heading or one of your
own: one line each, something a pass can find passing or failing — "Every
endpoint checks the caller's role", "No query is built by string
concatenation". The quality pass writes its report in the last-pass section
below this comment; leave that section to it. -->

## Last pass

**Date**: 2026-11-16

**Cross-check story**: [CORE Story 71](spec-core.md#core-story-71---quality-cross-check-of-core-story-57-core-story-67-core-story-68-core-story-69-core-story-70-priority-p3), on task/core-71-quality-cross-check (the working tree over 619fd82), the third pass

**Product grade**: **A** — every item passes.

### Scope and evidence

Read `spec.md`, the three specs, `plan.json`, `manifest.md`, `docs/` and the guides; checked the code and tests of every `Done` story against every item, hardest on [CORE Story 57](spec-core.md#core-story-57---read-every-value-of-the-charters-rules-by-what-it-holds-priority-p2) (3bf0f945) and Stories 67 to 70 (`55cd8ef..619fd82`). Each pass had two reviewers, each claude-opus-5-5: the stories against the code, and the guides with the specs against each other. Pass 1 graded D, pass 2 C; what each found was repaired in this story before the next, as the assumption on cross-checks from [CORE Story 55](spec-core.md#core-story-55---quality-cross-check-of-sdk-story-8-core-story-53-sdk-story-10-core-story-56-eval-story-9-priority-p3) on says.

| Check | First run | Second run |
|---|---|---|
| `pnpm typecheck` | passed | — |
| `pnpm lint:deps` | no violation (339 modules, 1122 dependencies) | no violation |
| `pnpm test` (dependency rules, Biome, builds, tests) | 1079 passed; 0 failed; 0 skipped | 1079 passed; 0 failed; 0 skipped |
| `node --test .cw/out/script/sdd-specs/specs.test.mjs .cw/out/script/sdd-clean/clean.test.mjs`, commit signing off for the run | 83 passed; 0 failed | 83 passed; 0 failed |
| `node .cw/out/script/sdd-specs/specs.mjs check` | passed | — |

### Results for each checklist item

| Item | Result | Violations |
|---|---|---|
| Every scenario of a `Done` story is held by a test or by its evidence | **pass** | |
| Every test and static check passes twice, none skipped | **pass** | |
| The code of each `Done` story does what its FR say | **pass** | |
| No code beyond the FR, nothing out of scope built | **pass** | |
| The code keeps the guides that apply to it | **pass** | |
| Consistent | **pass** | |
| Complete | **pass** | |
| No conflict | **pass** | |
| Roadmap | **pass** | `check` passes; 70 stories `Done`, [CORE Story 71](spec-core.md#core-story-71---quality-cross-check-of-core-story-57-core-story-67-core-story-68-core-story-69-core-story-70-priority-p3) `In Progress` |
| Format | **pass** | |

### Violations and proposed repairs

None left. Repaired in this story:

- Pass 1, [CORE-FR-237](spec-core.md#core-fr-237): `cw init`, `cw test`, `cw eval` and `cw vendor init` printed a path in plain words; each is set apart now, each held by a test. Pass 2 found the same of the address and ids `cw mcp auth` prints while it asks, and review of that the address it asks to open; they are set apart now, written as an answer is, in colour only at a terminal with no `NO_COLOR` ([CORE-FR-238](spec-core.md#core-fr-238)).
- Pass 1, specs: [CORE Story 71](spec-core.md#core-story-71---quality-cross-check-of-core-story-57-core-story-67-core-story-68-core-story-69-core-story-70-priority-p3) scenario 1 against the assumption on cross-checks; [CORE-FR-175](spec-core.md#core-fr-175) and its edge case against [CORE-FR-244](spec-core.md#core-fr-244); the lead of User Scenarios naming stories that do not exist. Each is written to agree.
- Pass 1, warnings: the help wraps by `layAnswerRows`; the architecture-map guide names `rewriteDeprecatedSensorHooks`; `cw mcp auth`'s stopped-prompt fault is built in the command; two edge cases read one way and are answered by the FR they cite; [CORE Story 69](spec-core.md#core-story-69---find-authoring-and-running-apart-among-cws-commands-priority-p2) scenario 2 cites the portal's FR; the clarifications name the commands' new names; [CORE-FR-238](spec-core.md#core-fr-238) says answers off a terminal wrap at 80 columns.

Of note, not a violation: `McpPrimitive.activatesWhen` in `contract/charter.d.ts` now names `cw run mcp`; no name of the contract changes, the text an integrator reads does, for the next release's notes. Globs and the header values `cw explain` declares are printed as written: they are neither ids nor paths.
