---
kind: skill
id: sdd-status
description: List every story of the spec set with its status, and the stories that can be built now.
triggers: ["spec status", "which stories are done", "what is the next story"]
---

Read the spec folder from `.sdd/settings.json`. For each `spec-<key>.md`
listed in `spec.md`, give one line per story — id, title, status — then the
counts of `Todo`, `In Progress` and `Done`. End with `ready` of [[sdd-specs]]:
the stories whose dependencies are `Done`, which can be built side by side.
Change nothing.
