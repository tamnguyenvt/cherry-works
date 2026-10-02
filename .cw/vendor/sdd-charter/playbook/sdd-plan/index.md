---
kind: playbook
id: sdd-plan
description: Write a phase's stories, FR and SC into the right spec-<key>.md and plan.json, clarifying what is unclear first; no plan of how, no task list.
triggers: ["plan a feature", "plan a phase", "specify a feature", "clarify requirement", "write the spec"]
rationale: sdd-concept
---

One job: write the stories of a phase into the spec set, in the shape
[[sdd-spec-format]] sets, and put them on the roadmap in `plan.json`. Nothing
else — no plan of how, no task list. How a story is built is decided when it
is implemented (/sdd-implement). A decision that changes how every later story
is built goes to `ADR.md` as well.

Pause for the user's acceptance after each step. Talk to the user in the
language they write in, in full sentences.

1. **Read** — the spec folder from `.sdd/settings.json`; with none, run
   /sdd-init first. Read `spec.md`, `plan.json` and `manifest.md`.
2. **Which spec** — say which spec the phase belongs to, or that it is a new
   part needing a new `spec-<key>.md`, with its key and prefix. With more than
   one candidate, ask. **Gate:** the user agrees.
3. **Restate** — what the phase adds, who it serves, and what it leaves out.
   **Gate:** the user agrees this is the phase.
4. **Clarify** — find what the request and that spec leave unclear, in order
   of impact: scope and out of scope; who the users are; data and its
   lifecycle; the main journeys and their error, empty and loading states;
   security, privacy and performance targets; external services and how they
   fail; edge cases; terms used two ways; vague words ("fast") with no number;
   `[NEEDS CLARIFICATION]` markers. Ask at most five questions whose answer
   changes a story, an FR, a test or the scope — never how it is built — one at
   a time, each as 2–5 options or a short answer, led by your recommendation
   and why; "yes" takes it. Write each answer as soon as it is given: a line
   `- Q: … → A: …` under `## Clarifications`, `### Session <today>`, and the
   change itself in the FR, scenario, edge case, entity, SC or out of scope it
   decides, replacing whatever it makes untrue. Skip this step only when
   nothing material is unclear, and say so.
5. **Draft** — in that spec (a new one from [[sdd-spec]], with its row added
   to `spec.md`): append to `**Input**`, and write stories numbered after its
   last one, each with `**Status**: Todo`, its priority, why, independent test
   and scenarios citing the FR or SC they prove; FR, SC, edge cases, entities,
   assumptions and out of scope as needed. Rewrite an older line the phase makes
   untrue rather than adding one that contradicts it. Split a story too big for
   one reviewable change.
6. **Roadmap** — add each new story to `plan.json` with its title and
   `dependsOn`: the stories, in any spec, that must be `Done` before it can be
   built. Depend only on what the story truly needs, so independent stories can
   run side by side. Show the user which stories become ready together.
7. **Check** — `link`, then `check` of [[sdd-specs]], until it passes; then
   /sdd-analyze, fixing every error it reports.
8. **Review** — show the new stories, FR, SC and dependencies by id.
   **Gate:** explicit acceptance.
9. **Branch** — create the phase branch the way `manifest.md` names it, if it
   names one.

## Iron laws

- What and why only. A file name, class, library or endpoint in a spec is a
  defect.
- Ids are numbered once within a spec, under its prefix, and never reused.
- Every story is in `plan.json`, and no story is written that its scenarios
  cannot prove.
