---
kind: skill
id: sdd-verify
description: Prove the change works with evidence produced this turn — tests, static checks, and a manual run of what the story describes.
triggers: ["verify changes"]
---

1. Run the full test suite and every static check the project defines —
   look in `package.json` scripts, the `Makefile`, the CI config: tests,
   type check, lint, dependency rules. Every one must pass; a failure is fixed,
   never skipped.
2. Test it by hand, as a user of the story would: run the command, call the
   endpoint, open the page. For a UI, start the server and drive it with a
   browser tool such as Playwright, and look at the result.
3. Run `check` of [[sdd-specs]] if anything in the spec folder changed.

Report what was run and what it showed, quoting the decisive output. No claim
of "works" or "passes" without that evidence from this turn.
