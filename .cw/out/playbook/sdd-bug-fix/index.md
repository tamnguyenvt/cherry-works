---
kind: playbook
id: sdd-bug-fix
description: Fix one bug on a fix branch of its own — understand it, reproduce it with evidence, report the root cause and the fix for approval, fix it test first, review, verify, and finish into the development branch.
rationale: sdd-concept
mixins: ["sdd-voice", "sdd-change-rules", "sdd-iron-laws"]
triggers: ["fix bug", "fix this bug", "bug fix", "debug this"]
---

## How to talk to the user

Talk in the language the user writes in, in full sentences: compress what is
said, never the grammar it is said in.

- **The answer first** — then why, then what comes next. Never open by
  announcing what you are about to do, never close with a recap or an offer
  of more help.
- **A line per step** — no text between routine tool calls: one line when a
  step of the walk starts, one with what it showed. Speak in between only to
  warn, to clarify, or to ask.
- **Verbatim** — commands, paths, ids, code and errors are quoted exactly; an
  error by its shortest decisive line.
- **Every negation kept** — never drop a not, never, no, only or except to
  save a word: a lost negation costs more than any word saved.
- **One reading** — a sentence that could be read two ways is written again
  until it cannot.
- **As long as `manifest.md` says** — where its **Conversation** is short, the
  default, a gate says only what it asks of the user, and what changed is
  never listed: the user reads the code and asks. Where it is detailed, each
  step reports what it did and what it showed.

## Every change

Read `.sdd/settings.json` for the spec folder, and `manifest.md` there: it
decides the worktree, the order, the branches — the development branch
`develop` where it names none — and how changes are committed. Do as it says;
where it says nothing about the case at hand, ask.

- **Handed over only once checked.** The user is handed a change only after
  /sdd-verify and /sdd-review have passed. With **Conversation** short, say
  only that it is done and needs the user's review, with each `q` the review
  left to answer; with it detailed, say what changed and what each check
  showed, with each `nit` and `q` the review left for the user to decide. Each
  change the user asks for then is made and checked the same way again before
  it is handed back; a requested change is never reported done on the edit
  alone.

The walk of one bug: `branch → understand → find the cause → report → fix →
review → verify → (learn) → finish`. The user is asked twice: once the cause
and the fix are reported, and once the fix has passed its own checks.

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
3. **Find the cause** — spawn [sdd-locator](../../agent/sdd-locator/index.md) with the bug as restated to
   find the code it runs through, then read the ranges it names. Reproduce it:
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
   story. A review that failed goes back to step 5.
7. **Verify** — run /sdd-verify, the reproduction of step 3 run again among
   it, now showing the bug gone. A failure goes back to step 5.
   **Gate:** only now hand the fix to the user — with **Conversation** short,
   in one line: it is fixed and needs the user's review.
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

## Iron laws of every change

- **No completion claim without fresh evidence.** Checks run this turn.
- **No commit the manifest does not allow, and none with failing checks.**
  Never `--no-verify`.

<!-- Generated by cherry-works. Do not edit; edit the charter and build again. -->
