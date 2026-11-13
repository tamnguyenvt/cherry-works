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
concatenation". The quality pass writes its report under `## Last pass` below
this comment; leave that section to it. -->

## Last pass

**Date**: 2026-11-13

**Cross-check story**: [CORE Story 55](spec-core.md#core-story-55---quality-cross-check-of-sdk-story-8-core-story-53-sdk-story-10-core-story-56-eval-story-9-priority-p3)

**Product grade**: **B** — the third pass found no error and fifteen warnings; every check passed twice with none skipped. The warnings were repaired after it, as the scenarios of [CORE Story 55](spec-core.md#core-story-55---quality-cross-check-of-sdk-story-8-core-story-53-sdk-story-10-core-story-56-eval-story-9-priority-p3) say, and proved by the checks and a review, not by a fourth pass.

### How the pass ran

The user had every violation repaired within [CORE Story 55](spec-core.md#core-story-55---quality-cross-check-of-sdk-story-8-core-story-53-sdk-story-10-core-story-56-eval-story-9-priority-p3) rather than written as stories of their own, and the pass run again: its scenarios 2–35 are those repairs.

- **First pass** (five reviewers): grade F — QC-17 to QC-24 below. The baseline's flaky naming test was fixed first, `fix/probe-file-race-in-src`, landed in `008-sdk` as 6d71f9a.
- **Second pass** (four reviewers): QC-17 to QC-21 resolved; two errors left in the guides — a bare-named `schema.ts` and DTO files reaching the whole kernel — with warnings; all repaired.
- **Third pass** (two reviewers, at 9882351): no error; fifteen warnings, each repaired after it (below).

### Scope and evidence

Read `spec.md`, the three specs, `plan.json`, `docs/ADR.md`, `docs/architecture-note.md` and the handoff notes; checked the code and tests of every `Done` story against every item. Each reviewer was claude-opus-5-5.

| Check | First run | Second run |
|---|---|---|
| `pnpm typecheck` | passed | passed |
| `pnpm lint:deps` | no violation | — |
| `pnpm test` (dependency rules, Biome, builds, tests) | 1023 passed; 0 failed; 0 skipped | 1023 passed; 0 failed; 0 skipped |
| `node --test .cw/out/script/sdd-specs/specs.test.mjs .cw/out/script/sdd-clean/clean.test.mjs` | 82 passed; 0 failed | 82 passed; 0 failed |
| `node .cw/out/script/sdd-specs/specs.mjs check` | passed | — |
| `cw context --exact --agent=claude` ([EVAL-SC-002](spec-eval.md#eval-sc-002), the real `claude`) | estimated 5,847, exact 5,800, +0.8%, within 15% | — |

`test/keeping-a-credential.test.ts` skips where the machine has no credential store; it ran on this one.

### Results for each checklist item

| Item | Third pass | After its repairs |
|---|---|---|
| Every scenario of a `Done` story is held by a test or by its evidence | warn: braces, scenario labels, export guard by folder | pass |
| Every test and static check passes twice, none skipped | pass | pass |
| The code of each `Done` story does what its FR say | warn: an optional folder reader, faults naming `cw`'s layout, other repositories' sessions folders | pass |
| No code beyond the FR, nothing out of scope built | pass | pass |
| The code keeps the guides that apply to it | warn: map omitting the layout values, promptfoo port words, three single names, "host" and "built output" left in code | pass |
| Consistent | warn: a missing file in the note, "the output", the settings module's name | pass |
| Complete | pass | pass |
| No conflict | pass | pass |
| Roadmap | pass | pass |
| Format | warn: ADR-001 cites no story | accepted: an ADR cites no spec, the user's rule |

### What the passes found, and how each was repaired

- **QC-17 — Done scenarios nothing proved**: six scenarios with no test and some seventy held in part; tests added for each, labels corrected ([CORE Story 55](spec-core.md#core-story-55---quality-cross-check-of-sdk-story-8-core-story-53-sdk-story-10-core-story-56-eval-story-9-priority-p3) scenarios 2–11).
- **QC-18 — tests and scenarios saying opposite things**: [CORE-FR-028](spec-core.md#core-fr-028) rewritten to the listing the user kept; CORE Stories 3, 6, 17, 27, 48 rewritten to their FR, with tests (scenarios 12–16).
- **QC-19 — exports beyond the FR**: the store's layout one value, `charterPath`, as `outputPath` is; no loose constant or helper exported; projections told where the charter is edited by the store (`describeCharterPlace`) (scenarios 23–25). No CHANGELOG line: nothing is published under the contract yet.
- **QC-20 — sessions ignoring the handed file adapters**: the default sessions store reads through them, a scheme no adapter reads answers a fault the caller corrects, every handed adapter is reached per operation (scenarios 26–28).
- **QC-21 — evaluation beyond its FR**: kept, with [EVAL-FR-039](spec-eval.md#eval-fr-039) to [EVAL-FR-042](spec-eval.md#eval-fr-042); a read path's control characters and braces refused, a sessions folder inside this repository refused (scenarios 29–33).
- **QC-22 — naming guides**: the guard widened (vague words, yes/no, counts, bare verbs, model functions and interfaces, private constructors, double imports, scripts and `main.ts`) and the code brought to it (scenarios 17–19).
- **QC-23, QC-24 — spec format and terms**: requirements state behaviour; one term per thing, with Engine, Workspace, Local output defined and the retired terms refused by test (scenarios 20–22).
- **Second and third passes**: zod reached only through the kernel's validator lib; the libraries in the kernel; a DTO-only kernel entry; `EvalCase` and `SessionAnalysisLine` value objects; `VendorSourcePath` kept off the package; `removeWorktree` refusing any folder but a named one under the worktrees folder; the promptfoo port in promptfoo's words; "host" and "built output" retired from code; faults naming no folder of `cw`'s.
- **The estimate's accuracy** ([EVAL Story 9](spec-eval.md#eval-story-9---measure-the-tokenizer-accuracy-again-after-the-workspace-moved-priority-p3)): measured by `cw context --exact --agent=<agent>`, which estimates and counts exactly, lists both and warns past 15%; no agent named is refused (scenarios 34–35). The repository's own measuring script is gone.

### Plan the fixes

None: every violation was repaired within [CORE Story 55](spec-core.md#core-story-55---quality-cross-check-of-sdk-story-8-core-story-53-sdk-story-10-core-story-56-eval-story-9-priority-p3), at the user's choice.
