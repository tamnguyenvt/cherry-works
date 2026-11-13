---
kind: guide
id: hexagonal-architecture
description: The layers of a hexagonal codebase, what each may import, and where a new file belongs.
globs: ["src/**", "main.ts", "main.js"]
rationale: why-hexagonal-architecture
---

This codebase is hexagonal (ports and adapters). Before writing a new class,
file or function, find its place below and extend what is already there.
`<pm> run lint:deps` (dependency-cruiser, `.dependency-cruiser.cjs`) enforces
the import rules; run it after any change that adds an import.

## Layers

- `src/presentation/` calls in: one folder per entry point (`cli/`, `http/`,
  `mcp/`, a UI). It parses input, calls a driver port, renders the answer. It
  decides nothing.
- `src/module/*/app/` and `src/module/*/domain/` decide. They import nothing
  outside the modules — no `node:*`, no adapter, no SDK, no library
  (`hexagon-is-sealed` of `.dependency-cruiser.cjs`) — and each library, zod
  included, only through a `domain/libs/` wrapper of the kernel
  (`a-library-is-reached-through-a-lib`, `zod-is-reached-through-the-kernel-validator`).
- `src/module/<module>/infra/` is called out to: one adapter per driven port (disk, DB, HTTP
  API, clock, queue), each with an `InMemory*` twin used by tests. The
  repositories are among them: one class per storage port, keeping that
  state as files or secrets over the driven ports that reach them
  (`ForReadingFiles`, `ForWritingFiles`, `ForFetchingCharterSources`),
  or reaching their store themselves, as the keychain the credentials are
  kept in, reading and writing the domain's models the port
  names again for them. Where each thing is kept — which files are a
  primitive, its assets or a vendor's, what a suite is named, where a source
  keeps its charters and skills — is its own to know, and so is keeping every
  write inside the charter (CORE-FR-044). It hands the engine what it keeps
  as it keeps it (`RawPrimitive`, `RawTestSuite`), for the engine to
  validate. The charter — its primitives, vendors, test cases and eval cases
  — is kept by one repository answering one port, `ForManagingCharter`; the
  settings and the credentials each by one of their own; nothing in the
  hexagon keeps anything itself (CORE-FR-228). A repository is wired in the
  composition root and handed to every use case that keeps that state.
- Each agent the engine compiles for has a folder of its own in the
  `infra/` of the module whose port it answers: its projection
  (`AgentProjection`, `ForManagingLocalAgentOutput`) in `charter/infra/<agent>/`,
  its command line (`AgentCli`, `ForCheckingAgentCli`) in
  `runtime/infra/<agent>/`. They are adapters like any other, and are what
  the composition root hands in as adapters.
- `main.ts` / `main.js` is the composition root. Where the engine is
  composed apart from it, as `composeApplications` in
  `src/module/composition.ts`, that is the one place that names
  concrete classes, but for the one instance each service's file exports:
  every adapter is handed in one `EngineAdapters`, typed by its port,
  the engine's own over files by default or one written anew (CORE-FR-230).

## Inside `src/module/`

The hexagon is made of modules, each laid out as below, and a kernel they
share, `shared/`, holding what is neither's (CORE-FR-222). Here the modules
are `charter/` and `runtime/`: runtime asks the charter through the charter's
driver ports alone, in DTOs, and never the other way round; the kernel
imports neither (CORE-FR-229). Each module holds `app/` — its use cases,
services and ports, `app/port/in/` and `app/port/out/` —
`domain/`, and `infra/`, its adapters, and `module.ts` beside them: what the
module lets the code outside it reach, and the only file of it that code
imports. Each folder named below is a module's: `<module>/app/port/in/`,
`<module>/app/`…

- `app/port/in/` — use-case interfaces, `For<Doing>` (`ForAuthoringCharter`),
  and beside them `<module>.dto.ts`, the zod schemas of what crosses them (`<Module>DTOs`, in
  the module answering with them, the faults `FaultDTOs` in `shared/`;
  each DTO `{ type, data }` — see [[hexagonal-naming]]). A driver port answers DTOs, never
  a model; it re-exports every type a driver needs, so a driver imports
  nothing else of the hexagon.
