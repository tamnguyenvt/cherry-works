---
kind: guide
id: architecture-map
description: Where each part of cw lives, the rules between them, and which existing class to extend before writing a new one.
globs: ["src/**"]
---
Map of `src/`. Before writing a new class, file or function, find its place
here and extend what is already there. Every file is named
`<kebab-subject>.<role>.ts` as [[hexagonal-naming]] says (`file-charter.repository.ts`);
only the models under a module's `domain/` (`charter-root.ts`), those an
agent's adapters keep of its own (`charter/infra/claude/claude-rule.ts`),
`helper.ts`, `index.ts`, a module's `domain/constants.ts` and `main.ts` keep
their bare names; a value object takes `.value-object`
(`primitive-layer.value-object.ts`).

## Layers (hexagonal; enforced by `pnpm lint:deps`)

- `presentation/` calls in: `cli/` (`Commander` in `cli.commander.ts`, one
  `commands/<name>.command.ts` each, listed in `commands/index.ts`; it asks
  the workspace module for the settings and hands them to the charter's and
  runtime's applications it composes, CORE-FR-231), `portal/`
  (`portal.routes.ts`, `portal.server.ts`, `page/`), `mcp/mcp.server.ts`. A
  driver, the composition root and every other module reach a module only
  through its `module.ts`, which exports what the module lets them reach —
  its applications, ports, DTOs, the models its ports carry, and its
  adapters; the page takes types alone from it. Tests may reach further in.
- `module/` decides: `charter/` and `runtime/`, `workspace/` — what a
  repository configured itself with, `ManagingWorkspace` keeping it in
  `.cw/settings.json` and setting a repository up, knowing neither other
  module, which never read it (CORE-FR-231) — and the kernel they share,
  `shared/`, each laid out as `app/`, `domain/` and `infra/`
  (CORE-FR-222). `app/` and `domain/` import nothing outside the modules but
  zod: no `node:*`, no adapter; they are the engine. Any other
  library is wrapped by a lib in `domain/libs/` — `globs.lib.ts`
  (picomatch), `yaml.lib.ts` (yaml, a primitive's frontmatter),
  `toml.lib.ts` (smol-toml, an agent's configuration) — the only files that
  import one; there is no port for a notation. `infra/` holds the module's adapters: one per driven port, plus an
  `InMemory*` twin used by tests under `infra/in-memory/`, each in
  `<name>.adapter.ts` (`in-memory/in-memory-file-output.adapter.ts`), each answering a driven port of its
  own module or of the kernel and nothing else of them.
  - `charter/infra/`: `FileCharterRepository`, the one charter repository,
    answering `ForManagingCharter` for all of the charter (CORE-FR-228) — its
    primitives under `.cw/charter/primitive/` and its vendors under
    `.cw/charter/vendor/`, by layer, kind and id, with their index.md and
    assets (`loadCharter`, `createCharter`, `assertLayout`, `addPrimitive`,
    `injectPrimitives`, `findCharterUri`, `rewritePrimitive`,
    `removePrimitive`, each kept inside the charter, CORE-FR-044), its vendors
    (`fetchVendorSource`, `removeTempSource`, `loadVendorRoot`,
    `storeVendor`, `findVendorUri`, `removeVendor`), its test cases (`loadTestSuites`, `writeTestSuite`,
    `removeTestSuite`) and its eval cases (`loadEvalSuites`,
    `writeEvalSuite`, `removeEvalSuite`), and what the last build laid
    (`readBuiltOutputItem`, `describeItemPlace`, `resolveOutputLinks`: the output
    under `.cw/out/`, `$CW_OUT` in what it holds, where `helper.ts`'s
    `findItemPlace` says), each read as the store holds it now, an
    evaluation's included (ADR-001);
    `KeychainCredentialsRepository`, each credential one JSON secret in the
    operating system's keychain, and `InMemoryCredentialsRepository`;
    `LocalRepoManipulator` and
    `InMemoryLocalRepo`, which lay a build's output under
    `.cw/out/`, what the last build left there taken away, and write every
    file a build planned, each made over a checkout by `createCheckoutOutput`;
    `GitSources`, `OAuth`, `Tiktoken`; and `helper.ts`: a charter folder's primitives, a source's
    skills, refusing a repository or a source laid out the old way
    (`assertNewLayout`, `findOldLayoutPaths`, CORE-FR-226), and where the output
    lands (`OUT_FOLDER`, which `module.ts` hands the agents' adapters too, `findItemPlace`).
  - `runtime/infra/`: `FileSessionAnalysisRepository` (`loadSessionLogs`:
    each session's lines last written within a window, in the sessions folder
    it is set up with — the one the repository's settings name, or one it
    finds from the repository's address and the home), `GitWorktrees`, `Promptfoo`
    (each run kept under `.cw/log/eval/runs/`), `Shell`; each agent's own
    command line is its agent's.
  - `workspace/infra/`: `FileWorkspaceSettingsRepository`, the settings and
    the workspace's ignore file (`log/`, CORE-FR-225).
  - `shared/infra/`: `FileReaders`, `FileOutput`,
    `McpClients`, `ConsoleReporter`, `SystemClock`, and `helper.ts`: a path
    read as an address, and a checkout's path.
- `charter/infra/claude/`, `charter/infra/codex/` — each agent the engine
  compiles for, one folder per agent, holding its projection,
  `ClaudeProjection` and `CodexProjection` (`ForManagingLocalAgentOutput`,
  CORE-FR-221): its files, each at its place, how each goes over what is
  there, its stamped files taken away, its links, its main context and its
  token factor, built on `agent-projection.base.ts` (`AgentProjection`) over
  the charter's `ProviderComponent` ← `DocumentBasedComponent` |
  `SettingBasedComponent`, with each agent's files (`ClaudeSkill`,
  `ClaudeRule`, `CodexConfig`…), its `<Agent>ComponentFactory` and its
  `<Agent>MainContextFactory`; what they take of the charter comes through
  that port alone. The charter's `infra/helper.ts` holds a text with its
  paths under `$CW_OUT` written from where it lands (`resolveLaidText`), and a
  agent's settings and entry file written into (`mergeSettingsText`,
  `mergeEntryFileText`). Each agent's command line, `ClaudeCli` and
  `CodexCli`, built on `agent-cli.base.ts` (`AgentCli`), sits in
  `runtime/infra/<agent>/`.
- `module/composition.ts` — `composeApplications`, handed a
  `Partial<EngineAdapters>`, every adapter the engine reaches the outside through, each
  typed by its port and each the engine's own or written anew: under
  `agentProvider`, each agent's projection (`ForManagingLocalAgentOutput`) and
  command line (`ForCheckingAgentCli`), the `charterRepository`, and every
  other store and runner; by default Claude's and Codex's,
  `FileCharterRepository` and the adapters over files (CORE-FR-230). It
  answers `{ workspaceApp, engineApp }`: `composeEngine`, the charter and runtime
  composed over those adapters for the settings they are handed; and
  `composeWorkspace`, the workspace module told the agents a projection is
  handed for. Each adapter not handed is the engine's own, the charter's
  store and the projections set up over the file adapters handed. `main.ts`
  hands both to the command line, and `test/use-cases-of.ts` builds each
  application as it does.
- `index.ts` — the library `cherry-works` exports (SDK-FR-002, SDK-FR-020),
  and nothing more: `composeApplications`, its `EngineAdapters`, and what it
  answers; the four driver ports and their DTOs; `VERSION`; the port of every
  adapter, with the models and values crossing it; and `cw`'s own adapters
  and their abstract bases, for a tool to extend. No use case or service. It reaches a module only through its `module.ts`, as `main.ts`
  does; what it exports is the contract a release compares.

## Inside `module/`

Charter asks nothing of runtime; runtime asks the charter only through the
charter's two applications, in DTOs, and holds no model of the charter's
(CORE-FR-229); the kernel imports neither (enforced by `pnpm lint:deps`).

- `charter/` — the charter's models and two applications: `AuthoringCharter`
  in `app/authoring-charter.use-case.ts`, answering `ForAuthoringCharter`
  (the primitives, vendors, test and eval files, the tests, signing in to
  the mcp origins and a token to one, the charter's layout and setting its
  folders up), and `BuildingCharter` in `app/building-charter.use-case.ts`,
  answering `ForBuildingCharter` (the build, its preview, the health check,
  the estimated main context, the tools the mcp origins serve; and for
  runtime the tools they declare, the commands of a signal, a build into a
  working copy, what an agent is sent when a session opens, and an
  evaluation's cases). Which agents it builds for, it is handed as
  `ProjectionSettings` when it is composed.
- `runtime/` — `RunningCharter` in `app/running-charter.use-case.ts`,
  answering `ForRunningCharter`: the sensors of a signal, the calls forwarded
  to the mcp origins, the main context counted exactly, the evaluations and
  their log under `.cw/log/`, and the sessions; handed `RuntimeSettings` when
  it is composed.
- `shared/` — what is neither's: `DomainFault`, `ApplicationService` in
  `app/application-service.base.ts`, `dto()` and the faults' DTOs, `FaultDTOs`,
  in `app/port/in/`, and the ports both use (`ForReadingFiles`,
  `ForWritingFiles`, `ForReportingProgress`,
  `ForTellingTime`, `ForCallingMcpServers`, `FolderAddress`).

In each module:

- `app/port/in/` — its applications' ports, and the DTOs crossing them,
  the only shapes a driver port answers (CORE-FR-223).
- `app/port/out/` — driven ports (`ForReadingFiles`, `ForFetchingCharterSources`,
  `ForKeepingWorktrees`, `ForCountingTokens`, `ForRunningAgentCli`,
  `ForRunningPromptfoo`…), named in the adapter's own words, never the
  domain's, each in `<doing>.port.ts` of the module that asks it. Beside
  them, the storage ports, each carrying the domain's models (`RawPrimitive`,
  `RawTestSuite`, `RawVendorSource`, `McpCredential`…): `ForManagingCharter`,
  `ForStoringCredentials`, `ForLoadingSessionAnalysis`; the output port,
  `ForManagingLocalOutput`, handed the compiled `CharterOutput` and
  answering the `ProjectionPlan` it would lay of the output, and laying every
  file a build planned; and `ForManagingLocalAgentOutput`, one agent's projection,
  handed the charter and the `CharterOutput` and answering the `ProjectionPlan`
  of that agent's files, its main context and its token factor, the
  application handed one per agent under the agent's name. No path of the workspace crosses them;
  where the repository and the home are, the adapters are told once, when
  they are set up. The one path that does is a checkout's, the worktree an
  evaluation lays the build into: handed once to the factory method of the
  output and of each projection, `createCheckoutOutput` and
  `createCheckoutProjection`, each building only its own class over it, and
  never to an operation; the store has none, and is read as it stands. Every
  class extending one overrides it, or is refused with
  `UnbuiltCheckoutAdapterFault` before anything is laid.
- `app/` — its use cases, each named as the driver port it implements without
  `For`; every DTO is made by its schema, `CharterDTOs.<Model>.of({ … })`, in
  the use case, and there is no folder of DTO makers: shaping one that more
  than one operation answers with is a private method of the use case
  (`AuthoringCharter#primitiveDTOOf`), and shaping a fault is
  `ApplicationService`'s (`findingDTOOf`, `faultsByFileDTOOf`). Every use
  case extends `ApplicationService` and answers through `answerWithFaultDTO`,
  so whatever it raises comes back as a `FaultDTOs.Fault`, an internal one
  logged first; `answeredDTOOf` raises again a fault another application
  answered. A use case orchestrates; logic only it follows is a private
  method: `BuildingCharter#estimateMainContext`,
  `RunningCharter#runWithPromptfoo`, `AuthoringCharter#vendorAddOutcomeDTOOf`.
- `app/services/` — what more than one use case follows, the charter's, one class
  of methods written in it per file, `<name>.service.ts`, with the one
  instance of it exported (`buildCharterService`) and handed to each use case
  through its constructor in `module/composition.ts`: `BuildCharterService`
  (`planBuild`, `previewPlan`, `executePlan`: compiled, then planned and laid
  through the projection, onto the repository or the checkout it builds),
  `InstallCharterService` (`filterSource`: the vendors a source fills
  chosen, then handed to the charter's store, which puts them down off the
  commit fetched, `storeVendor`), `LoadCharterService`
  (`loadCharterRoot`: the layers kept and what the engine brings, read into
  a charter), `LoadMcpOriginsService` (`loadMcpOrigins`, `loadMcpTools`,
  `loadToolsByOriginKey`, the token asked of charter authoring), the laid
  output read back through the charter repository.
- `domain/` — pure rules, no port, each module's own and the kernel's. The
  charter's `models/` is one folder per concept, in the order a charter goes
  through them, each holding its models, value objects and the factories
  that make them side by side, with the charter's application faults
  (`charter.fault.ts`) in `models/` itself; its `services/` holds the domain
  services, apart from every model, since each works over several:
  - `agent/` — what every agent's file is built on, naming no agent
    (CORE-FR-221): `ProviderComponent`, a document (`DocumentBasedComponent`)
    or settings (`SettingBasedComponent`), each agent's own kinds extending
    one of the two.
  - `primitive/` — one `<Kind>Primitive` per kind extending `BasePrimitive`,
    registered in `Primitives.classes` of `primitive.ts`; `RawPrimitive`, a
    primitive as it is kept; `PrimitiveLayer`; `PrimitiveFactory`.
  - `charter/` — `CharterRoot` (every primitive, every composite fault, in
    `compositeFaultsByFiles`) and `CharterRootFactory`;
    `RepoLayerPrimitiveSpec`, a specification. The workspace's layout is no
    model: it is the module's constants, in `domain/constants.ts`
    (`WORKSPACE_FOLDER_PATH`, `CHARTER_FOLDER_PATH`, `PRIMITIVES_FOLDER_PATH`,
    `VENDORS_FOLDER_PATH`, `TEST_FOLDER_PATH`, `EVAL_FOLDER_PATH`), each a
    path from the repository's root (CORE-FR-224). Where a build's output and
    each agent's files land is none of them: it is the projections'
    (CORE-FR-221).
  - `builtin/`, beside `models/` — the engine's own layer: `cw-author`, the session
    counter; listed in `BuiltinPrimitives.primitives`.
  - `vendor/` — `VendorSource` (with its `SourceCharter` and `SourceSkill`),
    `RawVendorSource`, `VendorSourceOrigin`, `VendorRoot`, their factories.
  - `test/` — `TestSuite`, `TestCase`, `TestRoot`, `TestCaseReport`, their
    factories (`TestSuiteFactory`, `TestRootFactory`).
  - `eval/` — `EvalSuite` (the cases of one file under `.cw/charter/eval/`),
    `EvalRoot`, their factories.
  - `charter-output/` — what a build produces, knowing no agent and naming
    no place but inside the output: `CharterOutput`, the list of its
    `CharterOutputItem`s (`add`, `charterOutputItems`, and
    `findCharterOutputItem`, the one item of a class), in the order a build
    lays them; `CharterOutputItem`, the class every item extends, its
    `text`; `OutputPath`, the output's layout: each item's path inside it by
    what the item is (`getPath`), the fixed file names and a compiled
    primitive's or a catalogue's path where no item is in hand, and the link
    under `$CW_OUT` one item's text names another by (`getLink`,
    `getLinkTo`), made once as `outputPath` in the domain's `constants.ts`
    and asked by everyone; the items, `Catalogue` (the shared one and each agent's), `CharterMd`,
    `McpOrigins`, `BuiltSensors` and `CompiledPrimitive`, each made by its
    factory; `ProjectionPlan`, `PlanSummary`, `StampedDocument`, and
    `StampedDocumentSpec`, a specification: whether a file on disk carries the
    stamp. What each agent reads of it is
    that agent's projection's, in its agent's folder.
  - `context/` — `MainContext`: what a charter puts into one agent's main
    context, counted, and the ceiling it is held to; each text of it is the
    agent's projection's (`listMainContextTexts`).
  - `mcp/` — `McpCredential`, `McpClientRegistration`, `McpAuthMethod`.
  - `services/` — `CompileService` (`compileCharterRoot`: charter to output,
    no file reads), `TestService` (`runSuite`, `runCase`,
    `validateTestRoot`), `EvalService` (`validateEvalRoot`: the cases naming
    what the charter does not hold).
  - `libs/` — the libraries the domain reads with (glob, YAML, TOML).
  - `helper.ts` — `ModelHelper`: frontmatter written out, short names, hashes.
  Runtime's domain keeps `models/` (`session/`, `eval/`, `sensor/`), each
  factory beside its model, `services/`, and `constants.ts` holding `LOG_FOLDER_PATH` and
  `EVAL_WORKTREES_FOLDER_PATH`; the workspace's `models/` holds
  `WorkspaceSettings` and its factory, and its `constants.ts` the settings
  file's and the ignore file's paths. The kernel's
  `domain/models/` holds `DomainFault` (`domain.fault.ts`), `AdapterFault`,
  `ApplicationFault` and `DomainFaultFactory`, and its `value-objects/`
  holds `AgentProvider`, an agent by its name, whichever names the
  projections the application was handed answer to (CORE-FR-221,
  CORE-FR-229).

## Extend, don't add

- A new primitive kind: `<kind>-primitive.ts` beside the others (schema,
  `requires`, `sample`, `activatesWhen`, `of`) and one line in
  `Primitives.classes`. `cw kinds`, `cw add`, the portal and `CHARTER.md`
  follow. A kind reached by being named (`mcp:`, `script:`, `template:`) adds
  its mention regex to `findMentionedIds` in `CharterRoot`.
- A new output of a primitive: extend `CompiledPrimitiveFactory.create` (extension,
  stamp, built files) rather than adding an output model.
- A new output of the charter: a class in `charter-output/` extending
  `CharterOutputItem` and a `<Model>Factory.create` beside it in
  `<model>.factory.ts`, its item added to the `CharterOutput` in
  `compileCharterRoot`.
- A new file for an agent: a class extending `DocumentBasedComponent` or
  `SettingBasedComponent` in `charter/infra/<agent>/`, listed in that agent's
  `<agent>-component.ts`, built in `<agent>-component.factory.ts`, its place in
  the `<AGENT>_PLACE_BY_KIND` of `<agent>-projection.adapter.ts`.
- A new agent: no file of the engine changes but the composition root.
  `charter/infra/<agent>/` with its components, `<agent>-component.factory.ts`
  and `<agent>-main-context.factory.ts` and `<agent>-projection.adapter.ts`, an
  `AgentProjection`, and `runtime/infra/<agent>/<agent>-cli.adapter.ts`, an
  `AgentCli`; one entry in
  the default `agentProvider` of `composeApplications`.
- A new composite check: a fault in `CharterRoot.compositeFaultsByFiles`;
  a warning is `"warn"`, anything that could send an agent to something that is
  not there is an error.
- A new command: `<name>.command.ts` + `commands/index.ts`, calling a use case;
  anything the portal shows must have a command too.

## Rules

- Each `CharterOutputItem` under `charter-output/` holds its final values,
  `document` included (stamped or not), and has no `to…()` step; a
  `CharterOutput` is the list `compileCharterRoot` adds them to with `add()`,
  in the order a build lays them. It knows no primitive: building
  it from the charter is its factory's job, where the stamp is decided by
  kind. An agent's component is built by its component factory
  (`ClaudeComponentFactory`, `CodexComponentFactory`) with `new`; the class
  keeps only what it alone decides, such as its `path`.
- A method that only reads never reaches for the writing port, even where
  its use case holds one (FR-041).
- Tests drive the real use case, with the real repositories, over `InMemory*`
  adapters (`test/use-cases-of.ts` builds each one as `composeEngine` does).
- A zod schema is named in PascalCase with a `Schema` suffix
  (`PrimitiveSchema`, `WorkspaceSettingsSchema`), never UPPER_SNAKE: it is
  a schema, not a constant. The type inferred from it drops the suffix
  (`SkillHeaders`).
