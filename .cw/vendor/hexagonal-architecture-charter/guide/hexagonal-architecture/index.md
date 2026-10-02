---
kind: guide
id: hexagonal-architecture
description: The layers of a hexagonal codebase, what each may import, and where a new file belongs.
globs: ["src/**", "main.ts", "main.js"]
rationale: corpus:hexagonal-architecture
---

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
  and `dtos/`, the plain data crossing them. A driver port answers DTOs, never
  a model; it re-exports every type a driver needs, so a driver imports
  nothing else of the hexagon.
- `port/zdriven/` — driven ports, `For<Doing>` (`ForReadingFiles`,
  `ForSendingMail`), named in the adapter's own words — see
  `guide:driven-port-speaks-its-adapter`. Errors and types an adapter needs
  are exported here.
- `application/` — one class per driver port implementing it. A use case
  orchestrates: it reads through services or driven ports, asks the domain to
  decide, turns the result into DTOs. A rule found here belongs in the domain.
- `service/` — reads and writes through driven ports and turns what an
  adapter speaks into domain values (`orderRepo`: `loadOrder`, `saveOrder`).
- `domain/models/` — pure values and rules. No port, no service, no DTO, no
  I/O: whatever a rule needs, it is handed.
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
- Name a model after what it is in the business; a DTO with a `DTO` suffix; a
  port `For<Doing>`; an adapter after the technology it speaks (`PostgresOrders`,
  `SystemClock`), its twin `InMemory<Port noun>`.
