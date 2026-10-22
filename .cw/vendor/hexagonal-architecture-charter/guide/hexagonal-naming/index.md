---
kind: guide
id: hexagonal-naming
description: What each part of a hexagon is named — ports, use cases, services, models, adapters, DTOs and faults — and where its faults live.
globs: ["src/**", "main.ts", "main.js"]
rationale: why-hexagonal-naming
---

Every part of a hexagon is named by the role it plays, so a name says which
layer a file is in before it is opened. Where it lives is
[[hexagonal-architecture]]'s to say; what it is called is said here.

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
| Driven port | `port/zdriven/` | `For<Doing>`, in the adapter's words — see [[driven-port-speaks-its-adapter]] | `ForVerifyingSessionTokens` |
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