- `app/port/out/` — driven ports, `For<Doing>` (`ForReadingFiles`,
  `ForFetchingCharterSources`), named in the adapter's own words — see
  `[[driven-port-speaks-its-adapter]]`. Faults and types an adapter needs
  are exported here; the adapters' faults live in the domain's
  `adapter.fault.ts`, re-exported by the port they are raised behind. A
  storage port, `ForManaging<Thing>`, `ForStoring<Thing>` or `ForLoading<Thing>`, keeps one part of
  the repository's state and carries the engine's own models both ways —
  each kept thing known by its layer, kind and id or name, with a `uri` its
  store gives and the engine only says back — never a record made to carry
  them, nor a path the engine reads anything off. The output
  port, `ForManagingLocalOutput`, is handed the compiled output, each item
  known by its path inside the output, and decides where the output lands,
  a checkout's handed once to its factory method (`createCheckoutOutput`); `ForManagingLocalAgentOutput`, one per
  agent, handed under the agent's name, decides what that agent reads of
  the charter and its output, and where — each agent's own folders — and how;
  what a build laid is read back through the charter's repository,
  `ForManagingCharter`, by the same parts (CORE-FR-221). Their adapters,
  `LocalRepoManipulator` and `InMemoryLocalRepo`, are in its module's `infra/`;
  `ClaudeProjection` and `CodexProjection` in `charter/infra/<agent>/`.
- `app/` — one class per driver port implementing it: the
  application service of that conversation, extending `ApplicationService`
  of `application-service.base.ts`, which every operation answers through
  (`answerWithFaultDTO`): a fault comes back as a DTO, an internal one logged
  first. A use case orchestrates: it
  loads what is kept through its storage ports and validates it into models
  with the domain's factories, asks the domain to decide, hands models back to
  keep, and
  turns the result — a fault included — into
  DTOs, each made by its schema, `<Module>DTOs.<Model>.of({ … })` — there is no
  folder of DTO makers. Logic that only this
  use case follows is a private method of its class (`#findPrimitiveById`). A rule found here
  belongs in the domain.
- Nothing in the use cases, the services, the domain or the ports knows
  where a repository is, nor where the developer's home is, nor where a
  primitive, a suite or a vendor is kept in it: what is kept is said by its
  `uri`, and a driver shows a `file:` one as the path from where it runs. The
  addresses go only to the adapters — `FileSessionAnalysisRepository`
  among them — set up once
  in the composition root on them, which refuse one that names no folder
  (`FolderAddress.parseFolderUrl`, in `app/port/out/folder-address.port.ts`). A use
  case is set up with no address (CORE-FR-217, CORE-FR-218).
- `app/services/` — orchestration that more than one use case
  follows: reading the charter off its layers, building it, reaching the mcp
  origins. It is a class of methods written in it, holding no state but the
  services it calls on, and what it answers is a model of the domain, never
  a shape of its own; its file exports the one instance of it
  (`buildCharterService`), which the composition root hands to each use case
  through its constructor, as it hands the ports. A use case hands it the ports
  a call needs.
- `domain/` — pure values and rules, every one a class. `models/` holds one
  folder per concept of the business (`primitive/`, `charter/`, `test/`,
  `charter-output/`…), each with the concept's models, its value objects and the
  factories that make them side by side; a module's faults sit in `models/`
  itself (`charter.fault.ts`). `services/` holds the domain services, apart
  from every model: a service works over several models, so the folder of
  any one of them is the wrong place for it. A domain may keep its value
  objects in `value-objects/` beside `models/` (the kernel's `AgentProvider`).
  A value object is a value an entity or an aggregate holds as a property;
  a value no model holds is no value object. A module's layout — a
  folder's path, a file's name — is one model of its own, made once in its
  `domain/constants.ts` (`charterPath`, `vendorSourcePath`, `logPath`,
  `settingsPath`, `outputPath`), never a loose constant; an adapter reads it
  through the port it answers, never writes a path of the workspace again.
  - A model: what makes one out of what a repository keeps is its factory
    (`CharterRootFactory.create`, `WorkspaceSettingsFactory.create`), its zod
    schema a static member (`WorkspaceSettings.schema`), and a constant a
    variable private to its file or a static member of its class. The one
    exception is the kernel's `domain/schema.ts`, which exports as constants
    the schemas every module's models share (`GoodLineSchema`,
    `GoodArraySchema`, `FlagSchema`). A closed
    set of names is a value object, one instance per name
    (`PrimitiveLayer.REPO`,
    `McpAuthMethod.OAUTH`); the name itself stays only where it crosses an
    edge — a file, a DTO, a driver port. A model holds a value as its value
    object, never its name (`McpCredential.method` is an `McpAuthMethod`,
    `CatalogueEntry.agentProviders` are `AgentProvider`s); a record, a DTO
    and the JSON a model is written as hold the name, which the value object
    writes itself as (`toJSON`) and is read back by (`McpAuthMethod.of`). No port, no service, no DTO, no I/O:
    whatever a rule needs, it is handed. The kernel's `domain.fault.ts` is
    the base of every fault.
  - The workspace's folders and files are each module's layout model, each
    by its path from the repository's root (`charterPath.charterFolderPath`):
    the charter, the output and the log (CORE-FR-224). Where a build's output and each agent's
    files land is no value of the domain's: it is the projections', and a
    item of the output naming another names it by its path inside the
    output, under `$CW_OUT` (`OutputPath.getLink`). Which agents there are is
    no value of the domain's either: an agent is a name, whichever names the
    projections the application was handed answer to.
  - A factory, `<model>.factory.ts`: one class per model it makes,
    `<Model>Factory`, whose static `create`, written in the class with every
    function it calls (`static #name`), makes it out of other models, or out
    of what a repository keeps.
  - A service, `<name>.service.ts`: pure logic over several models, calling
    the factories: one class per file, holding no state, its methods static
    (`CharterOutputService.compileCharterRoot`), never constructed.
  - `libs/`, in the kernel alone — the libraries the domain reads with,
    each wrapped in one `<name>.lib.ts`, one class of static methods named
    after it (`GlobsLib.coversGlob`, `TomlLib.mergeTomlText`), never
    constructed; the validator lib alone exports `z` itself, which every
    schema is written with (see `.dependency-cruiser.cjs`).

