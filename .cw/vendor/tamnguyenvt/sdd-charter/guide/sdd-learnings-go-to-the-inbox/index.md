---
kind: guide
id: sdd-learnings-go-to-the-inbox
description: Never save to the agent's own memory; write what was learned into learning/inbox, where repeated lessons become rules.
rationale: sdd-why-learnings-go-to-the-inbox
---

Never write to the agent's own memory (for Claude Code, the files under
`~/.claude/projects/<project>/memory/` and their `MEMORY.md`). When something is
worth keeping — a correction, a preference, a constraint — write it into a note
under `learning/inbox/`, named `<yyyy-mm-dd>-<slug>.md`, as /sdd-learn does.
