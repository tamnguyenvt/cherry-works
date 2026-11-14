# Spec: SDK — the engine as a package integrators build on

**Created**: 2026-11-02

**Updated**: 2026-11-14

**Input**: User description: "Publish the Cherry Works hexagon as an npm package, so a third party can import the engine's logic and write driver and driven adapters of their own, without `main.ts`, the command line or any adapter of this repository; a repository's address need not be a `file:` one; a test proves authoring through the built package on in-memory adapters, touching no disk." Then: "Ship the repositories as adapters in a package of their own…"

Then: "Return only DTOs from use cases; operators read error details through logs…"

Then: "Delete the engine's own package and stop publishing it: publish only `cherry-works`, `cw` unchanged, and let a tool import the engine from it, with how `cw` composes it and the adapters it is composed of, so a tool mixes those with its own."

Then: "Export only what a user needs: `composeApplications`, handed only the adapters a tool replaces and merging them with `cw`'s own; the four driver ports and their DTOs; `VERSION`; and the ports of the adapters a tool may replace, with what crosses them. No use case, service, domain model or adapter class; the charter's store and the agents' projections and command lines are not public for now."

Then: "Merge the adapters a tool may hand into one `EngineAdapters`, every one of them replaceable: the charter's store and each agent's projection and command line included."

Then: "Keep [SDK-FR-020](#sdk-fr-020): export `cw`'s own adapters for a tool to extend. Rewrite the SDK spec, its FR and SC, to stand by it."

Then: "Export the charter's layout as one value, as the output's is, and nothing loose; keep the sessions where the file adapters handed in keep files."

## Overview

The engine was reached only through `cw`, or through a portal listening on 127.0.0.1 for one repository: an integrator wanting the charter's rules had to shell out to a command, or write them again.

The engine's rules stand apart from every adapter, so this part publishes them, as a library of `cherry-works`, the package `cw` is installed from. An integrator installs that one package, composes the engine as `cw` does, handing adapters of their own for the ones they replace — written anew, or extending `cw`'s own — and reaches its applications, each answering in data, its failures included: where the charter's files are kept and how they are reached are theirs to decide.

