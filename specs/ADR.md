# Architecture Decision Records

## ADR-001: A primitive is named by its id alone

**Date**: 2026-10-02 · **Status**: Accepted · **Story**: [CORE Story 27](spec-core.md#core-story-27---name-every-primitive-by-its-id-alone-priority-p1) ([CORE-FR-015](spec-core.md#core-fr-015), [CORE-FR-171](spec-core.md#core-fr-171), [CORE-FR-172](spec-core.md#core-fr-172))

### Decision

The identity `kind:id` is removed. An id is unique across the whole charter,
whatever its kind, and it is the only name a primitive has.

| Where the name is written | How |
|---|---|
| A header (`rationale`, `mixins`), a test case, a command | the bare id: `rationale: why-small`, `cw explain no-any` |
| A body, a sensor's `run`, an agent's `tools` | `[[<id>]]`: `run [[check]]`, `"[[linear]]:list_issues"` |

Every `[[<id>]]` in a body, of any kind, is built into a link to that
primitive's compiled file. The catalogue lists `kind` and `id`, nothing else.

### Why

- **The host file is named by the id.** A skill is invoked as `/sdd-plan`,
  not `/skill-sdd-plan`, so `guide:x` and `skill:x` would both want one
  name. One id per primitive removes the clash instead of working around it.
- **The kind was noise.** The author already chose the id; writing
  `corpus:` or `script:` in front of it added nothing the primitive does not
  already say about itself.
- **One way to name, one way to link.** Before, only `mcp:`, `script:` and
  `template:` were found in a body, each by its own pattern. Now `[[<id>]]`
  finds any primitive, and only text written that way is a reference, so prose
  is never taken for one.

### Consequences

- **Breaking for every charter.** `rationale: corpus:x` becomes
  `rationale: x`; `script:x`, `mcp:x` and `template:x` in a body become `[[x]]`;
  `activate: "guide:x"` in a test becomes `activate: "x"`. The earlier way is
  not read, and not reported either.
- **Ids that two kinds shared must split.** A guide and the corpus explaining
  it can no longer share an id; the corpus becomes `why-<id>`.
- **Quote a header value that starts with `[[`.** YAML reads `run: [[check]]`
  as a list inside a list: write `run: "[[check]]"`.
- **A field that takes one kind reads an id of another as missing.**
  `rationale: some-guide` is a rationale no corpus answers to; no separate
  "wrong kind" error exists.
- The served name of an mcp's tools is hashed from its id rather than from
  `mcp:<id>`, so it changes once.

## ADR-002: The engine's public contract is what its package exports

**Date**: 2026-11-02 · **Status**: Accepted · **Story**: [SDK Story 2](spec-sdk.md#sdk-story-2---import-the-engine-from-the-package-cw-comes-in-priority-p1), [SDK Story 4](spec-sdk.md#sdk-story-4---publish-the-engine-with-every-release-priority-p2) ([SDK-FR-001](spec-sdk.md#sdk-fr-001), [SDK-FR-014](spec-sdk.md#sdk-fr-014), [SDK-FR-015](spec-sdk.md#sdk-fr-015), [SDK-FR-016](spec-sdk.md#sdk-fr-016))

### Decision

The engine is published as `@cherry-works/engine`, apart from `cherry-works`,
which does not depend on it. What that package exports, with what it states an
adapter owes the engine, is a public contract; everything else is internal.

The contract follows semantic versioning from its first publish, 1.0.0. The
package and `cw` share one version number and one release.

### Why

- **A separate package keeps `cw` as it is.** Installing `cherry-works` adds a
  bundle with no dependencies; an entry inside it would grow that, or bring
  dependencies with it.
- **Integrators build on ports.** A port changed in a minor release breaks
  someone else's adapter, and they cannot be asked first.
- **One number is one thing to trace.** Any report names one engine, whichever
  way it was reached.

### Consequences

- **A port, a constructor or a type that crosses them can no longer change
  freely.** Before changing one, ask whether it is a major release.
- **A breaking change to the contract moves `cw`'s major version too**, even
  when `cw` itself behaves the same.
- **Domain models, services and specifications stay free to change**, and a
  port must not leak them: what a port names is in the contract.
- **`cw` goes from 0.9 to 1.0.0** with the first release.

## ADR-003: Git fetches sources; it is not the engine's baseline

**Date**: 2026-11-02 · **Status**: Accepted · **Story**: [CORE Story 35](spec-core.md#core-story-35---set-a-repository-up-anywhere-with-or-without-git-priority-p2), [CORE Story 37](spec-core.md#core-story-37---install-and-remove-a-vendor-source-in-any-folder-priority-p3) ([CORE-FR-054](spec-core.md#core-fr-054), [CORE-FR-107](spec-core.md#core-fr-107), [CORE-FR-053](spec-core.md#core-fr-053), [CORE-FR-204](spec-core.md#core-fr-204), [CORE-FR-206](spec-core.md#core-fr-206))

### Decision

No use case asks for version control unless it cannot work without it.

| Asked of git | By |
|---|---|
| Reaching a source and reading what it holds | installing and injecting a vendor source, on a port of its own, named for fetching sources and not for vendors |
| Worktrees of the last commit | evaluating, on a port of its own |

Setup and the portal do not ask. Nothing tells an edited vendor any more
([ADR-004](#adr-004-nothing-tells-an-edited-vendor)), and removing a vendor
neither commits nor looks at work in hand. The one port for version control goes.

### Why

- **Those checks protected nothing they used.** Setup and the portal asked once
  and used nothing of the answer.
- **The engine is published for tools with no git**, and a port with ten
  questions, of which authoring asks two, is a cost with no return.

### Consequences

- **Breaking for `cw`.** A folder outside git is now set up rather than refused,
  and removing a vendor no longer commits.
- **A repository without git has no review, history or undo of its charter.**
  The engine does not enforce them; the tool or the developer takes them on.

## ADR-004: Nothing tells an edited vendor

**Date**: 2026-11-02 · **Status**: Accepted · **Story**: [CORE Story 37](spec-core.md#core-story-37---install-and-remove-a-vendor-source-in-any-folder-priority-p3) ([CORE-FR-046](spec-core.md#core-fr-046), [CORE-FR-053](spec-core.md#core-fr-053), [CORE-FR-080](spec-core.md#core-fr-080), [CORE-FR-081](spec-core.md#core-fr-081))

### Decision

The engine no longer checks whether a vendored file was edited, by git or by a
record of its own. `cw doctor` asks three questions, with no line for vendors,
`cw vendor add` and `cw vendor remove` compare nothing, and nothing is kept
beside a vendor.

A story that would have judged an edit from a hash in `.cw/vendor.json` was
built, reviewed and dropped before it landed.

### Why

- **The check cost more than the edit it catches.** A vendor is replaced by
  installing it again, and an edit is seen in the diff that brought it.
- **One hash could not tell an edit from noise.** `.DS_Store`, a file git
  ignores, a checkout's line endings, a folder that does not read and a
  removal each needed a rule of their own, and each rule brought the next
  fault: ten reviews of it failed.
- **A hash that refuses work has to be undone by hand.** Refusing installs and
  removals over a difference left a repository stuck with nothing to undo.
- **Git was no answer either.** It cannot see an edit that was committed, it
  reports a source just installed as edited, and the engine is published for
  tools with no git.

### Consequences

- **Breaking for `cw`.** `doctor` no longer fails on an edited vendor, so a CI
  gate on it no longer catches one.
- **Read-only is a convention.** Docs still call a vendor read-only; nothing
  enforces it, and review of the diff is what catches an edit.
- **`ForVCS` loses `changedUnder`**, and `CharterAuthoring` no longer takes
  version control.

## ADR-005: A use case returns failures as DTOs and logs internal details

**Date**: 2026-11-03 · **Status**: Accepted · **Story**: [SDK Story 5](spec-sdk.md#sdk-story-5---receive-every-use-case-failure-as-a-dto-priority-p1) ([SDK-FR-004](spec-sdk.md#sdk-fr-004), [SDK-FR-017](spec-sdk.md#sdk-fr-017), [SDK-FR-018](spec-sdk.md#sdk-fr-018))

### Decision

Failures of operations called through a driver port are returned as DTOs by the use case. The calling adapter needs no fault class and catches no operation failure. Internal diagnostic details and causes are recorded for the operator, without secrets, before a generic fault answer is returned. Caller-correctable refusals retain their actionable explanation.

### Why

The user chose the use case as the failure boundary: the operator reads the logs, while the adapter calling in reads DTOs alone. This replaces the exception behaviour originally accepted for [SDK Story 2](spec-sdk.md#sdk-story-2---import-the-engine-from-the-package-cw-comes-in-priority-p1) under [SDK-FR-004](spec-sdk.md#sdk-fr-004); ADR-002's package and versioning decisions remain in force.

### Consequences

Use cases, crossing response types, calling adapters and installed-package tests must agree on the DTO boundary. Driven adapters may raise faults internally; the use case translates them before answering. The public contract changes and is versioned under [SDK-FR-015](spec-sdk.md#sdk-fr-015). Existing Done evidence for [SDK Story 2](spec-sdk.md#sdk-story-2---import-the-engine-from-the-package-cw-comes-in-priority-p1) predates this reversal and does not prove the new behaviour; [SDK Story 5](spec-sdk.md#sdk-story-5---receive-every-use-case-failure-as-a-dto-priority-p1) supplies that evidence.

## ADR-006: A catalogue entry names the primitive and the file that holds it

**Date**: 2026-11-05 · **Status**: Accepted · **Story**: [CORE Story 40](spec-core.md#core-story-40---read-one-consistent-account-of-the-charters-behaviour-priority-p1) ([CORE-FR-025](spec-core.md#core-fr-025))

### Decision

A catalogue entry holds the primitive's kind, its id, its description, the file its body is in, and the files it applies to where it names any. The file is `catalogue.json`. This replaces the sentence in [ADR-001](#adr-001-a-primitive-is-named-by-its-id-alone) that the catalogue lists kind and id and nothing else. The rest of ADR-001 stands.

### Why

An author opening the catalogue has to know which file to read and what the primitive is for. The id remains the only name the primitive has; the kind is a field of its entry. The sentence in ADR-001 said less than [CORE-FR-025](spec-core.md#core-fr-025) already required, and the file is written under `catalogue.json`.

### Consequences

A reader of the catalogue sees the description, the file and the globs as well as the kind and the id. ADR-001 is not rewritten.

## ADR-007: A source file is named `<kebab-subject>.<role>.ts`

**Date**: 2026-11-06 · **Status**: Accepted · **Story**: [CORE Story 42](spec-core.md#core-story-42---keep-the-engines-architecture-consistent-with-its-charter-priority-p2) ([CORE-SC-058](spec-core.md#core-sc-058))

### Decision

Every file under `src/`, but the portal's page, is named as NestJS names one: the subject in kebab-case, then the role its folder gives it — `build-charter.service.ts`, `managing-charter.use-case.ts`, `reading-files.port.ts`, `in-memory-file-output.adapter.ts`, `charter-root.model.ts`, `adapter.fault.ts`, `add.command.ts`. The class or object inside keeps its name. Only `helper.ts`, `index.ts` and the entry file `main.ts` keep a bare name. Amended on 2026-11-06 at the user's word ([CORE Story 44](spec-core.md#core-story-44---keep-a-repositorys-state-in-a-store-of-ones-own-priority-p2)): a model under `domain/models/` keeps its subject alone, with no `.model` — `charter-root.ts` — since its folder says what it is. This replaces the earlier rule of `hexagonal-naming` that a file is named as the class it holds (`SigningIn.ts`).

### Why

The user chose it at the hand-over of [CORE Story 42](spec-core.md#core-story-42---keep-the-engines-architecture-consistent-with-its-charter-priority-p2): a file's name then says its role before it is opened, in one case and one pattern across the whole tree, never camelCase, PascalCase or snake_case.

### Consequences

Every later story names a new file this way, as `hexagonal-naming` and `architecture-map` now say. Imports, the paths in `.dependency-cruiser.cjs` and the `touchFile` cases of `.cw/test/` follow the new names. A script asset keeps the name it is put down under (`sessionTokensCounter.mjs`), whatever its source file is called. The portal's page keeps its own React naming.

## ADR-008: A use case loads and saves through repositories, and follows its own logic in private methods

**Date**: 2026-11-06 · **Status**: Accepted · **Story**: [CORE Story 42](spec-core.md#core-story-42---keep-the-engines-architecture-consistent-with-its-charter-priority-p2) ([CORE-SC-058](spec-core.md#core-sc-058))

### Decision

The hexagon's `service/` folder is gone. What read and wrote the repository's state through the file ports is a repository: a port `ForStoring<Thing>` or `ForLoading<Thing>` in `port/zdriven/`, in the domain's words, answered by a class in `application/repositories/` built over the driven ports (`CharterRepository`, `VendorsRepository`, `TestSuitesRepository`, `SettingsRepository`, `EvalSuitesRepository`, `SensorsRepository`, `SessionAnalysisRepository`, `CredentialsRepository`). Each is named for the state it keeps, never for where it keeps it: whether that is files, memory or a database is the driven ports' to say. The composition root builds them and hands them to the use cases' constructors, and `@cherry-works/engine` exports them. Logic that one use case alone followed is a private method of its class (`#estimateMainContext`, `#countExactMainContext`, `#injectVendor`, `#runWithPromptfoo`). Every use case extends `ApplicationService` (`application/application-service.base.ts`), whose `answerWithFaultDTO` every operation answers through and which writes the log. What several use cases follow and is no repository's stays a service, in `application/services/` (`BuildCharterService`, `LoadMcpOriginsService`). The domain's factories move to `domain/factories/`; `domain/services/` keeps the pure services.

### Why

The user asked at the hand-over of [CORE Story 42](spec-core.md#core-story-42---keep-the-engines-architecture-consistent-with-its-charter-priority-p2) for the layout hexagonal applications use in practice: the use case as the application service, state behind a repository, pure logic in the domain. The repositories sit in the hexagon rather than in `zdriven/` because [SDK-FR-005](spec-sdk.md#sdk-fr-005) keeps every adapter out of the engine, and a repository holds the rules of reading a charter, which a tool author must not have to write again.

### Consequences

Each use case's constructor takes its repositories in place of the file ports only they used; the engine is unreleased, so no version records the old signatures. A tool author builds the repositories over their own adapters; the domain's models a repository answers with are not exported, so they do not write repositories of their own. `driven-port-speaks-its-adapter` names a repository's port as its one exception. Tests build each use case as `main.ts` does, in `test/use-cases-of.ts`.

## ADR-009: A storage port carries plain records, and the engine builds its models from them

**Date**: 2026-11-06 · **Status**: Accepted · **Story**: [CORE Story 44](spec-core.md#core-story-44---keep-a-repositorys-state-in-a-store-of-ones-own-priority-p2) ([CORE-FR-213](spec-core.md#core-fr-213))

### Decision

Every storage port — `ForStoringCharter`, `ForStoringVendors`, `ForStoringTestSuites`, `ForStoringCredentials`, `ForStoringSettings`, `ForLoadingEvalSuites`, `ForLoadingSensors`, `ForLoadingSessionAnalysis` — carries plain records: paths, text and bytes, named `Stored<Thing>` (`StoredCharterFile`, `StoredCredential`). The engine builds its models from them with the domain's factories — which files are primitives, assets and vendors is read by `charterLayersOf` and `vendorFoldersOf`, and `assertInsideCharter` keeps every write inside the charter before any repository is asked ([CORE-FR-044](spec-core.md#core-fr-044)) — (`charterRootOf`, `workspaceSettingsOf`, `testRootOf`, `evalRootOf`, `sessionAnalysisOf`, `keptBuiltSensorsOf`), and what is no storage moves into the application: fetching a vendor source and checking what it holds into `VendoringCharters`, renewing an access token into `LoadMcpOriginsService`, reading the charter's layers with what the engine brings into `LoadCharterService`. The repositories answering the storage ports — `FileCharterRepository` and the rest, named for how and what they keep — know no model; they sit in `src/hexagon/storage/` until they move into packages of their own. This supersedes ADR-008's repositories in `application/repositories/` that built the models themselves.

### Why

The user decided at [CORE Story 44](spec-core.md#core-story-44---keep-a-repositorys-state-in-a-store-of-ones-own-priority-p2) that a repository is an adapter: the application only knows it wants to store a charter, and how it is stored is the repository's own choice. A port that carries the engine's models would tie every way of storing a repository to the engine's rules; one that carries records lets a tool author store a repository any way, knowing nothing of the engine's models.

### Consequences

A new kind of state is a storage port of records, its factory in the domain, and its repository in `storage/`. A record's path is as a person reads it; the file repositories escape it when they turn it into an address. The engine is not split into modules: its parts share one boundary.

## ADR-010: A domain service is a class of static methods, named for what it does; a factory is named for what it makes

**Date**: 2026-11-06 · **Status**: Accepted · **Story**: [CORE Story 44](spec-core.md#core-story-44---keep-a-repositorys-state-in-a-store-of-ones-own-priority-p2)

### Decision

Every file of `domain/services/` holds one class, `<Name>Service`, of static methods named verb first for what they do over several models — `CompileService.compileCharterRoot`, `TestService.runSuite`, `EvalService.validateEvalRoot` — holding no state and never constructed. What a service answers with is a model of `domain/models/` (`TestRunReport`, `EvalRunReport`), never a class of the service's file. A pure function that only makes one model, choosing a host's factory where there are several, is a factory: `mainContextTextsOf` in `domain/factories/main-context.factory.ts`, named for what it makes; a fact about one model, such as a host's token factor, is the model's (`tokenFactorOf`).

### Why

The user decided at [CORE Story 44](spec-core.md#core-story-44---keep-a-repositorys-state-in-a-store-of-ones-own-priority-p2) that the domain's services are written as classes, that `charterOutputOf` is `compileCharterRoot`, and that `main-context.service.ts` was a factory.

### Consequences

A new domain service is a class of static methods under `domain/services/`; `hexagonal-naming`, `hexagonal-architecture` and `architecture-map` say so, and the architecture test holds every domain service to it.

## ADR-011: Every value of the domain is a class; value objects under `domain/value-objects/`

**Date**: 2026-11-06 · **Status**: Accepted · **Story**: [CORE Story 45](spec-core.md#core-story-45---find-each-rule-of-the-engine-beside-the-value-it-is-about-priority-p2) ([CORE-FR-215](spec-core.md#core-fr-215))

### Decision

Nothing of `domain/models/` or `domain/value-objects/` is exported but classes and types. What makes a model is a static method of its class (`CharterRoot.of`, `WorkspaceSettings.of`, `Primitives.of`); a zod schema is a static member of its class (`WorkspaceSettings.schema`, `TestSuite.schema`); a constant is a variable private to its file, read off a static member where another file needs it (`MainContext.defaultCeiling`). The workspace's and the hosts' folders and files are value objects in `domain/value-objects/` — `CharterFolder`, `OutFolder`, `VendorsFolder`, `TestFolder`, `EvalFolder` (each a `RepoFolder`), `SettingsFile`, `WorkspaceGitignoreFile`, `SessionsFolder`, `FolderAddress`, and `AgentProviderFolder` with `ClaudeAgentProviderFolder` and `CodexAgentProviderFolder` — replacing `path.constants.ts`. A closed set of names is a value object with one instance per name: `SupportedAgentProvider.CLAUDE`, `PrimitiveLayer.REPO`, `McpAuthMethod.OAUTH`; the name (`AgentProviderName`, `LayerName`, `McpAuthMethodName`) stays only where it crosses an edge — a file, a DTO, a driver port — and becomes the value where it comes in. The driver ports export the names and values they did (`AGENT_PROVIDERS`, `isAgentProvider`, `TEST_DIRECTORY`…), read off the classes.

### Why

The user decided at [CORE Story 45](spec-core.md#core-story-45---find-each-rule-of-the-engine-beside-the-value-it-is-about-priority-p2) that every value of the domain is a class, value objects in a folder of their own, a constant a variable of its file, and that the closed sets become value objects as hexagonal architecture has them.

### Consequences

The domain's factories are classes too, `<Model>Factory.create` (`CatalogueFactory.create`), and a record of data the domain makes or reads (`SessionSpan`, `BuiltSensor`, `CatalogueEntry`, `McpOrigin`) is a class made from its fields. An agent is the value `AgentProvider` — its name and its folder from the repository — and `SupportedAgentProvider` holds the ones this engine compiles for. A new value of the domain is a class; a new folder or file of the workspace is a value object. A primitive's kind stays the static `kind` of its class: each primitive class is the value its kind names.


## ADR-012: The hexagon knows no address; the adapters are set up on it

**Date**: 2026-11-06 · **Status**: Accepted · **Story**: [CORE Story 46](spec-core.md#core-story-46---set-the-engine-up-with-no-address-of-the-machine-priority-p2) ([CORE-FR-217](spec-core.md#core-fr-217), [CORE-FR-218](spec-core.md#core-fr-218))

### Decision

Nothing in `application/`, `domain/` or `port/` holds a repository's address or the developer's home. Every path the hexagon says, and every path it asks a driven port for, is a string from the repository's root, `/` between its names, the empty path the root itself: the file ports (`ForReadingFiles`, `ForWritingFiles`), the storage ports, worktrees, sources, the shell and promptfoo alike. Each adapter is set up once on the address it works under — `new FileReaders(repoFolder)`, `new GitWorktrees(repoFolder)`, `new FileSessionAnalysisRepository((rootFolder) => new FileReaders(rootFolder), repoFolder, homeFolder)`, which sets its own reader up on the home's address — and refuses one that names no folder through `FolderAddress.urlOf` in `port/zdriven/folder-address.port.ts` ([SDK-FR-010](spec-sdk.md#sdk-fr-010)). A use case is set up with no address. Where the hexagon reads or builds a checkout of the repository, an evaluation's worktree, it names the checkout by its path (`checkoutPath`). The folders of the domain are their paths alone (`CharterFolder.path`, `AgentProviderFolder.ownedFolderPaths()`); which folder a repository's sessions are kept in is the sessions adapter's to find, and it answers that folder's name with the logs. The application's services are classes whose methods are written in them; each file exports the one instance of its service (`buildCharterService`, which is handed `loadMcpOriginsService`), and the composition root hands it to each use case that asks for it through the use case's constructor, as it hands the ports; what reads a repository's kept records into a model is a factory, `CharterRootFactory.create`, `WorkspaceSettingsFactory.create`, `EvalRootFactory.create`, `TestRootFactory.create`, `SessionAnalysisFactory.create`, and what makes a fault of whatever was raised, `DomainFaultFactory.create`, amending ADR-011, which had a model's class make it. A factory's `create`, and every function it calls, is written in its class (`static #name`), as a service's methods are written in its. How a charter is kept is the charter store's to read: `ForStoringCharter.loadCharter` answers each primitive kept, by layer, with its text and assets, and `CharterRootFactory.create` reads primitives off those records; a test or eval suite's name is its store's to say, carried on `StoredTestSuite` and `StoredEvalSuite`. This amends ADR-011, which had the domain read which kept files are primitives, assets or vendors. Where those files sit stays the domain's (`CharterFolder`, `VendorsFolder`, `TestFolder`, `EvalFolder`, the hosts' folders): a rule of the product the developer cannot rename, which every store applies.

### Why

The user decided at [CORE Story 46](spec-core.md#core-story-46---set-the-engine-up-with-no-address-of-the-machine-priority-p2) that the hexagon speaks only paths relative to the repository and that the repository's path is the adapters' concern; the home followed by the same rule.

### Consequences

Changing an address changes only how the adapters are set up, in `main.ts` or a tool's own composition. The published package's use cases lose their address parameters and take the services they use first, its adapters gain the addresses, and it exports the services and their instances, so the release carrying this is a major one ([SDK-FR-015](spec-sdk.md#sdk-fr-015)). A tool author's adapter is handed paths and keeps whatever address it was set up on. A new driven port speaks paths from the repository, never an address.

## ADR-013: The engine knows a charter by layer and kind; what keeps it, and what lays it onto a host, knows where it sits

**Date**: 2026-11-07 · **Status**: Accepted · **Story**: [CORE Story 47](spec-core.md#core-story-47---keep-a-charter-in-any-layout-and-hand-it-over-by-layer-and-kind-priority-p2), [CORE Story 48](spec-core.md#core-story-48---decide-where-a-compiled-charter-lands-for-each-host-priority-p2), [CORE Story 49](spec-core.md#core-story-49---get-answers-made-for-the-caller-priority-p2), [CORE Story 52](spec-core.md#core-story-52---replace-any-store-or-runner-and-find-the-workspace-in-three-parts-priority-p2) ([CORE-FR-213](spec-core.md#core-fr-213), [CORE-FR-219](spec-core.md#core-fr-219), [CORE-FR-220](spec-core.md#core-fr-220), [CORE-FR-221](spec-core.md#core-fr-221), [CORE-FR-222](spec-core.md#core-fr-222), [CORE-FR-223](spec-core.md#core-fr-223), [CORE-FR-224](spec-core.md#core-fr-224))

### Decision

A primitive, a test suite, an eval suite and a vendor are known to the engine by their layer and kind, never by where they sit. Three driven ports keep a repository's state, each speaking the domain's models in both directions: a charter repository, for authoring — primitives, tests, eval cases and vendors, a driven adapter outside the engine (the settings and the mcp origins' credentials are kept apart, each by a store of its own, since 2026-11-07); a charter output writer, which is handed one compiled output naming no place and lays it onto the repository — the build's output and each host's folders; and a session repository. The file reading and writing adapters, and the rest a store uses, sit behind those stores, never in front of a use case. The application validates and makes models, reads nothing off a path and projects nothing; what its services answer with is a model of the domain. The engine is reached through four applications — authoring, projecting onto each agent provider, testing, and reviewing the sessions — whose driver ports answer DTOs, which belong to the drivers alone. The workspace is `.cw/charter/{primitive,test,eval,vendor}`, `.cw/out`, `.cw/log`, with `.cw/settings.json`; a repository or a vendor source laid out the old way is refused everywhere, pointing to the authoring skill.

This replaces ADR-009 (storage ports carry plain records), and amends ADR-011 and ADR-012, which had the domain hold the workspace's and the hosts' folders as value objects; and ADR-002, whose domain models were free to change: every model a driven port names is now in the contract.

### Why

The user decided at the spec gate of a story since taken off the roadmap, which would have moved the driven adapters into packages of their own, that where a file sits matters only where the charter is kept or laid onto a host, that a record made only to carry a model is a second copy of it to keep in step, and that DTOs are the drivers' concern.

### Consequences

A change to a model a driven port names is a major release. A new kind of state is a model of the domain and a method on the store that keeps it, never a record. A new host is a projection of its own, not a change to the domain.

## ADR-014: A factory sits in its module, beside the models it makes

**Date**: 2026-11-07 · **Status**: Accepted · **Story**: [CORE Story 47](spec-core.md#core-story-47---keep-a-charter-in-any-layout-and-hand-it-over-by-layer-and-kind-priority-p2)

### Decision

`domain/factories/` is gone. Each module of the domain's models keeps its factories in a `factories/` folder of its own, beside the models they make: `domain/models/charter/factories/` (`PrimitiveFactory`, `CharterRootFactory`), `test/factories/` (`TestSuiteFactory`, `TestRootFactory`), `eval/factories/`, `session/factories/`, `context/factories/`, `output/factories/`, and `domain/models/factories/` for the models at the root (`WorkspaceSettingsFactory`, `DomainFaultFactory`). What makes a model out of what is handed in raw is a factory too, never a function of the model's file: `primitiveOf` is `PrimitiveFactory.create(rawPrimitive)`, `testSuiteOf` is `TestSuiteFactory.create(text)`. This amends ADR-008 and ADR-011, which kept the factories in `domain/factories/` and let a model's `of` make it.

### Why

The user decided at the implementation of [CORE Story 47](spec-core.md#core-story-47---keep-a-charter-in-any-layout-and-hand-it-over-by-layer-and-kind-priority-p2) that a module reads whole in one folder — its models and what makes them — and that what reads raw input into a model is a factory's job.

### Consequences

A new model's factory goes in its module's `factories/`; the architecture test finds every `*.factory.ts` there and nowhere else. The models' remaining `of` (`Primitives.idOf`, `SessionSpans.of`…) are not moved yet.

## ADR-015: The engine is two modules; every store and runner is an adapter it is handed

**Date**: 2026-11-08 · **Status**: Accepted · **Story**: [CORE Story 52](spec-core.md#core-story-52---replace-any-store-or-runner-and-find-the-workspace-in-three-parts-priority-p2)

### Decision

The engine, the `@cherry-works/engine` package, is two modules, each with its applications, its domain and the ports of its adapters, its adapters in its own infrastructure: charter — the charter's models and two applications, authoring (the primitives, vendors, test cases and eval cases, signing in to the mcp origins, and testing the charter) and projection (the build onto each agent provider, its preview and health check, the estimated main context, the tools the mcp origins serve, and what runtime asks of it: the mcp origins, the sensors of a signal, a build into a working copy); and runtime — running the sensors, forwarding calls to the mcp origins, the evaluations and their log, the exact count of the main context, and the agents' sessions. Runtime asks charter only through charter's applications, in DTOs, never a model of charter's; charter asks nothing of runtime; an application speaks to its own adapters in its own models. Which agent providers a repository builds for, and its other settings, are a third module's, the workspace's: its one application keeps them in `.cw/settings.json` and sets a repository up, knowing neither other module; whoever composes the engine asks it for them and hands them to the charter's and runtime's applications, which never read or write them. The charter repository — one store for the primitives, vendors, test cases and eval cases — and every other store and runner are adapters, handed to the engine where it is composed: each one handed replaces the default, each one not handed is the default, and the engine itself is never replaced. An evaluation's worktrees and runs sit under `.cw/log`, which is runtime's. What each agent provider reads of a charter is its projection's, an adapter handed to the projection application under the agent's name: the domain compiles the charter into the output every agent shares, naming paths only inside it under `$CW_OUT/`, and names no agent; the agents a repository may build for are the names of the projections handed. This replaces the four applications of ADR-013 and its stores inside the engine, and the out of scope that kept the engine one boundary.

### Why

The user decided while replanning the workspace layout and the one charter store into one story, and again at its implementation, that a tool using the engine brings its own way of keeping and running a charter; that keeping, testing and building a charter are one boundary, the charter's, and running what was built, its sensors, its mcp calls, its evaluations and the agents' sessions another, runtime's; that one module's models are no other's concern; and that what a repository configured itself with is a module of its own, the workspace, which neither the charter nor runtime knows.

### Consequences

A new kind of state belongs to the module whose work it is, and is kept by an adapter of that module's port. What one module needs of the other is a DTO of the other's application, never its model. A tool author replaces any adapter, never the engine.


## ADR-016: The engine is a library of cherry-works, and cw's own adapters are part of it

**Date**: 2026-11-11 · **Status**: Accepted · **Story**: [SDK Story 8](spec-sdk.md#sdk-story-8---compose-the-engine-anywhere-from-cws-own-adapters-and-ones-own-priority-p1) ([SDK-FR-001](spec-sdk.md#sdk-fr-001), [SDK-FR-005](spec-sdk.md#sdk-fr-005), [SDK-FR-013](spec-sdk.md#sdk-fr-013), [SDK-FR-020](spec-sdk.md#sdk-fr-020), [CORE-FR-228](spec-core.md#core-fr-228))

### Decision

No engine package is published. `cherry-works`, the package `cw` is installed from, is also the library: it exports how `cw` composes the engine, the driver ports and their DTOs, the port of every adapter with the models it names, and `cw`'s own adapters. Every store and runner can be handed in, as one set that may be partial; `cw`'s own is composed for each one left out. This replaces [ADR-002](#adr-002-the-engines-public-contract-is-what-its-package-exports) where it publishes the engine as `@cherry-works/engine`, and [ADR-015](#adr-015-the-engine-is-two-modules-every-store-and-runner-is-an-adapter-it-is-handed) where it names that package; the contract and its versioning from 1.0.0 stay as ADR-002 set them; it is compared at each release as [SDK-FR-015](spec-sdk.md#sdk-fr-015) says.

### Why

The user decided that one package is one thing to install and to release, with nothing published halfway, and that a tool extends `cw`'s own adapters more often than it writes one anew.

### Consequences

`cw`'s own adapters are part of the contract: changing one is a change the version policy judges. A breaking change to the contract moves `cw`'s major version too, even when `cw` behaves the same.

## ADR-017: Every operation of a driver port is named verb first

**Date**: 2026-11-11 · **Status**: Accepted · **Story**: [CORE Story 53](spec-core.md#core-story-53---keep-the-whole-engine-to-its-naming-and-fault-guides-priority-p2) ([CORE-FR-232](spec-core.md#core-fr-232))

### Decision

Every operation a driver port offers is named verb first, for what it acts on — never a bare verb nor a noun alone — and the operations are renamed before the first release under the contract.

### Why

The user decided at the quality pass of [CORE Story 43](spec-core.md#core-story-43---quality-cross-check-of-core-story-40-core-story-41-sdk-story-5-core-story-42-sdk-story-6-priority-p3) that the naming guide's rule for use cases holds for the ports a tool reads first, and that before 1.0.0 a rename breaks no tool, while after it each is a major release.

### Consequences

Every driver port, `cw`, the portal and their tests change names once.
