# Spec: SDK — the engine as a package other tools build on

**Created**: 2026-11-02

**Updated**: 2026-11-02

**Input**: User description: "Publish the Cherry Works hexagon as an npm package, so a third party can import the engine's logic and write driver and driven adapters of their own, without `main.ts`, the command line or any adapter of this repository; a repository's address need not be a `file:` one; a test proves authoring through the built package on in-memory adapters, touching no disk."

## Overview

Until now the engine could only be reached through `cw`, or through a portal listening on 127.0.0.1 for one repository. A tool that wanted the charter's rules had to shell out to a command, or write them again.

The engine's rules already stand apart from every adapter, so this part publishes them. A tool author installs one package, puts their own adapters behind its ports, and has the engine's use cases: where the charter is kept and how it is reached are theirs to decide.

It serves whoever writes a tool on top of the engine, not the developer using `cw`. What is published is a contract, and it is kept as one ([ADR-002](ADR.md#adr-002-the-engines-public-contract-is-what-its-package-exports)).

## Clarifications

### Session 2026-11-02

- Q: One package, or one entry of the package there is? → A: A package of its own, `@cherry-works/engine`, carrying the version of `cherry-works` and released with it. `cherry-works` does not depend on it, and installing `cherry-works` adds what it adds today ([SDK-FR-001](#sdk-fr-001), [SDK-FR-009](#sdk-fr-009), [SDK-FR-016](#sdk-fr-016)).
- Q: Are the libraries the engine's rules use bundled into it, or depended on? → A: Depended on: the types of what crosses the ports are made from one of them, so a tool author needs it anyway, and a fix to either reaches them without a release ([SDK-FR-006](#sdk-fr-006)).
- Q: How do the engine's own builtin files travel? → A: Inside what is published, as they do in `cw`: nothing is read from disk at run time to get them ([SDK-FR-007](#sdk-fr-007)).
- Q: How stable is the contract, and how is it versioned? → A: Semantic versioning from the first publish, which is 1.0.0; the number is shared with `cw`, so a breaking change to the contract moves `cw`'s major version too ([SDK-FR-015](#sdk-fr-015), [SDK-FR-016](#sdk-fr-016)).
- Q: Which addresses may name a repository? → A: Any URL with a hierarchical path, ending in its separator; any other is refused with a fault saying so. A `file:` address behaves exactly as it did ([SDK-FR-010](#sdk-fr-010), [SDK-FR-011](#sdk-fr-011), [SDK-FR-012](#sdk-fr-012)).
- Q: Which use cases need git? → A: Evaluating, and reaching a source. Authoring, validating, building, testing, setting up and the health check need no version control, since nothing tells an edited vendor ([SDK-FR-003](#sdk-fr-003)).
- Q: Is a constructor split so a tool author passes only the ports they use? → A: No. Constructors keep their shape; what drops out is the ports a use case no longer uses ([SDK-FR-003](#sdk-fr-003)).
- Q: Do the writes rely on being read back? → A: Yes: setup writes and then builds from what it wrote. No use case relies on two writes landing together, and a build is not atomic. The adapter's duties are part of the contract ([SDK-FR-008](#sdk-fr-008)).
- Q: What of a binary asset, when the ports carry text? → A: The ports carry it whole, and this lands before the first publish, since a change to a port afterwards would be a breaking one ([CORE-FR-208](spec-core.md#core-fr-208), [SDK-FR-002](#sdk-fr-002)).
- Q: How is what goes wrong handed back? → A: As the engine does today, both ways: what is wrong with a charter is data in the answer; what stops a use case is raised as a fault carrying its message and its fix. The fault is exported, so a tool can tell it from any other error ([SDK-FR-004](#sdk-fr-004)).

## User Scenarios & Testing *(mandatory)*

### SDK Story 1 - Keep a repository at any address (Priority: P2)

**Status**: Done

A tool keeps its charters in a database, and names one with an address of its own. Today most of the engine would take that address, and the part that reviews sessions would not: it writes a `file:` address of its own, and it tells two repositories apart by their path alone. After this, nothing in the engine assumes a disk, an address that cannot hold a folder is refused at once with a fault saying what is wanted, and `cw` on a `file:` address behaves as it did.

**Why this priority**: The published contract says a repository is an address, and a publish before this would promise what the engine does not keep.

**Independent Test**: Review the sessions of two repositories at `memory://a/` and `memory://b/` under a home at another such address, on adapters holding them in memory, and confirm each reads its own sessions, under that scheme. Repeat on `file:` addresses, and confirm the folders and the answer are as they were.

**Acceptance Scenarios**:

1. **Given** two repositories at addresses differing only in their host, **When** the sessions of each are reviewed, **Then** each reads a folder of its own ([SDK-FR-011](#sdk-fr-011)).
2. **Given** a home at an address that is not `file:` and a sessions folder set as an absolute path, **When** the sessions are reviewed, **Then** that folder is read under the home's scheme, and no `file:` address is asked for ([SDK-FR-011](#sdk-fr-011)).
3. **Given** a repository at an address that is not `file:`, **When** a review answers, **Then** the sessions folder it names tells that repository's from any other's ([SDK-FR-011](#sdk-fr-011)).
4. **Given** an address with no hierarchical path, or one not ending in its separator, **When** a use case is built on it or asked anything, **Then** a fault says what the address must be ([SDK-FR-010](#sdk-fr-010)).
5. **Given** a repository at a `file:` address, **When** any `cw` command runs, **Then** it reads, writes and says what it did before this ([SDK-FR-012](#sdk-fr-012)).

---

### SDK Story 2 - Import the engine from a package of its own (Priority: P1)

**Status**: Done

A tool author installs `@cherry-works/engine`, and imports from it the use cases, the ports they are entered through, the ports they call out to, and the types that cross them. They ask it which version of the engine they hold. Nothing of the command line, the portal or the adapters comes with it, and what the engine keeps inside stays inside.

**Why this priority**: It is what the phase is for, and every story after it is proved through it.

**Independent Test**: Build the package, install what it packs into an empty folder, and from a type-checked script import a use case, a port and a fault, and read the version. Confirm the packed files hold no command line, portal or adapter, and that importing anything internal fails.

**Acceptance Scenarios**:

1. **Given** the installed package, **When** a TypeScript consumer imports the use cases and both sides' ports, **Then** they resolve with their types, and nothing else need be installed by hand ([SDK-FR-001](#sdk-fr-001), [SDK-FR-002](#sdk-fr-002), [SDK-FR-006](#sdk-fr-006)).
2. **Given** the installed package, **When** its files are listed, **Then** it holds no command line, no portal, no adapter and no composition root ([SDK-FR-005](#sdk-fr-005)).
3. **Given** the installed package, **When** something the contract does not name is imported, **Then** the import fails ([SDK-FR-005](#sdk-fr-005), [SDK-FR-014](#sdk-fr-014)).
4. **Given** the installed package, **When** its version is read, **Then** it is the version it was published as, and the same one `cw` of that release names ([SDK-FR-009](#sdk-fr-009)).
5. **Given** a use case stopped by a fault, **When** the tool catches it, **Then** it is told from any other error by the exported fault, and holds its message and its fix ([SDK-FR-004](#sdk-fr-004)).
6. **Given** a charter with something wrong in it, **When** a use case is asked of it, **Then** what is wrong comes back as data in the answer, by file ([SDK-FR-004](#sdk-fr-004)).
7. **Given** the package imported where no builtin file could be read from disk, **When** the charter is read, **Then** the engine's own primitives and their assets are there ([SDK-FR-007](#sdk-fr-007)).
8. **Given** `cherry-works` installed, **When** what it added is listed, **Then** it is what it was before this package existed ([SDK-FR-013](#sdk-fr-013)).

---

### SDK Story 3 - Author a charter with no disk and no git (Priority: P1)

**Status**: Done

A tool author writes a reader and a writer over a map in memory, and hands them, with a YAML parser and a token counter of their own, to the authoring use case. They set a repository up, add a primitive, validate the charter and build it: no disk is touched, no process is started, and no version control stands behind any of it.

**Why this priority**: It is the claim of the phase, proved the only way that counts: through what is published, from outside.

**Independent Test**: In a test that imports only the built package, compose the authoring use case over adapters holding everything in memory, at a `memory:` address. Set up, add a guide, validate it, add one that breaks a rule and read the fault, then build and read the compiled file back from the map. Confirm no call reaches the file system or starts a process.

**Acceptance Scenarios**:

1. **Given** in-memory adapters at a `memory:` address, **When** the repository is set up, **Then** its settings and kind folders are in the map, and its first build is too ([SDK-FR-003](#sdk-fr-003), [SDK-SC-001](#sdk-sc-001)).
2. **Given** that repository, **When** a primitive is added and the charter validated, **Then** the primitive is in the map and the charter holds ([SDK-SC-001](#sdk-sc-001)).
3. **Given** that repository, **When** a primitive that breaks a rule is added, **Then** the answer says what is wrong, as `cw add` would, and nothing is written ([SDK-FR-004](#sdk-fr-004)).
4. **Given** that repository, **When** it is built, **Then** the compiled files are in the map, exactly as `cw build` writes them to a disk for the same charter ([SDK-SC-002](#sdk-sc-002)).
5. **Given** an adapter that reads back what was written and honours the rest of the contract, and nothing more, **When** every authoring use case runs, **Then** each answers as it does on a disk ([SDK-FR-008](#sdk-fr-008)).

---

### SDK Story 4 - Publish the engine with every release (Priority: P2)

**Status**: Todo

A maintainer releases one version. The package goes out with `cherry-works` at the same number, under the same checks, or neither does. The first release of both is 1.0.0, and from then on a change that breaks the contract is a major one, written in the changelog.

**Why this priority**: A contract nobody can install promises nothing; it comes last because a publish cannot be taken back.

**Independent Test**: Run a release dry-run and confirm it checks both packages at one version and publishes neither. Make the package fail a check, and confirm the release is refused for both. Remove something the contract names, and confirm the release is refused without a major version.

**Acceptance Scenarios**:

1. **Given** a release of one version, **When** it passes, **Then** both packages are published at that version ([SDK-FR-016](#sdk-fr-016)).
2. **Given** a check of either package failing, **When** a release is asked for, **Then** nothing is published of either, and it says which ([SDK-FR-016](#sdk-fr-016)).
3. **Given** a contract narrowed or changed against the last release, **When** a version that is not a new major is released, **Then** it is refused, naming what changed ([SDK-FR-015](#sdk-fr-015), [SDK-SC-003](#sdk-sc-003)).
4. **Given** a major release, **When** it is published, **Then** the changelog names each change that broke the contract ([SDK-FR-015](#sdk-fr-015)).

---

### Edge Cases

- A hierarchical address with no host, such as `memory:/repo/` — it is an address like any other.
- A file name holding characters a URL escapes — the adapter answers with the escaped address under the folder it was asked of, since a file's place in the charter is read from its address.
- A reader that answers a folder's files at an address not under that folder — those files are in no primitive; the contract says so, and the engine does not guess.
- A write that fails halfway through a build — the build says what failed and what was written stays: a build is not atomic, on any adapter.
- An adapter that drops an empty file — a kind folder set up empty is not there to read; the charter still reads, since a missing kind folder is an empty one.
- A tool that uses vendoring with no fetching adapter — the vendoring use case cannot be built without one; the authoring one does not ask for it.
- Evaluating over in-memory adapters — not offered: a case runs the real agent in a real folder ([EVAL-FR-021](spec-eval.md#eval-fr-021)).
- Two copies of the engine in one tool at different versions — each fault is its own copy's; the tool keeps to one version, as with any package.

## Requirements *(mandatory)*

### Functional Requirements

**The package**

- <a id="sdk-fr-001"></a>**SDK-FR-001**: The engine MUST be published as a package of its own, `@cherry-works/engine`, under the license `cherry-works` carries.
- <a id="sdk-fr-002"></a>**SDK-FR-002**: The package MUST export the use cases, the ports they are entered through, the ports they call out to, and the type of every value that crosses them, bytes included.
- <a id="sdk-fr-003"></a>**SDK-FR-003**: A tool MUST be able to compose a use case with adapters of its own and nothing else of this repository. Constructors keep their shape, and no use case may ask for a port it does not use: the authoring use case MUST NOT ask for version control or for fetching sources.
- <a id="sdk-fr-004"></a>**SDK-FR-004**: What is wrong with a charter MUST come back as data in the use case's answer, and what stops a use case MUST be raised as a fault holding its message and its fix. The fault an engine raises and the one an adapter raises MUST both be exported.
- <a id="sdk-fr-005"></a>**SDK-FR-005**: The package MUST hold no command line, portal, adapter or composition root, and MUST export nothing of the domain models, the services or the specifications beyond what a port itself names.
- <a id="sdk-fr-006"></a>**SDK-FR-006**: The libraries the engine's rules use MUST be declared as dependencies of the package, and installing it MUST add nothing beyond them.
- <a id="sdk-fr-007"></a>**SDK-FR-007**: The engine's builtin primitives and their assets MUST arrive within what is published, and MUST NOT be read from a disk at run time.
- <a id="sdk-fr-008"></a>**SDK-FR-008**: The package MUST state what a file adapter owes the engine, as part of the contract: a completed write is read back by any later read; writes to one file arrive in the order made, and deletes may be asked at once; a file not there is no failure to read or delete; an empty file is a file; every file listed sits at an address under the folder asked of, escaped as a URL escapes it.
- <a id="sdk-fr-009"></a>**SDK-FR-009**: The package MUST say the version of the engine it holds, as a value a tool reads, and that version MUST be the one it was published as.

**Addresses**

- <a id="sdk-fr-010"></a>**SDK-FR-010**: A repository MUST be named by a URL with a hierarchical path, ending in its separator. Any other MUST be refused with a fault saying what is wanted.
- <a id="sdk-fr-011"></a>**SDK-FR-011**: Nothing in the engine MUST assume the `file:` scheme: what it derives from a repository or a home MUST stay under that address's scheme, MUST tell addresses differing only in their host apart, and an absolute sessions folder MUST be taken under the home's scheme.
- <a id="sdk-fr-012"></a>**SDK-FR-012**: At a `file:` address, every use case MUST read, write and answer what it did before these addresses were allowed.

**`cw` and the release**

- <a id="sdk-fr-013"></a>**SDK-FR-013**: `cherry-works` MUST NOT depend on the package, and what installing it adds MUST NOT grow by it.
- <a id="sdk-fr-014"></a>**SDK-FR-014**: The contract MUST be what the package exports and what [SDK-FR-008](#sdk-fr-008) states, and nothing else: anything reached any other way is internal, and MAY change in any release.
- <a id="sdk-fr-015"></a>**SDK-FR-015**: The contract MUST follow semantic versioning from the first publish: a removal or an incompatible change is a major version, an addition a minor one, and a release narrowing the contract without one MUST be refused. A breaking change MUST be named in the changelog.
- <a id="sdk-fr-016"></a>**SDK-FR-016**: The package and `cherry-works` MUST carry one version number and be released together, under the checks of [CORE-FR-134](spec-core.md#core-fr-134), or neither is. The first version of both published under this contract MUST be 1.0.0.

### Key Entities *(include if the product holds data)*

- **Public contract**: What the package exports, and what it states an adapter owes the engine. Versioned; everything else is internal.
- **Repository address**: A URL naming the folder of a repository, on whatever the adapters behind it keep. Its scheme is theirs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- <a id="sdk-sc-001"></a>**SDK-SC-001**: Through the built package alone, one test sets a repository up, adds a primitive, validates it and builds it, with 0 file-system calls and 0 processes started.
- <a id="sdk-sc-002"></a>**SDK-SC-002**: For the same charter, the files a build leaves in memory and the files `cw build` leaves on disk are identical, byte for byte.
- <a id="sdk-sc-003"></a>**SDK-SC-003**: Every incompatible change to the contract between two published versions carries a major version.
- <a id="sdk-sc-004"></a>**SDK-SC-004**: A tool author composes the authoring use case with fewer than 100 lines of adapter of their own.

## Assumptions

- A tool author works in TypeScript or JavaScript, on the Node version the engine requires.
- The maintainer holds the `@cherry-works` scope on npm.
- `cw` takes the first public version too, so the first release under this contract moves it from 0.9 to 1.0.0.
- A tool without git takes on what git gave a repository: reviewing what changes, its history, and undoing a build. The engine does not supply them.

## Out of Scope

- A port for storage other than the file ports there are, or a rewrite of how a charter is read.
- An entry point made for one integrator.
- Any dependency on a central service.
- Splitting a use case's constructor, or making its ports optional.
- Publishing the command line, the portal or any adapter as a library.
- Evaluating away from a real folder and git.
- Changing the charter's format or validation rules, beyond what [CORE Story 38](spec-core.md#core-story-38---keep-a-binary-asset-whole-priority-p2) needs.
