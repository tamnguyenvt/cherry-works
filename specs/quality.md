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

**Date**: 2026-11-11

**Cross-check story**: [CORE Story 43](spec-core.md#core-story-43---quality-cross-check-of-core-story-40-core-story-41-sdk-story-5-core-story-42-sdk-story-6-priority-p3)

**Product grade**: **F** — every test and static check passed twice, but a `Done` scenario is held by a test that asserts its opposite ([CORE Story 48](spec-core.md#core-story-48---decide-where-a-compiled-charter-lands-for-each-agent-priority-p2) scenario 1), and Done scenarios and FR were rewritten after the evidence that proved them.

### Scope and evidence

Read `spec.md`, the three specs, `plan.json`, `ADR.md` and the handoff notes; located the code and tests of every `Done` story, closest for those Done since the last pass: CORE Stories 40–42, 44–49, 52, SDK Stories 5–7, [EVAL Story 8](spec-eval.md#eval-story-8---prove-the-tokenizer-accuracy-priority-p2). [CORE Story 43](spec-core.md#core-story-43---quality-cross-check-of-core-story-40-core-story-41-sdk-story-5-core-story-42-sdk-story-6-priority-p3) was the only story `In Progress` and the only one `ready`.

The baseline first failed on one test, "the engine's contract names each use case as its driver port, and the changelog names the change ([CORE Story 42](spec-core.md#core-story-42---keep-the-engines-architecture-consistent-with-its-charter-priority-p2) scenario 3)": `CHANGELOG.md does not name AuthoringCharter`. The user had that test removed as redundant; [CORE Story 42](spec-core.md#core-story-42---keep-the-engines-architecture-consistent-with-its-charter-priority-p2) scenario 3 stays held by `test/releasing-the-engine.test.ts:299`, `:445`, `:479`, `:511` and `test/importing-the-engine.test.ts:200`. There are no known failures.

| Check | First run | Second run |
|---|---|---|
| `pnpm typecheck` | passed | passed |
| `pnpm test` (dependency rules, Biome, builds, tests) | 895 passed; 0 failed; 3 skipped | 895 passed; 0 failed; 3 skipped |
| `node --test .cw/out/script/sdd-specs/specs.test.mjs .cw/out/script/sdd-clean/clean.test.mjs` | 82 passed; 0 failed | 82 passed; 0 failed |
| `node .cw/out/script/sdd-specs/specs.mjs check` | passed | — |

The three skipped tests are [EVAL Story 8](spec-eval.md#eval-story-8---prove-the-tokenizer-accuracy-priority-p2)'s real-agent journeys (`test/pricing-the-sessions-kept.test.ts:294`, `:325`, `:340`), skipped unless `CW_REAL_AGENT=1`; their recorded run is in `handoff/eval-8.md`, made before [CORE Story 52](spec-core.md#core-story-52---replace-any-store-or-runner-and-find-the-workspace-in-three-parts-priority-p2).

### Results for each checklist item

| Item | Result | Violations |
|---|---|---|
| Every scenario of a `Done` story is held by a test or by its evidence | **fail** | QC-09, QC-08, QC-16 |
| Every test and static check passes twice, none skipped | **fail** | QC-16: three real-agent tests skipped on both runs |
| The code of each `Done` story does what its FR say, and no later change bent one | **fail** | QC-09, QC-10, QC-11 |
| No code beyond the FR, nothing out of scope built | **fail** | QC-08 |
| The code keeps the guides that apply to it | **fail** | QC-15 |
| Consistent | **fail** | QC-12 |
| Complete | **fail** | QC-13 |
| No conflict | **fail** | QC-08, QC-12 |
| Roadmap | **fail** | QC-11, QC-14; `check` passes |
| Format | **fail** | QC-11, QC-13 |

Resolved since the last pass: QC-03, QC-05, QC-07; QC-06 by recorded evidence. QC-01 was resolved, then regressed (QC-11, QC-12); QC-02 is mostly resolved (QC-13); QC-04 holds for the use cases and services, its remainder is in QC-15.

### Violations and proposed repairs for sdd-plan

#### QC-08 — error: the library's exports contradict the requirements

`src/index.ts:3-66`, `:77-95` exports `cw`'s adapters (`FileCharterRepository`, `ClaudeProjection`, `CodexProjection`, `AgentCli`, `ClaudeCli`, `CodexCli`), domain model classes and helpers such as `mergedTomlText`. That matches [SDK-FR-020](spec-sdk.md#sdk-fr-020), added on 2026-11-11, and breaks [SDK-FR-005](spec-sdk.md#sdk-fr-005) and [SDK-FR-002](spec-sdk.md#sdk-fr-002) ("and nothing more"), [CORE-FR-228](spec-core.md#core-fr-228) ("MUST NOT export them"), [CORE Story 52](spec-core.md#core-story-52---replace-any-store-or-runner-and-find-the-workspace-in-three-parts-priority-p2) scenario 3 and the [SDK Story 2](spec-sdk.md#sdk-story-2---import-the-engine-from-the-package-cw-comes-in-priority-p1) narrative (`specs/spec-sdk.md:64`). `test/composing-the-engine-of-two-modules.test.ts:253` requires the exports, against Done [CORE Story 52](spec-core.md#core-story-52---replace-any-store-or-runner-and-find-the-workspace-in-three-parts-priority-p2) scenario 3. The CORE Input (`specs/spec-core.md:7`) still keeps the store, projections and command lines out of the contract, and records no reversal.

Proposed repair: the user decides which rule stands; an SDK story then amends the losing FR, scenarios and Input, and proves the export set by behaviour. Either way the contract changes under [SDK-FR-015](spec-sdk.md#sdk-fr-015).

#### QC-09 — error: the compiled output names its places, and a test asserts it

[CORE-FR-220](spec-core.md#core-fr-220) and [CORE-FR-221](spec-core.md#core-fr-221) say the compiled output names no place, carries its host on each entry, and leaves where an entry lands to the host's projection. `src/module/charter/domain/models/projection/output-part.ts:16-39` fixes each part's path in the domain (`OutputPart.ofPrimitive` answers `${kind}/${id}/index.md`), and neither `OutputPart` nor `CompiledPrimitive` carries a host. `test/laying-a-compiled-charter-onto-each-host.test.ts:63-75` requires a non-empty `path` on every part and checks no host — the opposite of [CORE Story 48](spec-core.md#core-story-48---decide-where-a-compiled-charter-lands-for-each-agent-priority-p2) scenario 1.

Proposed repair: a CORE story gives each entry its host, moves the output path into each projection, and tests scenario 1 as written; or, if the user accepts the current design, it rewords [CORE-FR-220](spec-core.md#core-fr-220) and the scenario.

#### QC-10 — error: not every store and runner can be handed in

[CORE-FR-228](spec-core.md#core-fr-228), [CORE-FR-230](spec-core.md#core-fr-230) and [SDK-FR-020](spec-sdk.md#sdk-fr-020) say every store and runner is handed in. `EngineAdapters` (`src/module/composition.ts:64`) has no place for the sessions store (built at `:161` on `new FileReaders(...)`, ignoring the file reader handed in), the settings store (`:182`) or the local output (`:137`); `composeEngine` (`:114`) takes the repository and home addresses only to build the sessions store. Reproduced: `composeApplications(new URL("memory:/r/"), new URL("memory:/home/"), {})` throws `The URL must be of scheme file`, from the default `Promptfoo` at `composition.ts:234` — against [SDK-FR-003](spec-sdk.md#sdk-fr-003) and [SDK-FR-011](spec-sdk.md#sdk-fr-011); `test/importing-the-engine.test.ts:290` hides it by always handing a runner. `runSensors(…, agentProviderName = "claude")` (`src/module/runtime/app/running-charter.use-case.ts:121`) names an agent provider in the engine, against [CORE-FR-221](spec-core.md#core-fr-221) and [CORE Story 52](spec-core.md#core-story-52---replace-any-store-or-runner-and-find-the-workspace-in-three-parts-priority-p2) scenario 13 (warn).

Proposed repair: a CORE story adds the sessions store, settings store and local output to the adapters, drops the addresses from `composeEngine`, resolves the promptfoo folder at the first evaluation, makes the agent a required argument, and tests composing at `memory:` addresses with nothing handed.

#### QC-11 — error: Done stories, FR and ADRs were rewritten outside a story

Commits 69abd47, 78096e2, bce827c and f6ce4ae (2026-11-10/11) rewrote Done text after its evidence: [SDK Story 2](spec-sdk.md#sdk-story-2---import-the-engine-from-the-package-cw-comes-in-priority-p1) scenarios 1, 2, 4, 8 and a new 9; [SDK Story 4](spec-sdk.md#sdk-story-4---publish-the-engine-with-every-release-priority-p2) scenarios 1–2; [SDK Story 6](spec-sdk.md#sdk-story-6---know-what-to-do-after-a-failed-publication-priority-p2) scenarios 1–3; [CORE Story 13](spec-core.md#core-story-13---install-cw-with-one-command-and-use-it-in-any-repository-priority-p1) scenario 5; [CORE Story 49](spec-core.md#core-story-49---get-answers-made-for-the-caller-priority-p2) scenario 4; [CORE Story 52](spec-core.md#core-story-52---replace-any-store-or-runner-and-find-the-workspace-in-three-parts-priority-p2) scenarios 3, 4, 6; [SDK-FR-001](spec-sdk.md#sdk-fr-001), -002, -003, -005, -006, -009, -013, -016, -019, and added [SDK-FR-020](spec-sdk.md#sdk-fr-020), which no story carries. Their `plan.json` evidence (2026-11-03 to 2026-11-09) proves text that no longer exists. `specs/ADR.md` was rewritten in place — ADR-001's catalogue sentence, ADR-002 reworded, ADR-003 to ADR-015 deleted (they survive in commit 0e3fd85) — against "An ADR is never rewritten" (`sdd-spec-format`); `handoff/core-39.md`, `handoff/core-40.md` and [CORE Story 40](spec-core.md#core-story-40---read-one-consistent-account-of-the-charters-behaviour-priority-p1)'s evidence cite ADRs that no longer exist; the deleted ADR-013 and ADR-015 were the ones recording the workspace layout ([CORE-FR-224](spec-core.md#core-fr-224), [CORE-FR-226](spec-core.md#core-fr-226)) and the replaceable adapters.

Proposed repair: a story carries [SDK-FR-020](spec-sdk.md#sdk-fr-020) and the rewritten scenarios, re-verifies them and refreshes their evidence; restore ADR-003 to ADR-015 as they were written, and add new ADRs, numbered after them, for the one-package library and every later decision.

#### QC-12 — error: older statements contradict CORE Stories 44–52

- CORE Out of Scope `specs/spec-core.md:1686` and the Assumption at `:1631` say the system runs no agent session and manages no worktree, against [EVAL-FR-021](spec-eval.md#eval-fr-021), [CORE-FR-206](spec-core.md#core-fr-206) and [CORE-FR-222](spec-core.md#core-fr-222).
- CORE Out of Scope `:1729` excludes changing a primitive's headers, body or validation rules, against [CORE-FR-075](spec-core.md#core-fr-075) and [CORE-FR-226](spec-core.md#core-fr-226).
- SDK Out of Scope `specs/spec-sdk.md:249`, `:255` exclude rewriting how a charter is read and changing its format, against [CORE-FR-213](spec-core.md#core-fr-213), [CORE-FR-219](spec-core.md#core-fr-219), [CORE-FR-224](spec-core.md#core-fr-224), [CORE-FR-226](spec-core.md#core-fr-226).
- [CORE-FR-044](spec-core.md#core-fr-044), [CORE-FR-002](spec-core.md#core-fr-002) (a lockfile), [CORE-FR-082](spec-core.md#core-fr-082), the Key Entity "Charter root" (`:1521`) and [CORE Story 16](spec-core.md#core-story-16---open-every-primitive-as-it-was-compiled-priority-p1)'s Independent Test (`:413`) put vendors and tests beside the charter, against [CORE-FR-224](spec-core.md#core-fr-224) (`.cw/charter/vendor/`).
- warn: [CORE-FR-002](spec-core.md#core-fr-002), [CORE-FR-003](spec-core.md#core-fr-003), [CORE-FR-141](spec-core.md#core-fr-141), [CORE-SC-043](spec-core.md#core-sc-043) fix a `<kind>/<id>/index.md` layout, against [CORE-FR-213](spec-core.md#core-fr-213); [CORE-FR-139](spec-core.md#core-fr-139), [CORE-FR-145](spec-core.md#core-fr-145), [CORE-FR-159](spec-core.md#core-fr-159), [CORE-FR-166](spec-core.md#core-fr-166) fix paths under `.cw/out/`, against [CORE-FR-220](spec-core.md#core-fr-220); the Assumption at `:1635` (nothing from the home) against [CORE-FR-218](spec-core.md#core-fr-218), [EVAL-FR-009](spec-eval.md#eval-fr-009), [EVAL-FR-032](spec-eval.md#eval-fr-032).
- warn, terms: "agent" / "host" / "agent provider" for one thing; "plugin" for the whole set of adapters and for one agent's; "the log" for `.cw/log/` and for the session log; "store" (CORE) and "storage" (SDK) for one thing; "charter" for the `.cw/charter/` folder and for its primitives alone.

Proposed repair: a CORE story scopes or rewrites each line to the accepted design — `cw`'s own file store and projections where a line is about them — and picks one term per thing.

#### QC-13 — error: requirements not traced, and format faults

- [CORE-FR-022](spec-core.md#core-fr-022), [CORE-FR-056](spec-core.md#core-fr-056), [CORE-FR-095](spec-core.md#core-fr-095), [CORE-FR-100](spec-core.md#core-fr-100), [CORE-FR-102](spec-core.md#core-fr-102), [CORE-FR-105](spec-core.md#core-fr-105), [CORE-FR-111](spec-core.md#core-fr-111), [CORE-FR-138](spec-core.md#core-fr-138) are cited by no story and allow-listed at `test/tracing-every-scenario-to-its-requirement.test.ts:38-49`, so [CORE-SC-057](spec-core.md#core-sc-057) is not met.
- warn: the EVAL edge case "A run stopped halfway" (`specs/spec-eval.md:214`) has no FR; [CORE-SC-007](spec-core.md#core-sc-007) and [CORE-SC-021](spec-core.md#core-sc-021) have no number.
- error: implementation in the spec — `EngineAdapters` in the SDK clarification (`specs/spec-sdk.md:35`); warn: FNV-1a in [CORE-FR-145](spec-core.md#core-fr-145).
- warn, format: CORE's `## Dependencies` section (`:1670`); Key Entities pointing at a data model that does not exist (`:1514`); the story-group guide stops at Story 27 (`:72`); an Assumption naming a task list (`:1621`); a template hint left in SDK Key Entities; the Key Entity "Package" (`:1534`) leaves out the library.

Proposed repair: a CORE story cites each FR from the scenario that proves it, or drops it, answers the edge case, gives the two SC a number, and clears the format faults.

#### QC-14 — error: the roadmap's dependencies are not borne out

`plan.json` has [CORE Story 43](spec-core.md#core-story-43---quality-cross-check-of-core-story-40-core-story-41-sdk-story-5-core-story-42-sdk-story-6-priority-p3) depend on CORE Stories 44–49 and 52, while its title and scenario (`specs/spec-core.md:944`, `:954`) name only CORE Stories 40–42 and SDK Stories 5–6. warn: [CORE Story 52](spec-core.md#core-story-52---replace-any-store-or-runner-and-find-the-workspace-in-three-parts-priority-p2) builds on [CORE-FR-221](spec-core.md#core-fr-221) and [CORE-SC-063](spec-core.md#core-sc-063) from [CORE Story 48](spec-core.md#core-story-48---decide-where-a-compiled-charter-lands-for-each-agent-priority-p2) without depending on it; [CORE Story 48](spec-core.md#core-story-48---decide-where-a-compiled-charter-lands-for-each-agent-priority-p2) scenario 4 cites [CORE-FR-222](spec-core.md#core-fr-222) without depending on [CORE Story 49](spec-core.md#core-story-49---get-answers-made-for-the-caller-priority-p2); [SDK Story 7](spec-sdk.md#sdk-story-7---read-the-releases-conservative-contract-policy-priority-p2), [EVAL Story 8](spec-eval.md#eval-story-8---prove-the-tokenizer-accuracy-priority-p2) and CORE Stories 44–52 are named by no cross-check story; this pass checked them all, as its scope says.

Proposed repair: add the two missing dependencies. No new cross-check story is needed for [SDK Story 7](spec-sdk.md#sdk-story-7---read-the-releases-conservative-contract-policy-priority-p2), [EVAL Story 8](spec-eval.md#eval-story-8---prove-the-tokenizer-accuracy-priority-p2) and CORE Stories 44–52: this pass checked them, and its violations are the repairs above.

#### QC-15 — error: the code breaks the naming and fault guides

- `hexagonal-naming` (bare verbs and nouns as functions): 29 driver-port methods — `list`, `explain`, `add`, `build`, `test`, `call`, `evaluate`, … and nouns such as `kinds`, `tools`, `settings` (`src/module/charter/app/port/in/authoring-charter.port.ts:76`, `:375`; `src/module/charter/app/port/in/building-charter.port.ts:63`, `:70`; `src/module/runtime/app/port/in/running-charter.port.ts:38`; `src/module/workspace/app/port/in/managing-workspace.port.ts:27`); `covers`, `matches` exported from `src/module/charter/domain/libs/globs.lib.ts:15`, `:21`. Renaming the port methods changes the public contract.
- `no-single-word-naming`: about 36 names — `one` (about 25, e.g. `src/module/charter/domain/models/primitive/primitive.ts:48`), `written` (`src/presentation/portal/page/queries.ts:99`), `parsed`, `required`, `listed`, `failed`, `typed`.
- `no-arbitrary-function-split`: `surveyed` (`src/presentation/cli/commands/list.command.ts:75`), `listen` (`src/presentation/portal/portal.server.ts:97`).
- `hexagonal-naming` (files): 19 portal page files PascalCase or with no role (`src/presentation/portal/page/components/PrimitiveForm.tsx`, `page/queries.ts`, …).
- `hexagonal-architecture` (faults): `throw new Error` at `src/module/shared/infra/in-memory/in-memory-file-readers.adapter.ts:100` and `src/presentation/mcp/mcp.server.ts:33`; warn: the bare `DomainFault` raised from the app layer in 9 places (e.g. `src/module/charter/app/authoring-charter.use-case.ts:854`, `src/module/charter/app/services/load-mcp-origins.service.ts:44`); domain faults kept in module fault files (`src/module/charter/domain/models/charter.fault.ts:40-80`, `src/module/workspace/domain/models/workspace.fault.ts:26`).
- warn: free functions in model files (`primitive.ts:55`, `:65`, `:104`, `:134`; `mcp-primitive.ts:14`; `base-primitive.ts:330`); in-memory twins not named for their port (`InMemoryAuthorizing`, `InMemoryLocalRepo`, `InMemoryTokenCounter`, `InMemorySources`, `InMemoryClock`, `InMemoryReporter`); `load-mcp-origins.service.ts:23`, `:52`, `:74` answers shapes of its own and parses without a factory; `architecture-map` names types and methods the code no longer has (`BuildPlan`, `FetchedSource`, `InstalledVendor`, `forgetVendorSource`, `identitiesMentionedIn`).

Proposed repair: the user decides whether port methods follow the verb-first rule; a CORE story then renames and moves what the guides name, and updates `architecture-map` in its source primitive.

#### QC-16 — warn: weak proofs and stale evidence

- Three tests skipped on both runs ([EVAL Story 8](spec-eval.md#eval-story-8---prove-the-tokenizer-accuracy-priority-p2), `CW_REAL_AGENT=1`); the recorded run predates [CORE Story 52](spec-core.md#core-story-52---replace-any-store-or-runner-and-find-the-workspace-in-three-parts-priority-p2).
- Scenarios held only by matching source text: [CORE Story 49](spec-core.md#core-story-49---get-answers-made-for-the-caller-priority-p2) scenario 2 (`test/reaching-the-engine-through-four-applications.test.ts:119`), [CORE Story 52](spec-core.md#core-story-52---replace-any-store-or-runner-and-find-the-workspace-in-three-parts-priority-p2) scenarios 1–2 (`test/composing-the-engine-of-two-modules.test.ts:170`, `:225`); [CORE Story 46](spec-core.md#core-story-46---set-the-engine-up-with-no-address-of-the-machine-priority-p2) scenario 4 has evidence that names no run of every `cw` command at a `file:` address; [CORE Story 52](spec-core.md#core-story-52---replace-any-store-or-runner-and-find-the-workspace-in-three-parts-priority-p2) scenario 13 has no test that the engine names no agent provider (it does, QC-10).
- `scripts/tokenizer-accuracy.ts:83` still filters the old `.cw/eval` path, so it measures `.cw/charter/eval` and `.cw/log` with the charter.
- `contract.d.ts:1` says it was generated by `pnpm release` from the library it published; it was written by hand and nothing is published.

Proposed repair: an EVAL story re-runs the real-agent journeys after [CORE Story 52](spec-core.md#core-story-52---replace-any-store-or-runner-and-find-the-workspace-in-three-parts-priority-p2) and fixes the tokenizer filter; the CORE stories above add behavioural tests for the scenarios named; reword the contract file's header.
