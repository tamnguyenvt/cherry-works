# Architecture

Hexagonal (ports and adapters). Three roles, and the arrows between them point
inward: a **driver** calls in, the **hexagon** decides, a **driven** adapter is
called out to. `pnpm lint:deps` (dependency-cruiser, `.dependency-cruiser.cjs`)
enforces every rule below on the real import graph.

```
src/
  driver/                 driving adapters: CLI, HTTP routes, MCP server, UI
  hexagon/
    port/driver/          driver ports: For<Doing>  (use-case interfaces)
      ApplicationFault    the use cases' faults
      dtos/               what crosses a driver port: dto.ts, data.ts (DataDTOs),
                          zod schemas each { type, data }
    port/zdriven/         driven ports: For<Doing>  (named in the adapter's words)
      AdapterFault        the adapters' faults
      ForWritingLogs      the log
    application/          use cases, named after their port without For — light
      dtos                one function per DTO: faultDTO(), greetingDTO()
    service/              <Verb>Service: logic a use case would grow heavy with,
                          or that several follow (LogService) — functions,
                          no state, handed the ports a call needs
    domain/models/        pure rules and values, no port
      DomainFault         the base of every fault, and the domain's faults
    domain/services/      pure logic over several models
  zdriven/                driven adapters, each with an InMemory* twin for tests
main.ts                   composition root: the one place that wires concretes
```

`zdriven` sorts after `hexagon` on purpose: folders read in the order a call
travels.

## Names

| Part | Named | Example |
|---|---|---|
| driver port | `For<Doing>` | `ForGreetingVisitors` |
| use case | its port as a noun, without `For` | `GreetingVisitors` |
| service | verb first, `Service` last | `LogService` |
| model | what it is in the business | `Greeting` |
| driven adapter | the technology, then what it holds; twin `InMemory…` | `StderrLogs`, `InMemoryLogs` |
| fault | `<What is wrong>Fault`, never `Error` | `NamelessVisitorFault` |
| DTO | `dto("<Model>", …)` in `dtos/data.ts`, read as `DataDTOs.<Model>` | `DataDTOs.Greeting` |
| DTO maker | the DTO it makes, in `application/dtos.ts` | `greetingDTO()` |

A function named for what it returns lives only in `domain/models/`
(`greetingOf()`) and, for the DTO it makes, in `application/dtos.ts`
(`greetingDTO()`); everywhere else a function is named verb first.

## Faults

Every error is a `…Fault` with a `message` and a `fix`, extending
`DomainFault`, `ApplicationFault` or `AdapterFault` from its layer's file. A
fault is internal unless raised with `{ internal: false }`. A use case catches
it, logs it through `LogService` when it is internal, and answers a
`DataDTOs.Fault` from `faultDTO()`: the person's fault as it is, an internal
one as `InternalFault` in the system's own words. A driver port never hands a fault
class out.

## What may import what

| from                      | may import                                       |
|---------------------------|--------------------------------------------------|
| `hexagon/**`              | `hexagon/**`, and the libraries in `HEXAGON_LIBRARIES` — never `node:*` |
| `hexagon/domain/**`       | `hexagon/domain/**` only                          |
| `hexagon/domain`, `service` | never `port/driver/**` (no DTO)                |
| `port/driver/dtos/**`     | other DTOs and the schema library                 |
| `driver/**`               | `hexagon/port/driver/**`, `hexagon/application/**`, its own folder |
| `zdriven/**`              | `hexagon/port/zdriven/**`, its own folder         |
| `main.ts`                 | everything                                        |

## Adding something

- **A use case:** a method on a driver port (or a new `For<Doing>` port), its
  implementation in `application/`, its rule in `domain/`, and its logic in a
  `service/` once it grows or is shared.
- **Something from outside** (a DB, an API, the disk, the clock): a driven port
  in `port/zdriven/`, a real adapter and an `InMemory*` one in `zdriven/`, wired
  in `main.ts`.
- **A new entry point:** an adapter in `driver/<name>/` calling a driver port.
- **Tests** drive the real use case over `InMemory*` adapters.

The greeting example (`Greeting`, `NamelessVisitorFault`, `ForGreetingVisitors`,
`GreetingVisitors`, `ForReadingClock`, `ClockUnreadableFault`, `SystemClock`,
`InMemoryClock`, `GreetCommand`) shows one slice through every layer. Replace
it with the first real use case.
