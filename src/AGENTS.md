<!-- CHERRYWORKS START -->
## Charter guides

Repository paths below are relative to the git root.

#### architecture-map

Applies only to repository paths matching: "src/**".

Source: [.cw/out/guide/architecture-map/index.md](../.cw/out/guide/architecture-map/index.md).

Map of `src/`. Before writing a new class, file or function, find its place
here and extend what is already there.

## Layers (hexagonal; enforced by `pnpm lint:deps`)

- `driver/` calls in: `cli/` (`Commander`, one `commands/<Name>Command.ts`
  each, listed in `commands/index.ts`), `portal/` (`routes.ts`, `page/`),
  `mcp/server.ts`. A driver reaches the hexagon only through `hexagon/port/driver/`
  or `hexagon/application/`.
- `hexagon/` decides. It imports nothing outside itself but lodash, picomatch
  and zod: no `node:*`, no adapter.
- `zdriven/` is called out to: one adapter per driven port, plus an `InMemory*`
  twin used by tests (`FileOutput`/`InMemoryFileOutput`, `Git`/`InMemoryVCS`…).

## Inside `hexagon/`

- `port/driver/` — use-case interfaces (`ForManagingCharter`, `ForReviewingSessions`…) and the DTOs
  crossing them (`dtos/data.ts`, `dtos/outcome.ts`).
- `port/zdriven/` — driven ports (`ForReadingFiles`, `ForWritingFiles`,
  `ForVCS`, `ForCountingTokens`, `ForRunningAgentCli`, `ForRunningPromptfoo`, `ForTellingTime`…), named in the adapter's own words, never the domain's.
- `application/` — use cases implementing the driver ports: `CharterAuthoring`,
  `CharterVendoring`, `TestAuthoring`, `McpConnecting`, `SessionReviewing`,
  `CharterEvaluating`; `dtos.ts` turns domain
  values into DTOs. A use case orchestrates; it holds no rule of its own.
