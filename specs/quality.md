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
concatenation". The quality pass writes its report under `## Last pass

**Date**: 2026-11-13

**Cross-check story**: on request, on fix/quality-warns-after-core-55 (the working tree over 7bf015f), after it repaired the last pass's violations

**Product grade**: **B** — no error; three warnings: two ideas with several terms, `cw context` listing every agent where [EVAL-FR-001](spec-eval.md#eval-fr-001) speaks of one, and [CORE Story 55](spec-core.md#core-story-55---quality-cross-check-of-sdk-story-8-core-story-53-sdk-story-10-core-story-56-eval-story-9-priority-p3) too large. The pass first found C; the fix repaired on its branch the one error and the four warnings it had brought (QC-30, QC-31, QC-32, QC-35, QC-36), and the checks were run again.

### Scope and evidence

Read `spec.md`, the three specs, `plan.json`, `manifest.md`, `docs/reference.md`, `docs/architecture-note.md`, `docs/ADR.md` and the guides; checked the code and tests of every `Done` story against every item, hardest on what the fix changed. Two reviewers, each claude-opus-5-5: the stories against the code, and the guides with the specs against each other (/sdd-analyze).

| Check | First run | Second run |
|---|---|---|
| `pnpm typecheck` | passed | — |
| `pnpm lint:deps` | no violation (334 modules, 1105 dependencies) | — |
| `pnpm test` (dependency rules, Biome, builds, tests), after the repairs | 1026 passed; 0 failed; 0 skipped | 1026 passed; 0 failed; 0 skipped |
| `node --test .cw/out/script/sdd-specs/specs.test.mjs .cw/out/script/sdd-clean/clean.test.mjs`, after the repairs | 81 passed; 1 failed, its name not kept | 82 passed; 0 failed, and in four runs more |
| `node .cw/out/script/sdd-specs/specs.mjs check` | passed | — |

The last pass's QC-25 to QC-29 are repaired: every refusal of an exact count says `cw context` with no agent named needs nothing, and `--agent` alone counts exactly (`src/module/runtime/app/running-charter.use-case.ts:241-259`, `src/presentation/cli/commands/context.command.ts:41-43`); the architecture map names every driven-port operation, beside its port; no binding holding an `AgentProvider` is named `agent`; the note on file names follows the guide.

### Results for each checklist item

| Item | Result | Violations |
|---|---|---|
| Every scenario of a `Done` story is held by a test or by its evidence | **pass** | QC-36 repaired |
| Every test and static check passes twice, none skipped | **pass** | the vendor's script tests failed once in six runs, and not in the five after |
| The code of each `Done` story does what its FR say | **pass** | |
| No code beyond the FR, nothing out of scope built | **pass** | |
| The code keeps the guides that apply to it | **pass** | |
| Consistent | **fail** | QC-33, QC-34 (warn); QC-32 repaired |
| Complete | **pass** | |
| No conflict | **pass** | QC-35 repaired |
| Roadmap | **fail** | QC-37 (warn); QC-36 repaired; `check` passes; 69 stories, all `Done` |
| Format | **pass** | QC-30, QC-31 repaired |

### Violations and proposed repairs

#### QC-30 — error: the core spec's **Input** names classes and fields

The last `Then:` of `spec-core.md:7` names `CharterRoot.charterPlace`, `charterPath` and `AgentProvider`; the spec format lets an **Input** name commands, flags and output, never a class or a field.

Proposed repair: say it as behaviour — the store says where the charter is edited, and every agent's files say that place; every value naming an agent is named for it.

Repaired: the `Then:` says it as behaviour.

#### QC-31 — warn: the core spec's **Input** cites ids a later pass overwrites

The same `Then:` cites "QC-25 to QC-29", ids of this file's `## Last pass`, which the next pass replaces.

Proposed repair: say what was repaired, never the QC ids.

Repaired: the `Then:` cites no QC id.

#### QC-32 — warn: one refusal said three ways

The refusal of an exact count reads "the estimate, with no agent named, needs nothing" in [EVAL-FR-004](spec-eval.md#eval-fr-004) (`spec-eval.md:230`), "the estimate needs nothing" in an edge case (`spec-eval.md:210`), and "`cw context` with no agent named needs nothing" in [CORE Story 55](spec-core.md#core-story-55---quality-cross-check-of-sdk-story-8-core-story-53-sdk-story-10-core-story-56-eval-story-9-priority-p3) scenario 36 (`spec-core.md:1182`).

Proposed repair: one wording in all three, the one the command prints.

Repaired: all three say `cw context` with no agent named needs nothing.

#### QC-33 — warn: two ideas with several terms

The agents a repository has are "configured" ([EVAL-FR-033](spec-eval.md#eval-fr-033) to [EVAL-FR-036](spec-eval.md#eval-fr-036), `spec-eval.md:261-264`), "chosen" ([CORE-FR-055](spec-core.md#core-fr-055), `spec-core.md:1399`) and those "the repository compiles for" ([EVAL-FR-004](spec-eval.md#eval-fr-004)); the agent given by `--agent` is "selected" ([EVAL-FR-033](spec-eval.md#eval-fr-033) to [EVAL-FR-038](spec-eval.md#eval-fr-038)) and "named" ([EVAL-FR-004](spec-eval.md#eval-fr-004)).

Proposed repair: one term each, "chosen" and "named", in every spec.

#### QC-34 — warn: `cw context` lists every agent where EVAL-FR-001 speaks of one

[EVAL-FR-001](spec-eval.md#eval-fr-001) and the Key Entity "Prediction" speak of "the agent's main context"; `cw context` lists one prediction per agent chosen (`src/presentation/cli/commands/context.command.ts:20-25`), as `docs/reference.md:255` says, and with none chosen tells the developer to run `cw init` (`context.command.ts:107`), which no FR or edge case answers.

Proposed repair: [EVAL-FR-001](spec-eval.md#eval-fr-001) predicts for each agent the repository chose; an edge case for a repository that chose none.

#### QC-35 — warn: one scenario read two ways

"no agent is asked" in [CORE Story 55](spec-core.md#core-story-55---quality-cross-check-of-sdk-story-8-core-story-53-sdk-story-10-core-story-56-eval-story-9-priority-p3) scenario 35 (`spec-core.md:1181`) reads as no agent's command line run, or as the developer not asked to choose one, against "When no agent is chosen, stop and ask" (`spec-core.md:7`).

Proposed repair: "no agent's command line is run".

Repaired: "no agent's command line is run", the test's name with it.

#### QC-36 — warn: evidence names a command that no longer runs

The evidence of [EVAL Story 8](spec-eval.md#eval-story-8---prove-the-tokenizer-accuracy-priority-p2), [EVAL Story 9](spec-eval.md#eval-story-9---measure-the-tokenizer-accuracy-again-after-the-workspace-moved-priority-p3) and [CORE Story 55](spec-core.md#core-story-55---quality-cross-check-of-sdk-story-8-core-story-53-sdk-story-10-core-story-56-eval-story-9-priority-p3) (`plan.json:522`, `:674`, `:689`) names the run `cw context --exact --agent=claude`, which the command line now refuses as an unknown argument; [CORE Story 55](spec-core.md#core-story-55---quality-cross-check-of-sdk-story-8-core-story-53-sdk-story-10-core-story-56-eval-story-9-priority-p3)'s says "scenarios 2-35", while scenarios 34-36 were rewritten or added after it (each held by a test, `test/predicting-the-main-context.test.ts:256-374`).

Proposed repair: run `cw context --agent=claude` again and record it as the evidence of the three stories, scenarios 34-36 named.

Repaired, by the user's choice without running `claude` again: the three summaries keep the +0.8% measured at 09:05Z and say the count is now run as `cw context --agent=claude`; [CORE Story 55](spec-core.md#core-story-55---quality-cross-check-of-sdk-story-8-core-story-53-sdk-story-10-core-story-56-eval-story-9-priority-p3)'s names scenarios 34-36 and the tests holding them.

#### QC-37 — warn: CORE Story 55 is too large to review as one change

[CORE Story 55](spec-core.md#core-story-55---quality-cross-check-of-sdk-story-8-core-story-53-sdk-story-10-core-story-56-eval-story-9-priority-p3) holds 36 scenarios (`spec-core.md:1135`).

Proposed repair: the repairs of a later pass go into a story of their own.