It serves an integrator, not the developer using `cw`. What is published is a contract, and kept as one ([ADR-001](../docs/ADR.md#adr-001-the-engine-is-a-hexagonal-library-of-cw-every-store-and-runner-an-adapter-it-is-handed)).

## Clarifications

### Session 2026-11-02

- Q: Why are the libraries the engine's rules use depended on, not bundled? → A: They were, while the engine had a package of its own; since 2026-11-10 it is a library of `cherry-works`, which bundles every library, and ships the types of the one the values crossing the ports are made from, so an integrator installs nothing else ([SDK-FR-006](#sdk-fr-006)).
- Q: Which use cases need git? → A: Evaluating, and reaching a source. Authoring, validating, building, testing, setting up and the health check need none, since nothing tells an edited vendor ([SDK-FR-003](#sdk-fr-003)).
- Q: Why must a completed write be read back? → A: Setup writes and then builds from what it wrote. No use case relies on two writes landing together, so the adapter owes nothing more ([SDK-FR-008](#sdk-fr-008)).

### Session 2026-11-11

- Q: May an integrator hand its own store for the charter, or its own projection or command line for an agent? → A: Yes: every adapter is replaceable, all handed as one set; the models their ports name are exported with them, so changing one is a change to the contract ([SDK-FR-020](#sdk-fr-020)).
- Q: Must an integrator hand every adapter? → A: No: it hands only what it replaces, and `cw`'s own is composed for every other ([SDK-FR-003](#sdk-fr-003)).
- Q: The library exports `cw`'s own adapters and the domain models their ports name, while [SDK-FR-002](#sdk-fr-002), [SDK-FR-005](#sdk-fr-005) and [CORE-FR-228](spec-core.md#core-fr-228) said it exports no adapter: which stands? → A: The export: an integrator extends `cw`'s own adapters rather than writing each anew; [SDK-FR-002](#sdk-fr-002), [SDK-FR-005](#sdk-fr-005) and [CORE-FR-228](spec-core.md#core-fr-228) are rewritten to it ([SDK-FR-005](#sdk-fr-005), [SDK-FR-020](#sdk-fr-020)).
- Q: Must every store and runner be replaceable, the sessions, the settings and the local output included, and the engine composed at addresses that are not `file:` with nothing handed? → A: Yes: every one is handed in the one set, and composing reaches no disk until a use case does ([SDK-FR-011](#sdk-fr-011), [SDK-FR-020](#sdk-fr-020)).

### Session 2026-11-13

- Q: Does the package export the workspace's folders and the helpers an adapter of `cw`'s uses, beside the values? → A: No: the layout of the store `cw` keeps is exported as one value, as the output's layout is; no loose constant or helper is exported, and an agent's projection is told where the charter is edited rather than reading `cw`'s layout ([SDK-FR-002](#sdk-fr-002), [SDK-FR-020](#sdk-fr-020)).
- Q: Where an integrator hands file adapters but no sessions store, where are the sessions kept? → A: Through the file adapters handed, as every other store of `cw`'s is set up ([SDK-FR-020](#sdk-fr-020)).

## User Scenarios & Testing *(mandatory)*

### SDK Story 1 - Keep a repository at any address (Priority: P2)

**Status**: Done

An integrator keeps its charters in a database, and names one with an address of its own. Today most of the engine would take that address, and the part that reviews sessions would not: it writes a `file:` address of its own, and it tells two repositories apart by their path alone. After this, nothing in the engine assumes a disk, an address that cannot hold a folder is refused at once with a fault saying what is wanted, and `cw` on a `file:` address behaves as it did.

**Why this priority**: The published contract says a repository is an address, and a publish before this would promise what the engine does not keep.

**Independent Test**: Review the sessions of two repositories at `memory://a/` and `memory://b/` under a home at another such address, on adapters holding them in memory, and confirm each reads its own sessions, under that scheme. Repeat on `file:` addresses, and confirm the folders and the answer are as they were.

**Acceptance Scenarios**:

1. **Given** two repositories at addresses differing only in their host name, **When** the sessions of each are reviewed, **Then** each reads a folder of its own ([SDK-FR-011](#sdk-fr-011)).
2. **Given** a home at an address that is not `file:` and a sessions folder set as an absolute path, **When** the sessions are reviewed, **Then** that folder is read under the home's scheme, and no `file:` address is asked for ([SDK-FR-011](#sdk-fr-011)).
3. **Given** a repository at an address that is not `file:`, **When** a review answers, **Then** the sessions folder it names tells that repository's from any other's ([SDK-FR-011](#sdk-fr-011)).
4. **Given** an address with no hierarchical path, or one not ending in its separator, **When** a repository's stores are set up on it, **Then** a fault says what the address must be ([SDK-FR-010](#sdk-fr-010)).
5. **Given** a repository at a `file:` address, **When** any `cw` command runs, **Then** it reads, writes and says what it did before this ([SDK-FR-012](#sdk-fr-012)).

---

### SDK Story 2 - Import the engine from the package cw comes in (Priority: P1)

**Status**: Done

An integrator installs `cherry-works`, and imports from it how `cw` composes the engine, the ports its applications are entered through with the DTOs they answer, the port of every adapter an integrator may replace, with the models that cross them, and `cw`'s own adapters to extend; no use case and no service. They ask it which version of the engine they hold. Nothing of the command line or the portal is exported, and what the engine keeps inside stays inside.

**Why this priority**: It is what the phase is for, and every story after it is proved through it.

**Independent Test**: Build the package, install what it packs into an empty folder, and from a type-checked script compose the engine, call a driver port and read its response DTOs, and read the version. Compose the engine as `cw` does, handing only the adapters the script replaces with its own. Confirm the library holds no command line or portal, and that importing anything internal fails.

**Acceptance Scenarios**:

1. **Given** the installed package, **When** a TypeScript consumer imports how to compose the engine, its driver ports with their DTOs, and the port of every adapter it may replace, **Then** they resolve with their types, and nothing else need be installed by hand ([SDK-FR-001](#sdk-fr-001), [SDK-FR-002](#sdk-fr-002), [SDK-FR-006](#sdk-fr-006)).
2. **Given** the installed package, **When** the library's code is read, **Then** it holds the engine, how it is composed and the adapters `cw` is composed of, no command line and no portal, and imports no other package ([SDK-FR-005](#sdk-fr-005), [SDK-FR-006](#sdk-fr-006), [SDK-FR-020](#sdk-fr-020)).
3. **Given** the installed package, **When** something the contract does not name is imported, **Then** the import fails ([SDK-FR-005](#sdk-fr-005), [SDK-FR-014](#sdk-fr-014)).
4. **Given** the installed package, **When** the library's version is read, **Then** it is the version the package was published as, the one its `cw` names ([SDK-FR-009](#sdk-fr-009)).
5. **Given** a use case stopped by a fault, **When** the integrator receives its answer, **Then** the answer is a fault DTO rather than a raised exception; an internal fault's diagnostics are recorded for the operator and its details are withheld from the answer ([SDK-FR-004](#sdk-fr-004), [SDK-FR-017](#sdk-fr-017), [SDK-FR-018](#sdk-fr-018)).
6. **Given** a charter with something wrong in it, **When** a use case is asked of it, **Then** what is wrong comes back as data in the answer, by file ([SDK-FR-004](#sdk-fr-004)).
7. **Given** the package imported where no builtin file could be read from disk, **When** the charter is read, **Then** the engine's own primitives and their assets are there ([SDK-FR-007](#sdk-fr-007)).
8. **Given** `cherry-works` installed, **When** what it added is listed, **Then** it is that one package, holding `cw` and the library, and depending on no other ([SDK-FR-013](#sdk-fr-013)).
9. **Given** the installed package, **When** an integrator composes the engine as `cw` does, handing only the adapters it replaces, `cw`'s own composed for the rest, **Then** the script type-checks against the package alone, and the engine builds the charter and answers through the integrator's own adapters ([SDK-FR-020](#sdk-fr-020), [SDK-FR-003](#sdk-fr-003)).

---

### SDK Story 3 - Author a charter with no disk and no git (Priority: P1)

**Status**: Done

An integrator writes a reader and a writer over a map in memory, and hands them, with a token counter of their own, to where the engine is composed; the charter's store and the agents' projections, `cw`'s own, are set up over them. They set a repository up, add a primitive, validate the charter and build it: no disk is touched, no process is started, and no version control stands behind any of it.

**Why this priority**: It is the claim of the phase, proved the only way that counts: through what is published, from outside.

**Independent Test**: In a test that imports only the built package, compose the engine over file adapters holding everything in memory, at a `memory:` address, `cw`'s own composed for the rest. Set up, add a guide, validate it, add one that breaks a rule and read the fault, then build and read the compiled file back from the map. Confirm no call reaches the file system or starts a process.

**Acceptance Scenarios**:

1. **Given** in-memory adapters at a `memory:` address, **When** the repository is set up, **Then** its settings and kind folders are in the map, and its first build is too ([SDK-FR-003](#sdk-fr-003), [SDK-SC-001](#sdk-sc-001)).
2. **Given** that repository, **When** a primitive is added and the charter validated, **Then** the primitive is in the map and the charter holds ([SDK-SC-001](#sdk-sc-001)).
3. **Given** that repository, **When** a primitive that breaks a rule is added, **Then** the answer says what is wrong, as `cw add` would, and nothing is written ([SDK-FR-004](#sdk-fr-004)).
4. **Given** that repository, **When** it is built, **Then** the compiled files are in the map, exactly as `cw build` writes them to a disk for the same charter ([SDK-SC-002](#sdk-sc-002)).
5. **Given** an adapter that reads back what was written and honours the rest of the contract, and nothing more, **When** every authoring use case runs, **Then** each answers as it does on a disk ([SDK-FR-008](#sdk-fr-008)).

---

### SDK Story 4 - Publish the engine with every release (Priority: P2)

**Status**: Done

A maintainer releases one version. The library goes out inside `cherry-works`, at its number, under its checks, with nothing published if a preflight check fails. A failure during publication is reported with the state reached and the recovery action. The first release under the contract is 1.0.0, and from then on a change that breaks the contract is a major one, written in the changelog.

**Why this priority**: A contract nobody can install promises nothing; it comes last because a publish cannot be taken back.

**Independent Test**: Run a release dry-run and confirm it checks `cw` and the library in the one package and publishes nothing. Make the package fail a check, and confirm the release is refused. Remove something the contract names, and confirm the release is refused without a major version.

**Acceptance Scenarios**:

1. **Given** a release of one version, **When** it passes, **Then** the one package, `cw` and the library in it, is published at that version ([SDK-FR-016](#sdk-fr-016)).
2. **Given** a check of `cw` or of the library failing, **When** a release is asked for, **Then** nothing is published, and it says which check failed ([SDK-FR-016](#sdk-fr-016)).
3. **Given** a contract narrowed or changed against the last release, **When** a version that is not a new major is released, **Then** it is refused, naming what changed ([SDK-FR-015](#sdk-fr-015), [SDK-SC-003](#sdk-sc-003)).
4. **Given** a major release, **When** it is published, **Then** the changelog names each change that broke the contract ([SDK-FR-015](#sdk-fr-015)).

---

### SDK Story 5 - Receive every use-case failure as a DTO (Priority: P1)

**Status**: Done

An integrator calls a use case and reads its answer in the same way whether it succeeds, refuses the request or encounters an internal failure. The operator can diagnose an internal failure from the diagnostics without making the calling adapter know the engine's fault classes.

**Why this priority**: It settles the public failure contract before integrators depend on it.

**Independent Test**: Through the installed package, exercise a caller-correctable refusal, invalid charter content and a driven-adapter failure. Inspect the returned DTOs and the operator's diagnostics, and confirm no operation failure is raised to the calling adapter.

**Acceptance Scenarios**:

1. **Given** a request the caller can correct, **When** a use case refuses it, **Then** it returns a fault DTO with an actionable message and next move, without raising the failure to the calling adapter or recording it as an internal failure ([SDK-FR-004](#sdk-fr-004), [SDK-FR-017](#sdk-fr-017), [SDK-FR-018](#sdk-fr-018)).
2. **Given** a driven adapter that fails internally, **When** a use case calls it, **Then** the use case writes the diagnostics and cause without secrets and returns a generic fault DTO without those details, rather than raising the failure ([SDK-FR-004](#sdk-fr-004), [SDK-FR-017](#sdk-fr-017), [SDK-FR-018](#sdk-fr-018)).
3. **Given** charter content that does not hold, **When** it is validated, **Then** the findings remain data grouped by file ([SDK-FR-004](#sdk-fr-004)).
4. **Given** the installed engine, **When** an author implements a calling adapter, **Then** its response types cover fault DTOs without requiring it to catch or inspect a fault class ([SDK-FR-002](#sdk-fr-002), [SDK-FR-004](#sdk-fr-004)).

---

### SDK Story 6 - Know what to do after a failed publication (Priority: P2)

**Status**: Done

A maintainer knows that a failed preflight publishes nothing, while a publish that fails comes after the release commit and tag were pushed. The release reports the state reached and how to publish at the same version.

**Why this priority**: The release instructions must describe the state a maintainer can actually meet.

**Independent Test**: Refuse a preflight, then fail the publication after the push; inspect the publication state and recovery instructions in each case.

**Acceptance Scenarios**:

1. **Given** a check that fails before publication, **When** a release is requested, **Then** nothing is published and the failing check is named ([SDK-FR-016](#sdk-fr-016)).
2. **Given** the release commit and tag pushed and the publication failing, **When** the release reports the failure, **Then** it says they were pushed and are kept, and claims nothing rolled back ([SDK-FR-019](#sdk-fr-019)).
3. **Given** the publication failing, **When** the release reports the failure, **Then** it states that nothing was published and how to publish at the same version ([SDK-FR-019](#sdk-fr-019)).

---

### SDK Story 7 - Read the release's conservative contract policy (Priority: P2)

**Status**: Done

An integrator can tell which version a release requires from the policy the maintainer already chose: changing an existing declaration requires a major version, adding a newly named declaration requires a minor version, and changing comments or layout does not change the contract.

**Why this priority**: It avoids promising a semantic compatibility analysis the release does not perform.

**Independent Test**: Compare releases that add an optional member to an existing declaration, add a newly named declaration, remove an export and change only comments or layout.

**Acceptance Scenarios**:

1. **Given** an existing declaration whose contents change, including an optional member added to it, **When** a non-major release is requested, **Then** it is refused naming that declaration ([SDK-FR-015](#sdk-fr-015)).
2. **Given** only a newly named declaration is added, **When** a minor release is requested, **Then** the contract check permits it; a patch release is refused ([SDK-FR-015](#sdk-fr-015)).
3. **Given** only comments or layout change, **When** a patch release is requested, **Then** the contract check permits it ([SDK-FR-015](#sdk-fr-015)).
4. **Given** an exported name is removed, **When** a non-major release is requested, **Then** it is refused naming the removal ([SDK-FR-015](#sdk-fr-015), [SDK-SC-003](#sdk-sc-003)).

---

### SDK Story 8 - Compose the engine anywhere, from cw's own adapters and one's own (Priority: P1)

**Status**: Done

An integrator imports `cw`'s own store and an agent's projection from `cherry-works`, extends them, and hands the extended ones where the engine is composed; or hands a sessions store, a settings store and a local output of their own, and the use cases that use them answer through them. Composed at a repository and a home that are not on a disk, with nothing handed, the engine is composed. Running a signal's sensors, the integrator names the agent they run for. What the package exports is exactly what the contract says: what composes the engine, the driver ports and their DTOs, the port of every adapter with the models it names, and `cw`'s own adapters — and nothing else.

**Why this priority**: The contract was changed to export the adapters after the stories that proved the old one were Done; the sessions, the settings and the local output cannot be handed today; and composing at an address that is not `file:` fails before any use case runs.

**Independent Test**: From the installed package, list every export and compare it with the contract; extend `cw`'s own charter store and one projection in a type-checked script, compose the engine with them and build a charter; compose at `memory:` addresses with no adapter handed and count the file-system calls; for each adapter the engine is composed with, hand one of the test's own and exercise the use cases that use it.

**Acceptance Scenarios**:

1. **Given** the installed package, **When** every name it exports is listed, **Then** each is what composes the engine, the version, a driver port or its DTO, an adapter's port or a model it names, one of `cw`'s own adapters, or the layout of `cw`'s store or of the output as one value, and no use case, service, driver, command line or portal is among them ([SDK-FR-002](#sdk-fr-002), [SDK-FR-005](#sdk-fr-005), [SDK-FR-020](#sdk-fr-020)).
2. **Given** `cw`'s own charter store and an agent's projection imported from the package, **When** an integrator extends them and composes the engine with the extended ones, **Then** a build answers through the extensions, and the script type-checks against the package alone ([SDK-FR-020](#sdk-fr-020), [SDK-FR-006](#sdk-fr-006)).
3. **Given** a repository and a home at `memory:` addresses, **When** the engine is composed with no adapter handed, **Then** it is composed with no failure and no file-system call ([SDK-FR-011](#sdk-fr-011), [SDK-SC-006](#sdk-sc-006)).
4. **Given** a sessions store, a settings store and a local output of an integrator's own, **When** the engine is composed with them and the use cases that use them run, **Then** each answers through the integrator's own, and `cw`'s own is never reached ([SDK-FR-020](#sdk-fr-020), [SDK-FR-003](#sdk-fr-003), [SDK-SC-005](#sdk-sc-005)).
5. **Given** the contract recorded by the last release, **When** what it says of itself is read, **Then** it says how it was made and that it is the contract of the last release ([SDK-FR-015](#sdk-fr-015), [SDK-FR-016](#sdk-fr-016)).
6. **Given** an integrator composing the engine, **When** it runs a signal's sensors, **Then** it names the agent they run for, or that none is named, and the engine assumes none ([CORE-FR-233](spec-core.md#core-fr-233)).

---

### SDK Story 10 - Trust the evidence of every rewritten Done story (Priority: P2)

**Status**: Done

A maintainer reads the evidence of each `Done` story and knows it proves the scenarios as they now read: SDK Stories 2, 4 and 6 and CORE Stories 13, 48, 49 and 52 were rewritten after their evidence, and their scenarios are run again and their evidence recorded anew.

**Why this priority**: Evidence older than the text it proves proves nothing; it follows the contract stories because they settle the text.

**Independent Test**: For each scenario of SDK Stories 2, 4 and 6 and CORE Stories 13, 48, 49 and 52, name the test or run that proves it, run it, and compare the date of the evidence with the scenario's last rewrite.

**Acceptance Scenarios**:

1. **Given** SDK Stories 2, 4 and 6 and CORE Stories 13, 48, 49 and 52 as they now read, **When** each scenario is run, **Then** a test proves it by behaviour, and the story's evidence names that run, dated after the scenario's last rewrite ([SDK-SC-007](#sdk-sc-007)).

---

### Edge Cases

- A hierarchical address with no host name, such as `memory:/repo/` — it is an address like any other ([SDK-FR-010](#sdk-fr-010)).
- A file name holding characters a URL escapes — the adapter answers with the escaped address under the folder it was asked of, since a file's place in the charter is read from its address ([SDK-FR-008](#sdk-fr-008)).
- A reader that answers a folder's files at an address not under that folder — those files are in no primitive; the contract says so, and the engine does not guess ([SDK-FR-008](#sdk-fr-008)).
- A write that fails halfway through a build — the build says what failed and what was written stays: a build is not atomic, on any adapter ([SDK-FR-004](#sdk-fr-004), [SDK-FR-008](#sdk-fr-008)).
- An adapter that drops an empty file — a kind folder set up empty is not there to read; the charter still reads, since a missing kind folder is an empty one ([SDK-FR-008](#sdk-fr-008)).
- An integrator that hands no fetching adapter — `cw`'s own is composed in, and only vendoring reaches it; authoring never asks for it ([SDK-FR-003](#sdk-fr-003)).
- An integrator composed at a home that is not `file:` that never evaluates — composing succeeds; only an evaluation asks for a real folder ([SDK-FR-011](#sdk-fr-011), [EVAL-FR-021](spec-eval.md#eval-fr-021)).
- An integrator extending one of `cw`'s own adapters rather than writing it anew — it hands the extended one, and the engine composes it as any other it is handed ([SDK-FR-020](#sdk-fr-020)).
- Evaluating over in-memory adapters — not offered: a case runs the real agent in a real folder ([EVAL-FR-021](spec-eval.md#eval-fr-021)).
- Two copies of the engine in one integrator at different versions — each copy answers with its own fault DTOs; the integrator keeps to one version, as with any package ([SDK-FR-004](#sdk-fr-004)).

## Requirements *(mandatory)*

### Functional Requirements

**The package**

- <a id="sdk-fr-001"></a>**SDK-FR-001**: The engine MUST be published as the library `cherry-works` exports, beside `cw` in that one package and under its license, and in no package of its own.
- <a id="sdk-fr-002"></a>**SDK-FR-002**: The package MUST export the ports the engine's applications are entered through and the DTOs they answer, the port of every adapter an integrator may replace, the type of every value that crosses them, bytes included, and what [SDK-FR-020](#sdk-fr-020) exports; nothing else.
- <a id="sdk-fr-003"></a>**SDK-FR-003**: An integrator MUST be able to compose the engine with adapters of its own for every adapter [SDK-FR-020](#sdk-fr-020) lets it replace, handing only those it replaces; an adapter of `cw`'s composed in for the rest MUST NOT reach a disk, start a process or need version control until a use case asks it to. A use case MUST NOT be split by capability or have its ports made optional, and MUST NOT ask for a port it does not use: authoring MUST NOT reach version control or fetch sources. Diagnostics MAY go to `cw`'s own reporter where an integrator hands none for [SDK-FR-017](#sdk-fr-017).
- <a id="sdk-fr-004"></a>**SDK-FR-004**: Every failure of an operation called through a driver port MUST be returned by the use case as a fault DTO, including a failure raised by a driven adapter; no failure of that operation may escape as an exception for the calling adapter to catch. Charter validation findings MUST remain data grouped by file. A calling adapter MUST need no fault class to interpret an answer.
- <a id="sdk-fr-005"></a>**SDK-FR-005**: The library MUST hold no command line or portal, and MUST export no driver, no use case and no service; of the adapters, the domain models and the specifications it MUST export only what [SDK-FR-020](#sdk-fr-020) names ([CORE-FR-223](spec-core.md#core-fr-223)).
- <a id="sdk-fr-006"></a>**SDK-FR-006**: The libraries the engine and its adapters use MUST be bundled into the package, the types its declarations name included, so installing it adds nothing else and an integrator type-checks against it alone.
- <a id="sdk-fr-007"></a>**SDK-FR-007**: The engine's builtin primitives and their assets MUST arrive within what is published, and MUST NOT be read from a disk at run time.
- <a id="sdk-fr-008"></a>**SDK-FR-008**: The package MUST state what a file adapter owes the engine, as part of the contract: a completed write is read back by any later read; writes to one file arrive in the order made, and deletes may be asked at once; a file not there is no failure to read or delete; an empty file is a file; every file listed sits at an address under the folder asked of, escaped as a URL escapes it.
- <a id="sdk-fr-009"></a>**SDK-FR-009**: The library MUST say the version of the engine it holds, as a value an integrator reads, and that version MUST be the one the package was published as, which its `cw` names.

**Addresses**

- <a id="sdk-fr-010"></a>**SDK-FR-010**: A repository MUST be named by a URL with a hierarchical path, ending in its separator. Any other MUST be refused with a fault saying what is wanted.
- <a id="sdk-fr-011"></a>**SDK-FR-011**: The engine MUST NOT assume the `file:` scheme: what it derives from a repository or a home MUST stay under that address's scheme and MUST tell addresses differing only in their host name apart; an absolute sessions folder MUST be taken under the home's scheme; and composing the engine at addresses of any scheme, with no adapter handed, MUST succeed, an address being turned into a path only when a use case reaches a disk.
- <a id="sdk-fr-012"></a>**SDK-FR-012**: At a `file:` address, every use case MUST read, write and answer what it did before these addresses were allowed.

**`cw` and the release**

- <a id="sdk-fr-013"></a>**SDK-FR-013**: `cw` and the library MUST be one package, `cherry-works`, depending on no other, and `cw` MUST run as it did before the library was in it.
- <a id="sdk-fr-014"></a>**SDK-FR-014**: The contract MUST be what the package exports and what [SDK-FR-008](#sdk-fr-008) states, and nothing else: anything reached any other way is internal, and MAY change in any release.
- <a id="sdk-fr-015"></a>**SDK-FR-015**: From the first publish, removing an exported name or changing the contents of an existing declaration — a compatible optional member added included — MUST be a major version; adding a newly named declaration MUST be a minor one; comments or layout alone MUST change no version. Compatibility MUST NOT be analysed beyond that. A release breaking the contract without a new major, or adding a newly named declaration in a patch, MUST be refused, naming what changed. A breaking change MUST be named in the changelog. Only what the package exports is compared: the duties [SDK-FR-008](#sdk-fr-008) states are prose, and whoever changes them versions and names the change by hand. Each release MUST record the contract anew, module by module, from the library it publishes, and the contract MUST say how it was made and whether anything has been published under it.
- <a id="sdk-fr-016"></a>**SDK-FR-016**: The library MUST go out only inside `cherry-works`, at its version, after the checks of [CORE-FR-134](spec-core.md#core-fr-134) and an import of the installed library pass. A preflight check failing MUST publish nothing. A failure of the publication MUST be reported under [SDK-FR-019](#sdk-fr-019). The first version published under this contract MUST be 1.0.0.
- <a id="sdk-fr-019"></a>**SDK-FR-019**: A release that fails during publication MUST report that nothing was published, that the release commit and tag pushed are kept, and how the maintainer can publish at the same version; it MUST NOT claim that anything was rolled back.
- <a id="sdk-fr-020"></a>**SDK-FR-020**: The library MUST export how `cw` composes the engine, taking only the adapters an integrator replaces and composing `cw`'s own for every other ([CORE-FR-230](spec-core.md#core-fr-230)). Every store and runner the engine is composed with MUST be replaceable — the store that keeps the charter, the sessions, the settings, the local output, and each agent's projection and command line included — all handed as one set that may be partial. The library MUST export each adapter's port, the models that port names, and `cw`'s own adapters for an integrator to extend; the layout of the store `cw` keeps MUST be one value, as the output's layout is, and no constant or helper MUST be exported beside them. An agent's projection MUST be told where the charter is edited, never read it off the layout of `cw`'s store. Where an integrator hands no store or projection, `cw`'s own MUST be set up over the file adapters it hands, the sessions store included — a file reader handed without a way to read another root folder answering a fault the caller corrects, naming it — so files kept anywhere keep the charter and the sessions there too.

**Failures**

- <a id="sdk-fr-017"></a>**SDK-FR-017**: Before answering an internal failure, the use case MUST record its diagnostic details and cause through the operator's diagnostics, without recording secrets. A failure caused by a request the caller can correct MUST NOT be recorded as an internal failure.
- <a id="sdk-fr-018"></a>**SDK-FR-018**: A fault DTO MUST identify the fault and give its message and next move. An internal failure MUST answer with a generic internal-failure identity, message and next move, withholding its diagnostic details; a caller-correctable fault MUST retain its actionable explanation.

### Key Entities

- **Public contract**: What the package exports, and what it states an adapter owes the engine. Versioned; everything else is internal.
- **The engine's adapters**: Every store and runner the engine is composed with, handed as one set that may be partial: each one an integrator leaves out is `cw`'s own.
- **Integrator**: A program that composes the engine through the package, as `cw` itself does, handing in the adapters it replaces ([SDK-FR-003](#sdk-fr-003)).
- **Repository address**: A URL naming the folder of a repository, on whatever the adapters behind it keep. Its scheme is theirs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- <a id="sdk-sc-001"></a>**SDK-SC-001**: Through the built package alone, one test sets a repository up, adds a primitive, validates it and builds it, with 0 file-system calls and 0 processes started.
- <a id="sdk-sc-002"></a>**SDK-SC-002**: For the same charter, the files a build leaves in memory and the files `cw build` leaves on disk are identical, byte for byte.
- <a id="sdk-sc-003"></a>**SDK-SC-003**: Every incompatible change to the contract between two published versions carries a major version.
- <a id="sdk-sc-004"></a>**SDK-SC-004**: An integrator composes the engine to author a charter with fewer than 100 lines of adapter of their own.
- <a id="sdk-sc-005"></a>**SDK-SC-005**: For 100% of the adapters the engine is composed with, a test replaces `cw`'s own with one of its own, and every use case that uses it answers through it; an evaluation runner handed still runs in a real folder.
- <a id="sdk-sc-006"></a>**SDK-SC-006**: Composing the engine at a repository and a home of a scheme other than `file:`, with no adapter handed, makes 0 file-system calls and raises 0 failures.
- <a id="sdk-sc-007"></a>**SDK-SC-007**: 100% of the scenarios of `Done` stories the contract's rewrite touched are proven by a test or a run recorded after their last rewrite.

## Assumptions

- An integrator works in TypeScript or JavaScript, on the Node version the engine requires.
- The maintainer holds the rights to publish `cherry-works` on npm.
- `cw` and the library share the package's version, so the first release under this contract moves it from 0.9 to 1.0.0.
- An integrator without git takes on what git gave a repository: reviewing what changes, its history, and undoing a build. The engine does not supply them.

## Out of Scope

- A store `cw` ships beyond its file and in-memory ones, such as a database store.
- An entry point made for one integrator.
- Any dependency on a central service.
- Splitting a use case by what it can do, or making its ports optional.
- Exporting the command line or the portal as a library.
- Evaluating away from a real folder and git.
- Changing the charter's format or validation rules: the CORE spec sets them ([CORE-FR-224](spec-core.md#core-fr-224), [CORE-FR-226](spec-core.md#core-fr-226)).