- `service/` — reads and writes through driven ports: `charterRepo`
  (`loadCharterRoot`, `writeCharter`), `buildService` (`plan`,
  `previewPlan`, `executePlan`), `settingsRepo`, `vendorRepo`,
  `testSuitesRepo`, `credentialRepo`, `mcpOriginsRepo`, `contextService`
  (`estimatedMainContextOf` through the tokenizer, `exactMainContextOf`
  through the agent's own command line), `sessionAnalysisRepo`
  (`loadSessionAnalysis`: the `SessionAnalysis` of the stops kept on this machine within a span,
  off the folder `sessionsFolderOf` in `path.ts` names, reading no log last
  written outside it), `evalSuitesRepo` (`loadEvalRoot`: the cases under
  `.cw/eval/`), `promptfooService` (`runWithPromptfoo`: one case said as a
  promptfoo test, run and graded by promptfoo, read back as its report).
- `domain/` — pure rules, no port:
  - `models/charter/` — `CharterRoot` (every primitive, every composite
    fault, in `compositeFaultsByFiles`), `primitive/` (one `<Kind>Primitive`
    per kind extending `BasePrimitive`, registered in `PRIMITIVE_CLASSES` of
    `Primitive.ts`), `builtin/` (the engine's own layer: `cw-author`,
    `cw-session-cost`, the session counter; listed in `BUILTIN_PRIMITIVES`).
  - `models/output/` — what a build produces, knowing no primitive:
    `CharterOutput`; `common/` (`Catalogue`, `CharterMd`, `CompiledPrimitive`,
    `McpOrigin`); `provider-component/` — a host's files: `ProviderComponent`
    ← `DocumentBasedComponent` | `SettingBasedComponent`, host-neutral, and
    `provider-component/<host>/`
    (`ClaudeSkill`, `ClaudeRule`, `ClaudeAgent`, `ClaudeSettings`,
    `ClaudeMcpConfig`, listed in `ClaudeComponent.ts`).
  - `services/` — logic that knows charter and output together:
    `compile/compileService.ts` (`compile`: charter to output, no file reads,
    with hosts dispatched in `providerComponentsOf`), calling one pure factory
    per output in `compile/<model>Factory.ts`:
    `compiledPrimitiveOf`, `catalogueOf`, `charterMdOf`, `mcpOriginsOf`, and
    `claudeComponentsOf` in `claudeComponentFactory.ts`;
    `context/mainContextService.ts` (`mainContextTextsOf`: what compiled output puts
    into the agent's main context when a session opens, hosts dispatched there, and
    `tokenFactorOf`, each host's token factor) calling `claudeMainContextOf`
    in `context/claudeMainContextFactory.ts`, beside `CLAUDE_TOKEN_FACTOR`;
    `testService.ts`; `evalService.ts` (`EvalCaseReport`, `EvalRunReport`, and the
    cases naming what the charter does not hold).
  - `path.ts` — the repository's layout: every folder and file name, and the
    URLs built from them. Not a model.
  - `models/context/` — `MainContext`: what a charter puts into one agent's
    main context, counted, and the ceiling it is held to.
  - `models/session/` — `SessionAnalysisLine`: one stop of one session, as
    `cw-session-tokens-counter` keeps it; `SessionSpan` (`sessionSpanOf`: the
    days a summary spans, 31 at most); `SessionAnalysis`: the lines read,
    and `summarize(span)` / `summarizeByDay(span)` into a
    `SessionAnalysisSummary`, which holds each session's tokens by kind and
    total at its last stop and no line.
  - `models/eval/` — `EvalSuite` (the cases of one file under `.cw/eval/`,
    `evalRootOf` reading them all into an `EvalRoot`).
  - `models/` root — what the charter and the output share: closed value
    sets with their type (`AgentProvider`, `McpAuthMethod`), `WorkspaceSettings`,
    `DomainFault` (faults with a fix and a severity).

## Extend, don't add

- A new primitive kind: `<Kind>Primitive.ts` beside the others (schema,
  `requires`, `sample`, `activatesWhen`, `of`) and one line in
  `PRIMITIVE_CLASSES`. `cw kinds`, `cw add`, the portal and `CHARTER.md`
  follow. A kind reached by being named (`mcp:`, `script:`, `template:`) adds
  its mention regex to `identitiesMentionedIn` in `CharterRoot`.
- A new output of a primitive: extend `compiledPrimitiveOf` (extension,
  stamp, built files) rather than adding an output model.
- A new output of the charter: a declarative model in `models/output/` and a
  `<model>Of()` in `compile/<model>Factory.ts`, called from `compile`.
- A new file for a host: a class extending `DocumentBasedComponent` or
  `SettingBasedComponent` that sets its own `path` in `of`, listed in that
  host's `<Host>Component.ts`, built in `<host>ComponentFactory.ts`.
- A new host: `provider-component/<host>/`, `compile/<host>ComponentFactory.ts`, one
  arm in `providerComponentsOf`, one value of `AgentProvider`; for its main
  context, `context/<host>MainContextFactory.ts`, one arm each in
  `mainContextTextsOf` and `tokenFactorOf`, and an adapter of
  `ForRunningAgentCli` under it in `agentCliByProvider` of `main.ts`.
- A new composite check: a fault in `CharterRoot.compositeFaultsByFiles`;
  a warning is `"warn"`, anything that could send an agent to something that is
  not there is an error.
- A new command: `<Name>Command.ts` + `commands/index.ts`, calling a use case;
  anything the portal shows must have a command too.

## Rules

- A model under `models/output/` holds its final values, `document` included
  (stamped or not), and has no `to…()` step. It knows no primitive: building
  it from the charter is its factory's job, where the stamp is decided by
  kind. A host's class keeps an `of` only for what the class alone decides,
  such as its `path`.
- A method that only reads never reaches for the writing port, even where
  its use case holds one (FR-041).
- Tests drive the real use case over `InMemory*` adapters.
- A zod schema is named in PascalCase with a `Schema` suffix
  (`SkillHeadersSchema`, `WorkspaceSettingsSchema`), never UPPER_SNAKE: it is
  a schema, not a constant. The type inferred from it drops the suffix
  (`SkillHeaders`).

#### hexagonal-architecture

Applies only to repository paths matching: "src/**", "main.ts", "main.js".

Source: [.cw/out/guide/hexagonal-architecture/index.md](../.cw/out/guide/hexagonal-architecture/index.md).

This codebase is hexagonal (ports and adapters). Before writing a new class,
file or function, find its place below and extend what is already there.
`<pm> run lint:deps` (dependency-cruiser, `.dependency-cruiser.cjs`) enforces
the import rules; run it after any change that adds an import.

## Layers

- `src/driver/` calls in: one folder per entry point (`cli/`, `http/`,
  `mcp/`, a UI). It parses input, calls a driver port, renders the answer. It
  decides nothing.
- `src/hexagon/` decides. It imports nothing outside itself — no `node:*`, no
  adapter, no SDK — except the value libraries named in `HEXAGON_LIBRARIES` of
  `.dependency-cruiser.cjs`.
- `src/zdriven/` is called out to: one adapter per driven port (disk, DB, HTTP
  API, clock, queue), each with an `InMemory*` twin used by tests.
- `main.ts` / `main.js` is the composition root, the one place that names
  concrete classes. Each binding is declared as its port type, not as the class.

## Inside `src/hexagon/`

- `port/driver/` — use-case interfaces, `For<Doing>` (`ForManagingOrders`),
  and `dtos/`, the zod schemas of what crosses them (`DataDTOs`, `OutcomeDTOs`,
  each DTO `{ type, data }` — see [hexagonal-naming](../.cw/out/guide/hexagonal-naming/index.md)). A driver port answers DTOs, never
  a model; it re-exports every type a driver needs, so a driver imports
  nothing else of the hexagon.
- `port/zdriven/` — driven ports, `For<Doing>` (`ForReadingFiles`,
  `ForSendingMail`), named in the adapter's own words — see
  [`driven-port-speaks-its-adapter`](../.cw/out/guide/driven-port-speaks-its-adapter/index.md). Faults and types an adapter needs
  are exported here; the adapters' faults live in `AdapterFault.ts`.
- `application/` — one class per driver port implementing it. A use case
  orchestrates: it reads through services or driven ports, asks the domain to
  decide, turns the result — a fault included — into DTOs with the makers in
  `application/dtos.ts`. It stays light: a
  rule found here belongs in the domain, and logic that grows belongs in a
  service.
- `service/` — the logic a use case follows when it is more than a few
  calls: reading and writing through driven ports, turning what an adapter
  speaks into domain values, stringing several models together. One service
  is reused by every use case that follows the same logic. It is an object
  of functions, holding no state and never constructed: a use case hands it
  the ports a call needs, so only ports are wired in the composition root.
- `domain/models/` — pure values and rules. No port, no service, no DTO, no
  I/O: whatever a rule needs, it is handed. `DomainFault.ts` here is the base
  of every fault.
- `domain/services/` — pure logic over several models.

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
| `driver/**` | `hexagon/port/driver/**`, `hexagon/application/**`, its own folder |
| `zdriven/**` | `hexagon/port/zdriven/**`, its own folder |
| `hexagon/**` | `hexagon/**` and `HEXAGON_LIBRARIES` only |
| `hexagon/domain/**` | `hexagon/domain/**` only |
| `hexagon/domain/**`, `hexagon/service/**` | never `hexagon/port/driver/**` |
| `hexagon/port/driver/dtos/**` | other DTOs and the schema library |
| `main.ts` / `main.js` | everything |

A driving adapter and a driven adapter never import each other; no cycles.

## Extend, don't add

- **New use case:** a method on the driver port that already holds the
  conversation, or a new `For<Doing>` port when it is a different one; its
  implementation in the matching `application/` class; its rules in `domain/`.
- **New outside thing** (a table, an API, a file, the time): a driven port in
  `port/zdriven/`, the real adapter and an `InMemory*` one in `zdriven/`, wired
  in the composition root. Never call it straight from the hexagon.
- **New entry point:** `driver/<name>/` calling existing driver ports, wired
  in the composition root. Anything one driver can do, another reaches through the same
  port.
- **New rule:** in `domain/`, tested with plain values.

## Rules

- Never loosen `.dependency-cruiser.cjs` to make a change pass. A violation
  means the code is in the wrong layer; move it, or add the export to the port.
- Adding a library to `HEXAGON_LIBRARIES` is a decision for the user, not a fix.
- Tests drive the real use case through its driver port over `InMemory*`
  adapters. No mock of anything inside the hexagon.
- A use case that only reads holds no writing port.
- Name every part as [hexagonal-naming](../.cw/out/guide/hexagonal-naming/index.md) says, and raise a `…Fault` from
  its layer's fault file, never an `Error`.

#### hexagonal-naming

Applies only to repository paths matching: "src/**", "main.ts", "main.js".

Source: [.cw/out/guide/hexagonal-naming/index.md](../.cw/out/guide/hexagonal-naming/index.md).

Every part of a hexagon is named by the role it plays, so a name says which
layer a file is in before it is opened. Where it lives is
[hexagonal-architecture](../.cw/out/guide/hexagonal-architecture/index.md)'s to say; what it is called is said here.

## Names by part

| Part | Where | Named | Example |
|---|---|---|---|
| Driver port | `port/driver/` | `For<Doing>`, the conversation it holds | `ForSigningIn` |
| Use case | `application/` | its driver port as a noun, without `For` | `SigningIn.ts` implements `ForSigningIn` |
| Service | `service/` | verb first, `Service` last | `FindSignedInPersonService` |
| Model | `domain/models/` | what it is in the business | `SignInMethod` |
| Domain service | `domain/services/` | what it works out, over several models | `RateCalculator` |
| DTO | `port/driver/dtos/data.ts` | `dto("<Model>", …)`, read as `DataDTOs.<Model>` | `DataDTOs.Session`, `DataDTOs.Fault` |
| Outcome DTO | `port/driver/dtos/outcome.ts` | `dto("<Doing>Outcome", …)`, read as `OutcomeDTOs.<Doing>Outcome` | `OutcomeDTOs.DoctorOutcome` |
| DTO maker | `application/dtos.ts` | the DTO it makes | `sessionDTO()`, `faultDTO()` |
| Driven port | `port/zdriven/` | `For<Doing>`, in the adapter's words — see [driven-port-speaks-its-adapter](../.cw/out/guide/driven-port-speaks-its-adapter/index.md) | `ForVerifyingSessionTokens` |
| Driven adapter | `zdriven/` | the technology it speaks, then what it holds; its twin `InMemory<Port noun>` | `ClerkSessionTokens`, `InMemorySessionTokens` |
| Driving adapter | `driver/<entry point>/` | what it serves, in that entry point's words | `GreetCommand`, `cloudApi` |
| Fault | beside its base, below | `<What is wrong>Fault`, never `Error` | `IdentityServiceUnreachableFault` |

## A use case, and the service behind it

A use case reads like the story it serves: a few calls, a decision asked of
the domain, a DTO handed back. When the logic behind it grows — strings
several models together, or is followed by more than one use case — it moves
into a service, named for what it does (`FindSignedInPersonService`,
`TransferMoneyService`), and every use case that needs it calls the same
service. A use case stays light enough to read in one go; a service is where
logic is reused.

A service is logic and nothing else: an object of functions, holding no
state, never constructed and never wired in the composition root. A use case
holds the ports it was given and hands a service the ones a call needs —
`LogService.logFault(this.#logs, fault)` — so only ports are injected, and a
service is read as plainly as a domain function.

## Functions

- **Named for what it returns** — `signInMethodOf()`, `rateOf()` — only in
  `domain/models/`, where a function is a fact about a value, and in
  `application/dtos.ts`, where a function is the DTO it makes:
  `sessionDTO()`, `faultDTO()`.
- **Verb first everywhere else** — use cases, services, adapters, drivers:
  `findSessionTokenHolder()`, `getBearerToken()`, `loadOrder()`. Never a
  bare verb (`run`, `execute`, `handle`): the verb says what, the noun says
  what of.

## DTOs

What crosses a driver port is a DTO, written as cherry-works writes them, in
`port/driver/dtos/`:

- `dto.ts` — `dto(type, data)`, the one way a DTO is made: a zod schema of
  `{ type, data }`, `type` the model's name as a literal; and `byType()`,
  which keys a set of schemas by the `type` each carries.
- `data.ts` — one `<Model>Schema = dto("<Model>", z.object({ … }))` per
  model, each with a line saying what it holds; a DTO inside another is its
  schema (`person: PersonSchema.nullable()`). They are gathered as
  `export const DataDTOs = byType(…)`, in alphabetical order, with
  `export namespace DataDTOs { export type <Model> = z.infer<…> }` beside it:
  `DataDTOs.Session` is the schema where a value is wanted and the type where
  a type is.
- `outcome.ts` — the same for what came of a use case doing something,
  `…Outcome`, gathered as `OutcomeDTOs`, made of the data DTOs.
- `index.ts` — re-exports all three.

In JavaScript there is no namespace to hold the types: each is a typedef
`<Model>DTO` beside the schemas (`@typedef {z.infer<typeof DataDTOs.Fault>}
FaultDTO`), and `dto()` and `byType()` are typed with `@type`.

The DTO files import zod and nothing else, so a client may import them and
parse what it is sent by them: `DataDTOs.Session.or(DataDTOs.Fault).parse(…)`.
A driver port answers DTOs alone — `Promise<DataDTOs.Session |
DataDTOs.Fault>` — and re-exports `DataDTOs`; the use case makes each one
with its maker in `application/dtos.ts`, never inline.

## Faults

Every error a hexagon raises is a `…Fault`, and every fault owes two
things, asked for by its base constructor so neither is left out:

- `message` — what is wrong, never only that something is;
- `fix` — the next move.

A fault is either the person's — a request they can change — or the
system's own: a key set wrong, a service misconfigured, a bug. It is the
system's own, `internal`, unless it is raised with `{ internal: false }`:
what is not marked as the person's is never shown to them. A fault adds no
constructor of its own. Each part keeps its faults in one
file, beside the base they extend:

| File | Base | Holds |
|---|---|---|
| `domain/models/DomainFault.ts` | `DomainFault extends Error` | the base of every fault, and the domain's faults |
| `port/driver/ApplicationFault.ts` | `ApplicationFault extends DomainFault` | what a use case refuses |
| `port/zdriven/AdapterFault.ts` | `AdapterFault extends DomainFault` | what stands behind a driven port refusing or out of reach |

- A driven port re-exports the faults its adapters raise.
- A fault never crosses a driver port as a class: the use case turns it into
  a `DataDTOs.Fault` — `{ type: "Fault", data: { name, message, fix } }` —
  with `faultDTO()` in `application/dtos.ts`. A driver port re-exports no
  fault, so what calls in knows DTOs alone.
- `faultDTO()` sends the person's fault as it is, and cooks an internal one
  into the system's own words — `{ name: "InternalFault", message: "Something
  went wrong on our side.", fix: "Try again in a moment…" }` — so nothing of
  how the system is set up reaches a client.
- Before it does, the use case hands the fault to `LogService.logFault(logs, fault)`,
  which writes an internal one — its message, its fix and its cause — through
  the `ForWritingLogs` port (`StderrLogs`, `InMemoryLogs` in tests). What the
  client is not told, whoever runs the system can still read; the person's
  own faults are not logged.

## Logs

One service writes the log for every use case and whatever it logs:
`LogService` in `service/` — `logInfo()`, `logWarning()`, `logError()` and
`logFault()`, each handed the `ForWritingLogs` port the use case holds. A use case says what happened
and never builds a log entry itself, and a new kind of thing to log is a
method on `LogService`, never a second log service. A log entry never
carries a secret.

<!-- Generated by cherry-works. Do not edit; edit the charter and build again. -->
<!-- CHERRYWORKS END -->
