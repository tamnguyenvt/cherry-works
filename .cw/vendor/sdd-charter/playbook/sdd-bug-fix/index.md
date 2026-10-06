---
kind: playbook
id: sdd-bug-fix
description: Fix one bug on a fix branch of its own — understand it, reproduce it with evidence, report the root cause and the fix for approval, fix it test first, review, verify, and finish into the development branch.
triggers: ["fix bug", "fix this bug", "bug fix", "debug this"]
rationale: sdd-concept
---

The walk of one bug: `branch → understand → find the cause → report → fix →
review → verify → (learn) → finish`. The user is asked twice: once the cause
and the fix are reported, and once the fix has passed its own checks. Talk to
the user in the language they write in, in full sentences.

Read `.sdd/settings.json` for the spec folder, and `manifest.md` there: it
decides the worktree, the development branch (`develop` where it names none)
and how changes are committed. Do as it says; where it says nothing about the
case at hand, ask.

1. **Branch** — a bug is fixed on `fix/<slug>`, `<slug>` a few words of
   the bug, started from the development branch:
   - **Worktree** main: stop the work in hand first. With a change in the
     working tree, say what it is and ask whether to stash it
     (`git stash push -u`) or commit it on its branch; never discard it. Then
     `git switch -c fix/<slug> <development branch>`.
   - **Worktree** per story: leave the main worktree as it is, and add one for
     the fix, `git worktree add -b fix/<slug> <path>/fix-<slug>
     <development branch>`, under the path the manifest names.
2. **Understand** — restate the bug: what happens, what should happen
   instead, where, and the steps given to reproduce it, if any. Where the
   bug as told cannot be understood — what goes wrong, or where — ask the
   user before looking for its cause, rather than guessing.
3. **Find the cause** — read the code the bug runs through. Reproduce it:
   with steps given, follow them; without, find them. Bring evidence of it
   happening — a failing test, a run of the command, an API call and its
   answer, a page driven with Playwright and what it showed. Keep trying,
   20 attempts at most, each a different way in; where it still will not
   reproduce, say what was tried and give the most likely cause as a
   prediction, saying it is one.
4. **Report** — in this order:
   - **Root cause** — one line.
   - **Flow** — the steps that reproduce it and what each showed, or the
     prediction and why.
   - **Root cause in detail** — the code path and why it goes wrong, where
     known.
   - **Fix** — what will change, and where.
   - **Related issues** — "yes, see the inbox" or "no".
   - **Caveats** — what fixing it this way risks or trades off.
   - **Definition of done** — what will be true once it is fixed, each
     checkable.

   **Gate:** explicit approval of the fix.
5. **Fix** — test first: a test that fails for the bug's own reason, then
   the smallest change that makes it pass, and nothing else.
6. **Review** — run /sdd-review, held to the definition of done instead of a
   story. A finding to fix goes back to step 5.
7. **Verify** — run /sdd-verify, the reproduction of step 3 run again among
   it, now showing the bug gone. A failure goes back to step 5.
   **Gate:** only now hand the fix to the user, saying what changed and what
   review and verify showed. Each change the user asks for here is made, then
   reviewed and verified again, before it is handed back.
8. **Learn** *(only if something surprising came up)* — run /sdd-learn.
9. **Finish** — once the user accepts the fix, run /sdd-finish: it lands
   `fix/<slug>` in the development branch, never in a phase branch.

## Iron laws (across every step)

- **Never refactor to fix a bug.** The fix is the smallest change that makes
  the failing test pass.
- **Never rename on the way.** A variable, a function or a file keeps its
  name, however much a better one suggests itself.
- **Never fix what is beside the bug.** A performance issue, a coding issue
  or any other problem met on the way goes into a note in `learning/inbox/`
  as /sdd-learn writes one, and the user is told in one line; it is not fixed
  here.
- **No fix without approval.** The report gate is real.
- **No completion claim without fresh evidence.** Checks run this turn.
- **No commit the manifest does not allow, and none with failing checks.**
  Never `--no-verify`.
