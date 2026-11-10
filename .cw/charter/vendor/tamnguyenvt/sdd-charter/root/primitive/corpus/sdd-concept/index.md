---
kind: corpus
id: sdd-concept
description: Why specs are split by part with a status per story, why a roadmap sits beside them, why they hold no how, and why every phase stops at a gate.
---

A coding agent's output is made reliable by narrowing it, in three places.

**Narrow the input.** A story with falsifiable scenarios, the FR and SC it
proves, and what is out of scope, is what the agent is held to. One spec per
part of the product, each extended in place and listed in one index, means
there is one answer to "what must this part do now" rather than a pile of
per-feature folders that disagree with each other. A part is its own file so
neither a reader nor an agent loads the whole product to work on one story,
and its ids carry its prefix so a citation says where it lives.

**A roadmap apart from the prose.** A spec grows long; which story waits on
which should not take reading it. `plan.json` holds only the stories and their
dependencies, so `ready` answers what can be built now, and stories that do not
wait on each other can be built side by side.

**The user decides how work lands.** Worktrees or not, parallel or linear,
commits or unstaged changes, merge, squash or pull request: teams differ, and
an agent guessing differs from all of them. /sdd-init asks once, `manifest.md`
keeps the answers, and /sdd-implement and /sdd-finish read them every time.

**Keep the how out.** A plan, a task list or a class name written into the spec
goes stale the day the code moves, and then the spec lies. The how is decided
at the start of each story, accepted by the user at the gate, and lives in the
code. The spec changes only when a requirement does.

**A status on every story.** The spec is also the schedule: the first story
not `Done` is the next one. A status line under the heading — never in it —
keeps every link to the story working while it moves.

**Gates.** Each phase of a story waits for the user's acceptance, and nothing is
claimed done without evidence produced this turn. Speed lost at a gate is less
than the rework of a story built on a misread.

**Ids, not copies.** A requirement restated in two places drifts. Citing by id,
linked by a script and checked when the agent stops, keeps one definition and
makes a dangling one fail loudly.
