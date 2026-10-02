---
kind: skill
id: sdd-review
description: Review the change against the story's scenarios, FR and SC — nothing missing, nothing beyond them — and for security issues.
triggers: ["review implementation"]
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

Report each finding as `<file>:<line> <severity>: <problem>. <fix>.`, then a
verdict: passed, or failed with what must change.