## Ports in JavaScript

TypeScript ports are `interface`s. In JavaScript a port is a JSDoc
`@typedef` in its own file under `port/`, which exports nothing at runtime
(`export {};`); an implementation says `@implements {ForSomething}`, and a
binding in `main.js` is typed `/** @type {import("…").ForSomething} */`.
`checkJs` in `jsconfig.json` makes `<pm> run typecheck` hold every
implementation to its port, and `detectJSDocImports` makes dependency-cruiser
count those `import("…")` types as imports — so the rules below bind them too.
Never turn `checkJs` off to make a change pass.

## What may import what

| from | may import |
|---|---|
| `presentation/**` | `module/*/app/port/in/**`, `module/*/app/**`, its own folder |
| `module/*/infra/**` | `app/port/out/**` of its module and of `shared/`, its own folder |
| `module/*/{app,domain}/**` | `module/**`, and a library, zod included, only from the kernel's `domain/libs/` |
| `module/*/domain/**` | `module/*/domain/**` only |
| `module/*/domain/**`, `module/*/app/services/**` | never `module/*/app/port/in/**` |
| `module/*/app/port/in/*.dto.ts`, `dto.schema.ts`, `shared/app/port/in/index.ts` | other DTOs, the kernel's DTO entry `shared/app/port/in/index.ts` and the validator lib — never `shared/module.ts`, which reaches its adapters |
| `module/runtime/**` | of `module/charter/`, its driver ports alone |
| `module/charter/**` | nothing of `module/runtime/` |
| `module/shared/**` | nothing of either module |
| `main.ts` / `main.js`, `module/composition.ts` | everything |

A driving adapter and a driven adapter never import each other; no cycles.

## Extend, don't add

- **New use case:** a method on the driver port that already holds the
  conversation, or a new `For<Doing>` port when it is a different one; its
  implementation in the matching `app/` class; its rules in `domain/`.
- **New outside thing** (a table, an API, a file, the time): a driven port in
  `app/port/out/`, the real adapter and an `InMemory*` one in `infra/`, wired
  in the composition root. Never call it straight from the hexagon.
- **New state to keep** (a kind of file the repository holds): a storage
  port in `app/port/out/` carrying the domain's models, the factory that
  validates what is kept into its model in `domain/`, and its repository in `infra/` over the driven ports
  that reach it, wired in the composition root.
- **New entry point:** `presentation/<name>/` calling existing driver ports, wired
  in the composition root. Anything one driver can do, another reaches through the same
  port.
- **New rule:** in `domain/`, tested with plain values.

## Rules

- Never loosen `.dependency-cruiser.cjs` to make a change pass. A violation
  means the code is in the wrong layer; move it, or add the export to the port.
- Adding a library `hexagon-is-sealed` or `a-library-is-reached-through-a-lib` allows is a decision for the user, not a fix.
- Tests drive the real use case through its driver port, with the real
  repositories, over `InMemory*` adapters. No mock of anything inside the
  hexagon.
- A use case that only reads holds no writing port.
- Name every part as [[hexagonal-naming]] says, and raise a `…Fault` from
  its layer's fault file, never an `Error`.
