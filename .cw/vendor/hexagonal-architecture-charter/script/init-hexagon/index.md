---
kind: script
id: init-hexagon
description: Scaffold a hexagonal architecture (driver / hexagon / zdriven), in TypeScript or JavaScript, into the folder it is given.
executionPath: ./run.sh
---

Scaffolds a hexagonal (ports and adapters) architecture into one folder, in
**TypeScript or JavaScript** — no other language. Each has its skeleton beside
this file, `ts-skeleton/` and `js-skeleton/`: the layer folders, a
`.dependency-cruiser.cjs` that enforces them, a `tsconfig.json` (TypeScript)
or a `jsconfig.json` with `checkJs` (JavaScript), a composition root
`main.ts` / `main.js`, `src/ARCHITECTURE.md`, and one walking-skeleton use case
(a greeting) through every layer with a passing test. In JavaScript a port is a
JSDoc `@typedef`, held to by `checkJs`, and dependency-cruiser counts JSDoc
`import("…")` types as edges.

```bash
.cw/out/script/init-hexagon/run.sh <target-folder> [--language ts|js] [--force] [--dry-run] [--no-dependency-cruiser] [--no-example]
.cw/out/script/init-hexagon/run.sh <target-folder> --detect-language
```

- `<target-folder>` — the one argument, required: the project root to
  initialise. Created when it is not there; refused when it is a file.
- `--detect-language` — print one line and write nothing: `ts` (a
  `tsconfig.json` or a `.ts` file), `js` (a `package.json`, `jsconfig.json` or
  `.js` file), `none` (nothing to tell by: missing or empty), or
  `unsupported:<file>` (another language's file, such as `go.mod` or `app.py`).
  TypeScript wins over JavaScript, and either over another language.
- `--language ts|js` — which skeleton. Without it, the detected language;
  refused when that is `none`. Any other value is refused.
- `--force` — overwrite files already in the target. Without it, an existing
  file is left alone and listed as skipped. Nothing is ever deleted.
- `--dry-run` — print what would be written and what would be skipped, and
  write nothing, not even the target folder. What a gate shows before asking.
- `--no-dependency-cruiser` — leave out `.dependency-cruiser.cjs`.
- `--no-example` — leave out the greeting slice: each folder it would have
  filled gets a `.gitkeep`, and `main.<ts|js>` is an empty composition root.

A folder detected as `unsupported:` is refused whatever `--language` says:
hexagonal scaffolding in JavaScript does not belong in a Go or Python project.

It writes files and prints the language, what it wrote, what it skipped, and
the next steps; it installs nothing and does not touch `package.json`. Those
are for whoever runs it — `agent:hexagon-initializer` does them.

What it lays out, and the rules between the layers, are `guide:hexagonal-architecture`.
