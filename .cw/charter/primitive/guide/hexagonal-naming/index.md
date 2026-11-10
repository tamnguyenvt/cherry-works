---
kind: guide
id: hexagonal-naming
description: What each part of a hexagon is named — ports, use cases, repositories, services, models, factories, adapters, DTOs and faults — and where its faults live.
globs: ["src/**", "main.ts", "main.js"]
rationale: why-hexagonal-naming
---

Every part of a hexagon is named by the role it plays, so a name says which
layer a file is in before it is opened. Where it lives is
[[hexagonal-architecture]]'s to say; what it is called is said here.

## Names by part

| Part | Where | Named | Example | File |
|---|---|---|---|---|
| Driver port | `app/port/in/` | `For<Doing>`, the conversation it holds | `ForSigningIn` | `signing-in.port.ts` |
| Use case | `app/` | its driver port as a noun, without `For`, extending `ApplicationService` | `SigningIn extends ApplicationService implements ForSigningIn` | `signing-in.use-case.ts` |
| Storage port | `app/port/out/` | `For<Storing|Loading><Thing>`, `ForLoading` where it only reads; it carries the domain's models, what is kept before it is read `Raw<Thing>` | `ForManagingCharter`, `ForLoadingSessionAnalysis`, `RawPrimitive` | `managing-charter.port.ts` |
| Repository | `infra/` | how it keeps the state, then the state, `Repository` last; it answers a storage port with the domain's models | `FileCharterRepository` implements `ForManagingCharter` | `file-charter.repository.ts` |
| Output port | `app/port/out/` | `ForWriting<Thing>Output`, or `ForProjecting<Thing>`; it is handed the domain's compiled output and lays it, each part known by its part, kind, id and path inside the output | `ForManagingLocalOutput`, `ForManagingLocalAgentOutput` | `managing-local-output.port.ts`, `managing-local-agent-output.port.ts` |
| Service | `app/services/` | verb first, `Service` last; one per file | `BuildCharterService` | `build-charter.service.ts` |
| Model | `domain/models/<concept>/` | what it is in the business, a class; what makes one its static `of` | `SignInMethod`, `SignInMethod.of()` | `sign-in-method.ts` |
| Value object | `domain/models/<concept>/` (or `domain/value-objects/`) | the value it holds, a class | `CharterFolder` | `charter-folder.ts` |
| Factory | beside the model it makes, `domain/models/<concept>/` | the model it makes, `Factory` last, a class whose static `create`, and every function it calls (`static #name`), is written in it | `CatalogueFactory.create()` | `catalogue.factory.ts` |
| Domain service | `domain/services/`, never a model's folder: it works over several models | a class, `Service` last, of static methods named verb first for what they do over several models | `CompileService.compileCharterRoot()` | `compile.service.ts` |
| DTO | `<module>/app/port/in/<module>.dto.ts` | `dto("<Model>", …)` or `dto("<Doing>Outcome", …)`, read as `<Module>DTOs.<Model>` | `OrderingDTOs.Order`, `OrderingDTOs.CheckoutOutcome`, `FaultDTOs.Fault` | `ordering.dto.ts` |
| Driven port | `app/port/out/` | `For<Doing>`, in the adapter's words — see [[driven-port-speaks-its-adapter]] | `ForVerifyingSessionTokens` | `verifying-session-tokens.port.ts` |
| Driven adapter | `infra/`, its in-memory twin in `infra/in-memory/`; an agent's own in `src/plugin/<agent>/` | the technology it speaks, then what it holds; its twin `InMemory<Port noun>` | `ClerkSessionTokens`, `InMemorySessionTokens` | `clerk-session-tokens.adapter.ts`, `in-memory-session-tokens.adapter.ts` |
| Driving adapter | `presentation/<entry point>/` | what it serves, in that entry point's words | `GreetCommand`, `cloudApi` | `greet.command.ts`, `cloud-api.server.ts` |
| Fault | beside its base, below | `<What is wrong>Fault`, never `Error` | `IdentityServiceUnreachableFault` | its base's `<layer>.fault.ts` |

