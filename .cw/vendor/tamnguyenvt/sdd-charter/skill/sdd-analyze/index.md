---
kind: skill
id: sdd-analyze
description: Check the spec set for gaps, contradictions and format faults, and report each by id with its fix; changes nothing.
triggers: ["analyze the spec", "check the spec", "review the spec"]
disable-user-invocation: true
rationale: sdd-concept
---

Read the spec folder (`.sdd/settings.json`): `spec.md`, every
`spec-<key>.md` and `plan.json`. Run `check` of [[sdd-specs]] first; its faults
are errors. Then report; change nothing. Each finding is one line:
`<severity> <id or section>: <problem>. <fix>.` — severity `error` or `warn`.

**Errors**

- A story with no `**Status**:` line under its heading, a status other than
  `Todo`, `In Progress` or `Done`, or a status inside the heading.
- A story with no Given/When/Then scenario, or a scenario no one could test.
- An FR no story cites.
- A dependency in `plan.json` the stories do not bear out, or a story that
  depends on more than it needs, keeping it from running side by side.
- Two statements that contradict each other — an FR against a clarification,
  a story against out of scope.
- Implementation in the spec: a file, class, library, endpoint, schema or task
  list.
- A `[NEEDS CLARIFICATION]` left in a story that is next to be implemented.

**Warnings**

- An SC with no number or no way to measure it; a vague word ("fast",
  "intuitive") with no target.
- A story that looks too big for one reviewable change.
- A term used for two things, or two terms for one.
- An edge case no FR answers.

End with a count of stories by status per spec, the stories `ready` lists,
and the counts of errors and warnings. If there are errors, say that /sdd-plan fixes
them.
