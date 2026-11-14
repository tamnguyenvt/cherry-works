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

**Date**: 2026-11-14

**Cross-check story**: on request, on fix/quality-after-handoff-leftovers (the working tree over 9b0d4b8), the eighth pass since the one that graded C

**Product grade**: **A** — every item passes.

### Scope and evidence

Read `spec.md`, the three specs, `plan.json`, `manifest.md`, `docs/` and the guides; checked the code and tests of every `Done` story against every item, hardest on what this branch changed. Two reviewers each pass, each claude-opus-5-5: the stories against the code, and the guides with the specs against each other. Passes 1 to 7 graded C, C, B, B, B, B and C; what each found was repaired on this branch before the next, among it one fault older than the branch: Codex kept the repository's own hooks under a signal the charter's sensors name, against [CORE-FR-039](spec-core.md#core-fr-039).

| Check | First run | Second run |
|---|---|---|
| `pnpm typecheck` | passed | — |
| `pnpm lint:deps` | no violation (334 modules, 1105 dependencies) | — |
| `pnpm test` (dependency rules, Biome, builds, tests) | 1034 passed; 0 failed; 0 skipped | 1034 passed; 0 failed; 0 skipped |
| `node --test .cw/out/script/sdd-specs/specs.test.mjs .cw/out/script/sdd-clean/clean.test.mjs`, commit signing off for the run | 82 passed; 0 failed | 82 passed; 0 failed |
| `node .cw/out/script/sdd-specs/specs.mjs check` | passed | — |

The vendor script tests failed 17 of 82 with commit signing on, `1Password: failed to fill whole buffer`: they commit in scratch repositories, and the machine's signing agent was locked; with signing off for the run they pass.

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
| Roadmap | **pass** | `check` passes; 69 stories, all `Done`, every one with evidence |
| Format | **pass** | |

### Violations and proposed repairs

None. Of note, not a violation: `contract/composition.d.ts` renames `EngineAdapters.mcpServers` to `mcpServerCaller` and `EngineSettings.enabledAgents` to `agents`, so the next release after 0.9.0 is a major one ([SDK-FR-015](spec-sdk.md#sdk-fr-015)).