## Files

A file is named as NestJS names one: `<kebab-subject>.<role>.ts` — the
subject in kebab-case, never camelCase, PascalCase or snake_case, then the
role its folder gives it, as in the File column above. The subject drops what
the role already says: `BuildCharterService` is `build-charter.service.ts`,
`ForReadingFiles` is `reading-files.port.ts`, `AdapterFault` is
`adapter.fault.ts`. The class or object inside keeps its own name. A model or a value object
keeps its subject alone, with no role: its folder says what it is
(`charter-root.ts`, `charter-folder.ts`), and so does a model an adapter
keeps of its own in a folder of its module's `infra/` or of its plugin
(`plugin/claude/claude-rule.ts`). So do `helper.ts`, `index.ts` and the entry file
`main.ts`. The
other roles: `.repository`, `.base` (the class every use case, or every adapter of a kind, extends), `.constants` (a layout of names), `.specification`, `.lib`,
`.script` (an asset put down as it is), `.schema` (`dto()`, what
every DTO schema is written with), `.interface` (a type every driving adapter of an entry point
implements), `.commander`, `.server`, `.routes`.

## A use case, and what stands behind it

A use case reads like the story it serves: load what is kept through a
storage port, validate it into models, ask the domain to decide, hand models
back to keep, hand a DTO back. What
stands behind it is chosen by who else follows it:

- **Only this use case** — a private `#method` of its class, named verb
  first (`#countExactMainContext`, `#injectVendor`).
- **State a repository keeps** — the charter, the vendors, the settings, the
  test and eval suites, the sensors, the sessions, the credentials: read and
  written through its storage port as the domain's models (`loadCharter`,
  `addPrimitive`), never through the file ports straight from the use
  case; what is kept is validated into a model by its factory
  (`CharterRootFactory.create`). A
  use case holds the storage ports it was given, and the driven ports it still
  calls itself for what no repository keeps, such as what a build writes.
- **Orchestration several use cases follow** — a service in
  `app/services/`, named for what it does (`BuildCharterService`).
  A service is logic and nothing else: a class of methods written in it,
  holding no state but the services it calls on. Its file exports the one
  instance of it, named as the class in camelCase (`buildCharterService`),
  and the composition root hands it to each use case through its
  constructor. A use case hands it the ports a call needs.

## Functions

- **Named for what it returns** — `SignInMethod.of()`, `Rate.of()` — only in
  a model of the domain, where a static method makes or reads its class's
  value, in a factory, where `create` is the model the factory makes
  (`CatalogueFactory.create()`), and in a use case or `ApplicationService`, where
  a method shaping one DTO is that DTO, `Of` last: `#primitiveDTOOf()`,
  `faultsByFileDTOOf()`.
- **Verb first everywhere else** — use cases and their private methods, services
  of the application and of the domain (`CompileService.compileCharterRoot()`,
  `TestService.runSuite()`),
  repositories, adapters, drivers:
  `findSessionTokenHolder()`, `getBearerToken()`, `loadOrder()`. Never a
  bare verb (`run`, `execute`, `handle`): the verb says what, the noun says
  what of.

## DTOs

What crosses a driver port is a DTO, written as cherry-works writes them, in
`app/port/in/` beside the ports it crosses:

- `dto.schema.ts` — `dto(type, data)`, the one way a DTO is made: a zod schema of
  `{ type, data }`, `type` the model's name as a literal, whose `of(data)`
  makes one — `OrderingDTOs.Order.of({ … })`; and `byType()`,
  which keys a set of schemas by the `type` each carries.
