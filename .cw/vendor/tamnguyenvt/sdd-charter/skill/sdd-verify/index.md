---
kind: skill
id: sdd-verify
description: Prove the change works with evidence produced this turn — tests, static checks, and a manual run of what the story describes.
triggers: ["verify changes"]
disable-user-invocation: true
---

1. Run the full test suite and every static check the project defines —
   look in `package.json` scripts, the `Makefile`, the CI config: tests,
   type check, lint, dependency rules. Every one must pass, and a failure is
   never skipped. The one exception is a known failure the baseline of this
   walk recorded: a check that fails with none but the failures it recorded
   — each failing test's name, each error's line — does not fail this step,
   and they are reported as known, never as caused by the change. A known
   failure that no longer fails is reported as fixed. Any failure the
   baseline did not record is a failure like any other.
2. Test it by hand, as a user of the story would: run the command, call the
   endpoint, open the page. For a UI, start the server and drive it with a
   browser tool such as Playwright, and look at the result. Read what the
   program logged and printed during the run — its output and error
   streams, its log files, the browser console — and report it, or say that
   nothing was logged. An error or a warning raised on the story's path
   fails this step, quoted as it was printed.
3. Run `check` of [[sdd-specs]] if anything in the spec folder changed.

Report what was run and what it showed, quoting the decisive output, and end
on one line that sums it up — what was run, what it showed — the evidence a
`Done` story keeps. Where **Conversation** is short and every step passed, the
report and its line go to the review, and to the handoff note where the walk
keeps one, not the chat. No claim of "works" or "passes" without that evidence
from this turn. A failure of any step is reported, never fixed here: nothing
is changed, and the walk goes back to the change.
