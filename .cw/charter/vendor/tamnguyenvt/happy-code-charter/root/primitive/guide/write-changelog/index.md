---
kind: guide
id: write-changelog
description: Write each CHANGELOG.md entry as one short plain sentence for the people who use what you ship, with no spec ids or internals, and mark Breaking only when they must edit what they wrote.
globs: ["CHANGELOG.md"]
rationale: why-write-changelog
---
Write each entry of `CHANGELOG.md` as one short plain sentence that a user of
what this repository ships understands. No spec ids, no internals, no long
upgrade essays.

Mark an entry **Breaking:** only when a user must edit something they wrote —
their config, their code, their content — and say the fix in the same line. A
change that a rebuild, a reinstall or a migration applies on its own is not
breaking: write it as a plain entry that says what to run.