- `<module>.dto.ts` — in the module whose driver ports answer with them, one
  `<Model>Schema = dto("<Model>", z.object({ … }))` per model, and one
  `<Doing>OutcomeSchema` per thing a use case did, each with a line saying what
  it holds; a DTO inside another is its schema (`person:
  PersonSchema.nullable()`). They are gathered as `export const <Module>DTOs =
  byType(…)`, in alphabetical order, with `export namespace <Module>DTOs {
  export type <Model> = z.infer<…> }` beside it: `OrderingDTOs.Order` is the
  schema where a value is wanted and the type where a type is. A DTO belongs
  to the module answering with it, never to `shared/`; a module reading
  another's answers imports that module's DTO file.
- `shared/app/port/in/` — `dto.schema.ts`, and `fault.dto.ts`, the faults
  every module answers with, gathered as `FaultDTOs`; the kernel's `module.ts`
  exports both.

In JavaScript there is no namespace to hold the types: each is a typedef
`<Model>DTO` beside the schemas (`@typedef {z.infer<typeof FaultDTOs.Fault>}
FaultDTO`), and `dto()` and `byType()` are typed with `@type`.

The DTO files import zod and nothing else, so a client may import them and
parse what it is sent by them: `OrderingDTOs.Order.or(FaultDTOs.Fault).parse(…)`.
A driver port answers DTOs alone — `Promise<OrderingDTOs.Order |
FaultDTOs.Fault>`; the use case makes each one by its schema,
`OrderingDTOs.Order.of({ … })`, never by hand as `{ type, data }`,
and no folder of DTO makers stands beside it.

## Faults

Every error a hexagon raises is a `…Fault`, and every fault owes two
things, asked for by its base constructor so neither is left out:

- `message` — what is wrong, never only that something is;
- `fix` — the next move.

A fault is either the person's — a request they can change — or the
system's own: a key set wrong, a service misconfigured, a bug. It is the
system's own, `internal`, unless it is raised with `{ internal: false }`:
what is not marked as the person's is never shown to them. A fault adds no
constructor of its own. Every fault class is the domain's, under
`domain/models/`, one file per part it is raised in, beside the base it
extends:

| File | Base | Holds |
|---|---|---|
| `domain/models/domain.fault.ts` | `DomainFault extends Error` | the base of every fault, and the domain's faults |
| `shared/domain/models/application.fault.ts` | `ApplicationFault extends DomainFault` | the base of what a use case refuses, and nothing else |
| `<module>/domain/models/<module>.fault.ts` | `ApplicationFault` | what that module's use cases refuse (`UnknownIdFault` in `charter.fault.ts`) |
| `domain/models/adapter.fault.ts` | `AdapterFault extends DomainFault` | what stands behind a driven port refusing or out of reach |

- A driven port re-exports the faults its adapters raise.
- A fault never crosses a driver port as a class: the use case turns it into
  a `FaultDTOs.Fault` — `{ type: "Fault", data: { name, message, fix } }` —
  in `answerWithFaultDTO()` of `ApplicationService`. A driver port re-exports no
  fault, so what calls in knows DTOs alone.
- It sends the person's fault as it is, and cooks an internal one
  into the system's own words — `{ name: "InternalFault", message: "Something
  went wrong on our side.", fix: "Try again in a moment…" }` — so nothing of
  how the system is set up reaches a client.
- Before it does, `answerWithFaultDTO()` of `ApplicationService` in
  `app/application-service.base.ts` writes an
  internal one — its name, its message, its stack and its causes — through the
  `ForReportingProgress` port the use case holds (`ConsoleReporter`,
  `InMemoryReporter` in tests). What the client is not told, whoever runs the
  system can still read; the person's own faults are not logged.

## Logs

One place writes the log for every use case: `answerWithFaultDTO()` of
`ApplicationService`, the base every use case extends, which every operation
of a driver port answers
through, writing through the `problem()` of the `ForReportingProgress` port
the use case holds. There is no logging port of its own. A use case says what
happened and never builds a log entry itself. A log entry never carries a
secret: never the arguments a use case was called with.
