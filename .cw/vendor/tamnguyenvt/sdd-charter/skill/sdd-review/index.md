---
kind: skill
id: sdd-review
description: Review the change against the story's scenarios, FR and SC — nothing missing, nothing beyond them — and for security issues.
triggers: ["review implementation"]
disable-user-invocation: true
rationale: sdd-concept
---

Read the diff and the story it implements, in its `spec-<key>.md`.

- **Coverage** — every scenario of the story, and every FR and SC it cites, is
  implemented and has a test that would fail without it. Name each one that
  is not.
- **Scope** — nothing is built beyond the story. Code the story does not ask
  for marks the review **failed**, named file by file.
- **Guides** — every guide whose globs match a changed file is followed.
- **Security** — input validated where it enters, no secret in code or logs,
  no injection, authorization checked where data is reached.

Report each finding on one line, `<file>:<line> <severity>: <problem>. <fix>.`,
its severity one of:

- `bug` — it behaves wrong, and will cause an incident.
- `risk` — it works, but breaks easily: a race, a missing null check, a
  swallowed error.
- `nit` — a name, a style, a micro-optimisation; it may be left as it is.
- `q` — a real question, asked where the answer decides whether it is wrong.

Never hedge ("maybe", "I think", "consider"): what is unsure is a `q`. The fix
is concrete — the guard to add, the name to use — never "refactor this". The
why goes in only where the fix does not show it. A security finding, or a
disagreement over the design, is written as a paragraph with its reasoning
instead of a line.

End with a verdict. Any `bug` or `risk`, a missing scenario, FR or SC, or code
beyond the story: **failed**, with what must change. Otherwise **passed**; a
`nit` or a `q` does not fail it, and is handed to the user to decide at the
gate — a `q` whose answer shows something wrong becomes a `bug` or a `risk`.
