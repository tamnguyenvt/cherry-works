---
kind: sensor
id: biome-on-edit
description: Format and lint each file the agent writes with Biome, handing back what Biome cannot fix.
signal: PostToolUse
run: node [[biome-check]]
---

After every tool the agent runs, [[biome-check]] formats and lints the file
that tool wrote, if any, with the repository's `biome.json`. A file Biome left
clean passes silently; a lint error it cannot fix comes back to the agent,
which fixes the file before going on.
