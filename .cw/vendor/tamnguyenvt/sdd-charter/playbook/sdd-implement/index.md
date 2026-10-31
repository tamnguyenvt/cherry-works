---
kind: playbook
id: sdd-implement
description: Implement a ready story of the spec set — pick it, baseline, spec gate, test first, verify and review — the way manifest.md says, and mark it Done.
triggers: ["implement task", "implement next task", "implement the next story", "implement story"]
rationale: sdd-concept
mixins: [sdd-change-rules, sdd-iron-laws]
---

One story, from `Todo` to `Done`:

`pick → baseline → spec → implement → verify and review → hand over → (learn)
→ done`

The user answers at the two gates, at the pick when it asks, and at the
baseline when it fails or finds no check. Every other step runs on its own,
with no pause.

## Steps

1. **Pick**
   - Run /sdd-report, saying nothing of it where **Conversation** is short.
   - With more than one spec and none named, ask which one.
   - Take the story the user names, else the first one already
     `In Progress` in that spec, in `plan.json` order, else the first `ready`
     one ([[sdd-specs]]).
   - A story `In Progress`: switch to its branch and read its handoff note
     before anything else of it. Say where the note and the code differ — the
     code wins — then go on at the step the note names under Remaining,
     asking nothing the note answers. A baseline or a spec gate the note
     records as passed is not run again, and the story's own tests are its
     work, never a baseline failure. No note, as where notes are ignored:
     start from the story and its branch.
   - With **Order** parallel and several ready, offer an agent and a worktree
     to each.
   - A story not yet `In Progress`: open its branch, set it `In Progress`,
     and write its handoff note from [[sdd-handoff]].
   - Find the code it touches with [[sdd-locator]].
2. **Baseline** — run every test and static check the project defines.
   - None defined: ask whether to go on.
   - Any fails: stop, and offer the two ways of **Known failures**.
   - All pass: say nothing of it where **Conversation** is short.
3. **Spec** — gate
   - Restate the story: intent, scenarios, the FR and SC it cites, and what
     is out of scope.
   - Propose each technical decision it needs.
   - End with one sentence saying what will be done. With **Conversation**
     short, say that sentence alone, and ask only a decision that needs the
     user, or what is unclear.
4. **Implement** — a failing test per scenario, then the code that passes it.
   Surgical edits only. A quality cross-check story is built by
   /sdd-quality instead: its report written, and the stories /sdd-plan
   writes from it accepted.
5. **Verify and review** — /sdd-review.
6. **Hand over** — gate, ending on this line alone, word for word whatever
   the user's language, and at no other gate:
   `approve ?`
7. **Learn** — only if something surprising came up: /sdd-learn.
8. **Done**
   - A quality cross-check story is never set `Done` before its report is
     written and the user has accepted the stories /sdd-plan
     wrote from it, or the pass found none.
   - Set the story `Done`, write the evidence into its `plan.json` entry —
     `"evidence": { "summary": "<one line>", "date": "yyyy-mm-dd" }`, the
     line /sdd-verify ended on and the day it ran — bring its handoff note up
     to date and keep it, and run `check` of [[sdd-specs]].
   - Commit or leave the change as **While working** says.
   - Run /sdd-finish at once; the user accepting the change is the ask.

## Handoff note

Before every stop on a story `In Progress` — at a gate, mid-step, or because
the session ends — bring `<spec folder>/handoff/<prefix>-<n>.md` up to date:
what is done — the baseline with each known failure, the spec gate once it
passed — what remains, from the step to go on at, the decisions taken and what
blocks it, and nothing the spec already says. `check` refuses a story
`In Progress` without one — except where notes are ignored — and a note for a
story `Todo`.

## Going back

- Verify or review fails: back to step 4.
- The user asks for a change at the hand-over: make it, then verify and
  review it again.

## Known failures

The user picks one:

- **Fix it first** with /sdd-bug-fix, then bring the fix into the story's
  branch and run the baseline again.
- **Record it as known**: keep every failure the check printed, and go on.
  Where a commit hook then fails on it, stop and ask the user.

## Iron laws (across every phase)

- **No building without acceptance criteria.** The spec gate is real.
- **The spec is not rewritten per story.** Only the status line changes, and
  the story's evidence in `plan.json` once it is `Done`. The one exception is
  a requirement the user reverses during the story: ask, then update the spec,
  and `plan.json` where a dependency changes, as /sdd-plan's clarify step
  would, and run `check` until it passes. A reversal that changes how every
  later story is built also goes to `ADR.md`.
- **No silent overwrite** of a file the user did not ask to change.
