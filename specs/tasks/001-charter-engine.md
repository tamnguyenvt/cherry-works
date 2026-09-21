# Tasks, phase 001: Charter, Engine and Agent Authoring

Everything here has landed. Each task was one reviewable change held to [SC-026](../spec.md#sc-026),
leaving the repository building and green. The design behind each task is
plan [§17.1](../plan.md#171-phase-001-the-charter-its-engine-and-agent-authoring), keyed by task id.

Legend: `[P]` = parallelisable with its siblings; `[USn]` = the spec's Story n.

---

## Phase 0 — Skeleton (blocks everything)

- [x] <a id="t001"></a>**T001** Package skeleton with a `cw` entry point that prints usage. *([FR-094](../spec.md#fr-094); plan [§1](../plan.md#1-technical-context), [§17.1.1](../plan.md#1711-t001--package-skeleton))*
- [x] <a id="t002"></a>**T002** Command-line adapter: command table, strict parsing, near-miss suggestion, output through the reporting port. *([FR-095](../spec.md#fr-095); plan [§13](../plan.md#13-the-command-line-fr-093--fr-095-fr-109), [§17.1.2](../plan.md#1712-t002--the-command-line-adapter))* Depends on [T001](#t001).
- [x] <a id="t003"></a>**T003** Architecture rules run as the first step of the test suite. *([FR-093](../spec.md#fr-093); plan [§2.1](../plan.md#21-domain-srchexagondomain), [§17.1.3](../plan.md#1713-t003--architecture-rules))* Depends on [T001](#t001).
- [x] <a id="t004"></a>**T004** Driven ports, each declared when first needed. *(plan [§2.3](../plan.md#23-ports-srchexagonport), [§2.6](../plan.md#26-adapters-and-the-composition-root), [§14](../plan.md#14-risks), [§17.1.4](../plan.md#1714-t004--driven-ports))* Depends on [T001](#t001).

---

## Story 1 — Author a charter and put the agent under it

**Independent test**: see spec [Story 1](../spec.md#user-story-1---author-a-charter-and-put-the-agent-under-it-priority-p1).

### Domain: the format
- [x] <a id="t005"></a>**T005** The closed set of kinds. *([FR-001](../spec.md#fr-001) – [FR-003](../spec.md#fr-003); plan [§17.1.5](../plan.md#1715-t005--the-closed-set-of-kinds))*
- [x] <a id="t006"></a>**T006** Read one primitive, its headers checked by its kind. *([FR-002](../spec.md#fr-002) – [FR-004](../spec.md#fr-004); plan [§2.1](../plan.md#21-domain-srchexagondomain), [§17.1.6](../plan.md#1716-t006--reading-one-primitive))* Depends on [T005](#t005).
- [x] <a id="t007"></a>**T007** The one read path for a charter. *([FR-002](../spec.md#fr-002), [FR-009](../spec.md#fr-009); [SC-010](../spec.md#sc-010); plan [§4.1](../plan.md#41-the-one-read-path-fr-009-sc-010), [§17.1.7](../plan.md#1717-t007--the-one-read-path))* Depends on [T006](#t006).
- [x] <a id="t008"></a>**T008** Mixins lend a body; their reach is checked against the host's. *([FR-006](../spec.md#fr-006), [FR-007](../spec.md#fr-007); plan [§5.2](../plan.md#52-mixins-fr-006-fr-007), [§17.1.8](../plan.md#1718-t008--mixins))* Depends on [T007](#t007).

### Domain: validation
- [x] <a id="t009"></a>**T009** Validation across files: collisions, missing mixins, mixin reach. *([FR-010](../spec.md#fr-010), [FR-012](../spec.md#fr-012); [SC-003](../spec.md#sc-003); plan [§5.1](../plan.md#51-one-identity-one-primitive-fr-015-fr-016), [§14](../plan.md#14-risks), [§17.1.9](../plan.md#1719-t009--validation-across-files))* Depends on [T007](#t007).
- [x] <a id="t010"></a>**T010** Per-kind required headers, one class per kind. *([FR-004](../spec.md#fr-004); plan [§17.1.10](../plan.md#17110-t010--per-kind-headers))* Depends on [T006](#t006).
- [x] <a id="t011"></a>**T011** The checking service over the real filesystem. *([FR-010](../spec.md#fr-010), [FR-011](../spec.md#fr-011), [FR-013](../spec.md#fr-013), [FR-093](../spec.md#fr-093); plan [§2.4](../plan.md#24-application-srchexagonapplication), [§17.1.11](../plan.md#17111-t011--the-checking-service))* Depends on [T009](#t009).
- [x] <a id="t012"></a>**T012** Rationale references checked, dangling ones warned. *([FR-005](../spec.md#fr-005); plan [§17.1.12](../plan.md#17112-t012--rationale-references))* Depends on [T009](#t009).

### Domain: catalogues and compilation
- [x] <a id="t013"></a>**T013** Full and reduced catalogues. *([FR-025](../spec.md#fr-025) – [FR-027](../spec.md#fr-027); [SC-005](../spec.md#sc-005); plan [§17.1.13](../plan.md#17113-t013--catalogues))* Depends on [T007](#t007).
- [x] <a id="t014"></a>**T014** One compile pass returns every file the charter produces. *([FR-033](../spec.md#fr-033); [SC-004](../spec.md#sc-004); plan [§6.1](../plan.md#61-one-pass-produces-everything-fr-030--fr-034-sc-004), [§17.1.14](../plan.md#17114-t014--one-compile-pass))* Depends on [T013](#t013).
- [x] <a id="t015"></a>**T015** The agent-neutral orientation. *([FR-026](../spec.md#fr-026), [FR-027](../spec.md#fr-027), [FR-031](../spec.md#fr-031), [FR-036](../spec.md#fr-036); [SC-004](../spec.md#sc-004), [SC-005](../spec.md#sc-005); plan [§17.1.15](../plan.md#17115-t015--the-agent-neutral-surface))* Depends on [T014](#t014).
- [x] <a id="t016"></a>**T016** The claude surface, mixin bodies before the host's. *([FR-006](../spec.md#fr-006), [FR-030](../spec.md#fr-030), [FR-037](../spec.md#fr-037); plan [§17.1.16](../plan.md#17116-t016--the-claude-surface))* Depends on [T008](#t008), [T014](#t014).
- [x] <a id="t017"></a>**T017** `cw build` writes, deletes and merges the compiled files. *([FR-032](../spec.md#fr-032), [FR-038](../spec.md#fr-038) – [FR-040](../spec.md#fr-040), [FR-055](../spec.md#fr-055), [FR-093](../spec.md#fr-093); plan [§6.1](../plan.md#61-one-pass-produces-everything-fr-030--fr-034-sc-004), [§17.1.17](../plan.md#17117-t017--the-build))* Depends on [T014](#t014).
- [x] <a id="t018"></a>**T018** `cw list`. *([FR-025](../spec.md#fr-025), [FR-026](../spec.md#fr-026), [FR-028](../spec.md#fr-028); plan [§13](../plan.md#13-the-command-line-fr-093--fr-095-fr-109), [§17.1.18](../plan.md#17118-t018--listing))* Depends on [T014](#t014).
- [x] <a id="t019"></a>**T019** The charter's section in each host's entry file. *([FR-030](../spec.md#fr-030), [FR-031](../spec.md#fr-031), [FR-035](../spec.md#fr-035); [SC-007](../spec.md#sc-007); [Story 1](../spec.md#user-story-1---author-a-charter-and-put-the-agent-under-it-priority-p1) scenarios 6, 7; plan [§6.1](../plan.md#61-one-pass-produces-everything-fr-030--fr-034-sc-004), [§17.1.19](../plan.md#17119-t019--the-charters-section-in-each-hosts-entry-file))* Depends on [T015](#t015), [T017](#t017).

### Setup
- [x] <a id="t020"></a>**T020** Refuse to set up outside a git repository. *([FR-054](../spec.md#fr-054); plan [§17.1.20](../plan.md#17120-t020--version-control))*
- [x] <a id="t021"></a>**T021** Setup questions, each with a default and a flag. *([FR-056](../spec.md#fr-056); [SC-011](../spec.md#sc-011); plan [§17.1.21](../plan.md#17121-t021--asking-the-setup-questions))* Depends on [T020](#t020).
- [x] <a id="t022"></a>**T022** `cw init` scaffolds the charter root and leaves it uncommitted. *([FR-057](../spec.md#fr-057); plan [§17.1.22](../plan.md#17122-t022--setup))* Depends on [T021](#t021).
- [x] <a id="t023"></a>**T023** Re-running `cw init` offers the current answers. *([FR-055](../spec.md#fr-055), [FR-058](../spec.md#fr-058); plan [§17.1.23](../plan.md#17123-t023--re-running-setup))* Depends on [T022](#t022).

---

## Story 2 — Adopt shared governance without copying files

**Independent test**: see spec [Story 2](../spec.md#user-story-2---adopt-shared-governance-without-copying-files-priority-p2).

- [x] <a id="t024"></a>**T024** Install and update a vendor source through git subtree. *([FR-041](../spec.md#fr-041), [FR-046](../spec.md#fr-046) – [FR-051](../spec.md#fr-051); Edge Cases; plan [§17.1.24](../plan.md#17124-t024--installing-through-git-subtree))* Depends on [T020](#t020).
- [x] <a id="t025"></a>**T025** `cw vendor add`. *([FR-045](../spec.md#fr-045), [FR-047](../spec.md#fr-047), [FR-051](../spec.md#fr-051), [FR-052](../spec.md#fr-052); plan [§17.1.25](../plan.md#17125-t025--cw-vendor-add))* Depends on [T024](#t024).
- [x] <a id="t026"></a>**T026** One identity space for every layer. *([FR-015](../spec.md#fr-015), [FR-016](../spec.md#fr-016); plan [§5.1](../plan.md#51-one-identity-one-primitive-fr-015-fr-016), [§17.1.26](../plan.md#17126-t026--one-identity-space))* Depends on [T009](#t009).
- [x] <a id="t027"></a>**T027** Mixins and corpora named the same way whichever layer published them. *([FR-006](../spec.md#fr-006); plan [§5.1](../plan.md#51-one-identity-one-primitive-fr-015-fr-016), [§17.1.27](../plan.md#17127-t027--naming-mixins-and-corpora-across-layers))* Depends on [T026](#t026).
- [x] <a id="t028"></a>**T028** `cw vendor remove`. *([FR-047](../spec.md#fr-047), [FR-051](../spec.md#fr-051); plan [§17.1.28](../plan.md#17128-t028--cw-vendor-remove))* Depends on [T025](#t025).

---

## Story 3 — Trust the charter, and prove it in CI

**Independent test**: see spec [Story 3](../spec.md#user-story-3---trust-the-charter-and-prove-it-in-ci-priority-p3).

- [x] <a id="t029"></a>**T029** `cw explain <identity>`. *([FR-029](../spec.md#fr-029); [SC-006](../spec.md#sc-006); plan [§17.1.29](../plan.md#17129-t029--cw-explain))* Depends on [T026](#t026).
- [x] <a id="t030"></a>**T030** `cw build --preview`. *([FR-034](../spec.md#fr-034); plan [§6.1](../plan.md#61-one-pass-produces-everything-fr-030--fr-034-sc-004), [§17.1.30](../plan.md#17130-t030--build---preview))* Depends on [T017](#t017).
- [x] <a id="t031"></a>**T031** `cw doctor`. *([FR-010](../spec.md#fr-010), [FR-011](../spec.md#fr-011), [FR-013](../spec.md#fr-013), [FR-080](../spec.md#fr-080), [FR-081](../spec.md#fr-081); plan [§17.1.31](../plan.md#17131-t031--cw-doctor))* Depends on [T011](#t011), [T030](#t030).
- [x] <a id="t032"></a>**T032** The test file format and its reader. *([FR-082](../spec.md#fr-082), [FR-084](../spec.md#fr-084), [FR-086](../spec.md#fr-086); plan [§11.1](../plan.md#111-the-format), [§17.1.32](../plan.md#17132-t032--the-test-format); data-model [§11.1](../data-model.md#111-the-test-file))*
- [x] <a id="t033"></a>**T033** `cw test`. *([FR-012](../spec.md#fr-012), [FR-083](../spec.md#fr-083) – [FR-085](../spec.md#fr-085), [FR-087](../spec.md#fr-087) – [FR-089](../spec.md#fr-089); plan [§17.1.33](../plan.md#17133-t033--cw-test))* Depends on [T032](#t032).

---

## Story 4 — Scaffold a primitive

**Independent test**: see spec [Story 4](../spec.md#user-story-4---create-a-correctly-shaped-primitive-without-looking-anything-up-priority-p5).

- [x] <a id="t034"></a>**T034** `cw add <kind> <id>`. *([FR-064](../spec.md#fr-064), [FR-065](../spec.md#fr-065); plan [§17.1.34](../plan.md#17134-t034--cw-add))* Depends on [T010](#t010), [T021](#t021).

---

## Portal groundwork

- [x] <a id="t035"></a>**T035** Every port method answers DTOs, and a driver reads them alone. *(plan [§2.2](../plan.md#22-dependency-rules), [§2.5](../plan.md#25-models-are-classes-and-a-driver-reads-their-dtos), [§17.1.35](../plan.md#17135-t035--models-are-classes-and-a-driver-reads-their-dtos); data-model [§12](../data-model.md#12-what-crosses-a-driver-port), [§14](../data-model.md#14-doctor-outcome-fr-080-fr-081))* Depends on [T036](#t036).
- [x] <a id="t036"></a>**T036** The page toolchain. *(plan [§1](../plan.md#1-technical-context), [§17.1.36](../plan.md#17136-t036--the-page-toolchain))*
- [x] <a id="t037"></a>**T037** The dependency rule keeping the page browser code. *([FR-108](../spec.md#fr-108); plan [§2.2](../plan.md#22-dependency-rules), [§17.1.37](../plan.md#17137-t037--the-page-kept-browser-code))* Depends on [T036](#t036).
- [x] <a id="t038"></a>**T038** The server, serving the built page, with no route yet. *([FR-104](../spec.md#fr-104), [FR-106](../spec.md#fr-106); plan [§12.2](../plan.md#122-the-route-table), [§14](../plan.md#14-risks), [§17.1.38](../plan.md#17138-t038--the-server))* Depends on [T036](#t036).
- [x] <a id="t039"></a>**T039** The token and the host check. *([FR-106](../spec.md#fr-106); plan [§12.4](../plan.md#124-security-fr-106), [§17.1.39](../plan.md#17139-t039--the-token-and-the-host-check))* Depends on [T038](#t038).
- [x] <a id="t040"></a>**T040** `cw portal`, started and refused as the spec says. *([FR-104](../spec.md#fr-104), [FR-105](../spec.md#fr-105), [FR-107](../spec.md#fr-107); plan [§13](../plan.md#13-the-command-line-fr-093--fr-095-fr-109), [§17.1.40](../plan.md#17140-t040--cw-portal))* Depends on [T038](#t038).
- [x] <a id="t041"></a>**T041** Explain names what a primitive pulls in and what names it. *([FR-029](../spec.md#fr-029); plan [§10.2](../plan.md#102-explain-fr-029-fr-116), [§17.1.41](../plan.md#17141-t041--what-a-primitive-pulls-in-and-what-names-it); data-model [§13](../data-model.md#13-explanation-fr-029))*

---

## Story 10 — Write a primitive with no terminal to answer at

**Independent test**: see spec [Story 10](../spec.md#user-story-10---write-a-primitive-with-no-terminal-to-answer-at-priority-p1).

- [x] <a id="t042"></a>**T042** [US10] `--header` on `cw add`, read as `k=v` and passed as the answers a prompt would give. *([FR-066](../spec.md#fr-066), [FR-068](../spec.md#fr-068); plan [§9.3](../plan.md#93-cw-add-kind-id-prompts-and-header-flags-fr-064--fr-074), [§17.1.42](../plan.md#17142-t042----header-on-cw-add))*
- [x] <a id="t043"></a>**T043** [US10] Flags grouped by the shape each header takes, with no list of its own. *([FR-067](../spec.md#fr-067), [FR-069](../spec.md#fr-069); plan [§9.3](../plan.md#93-cw-add-kind-id-prompts-and-header-flags-fr-064--fr-074), [§17.1.43](../plan.md#17143-t043--the-shapes); data-model [§2.1](../data-model.md#21-primitive-requirements-fr-059-fr-062))*
- [x] <a id="t044"></a>**T044** [US10] The flag path refuses what the prompt path refuses, and is proved to. *([FR-065](../spec.md#fr-065), [FR-070](../spec.md#fr-070) – [FR-074](../spec.md#fr-074); [SC-022](../spec.md#sc-022), [SC-023](../spec.md#sc-023); [Story 10](../spec.md#user-story-10---write-a-primitive-with-no-terminal-to-answer-at-priority-p1) scenarios 1 – 7; plan [§9.3](../plan.md#93-cw-add-kind-id-prompts-and-header-flags-fr-064--fr-074), [§17.1.44](../plan.md#17144-t044--the-flag-path-refuses-what-the-prompt-path-refuses))*

---

## Story 11 — Ask a kind what it requires, rather than being told

**Independent test**: see spec [Story 11](../spec.md#user-story-11---ask-a-kind-what-it-requires-rather-than-being-told-priority-p2).

- [x] <a id="t045"></a>**T045** [US11] The kind answers in full, from the model to `cw kinds <kind>`. *([FR-059](../spec.md#fr-059) – [FR-063](../spec.md#fr-063); [Story 11](../spec.md#user-story-11---ask-a-kind-what-it-requires-rather-than-being-told-priority-p2) scenarios 1 – 4; plan [§9.1](../plan.md#91-what-a-kind-requires-fr-059-fr-062-fr-063), [§9.2](../plan.md#92-cw-kinds-kind-fr-059--fr-061), [§17.1.45](../plan.md#17145-t045--the-kind-answers-in-full-from-the-model-to-the-terminal); data-model [§2.1](../data-model.md#21-primitive-requirements-fr-059-fr-062))*

---

## Story 12 — The instructions arrive with the engine, not with the repository

**Independent test**: see spec [Story 12](../spec.md#user-story-12---the-instructions-arrive-with-the-engine-not-with-the-repository-priority-p3).

- [x] <a id="t046"></a>**T046** [US12] A third layer, read and named, with nothing in it yet. *([FR-015](../spec.md#fr-015), [FR-017](../spec.md#fr-017) – [FR-022](../spec.md#fr-022); [Story 12](../spec.md#user-story-12---the-instructions-arrive-with-the-engine-not-with-the-repository-priority-p3) scenarios 4, 5; plan [§5.3](../plan.md#53-the-builtin-layer-supplied-rather-than-stored-fr-017--fr-024), [§17.1.46](../plan.md#17146-t046--a-third-layer-read-and-named); data-model [§3.2](../data-model.md#32-scope-fr-017--fr-024), [§4.2](../data-model.md#42-the-files-a-charter-is-read-from))*
- [x] <a id="t047"></a>**T047** [US12] What the engine brings, and the build needing no case for it. *([FR-018](../spec.md#fr-018), [FR-023](../spec.md#fr-023), [FR-024](../spec.md#fr-024), [FR-096](../spec.md#fr-096), [FR-100](../spec.md#fr-100); [Story 12](../spec.md#user-story-12---the-instructions-arrive-with-the-engine-not-with-the-repository-priority-p3) scenarios 1, 2, 6, 7; plan [§5.4](../plan.md#54-what-the-engine-brings-fr-096--fr-103), [§6.5](../plan.md#65-the-builtin-layer-needs-no-case-of-its-own-fr-024), [§17.1.47](../plan.md#17147-t047--what-the-engine-brings-and-the-build-needing-no-case-for-it); data-model [§5](../data-model.md#5-what-the-engine-brings-fr-096--fr-103))* Depends on [T046](#t046).
- [x] <a id="t048"></a>**T048** [US12] The body, written against the commands that answer it. *([FR-097](../spec.md#fr-097) – [FR-099](../spec.md#fr-099), [FR-101](../spec.md#fr-101) – [FR-103](../spec.md#fr-103); [SC-020](../spec.md#sc-020); plan [§5.4](../plan.md#54-what-the-engine-brings-fr-096--fr-103), [§17.1.48](../plan.md#17148-t048--the-body-written-against-the-commands-that-answer-it))* Depends on [T047](#t047), and on Stories 10 and 11 ([T042](#t042) – [T044](#t044), [T045](#t045)) having landed.
