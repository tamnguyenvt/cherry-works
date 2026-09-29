---
kind: playbook
id: implement-task
description: Instruction for implement new task
triggers: ["implement task XXX or implement next task"]
---

# task

**End-to-end task workflow.** Orchestrates `spec → orient → (implementation) → check-drift → verify → review` and an optional `learn` pass at the end. The canonical phrase to kick off a unit of work.

## Activities

The agent walks through each phase below in order. After each phase, **pause for the user's acceptance** before proceeding to the next. Do not race ahead.

1. Pick the first story in <root>/specs/spec.md whose status is not `Done` (or the story the user names), and read the code it will touch. Start new branch from phase branch.
2. **spec** — restate the story to the user: its intent, its acceptance criteria (its scenarios and the FR/SC it cites), and what is out of scope. Then list the technical decisions the story needs — libraries, modules, the shape of new data — each with the choice proposed. Print one sentence (in vietnamese) saying what will be done. Nothing under specs/ is edited at this step. **Gate:** explicit user acceptance.
3. **implementation** — Implement the story test first, with /superpowers:test-driven-development. Iron law: surgical edits only — touch what the spec requires.
4. **check-drift**. check diff and go through guides to see any violations before running heavy sensors.
5. **verify** — run /skill-verify. Iron law: no completion claims without fresh evidence.
6. **review** — run /skill-review.
7. **learn** *(conditional)* — if something surprising came up during the task, run /skill-learn. Otherwise skip.
8. **mark the story as done**: set its `**Status**:` line in <root>/specs/spec.md to `Done`.

## Iron laws (carry across every phase)

- **No proceeding without explicit acceptance criteria.** The spec gate is real.
- **The spec is not rewritten per story.** Only a story's status line changes; a technical decision is accepted by the user at the spec gate and lives in the code.
- **No completion claims without fresh verification evidence.** Sensors must run this turn.
- **No commits with failing sensors.** Never `--no-verify`.
- **No AI attribution** in commits, PRs, or tracker comments.
- **No silent overwrites** of state files.

## When *not* to use task

- One-off questions or short edits that don't need a spec. Skip directly to the relevant action.
