---
kind: skill
id: sdd-review
description: Verify the change, then have an agent that did not write it review it, with what verify showed, against the story's scenarios, FR and SC — nothing missing, nothing beyond them — and for security issues.
triggers: ["review implementation"]
disable-user-invocation: true
rationale: sdd-concept
---

Run /sdd-verify first, with what the walk hands it — the baseline's known
failures, a bug's reproduction. On a failure, stop: no review is made, and
the walk goes back to the change.

The change is never reviewed by the agent that wrote it. Write the change to
a temporary file outside the repository — `git diff $(git merge-base <the
branch it started from> HEAD)`, then `git diff --no-index /dev/null -- "<file>"`
for each file `git ls-files --others --exclude-standard` lists — raw, past
any filter that rewrites command output (`rtk proxy git …` where rtk is
installed); the file holds a `+++ ` header per changed file, or it is written
again. Then spawn
[[sdd-review-agent]] with the story's id and `spec-<key>.md`, or a bug fix's
definition of done, that file's path, and the line /sdd-verify ended on.
Hand it nothing else: never the conversation, the plan, or the reasoning
behind the change.

Relay the guides it read, its findings and its verdict to the walk as it wrote
them; each `nit` and `q` goes to the hand-over: written to the handoff note,
settled, or put to the user as **Review** in the manifest says. Where
**Conversation** is short, a review that passes says nothing in the chat but
each `nit` and `q` left for the user, at the hand-over.
