---
kind: script
id: biome-check
description: Format and lint the one file the agent just wrote with Biome, and hand back what it cannot fix.
executionPath: ./run.mjs
---

Run as a `PostToolUse` hook: `node <this script>`, with the hook's JSON on
standard input. It reads the file the tool wrote (`tool_input.file_path`, or
`tool_input.path`), and when Biome handles that kind of file it runs
`biome check --write` on it alone, with the repository's own `biome.json`.

It exits 0 when the file is formatted and clean, when the tool wrote no file
Biome handles, and when Biome is not installed. When a lint error is left that
Biome cannot fix, it prints Biome's report on standard error and exits 2, so
the agent reads it and fixes the file.
