# Architecture

Hexagonal (ports and adapters). Three roles, and the arrows between them point
inward: a **driver** calls in, the **hexagon** decides, a **driven** adapter is
called out to. `pnpm lint:deps` (dependency-cruiser, `.dependency-cruiser.cjs`)
enforces every rule below on the real import graph, JSDoc `import("…")`
types included.

```
src/
  driver/                 driving adapters: CLI, HTTP routes, MCP server, UI
  hexagon/
    port/driver/          driver ports: For<Doing>  (use-case interfaces)
      dtos/               plain data crossing a driver port
    port/zdriven/         driven ports: For<Doing>  (named in the adapter's words)
    application/          use cases implementing driver ports — orchestrate only
    service/              reads and writes through driven ports
    domain/models/        pure rules and values, no port
    domain/services/      pure logic over several models
  zdriven/                driven adapters, each with an InMemory* twin for tests
main.js                   composition root: the one place that wires concretes
```

`zdriven` sorts after `hexagon` on purpose: folders read in the order a call
travels.

## Ports in JavaScript

A port is a JSDoc `@typedef` in its own file under `port/`, exporting nothing
at runtime. An implementation says `@implements {ForSomething}`, and a binding
in `main.js` is typed as its port. `checkJs` in `jsconfig.json` makes the type
checker (`pnpm typecheck`) hold every implementation to its port.

## What may import what

| from                      | may import                                       |
|---------------------------|--------------------------------------------------|
| `hexagon/**`              | `hexagon/**`, and the libraries in `HEXAGON_LIBRARIES` — never `node:*` |
| `hexagon/domain/**`       | `hexagon/domain/**` only                          |
| `hexagon/domain`, `service` | never `port/driver/**` (no DTO)                |
| `port/driver/dtos/**`     | other DTOs and the schema library                 |
| `driver/**`               | `hexagon/port/driver/**`, `hexagon/application/**`, its own folder |
| `zdriven/**`              | `hexagon/port/zdriven/**`, its own folder         |
| `main.js`                 | everything                                        |

## Adding something

- **A use case:** a method on a driver port (or a new `For<Doing>` port), its
  implementation in `application/`, its rule in `domain/`.
- **Something from outside** (a DB, an API, the disk, the clock): a driven port
  in `port/zdriven/`, a real adapter and an `InMemory*` one in `zdriven/`, wired
  in `main.js`.
- **A new entry point:** an adapter in `driver/<name>/` calling a driver port.
- **Tests** drive the real use case over `InMemory*` adapters.

The greeting example (`Greeting`, `ForGreetingVisitors`, `VisitorGreeting`,
`ForReadingClock`, `SystemClock`, `InMemoryClock`, `GreetCommand`) shows one
slice through every layer. Replace it with the first real use case.
