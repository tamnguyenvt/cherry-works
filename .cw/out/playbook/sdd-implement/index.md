---
kind: playbook
id: sdd-implement
description: Implement a ready story of the spec set — pick it, spec gate, test first, verify, review — the way manifest.md says, and mark it Done.
rationale: sdd-concept
mixins: ["sdd-voice", "sdd-change-rules", "sdd-iron-laws"]
triggers: ["implement task", "implement next task", "implement the next story", "implement story"]
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

The end-to-end walk of one story: `pick → spec → implement → check drift →
verify → review → (learn) → done`. The user is asked twice: at the spec gate,
and once the change has passed its own checks. Implement, check drift, verify
and review run on their own in between, with no pause: the user is never
handed a change to look at that has not been verified and reviewed first.

1. **Pick** —
   - Run /sdd-report first, so the user sees the roadmap the story is picked
     from.
   - With more than one `spec-<key>.md`, ask which spec to work in before
     looking up any story, unless the user named one.
   - Run `ready` of [sdd-specs](../../script/sdd-specs/index.md): the stories whose dependencies are `Done`.
     Take the one the user names, else the first ready one in that spec.
   - With **Order** parallel and several ready, say which could run side by
     side and offer to give each its own agent in its own worktree; each then
     walks this playbook on its own.
   - Open the story's branch, in its own worktree where **Worktree** says so,
     and set its status to `In Progress`. Spawn [sdd-locator](../../agent/sdd-locator/index.md) with the
     story to find the code it will touch, then read the ranges it names.
2. **Spec** — restate the story: its intent, its acceptance criteria (its
   scenarios and the FR and SC it cites), and what is out of scope. List the
   technical decisions it needs — libraries, modules, the shape of new data —
   each with the choice proposed. End with one sentence saying what will be
   done. With **Conversation** short, say that one sentence alone, and ask
   besides only a technical decision that needs the user, or what is unclear.
   Nothing else in the spec folder is edited here. **Gate:** explicit
   acceptance.
3. **Implement** — test first: a failing test per scenario, then the code that
   passes it. Surgical edits only.
4. **Check drift** — for each changed file, list the guides that apply to
   it, then read every changed hunk line by line against each of them; a
   static check passing is not this step. What a hunk touches is the guide's
   to judge, old code on a changed line included: a name, a call or a shape
   the line already had is held to the guide as a new one is. Fix what they
   flag, and say file by file which guides were read.
5. **Verify** — run /sdd-verify. A failure goes back to step 3.
6. **Review** — run /sdd-review. A review that failed goes back to step 3,
   and the steps after it run again.
   **Gate:** only now hand the change to the user — with **Conversation**
   short, in one line: it is implemented and needs the user's review. Each
   change the user asks
   for here goes through check drift, verify and review again before it is
   handed back.
7. **Learn** *(only if something surprising came up)* — run /sdd-learn.
8. **Done** — once the user accepts the change at the gate, set the story's
   status line to `Done`, run `check` of [sdd-specs](../../script/sdd-specs/index.md), and commit or leave
   the change as **While working** says.
   Then run /sdd-finish at once: the user saying the story is done is the ask
   to finish it, with no second acceptance. Say which stories `ready` lists
   once it has merged.

## Iron laws (across every phase)

- **No building without acceptance criteria.** The spec gate is real.
- **The spec is not rewritten per story.** Only the status line changes; a
  technical decision is accepted at the gate and lives in the code. The one
  exception is a requirement the user reverses during the story: ask whether to
  update the spec, then update the story, its FR, the clarification, the edge
  case, the SC and `plan.json` together, as the clarify step of /sdd-plan
  writes an answer, and run `check` until
  it passes. A reversal that changes how every later story is built is also
  written to `ADR.md`.
- **No silent overwrite** of a file the user did not ask to change.

## Iron laws of every change

- **No completion claim without fresh evidence.** Checks run this turn.
- **No commit the manifest does not allow, and none with failing checks.**
  Never `--no-verify`.

<!-- Generated by cherry-works. Do not edit; edit the charter and build again. -->
