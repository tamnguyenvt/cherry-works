---
kind: guide
id: leave-changes-unstaged
description: Never stage and never commit on your own — leave every change in the working tree and stop, even on a task branch and even after an earlier commit was approved.
---

Never run `git add` and never run `git commit`. Leave every change unstaged in
the working tree and stop there.

**Why:** the user stages a file once they have read it, so the index is their
record of what is reviewed and what is not. A change staged for them erases that
record, and an unasked commit takes the reading away altogether. Being on a
`task/<id>-<slug>` branch is not permission ([[one-branch-per-task]]), and
neither is an earlier "commit đi" in the same session — that authorised one
commit, not the ones after it. When a commit happened unasked, the fix was
`git reset --soft` back to the branch point.

**How to apply:** finish the work, run the checks, report which files changed,
and wait. A file moved with `git mv` is staged by git itself; move it with a
plain `mv` instead. Stage or commit only when this turn's message asks for it,
and only the change it asks for.
