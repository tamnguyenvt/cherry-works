# Hexagonal Architecture Charter

A [Cherry Works](https://github.com/tamnguyenvt/cherry-works) charter that sets
up a hexagonal (ports and adapters) architecture in a folder of your choice, and
keeps your coding agent following it afterwards.

## Install

From your repository:

```bash
# latest
cw vendor add https://github.com/tamnguyenvt/hexagonal-architecture-charter

# or pinned to a version
cw vendor add https://github.com/tamnguyenvt/hexagonal-architecture-charter --ref v0.1.0

cw build
```

If you don't have `cw` yet, set it up first with
[Cherry Works](https://github.com/tamnguyenvt/cherry-works#install).

## Use

Ask your agent:

```text
/init-hexagon ./path/to/your/folder
```

The skill asks for anything you left out: the folder, the language,
dependency-cruiser, and whether to include the example. It then shows what it
will write and waits for your yes. After it runs, it checks the result against
your guides and fixes what they flag. It tells you it is done only once that
check is clean.

## What it creates

```text
<your-folder>/
├── main.ts                       # composition root: the only place that wires concrete classes
├── src/
│   ├── ARCHITECTURE.md           # the rules below, for whoever reads the code
│   ├── driver/                   # calls in: CLI, HTTP routes, UI
│   ├── hexagon/                  # decides: imports nothing from outside
│   │   ├── port/driver/          # use-case interfaces (For<Doing>) and their dtos/
│   │   ├── port/zdriven/         # what the hexagon needs from outside (For<Doing>)
│   │   ├── application/          # use cases: orchestrate, hold no rules
│   │   ├── service/              # reads and writes through driven ports
│   │   └── domain/               # pure rules and models
│   └── zdriven/                  # is called out to: DB, API, disk, clock, plus InMemory twins for tests
├── test/
├── tsconfig.json                 # jsconfig.json in JavaScript
└── .dependency-cruiser.cjs       # enforces the layer rules (optional)
```

The example use case (a greeting) runs through every layer with a passing test.
It is optional. Replace it with your first real use case.

## Languages

- [x] TypeScript
- [x] JavaScript (ES modules, with JSDoc types checked by `checkJs`)
- [ ] Others (Not supported yet)

The skill detects which one the folder already uses.
