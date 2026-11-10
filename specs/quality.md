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

**Date**: 2026-11-03

**Cross-check story**: [CORE Story 39](spec-core.md#core-story-39---quality-cross-check-of-core-story-35-core-story-37-core-story-38-sdk-story-1-priority-p3)

**Product grade**: **F** — all automated checks passed twice, but some Done scenarios remain unproven and current requirements contradict each other. This is the product's checklist grade, not a failing test-suite result.

### Scope and evidence

Read all three specs, their index, roadmap, ADRs and existing handoffs; located the code and tests for all 48 Done stories: 37 CORE, 7 EVAL and 4 SDK. At the time of the pass, [CORE Story 39](spec-core.md#core-story-39---quality-cross-check-of-core-story-35-core-story-37-core-story-38-sdk-story-1-priority-p3) was the only In Progress story, there were no Todo stories, and `ready` listed only [CORE Story 39](spec-core.md#core-story-39---quality-cross-check-of-core-story-35-core-story-37-core-story-38-sdk-story-1-priority-p3). The baseline recorded as passed by Claude was not repeated. The runs below are fresh quality-pass evidence produced after the user accepted its scope.

| Check | First run | Second run |
|---|---|---|
| `pnpm typecheck` | Both TypeScript configurations passed | Both TypeScript configurations passed |
| `pnpm test` | 816 passed; 0 failed; 0 skipped; 0 cancelled | 816 passed; 0 failed; 0 skipped; 0 cancelled |
| Dependency rules and CLI, portal and engine builds, called by `pnpm test` | Passed | Passed |
| `node --test .cw/out/script/sdd-specs/specs.test.mjs .cw/out/script/sdd-clean/clean.test.mjs` | 58 passed; 0 failed; 0 skipped; 0 cancelled | 58 passed; 0 failed; 0 skipped; 0 cancelled |

`node .cw/out/script/sdd-specs/specs.mjs check` passed; `ready` and `report` ran successfully. Read stdout and stderr from the checks. No execution errors occurred outside the deliberately reproduced refusals described below. There are no known baseline failures. Temporary logs are outside the repository: `/tmp/cw-core39-typecheck-{1,2}.log`, `/tmp/cw-core39-test-{1,2}.log` and `/tmp/cw-core39-scripts-{1,2}.log`. This report preserves the results even if those temporary logs are removed.

### Results for each checklist item

| Item | Result | Evidence |
|---|---|---|
| Every Done scenario has a test that distinguishes its behaviour or a run recorded in its evidence | **fail** | QC-01: older scenarios contradict newer behaviour. QC-06: skill-text tests do not prove the pricing result when the skill is used. |
| Every test and static check passes twice, with none skipped | **pass** | Two runs of 816 tests, two runs of 58 script tests, typecheck, dependency rules and builds above. |
| Done code keeps its FR, including after subsequent changes | **fail** | QC-05: the joint-publication promise does not describe failure between publications. QC-07: the spec does not state the accepted conservative declaration-comparison policy. |
| No functionality is outside the FR or excluded by scope | **fail** | QC-01: binary assets, skill asset folders and model-invocation restrictions are implemented while older out-of-scope statements still exclude them. Reconcile scope with the accepted decisions. |
| Code follows its applicable guides | **fail** | QC-03: fault contracts differ from the guide. QC-04: use-case/service names and structure differ from current guidance. Dependency checks alone do not establish compliance. |
| Consistent: each concept has one term | **fail** | QC-01: older scenarios name `catalog.json`, while output uses `catalogue.json`; health reporting is described as four answers in some places and three elsewhere. |
| Complete: stories cite FR, scenarios cite FR/SC, edge cases have an FR, and SC are measurable | **fail** | QC-02: 146 CORE scenarios lack FR/SC citations and 153 CORE FR had no direct citation in any spec's story section at the time of the pass. QC-01's conflicting edge cases have no consistent answer. SC have measurable quantities or targets; QC-06 separately records missing measurement evidence. |
| No conflict between FR, stories, clarifications, assumptions or scope | **fail** | QC-01, QC-03 and QC-05. Historical EVAL answers explicitly recorded as superseded are not treated as conflicts. |
| Roadmap dependencies are justified and `check` passes | **pass** | Compared dependencies with the stories; found no missing mandatory dependency or unnecessary dependency preventing an existing story from starting. `check` passed. |
| Specs follow the charter's format | **fail** | QC-02: scenarios lack FR/SC citations. Status lines, identifiers, roadmap entries and handoffs pass the structural check. |

### Violations and proposed repairs for sdd-plan

#### QC-01 — error: older specification statements retain superseded decisions

The locations below record the files as inspected during the quality pass; subsequent planning edits can move their line numbers.

- `specs/spec-core.md:253`: [CORE Story 6](spec-core.md#core-story-6---author-edit-and-delete-a-primitive-without-looking-anything-up-priority-p2) scenario 2 still refuses a guide without globs, contradicting the clarification at line 33 and the behaviour held by `test/checking-a-repository.test.ts:235`.
- `specs/spec-core.md:268`, `:279`, `:1224`: [CORE Story 7](spec-core.md#core-story-7---build-preview-and-check-the-repositorys-health-priority-p3) and [CORE-FR-121](spec-core.md#core-fr-121) still require four health answers, including vendors, contradicting [CORE-FR-080](spec-core.md#core-fr-080) and ADR-004. `src/hexagon/application/CharterAuthoring.ts:136` and `test/checking-a-repository.test.ts:95` hold the three-answer behaviour.
- `specs/spec-core.md:680`: [CORE Story 26](spec-core.md#core-story-26---invoke-a-skill-by-its-id-alone-priority-p2) scenario 2 still builds a guide and skill sharing one id into two files, contradicting [CORE Story 27](spec-core.md#core-story-27---name-every-primitive-by-its-id-alone-priority-p1) scenario 1 and [CORE-FR-015](spec-core.md#core-fr-015). `test/validating-a-charter.test.ts:108` holds the collision rule.
- `specs/spec-core.md:941`: an edge case still merges mixin headers, contradicting [CORE-FR-006](spec-core.md#core-fr-006). The current rule lends bodies only.
- `specs/spec-core.md:992`: an edge case says no MCP configuration is written without an mcp primitive, contradicting [CORE-FR-146](spec-core.md#core-fr-146) and [CORE Story 17](spec-core.md#core-story-17---declare-where-knowledge-lives-once-and-point-any-primitive-at-it-priority-p1) scenario 6. `src/hexagon/domain/services/compile/claudeComponentFactory.ts:48` and surface tests retain the single server entry.
- `specs/spec-core.md:1515`, `:1517`, `:1519`: out-of-scope statements still exclude skill asset folders, binary script assets and withholding skills from the model, contradicting [CORE Story 23](spec-core.md#core-story-23---keep-every-primitive-as-a-folder-with-its-indexmd-and-its-assets-priority-p1), [CORE Story 31](spec-core.md#core-story-31---keep-a-skill-out-of-the-agents-own-reach-priority-p2), [CORE Story 38](spec-core.md#core-story-38---keep-a-binary-asset-whole-priority-p2), [CORE-FR-168](spec-core.md#core-fr-168), [CORE-FR-182](spec-core.md#core-fr-182) and [CORE-FR-207](spec-core.md#core-fr-207). `test/building-scripts-and-templates.test.ts:71`, `test/compiling-the-claude-surface.test.ts:293` and `test/keeping-a-binary-asset-whole.test.ts:65` prove the implemented features.
- `specs/spec-core.md:534`, `:535`, `:1265`, `:1267` and the edge case at line 984 still describe reaching or starting an upstream origin when the server starts, contradicting [EVAL-FR-031](spec-eval.md#eval-fr-031) and `specs/spec-eval.md:221`: the server lists saved tools and connects for a call. `test/serving-the-mcp-origins.test.ts:118` proves listing makes no upstream connection.
- [CORE Story 16](spec-core.md#core-story-16---open-every-primitive-as-it-was-compiled-priority-p1), [CORE Story 21](spec-core.md#core-story-21---keep-a-script-or-a-template-in-the-charter-and-get-the-file-it-is-priority-p1) and older clarifications still name `catalog.json`, whereas `src/hexagon/domain/models/output/common/Catalogue.ts:25` writes `catalogue.json`. ADR-001 at `specs/ADR.md:18` also says the catalogue contains only kind and id, contradicting [CORE-FR-025](spec-core.md#core-fr-025). ADRs are immutable: supersede the statement in a new ADR rather than rewriting ADR-001.

Proposed repair: a CORE story reconciles superseded statements with accepted FR and clarifications, uses one catalogue name and records a superseding ADR where needed. Preserve the newer decisions rather than changing code back to older behaviour. Then compare tests with the reconciled scenarios.

#### QC-02 — error: scenarios do not trace to their requirements

`specs/spec-core.md:151` begins older acceptance scenarios without FR/SC citations. Counting the `User Scenarios & Testing` section up to `Edge Cases` finds 146 such scenarios, including [CORE Story 39](spec-core.md#core-story-39---quality-cross-check-of-core-story-35-core-story-37-core-story-38-sdk-story-1-priority-p3)'s own scenario. Comparing the story sections of all three specs with CORE FR definitions finds 153 FR without a direct story citation at the time of the pass, including [CORE-FR-001](spec-core.md#core-fr-001), [CORE-FR-006](spec-core.md#core-fr-006), [CORE-FR-009](spec-core.md#core-fr-009) and [CORE-FR-134](spec-core.md#core-fr-134). An FR citing another FR does not count as a story citation. `check` validates citations that exist, so it still passes.

Proposed repair: a CORE story adds behaviourally relevant FR/SC citations to existing scenarios and traces every FR and edge case without renumbering ids or inventing requirements to fit the code. Clarify scenarios lacking a supporting requirement. Keep [CORE Story 39](spec-core.md#core-story-39---quality-cross-check-of-core-story-35-core-story-37-core-story-38-sdk-story-1-priority-p3) In Progress while planning; do not rewrite its content beyond the playbook's permitted exceptions.

#### QC-03 — error: the SDK fault contract conflicts with current guidance

At the time of the pass, [SDK Story 2](spec-sdk.md#sdk-story-2---import-the-engine-from-the-package-cw-comes-in-priority-p1) scenario 5, [SDK-FR-004](spec-sdk.md#sdk-fr-004) and the contract accepted under [SDK-FR-004](spec-sdk.md#sdk-fr-004) for [SDK Story 2](spec-sdk.md#sdk-story-2---import-the-engine-from-the-package-cw-comes-in-priority-p1) required exported, raised faults carrying message/fix. `src/hexagon/port/driver/ForManagingCharter.ts:8` re-exports DomainFault; `test/importing-the-engine.test.ts:90` checks that consumers can catch it. Conversely, the Faults section of `hexagonal-naming` forbids fault classes crossing a driver port and requires use cases to return fault DTOs, conceal internal details and log through a port. `src/hexagon/domain/models/DomainFault.ts:15` has no internal flag; `src/hexagon/application/dtos.ts:105` returns message/fix/severity directly. `src/driver/portal/routes.ts:42` translates faults in the driver, while line 53 returns the message of an unrecognised error.

Proposed repair at the time of the pass: an SDK story settles the boundary between integrator exceptions and CLI/HTTP DTOs, including internal-error logging and concealment. Obtain the user's contract decision rather than silently changing the public SDK or adjusting guidance to legitimise the code. Charter changes must be made in source primitives and followed by `cw build`. This is a verified contract conflict, not evidence that an actual secret was exposed. The subsequent user decision is recorded below.

#### QC-04 — error: use-case/service structure differs from the naming and service guides

`hexagonal-naming` requires a use case to take its driver port's noun, and a service to be a stateless object whose name begins with a verb and ends with `Service`. Functions outside domain models and DTO makers begin with a verb and name their object. `src/hexagon/application/CharterAuthoring.ts:67` declares CharterAuthoring implements ForManagingCharter. `src/hexagon/service/buildService.ts:53` exports the bare verb `plan`; `src/hexagon/domain/services/compile/compileService.ts:48` exports the bare verb `compile`. Existing services export standalone functions in `charterRepo`, `vendorRepo` and `buildService`, instead of the prescribed object form. `architecture-map` describes the older form, so the guides also disagree. Relevant stories and requirements: [CORE Story 1](spec-core.md#core-story-1---author-a-charter-and-put-the-agent-under-it-priority-p1), [CORE Story 7](spec-core.md#core-story-7---build-preview-and-check-the-repositorys-health-priority-p3), [SDK Story 2](spec-sdk.md#sdk-story-2---import-the-engine-from-the-package-cw-comes-in-priority-p1), [SDK-FR-002](spec-sdk.md#sdk-fr-002) and [SDK-FR-003](spec-sdk.md#sdk-fr-003).

Proposed repair: a CORE story reconciles architecture guidance and aligns affected components while preserving behaviour tested through ports. Do not rename older code during the quality pass; retain the rule limiting renames to code being touched. Assess public export changes against [SDK-FR-015](spec-sdk.md#sdk-fr-015).

#### QC-05 — error: joint publication does not account for failure between publishes

At the time of the pass, [SDK-FR-016](spec-sdk.md#sdk-fr-016) and [SDK Story 4](spec-sdk.md#sdk-story-4---publish-the-engine-with-every-release-priority-p2) promised both packages would be published together or neither would. `scripts/release.ts:250` publishes the CLI first; line 253 publishes the engine. If the latter fails, the CLI is already published. `test/releasing-the-engine.test.ts:124` deliberately proves that partial state, rather than atomic publication. Preflight tests prove neither is published when a check fails; the contract gap concerns failure after preflight. Two sequential publications are not an atomic transaction.

Proposed repair: an SDK story limits the neither-published guarantee to preflight, describes partial publication separately and explains how to finish the remaining publication at the same version. Change [SDK-FR-016](spec-sdk.md#sdk-fr-016) only after the user accepts that guarantee. Do not assume rollback or unpublishing, which are outside scope.

#### QC-06 — error: evidence does not prove the pricing skill's results

[EVAL Story 4](spec-eval.md#eval-story-4---ask-what-the-sessions-cost-priority-p2) is Done, but `test/the-cw-session-cost-skill.test.ts:27` only searches its body for words, and line 36 searches for `unknown` and `Never guess`. Its three scenarios require actual invocation results: session/day costs using typed prices, published prices with a source and reading time, and no guessed unknown-model price. A skill retaining those words while omitting token-by-price multiplication would still pass those assertions. [EVAL Story 4](spec-eval.md#eval-story-4---ask-what-the-sessions-cost-priority-p2)'s `specs/plan.json` entry has no run evidence, and no handoff for it was found. Missing evidence on an older Done story is not itself a format failure: the problem is the absence of proof distinguishing the three required behaviours.

The [EVAL-SC-002](spec-eval.md#eval-sc-002) assertion at `test/predicting-the-main-context.test.ts:128` also checks only a factor over InMemoryAgentCli. It does not measure the maximum 15% difference against the real agent, and the roadmap holds no such measurement. This is missing evidence, not a claim that actual error exceeds 15%.

Proposed repair: an EVAL story supplies invocation evidence for all three pricing cases, with independently verifiable arithmetic and price source/time, while keeping pricing out of the engine. Measure and record actual tokenizer accuracy, or seek a requirement change if it cannot be measured validly. This pass did not invoke paid agents or retrieve live prices merely to substitute for missing acceptance evidence.

#### QC-07 — error: the spec does not fully state the accepted version policy

At the time of the pass, [SDK-FR-015](spec-sdk.md#sdk-fr-015) described additions as minor. `scripts/release.ts:164` treats every content change to an existing declaration as breaking; line 166 requires a major version. Reproduced through the actual release script using `inARelease` at `test/a-release.ts:32`, in a temporary fixture with fake npm/git/pnpm and no registry access: add optional `description?: string` to interface `Options`, which already has `label?: string`, then request 1.0.0 → 1.1.0. Existing consumers and adapters need no edits for this addition, but the conservative policy returns status 1:

```text
Release refused: 1.1.0 is not a new major, yet the engine's contract changes against 1.0.0: Options. Release 2.0.0.
```

The Decisions section of `specs/handoff/sdk-4.md` explicitly records user acceptance of declaration-level comparison and treating all changes to existing declarations as breaking. The code follows that decision. The addition test at `test/releasing-the-engine.test.ts:188` adds a newly named declaration only. This is a gap between the spec's semantic-versioning wording and the accepted conservative policy, not code contradicting its technical gate.

Proposed repair: an SDK story states the accepted policy precisely in requirements and scenarios: existing declaration changes require major; newly named declarations require minor; comments/whitespace do not change the contract. Add optional-member coverage so the policy is not mistaken for full semantic compatibility analysis. Do not replace the comparator with type-compatibility analysis without reversing the user's decision. Reproduction log: `/tmp/cw-core39-semver-reproduction.log`.

### Story-to-code and test map

The following locations identify execution paths and existing evidence. They do not replace proof of each scenario; observed exceptions are recorded in QC-01 through QC-07.

| Story | Execution path | Existing tests |
|---|---|---|
| [CORE Story 1](spec-core.md#core-story-1---author-a-charter-and-put-the-agent-under-it-priority-p1) | `src/hexagon/application/CharterAuthoring.ts:624` | `test/setting-a-repository-up.test.ts:209`, `test/validating-a-charter.test.ts:108` |
| [CORE Story 2](spec-core.md#core-story-2---adopt-shared-governance-without-copying-files-priority-p2) | `src/hexagon/application/CharterVendoring.ts:47`, `src/hexagon/service/charterRepo.ts:34` | `test/adding-a-vendor.test.ts:58` |
| [CORE Story 3](spec-core.md#core-story-3---trust-the-charter-and-prove-it-in-ci-priority-p3) | `src/hexagon/application/CharterAuthoring.ts:136` | `test/checking-a-repository.test.ts:95` |
| [CORE Story 4](spec-core.md#core-story-4---create-a-correctly-shaped-primitive-without-looking-anything-up-priority-p5) | `src/hexagon/application/CharterAuthoring.ts:443` | `test/scaffolding-a-primitive.test.ts:90` |
| [CORE Story 5](spec-core.md#core-story-5---see-what-the-charter-holds-and-why-each-rule-comes-up-priority-p1) | `src/hexagon/application/CharterAuthoring.ts:207`, `:250` | `test/listing-a-charter.test.ts`, `test/explaining-an-id.test.ts` |
| [CORE Story 6](spec-core.md#core-story-6---author-edit-and-delete-a-primitive-without-looking-anything-up-priority-p2) | `src/hexagon/application/CharterAuthoring.ts:443`, `:499`, `:544` | `test/authoring-a-primitive.test.ts:129`, `test/authoring-over-http.test.ts` |
| [CORE Story 7](spec-core.md#core-story-7---build-preview-and-check-the-repositorys-health-priority-p3) | `src/hexagon/application/CharterAuthoring.ts:136`, `:358` | `test/checking-a-repository.test.ts:95`, `test/previewing-a-build.test.ts` |
| [CORE Story 8](spec-core.md#core-story-8---install-see-and-remove-vendor-sources-priority-p4) | `src/hexagon/application/CharterVendoring.ts:47`, `:55` | `test/vendoring-over-http.test.ts`, `test/listing-the-vendors.test.ts` |
| [CORE Story 9](spec-core.md#core-story-9---write-run-and-correct-the-self-regression-tests-priority-p5) | `src/hexagon/application/CharterAuthoring.ts:387`, `src/hexagon/application/TestAuthoring.ts:46` | `test/running-the-tests.test.ts:90`, `test/test-suites-over-http.test.ts` |
| [CORE Story 10](spec-core.md#core-story-10---write-a-primitive-with-no-terminal-to-answer-at-priority-p1) | `src/hexagon/application/CharterAuthoring.ts:443` | `test/scaffolding-a-primitive.test.ts:204` |
| [CORE Story 11](spec-core.md#core-story-11---ask-a-kind-what-it-requires-rather-than-being-told-priority-p2) | `src/hexagon/application/CharterAuthoring.ts:409` | `test/scaffolding-a-primitive.test.ts:90` |
| [CORE Story 12](spec-core.md#core-story-12---the-instructions-arrive-with-the-engine-not-with-the-repository-priority-p3) | `src/hexagon/service/charterRepo.ts:34` | `test/loading-a-charter.test.ts:126` |
| [CORE Story 13](spec-core.md#core-story-13---install-cw-with-one-command-and-use-it-in-any-repository-priority-p1) | `main.ts`, `scripts/release.ts` | `test/packaging-the-engine.test.ts:38` |
| [CORE Story 14](spec-core.md#core-story-14---know-which-cw-is-running-and-move-to-another-priority-p2) | `main.ts` | `test/packaging-the-engine.test.ts:76` |
| [CORE Story 15](spec-core.md#core-story-15---publish-a-release-that-users-can-trust-priority-p3) | `scripts/release.ts` | `test/releasing-the-engine.test.ts:38`, `test/updating-the-release-version.test.ts` |
| [CORE Story 16](spec-core.md#core-story-16---open-every-primitive-as-it-was-compiled-priority-p1) | `src/hexagon/domain/services/compile/compiledPrimitiveFactory.ts:44` | `test/compiling-a-charter.test.ts:176` |
| [CORE Story 17](spec-core.md#core-story-17---declare-where-knowledge-lives-once-and-point-any-primitive-at-it-priority-p1) | `src/hexagon/application/CharterAuthoring.ts:250` | `test/explaining-an-id.test.ts:160`, `test/compiling-the-claude-surface.test.ts` |
| [CORE Story 18](spec-core.md#core-story-18---sign-in-to-every-mcp-origin-as-yourself-priority-p1) | `src/hexagon/application/McpConnecting.ts:84`, `:90` | `test/signing-in-to-mcp-origins.test.ts:129` |
| [CORE Story 19](spec-core.md#core-story-19---give-the-agent-one-server-that-reaches-every-mcp-origin-priority-p1) | `src/hexagon/application/McpConnecting.ts:96`, `:114` | `test/serving-the-mcp-origins.test.ts:80` |
| [CORE Story 20](spec-core.md#core-story-20---hold-a-subagent-to-the-mcp-origins-it-lists-priority-p2) | `src/hexagon/domain/services/compile/claudeComponentFactory.ts:48` | `test/compiling-the-claude-surface.test.ts:203` |
| [CORE Story 21](spec-core.md#core-story-21---keep-a-script-or-a-template-in-the-charter-and-get-the-file-it-is-priority-p1) | `src/hexagon/domain/services/compile/compiledPrimitiveFactory.ts:44` | `test/building-scripts-and-templates.test.ts:71` |
| [CORE Story 22](spec-core.md#core-story-22---point-any-primitive-at-a-script-or-a-template-by-its-id-priority-p2) | `src/hexagon/application/CharterAuthoring.ts:250` | `test/explaining-an-id.test.ts:191` |
| [CORE Story 23](spec-core.md#core-story-23---keep-every-primitive-as-a-folder-with-its-indexmd-and-its-assets-priority-p1) | `src/hexagon/service/charterRepo.ts:34` | `test/building-scripts-and-templates.test.ts:108` |
| [CORE Story 24](spec-core.md#core-story-24---keep-a-script-as-real-files-and-say-which-one-runs-priority-p1) | `src/hexagon/domain/services/compile/compiledPrimitiveFactory.ts:44` | `test/building-scripts-and-templates.test.ts:169` |
| [CORE Story 25](spec-core.md#core-story-25---write-each-name-as-what-its-reader-can-use-priority-p2) | `src/hexagon/domain/services/compile/claudeComponentFactory.ts:48` | `test/building-scripts-and-templates.test.ts:108` |
| [CORE Story 26](spec-core.md#core-story-26---invoke-a-skill-by-its-id-alone-priority-p2) | `src/hexagon/domain/services/compile/claudeComponentFactory.ts:48` | `test/compiling-the-claude-surface.test.ts:234` |
| [CORE Story 27](spec-core.md#core-story-27---name-every-primitive-by-its-id-alone-priority-p1) | `src/hexagon/service/charterRepo.ts:34` | `test/validating-a-charter.test.ts:108` |
| [CORE Story 28](spec-core.md#core-story-28---keep-a-step-skill-out-of-the-users-commands-priority-p2) | `src/hexagon/domain/services/compile/claudeComponentFactory.ts:48` | `test/compiling-the-claude-surface.test.ts:277` |
| [CORE Story 29](spec-core.md#core-story-29---fire-every-sensor-of-a-signal-through-one-cw-command-priority-p2) | `src/hexagon/application/SensorRunning.ts:31` | `test/running-the-sensors.test.ts:111` |
| [CORE Story 30](spec-core.md#core-story-30---name-every-vendor-folder-by-its-owner-and-its-repository-priority-p2) | `src/hexagon/service/vendorRepo.ts:236` | `test/adding-a-vendor.test.ts:58` |
| [CORE Story 31](spec-core.md#core-story-31---keep-a-skill-out-of-the-agents-own-reach-priority-p2) | `src/hexagon/domain/services/compile/claudeComponentFactory.ts:48` | `test/compiling-the-claude-surface.test.ts:293` |
| [CORE Story 32](spec-core.md#core-story-32---take-a-skill-from-a-skills-repository-into-the-vendor-layer-priority-p2) | `src/hexagon/service/vendorRepo.ts:119` | `test/taking-a-skill.test.ts:78` |
| [CORE Story 33](spec-core.md#core-story-33---pick-charters-from-a-source-that-gathers-many-priority-p2) | `src/hexagon/service/vendorRepo.ts:119` | `test/picking-a-charter.test.ts:74` |
| [CORE Story 34](spec-core.md#core-story-34---inject-a-charter-or-a-skill-into-the-repositorys-own-charter-priority-p2) | `src/hexagon/application/CharterVendoring.ts:51` | `test/injecting-a-vendor.test.ts:24` |
| [CORE Story 35](spec-core.md#core-story-35---set-a-repository-up-anywhere-with-or-without-git-priority-p2) | `src/hexagon/application/CharterAuthoring.ts:624` | `test/setting-a-repository-up.test.ts:209`, `test/evaluating-the-charter.test.ts:437` |
| [CORE Story 37](spec-core.md#core-story-37---install-and-remove-a-vendor-source-in-any-folder-priority-p3) | `src/zdriven/GitSources.ts:28`, `src/hexagon/service/vendorRepo.ts:236` | `test/fetching-a-vendor.test.ts:249`, `:409` |
| [CORE Story 38](spec-core.md#core-story-38---keep-a-binary-asset-whole-priority-p2) | `src/hexagon/domain/services/compile/compiledPrimitiveFactory.ts:44`, `src/zdriven/GitSources.ts:90` | `test/keeping-a-binary-asset-whole.test.ts:65`, `:120` |
| [EVAL Story 1](spec-eval.md#eval-story-1---see-what-the-charter-loads-into-the-agents-context-priority-p1) | `src/hexagon/application/CharterAuthoring.ts:302` | `test/predicting-the-main-context.test.ts:180`; evidence limitation in QC-06 |
| [EVAL Story 2](spec-eval.md#eval-story-2---be-told-what-a-session-has-used-when-the-agent-stops-priority-p1) | `src/hexagon/domain/models/charter/builtin/sessionTokensCounter.mjs` | `test/counting-a-session.test.ts:96` |
| [EVAL Story 3](spec-eval.md#eval-story-3---read-back-the-sessions-kept-priority-p2) | `src/hexagon/application/SessionReviewing.ts:41`, `src/hexagon/service/sessionAnalysisRepo.ts:20` | `test/reading-the-sessions.test.ts:116` |
| [EVAL Story 4](spec-eval.md#eval-story-4---ask-what-the-sessions-cost-priority-p2) | `src/hexagon/domain/models/charter/builtin/CwSessionCostSkill.ts` | `test/the-cw-session-cost-skill.test.ts:27`; missing behavioural evidence in QC-06 |
| [EVAL Story 5](spec-eval.md#eval-story-5---search-tools-rather-than-load-them-all-into-context-priority-p2) | `src/hexagon/service/mcpOriginsRepo.ts:102` | `test/compiling-the-claude-surface.test.ts:224`, `test/serving-the-mcp-origins.test.ts:118` |
| [EVAL Story 6](spec-eval.md#eval-story-6---evaluate-the-charter-against-the-real-agent-under-promptfoo-priority-p3) | `src/hexagon/application/CharterEvaluating.ts:82` | `test/evaluating-the-charter.test.ts:110` |
| [EVAL Story 7](spec-eval.md#eval-story-7---evaluate-with-the-selected-configured-agent-priority-p2) | `src/hexagon/application/CharterEvaluating.ts:82` | `test/evaluating-the-charter.test.ts:376` |
| [SDK Story 1](spec-sdk.md#sdk-story-1---keep-a-repository-at-any-address-priority-p2) | `src/hexagon/application/SessionReviewing.ts:41` | `test/keeping-a-repository-at-any-address.test.ts:57`, `:116`, `:177` |
| [SDK Story 2](spec-sdk.md#sdk-story-2---import-the-engine-from-the-package-cw-comes-in-priority-p1) | `src/index.ts:2` | `test/importing-the-engine.test.ts:37`, `:109` |
| [SDK Story 3](spec-sdk.md#sdk-story-3---author-a-charter-with-no-disk-and-no-git-priority-p1) | `src/hexagon/application/CharterAuthoring.ts:624`, `:332` | `test/importing-the-engine.test.ts:240`, `:287` |
| [SDK Story 4](spec-sdk.md#sdk-story-4---publish-the-engine-with-every-release-priority-p2) | `scripts/release.ts` | `test/releasing-the-engine.test.ts:38`, `:188`; QC-07 reproduction |

### sdd-analyze result and next step

A passing `check` does not establish content consistency. Content analysis found five error groups: QC-01 (CORE and CORE/EVAL conflicts), QC-02 (traceability/format), QC-03 (SDK/guide contract conflict), QC-05 (publication guarantee) and QC-07 (version policy). No warning was recorded for vague SC because they have measurable targets. QC-04 and QC-06 arise from code/evidence review. sdd-plan must address specification findings; the quality pass itself does not fix them.

The proposed allocation was CORE for QC-01, QC-02 and QC-04; SDK for QC-03, QC-05 and QC-07; EVAL for QC-06. At the report checkpoint, no repair story had been accepted and [CORE Story 39](spec-core.md#core-story-39---quality-cross-check-of-core-story-35-core-story-37-core-story-38-sdk-story-1-priority-p3) was not eligible for Done. Independent verification/review and the story handover remained after repair planning.

### Decisions and drafts after the pass

The user accepted all seven groups and their allocation to the three specs. When clarifying QC-03, the user specified that only DTOs leave a use case and operators read internal diagnostics through logs. This decision is recorded in [SDK-FR-004](spec-sdk.md#sdk-fr-004), [SDK-FR-017](spec-sdk.md#sdk-fr-017), [SDK-FR-018](spec-sdk.md#sdk-fr-018) and ADR-005, replacing the proposal to retain exceptions outside use cases.

Repair mappings: QC-01 → [CORE Story 40](spec-core.md#core-story-40---read-one-consistent-account-of-the-charters-behaviour-priority-p1); QC-02 → [CORE Story 41](spec-core.md#core-story-41---trace-every-acceptance-scenario-to-its-requirement-priority-p2); QC-03 → [SDK Story 5](spec-sdk.md#sdk-story-5---receive-every-use-case-failure-as-a-dto-priority-p1); QC-04 → [CORE Story 42](spec-core.md#core-story-42---keep-the-engines-architecture-consistent-with-its-charter-priority-p2); QC-05 → [SDK Story 6](spec-sdk.md#sdk-story-6---know-what-to-do-after-a-failed-publication-priority-p2); QC-06 → [EVAL Story 8](spec-eval.md#eval-story-8---prove-the-pricing-journeys-and-tokenizer-accuracy-priority-p2); QC-07 → [SDK Story 7](spec-sdk.md#sdk-story-7---read-the-releases-conservative-contract-policy-priority-p2). [CORE Story 43](spec-core.md#core-story-43---quality-cross-check-of-core-story-40-core-story-41-sdk-story-5-core-story-42-sdk-story-6-priority-p3) cross-checks the first five repairs. All remain Todo. The user has accepted the drafts; writing and accepting a plan does not mean its findings are repaired. The Last pass findings above describe the inspected state before these drafts.

The subsequent structural check passed. Content analysis still found 146 uncited CORE FR and 146 older CORE scenarios without FR/SC citations, together with older conflicts targeted by CORE Stories 40–41. On 2026-11-03 the user approved the workflow exception deferring those reported defects to CORE Stories 40–41, and approved the repair plan. The content defects remain known and are not claimed as repaired. [CORE Story 39](spec-core.md#core-story-39---quality-cross-check-of-core-story-35-core-story-37-core-story-38-sdk-story-1-priority-p3) remains In Progress.
