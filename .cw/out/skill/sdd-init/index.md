---
kind: skill
id: sdd-init
description: Set a repository up for spec-driven development — find the specs it already has and offer to refactor them into a spec set, ask how work is carried out and finished, then write .sdd/settings.json, the spec folder and its manifest.md.
rationale: sdd-concept
triggers: ["sdd init", "set up spec driven development", "set up the specs", "integrate sdd into this repo"]
---

Nothing is written until the user has said yes to it. Talk to the user in the
language they write in, in full sentences. Where `.sdd/settings.json` and a
`manifest.md` already exist, show what they say and ask only what the user
wants changed.

## 1. Survey what the repository already has

Look before asking, so every question comes with a recommendation drawn from
the repository itself:

- **Specs** — any of: a `spec.md` or `spec-*.md` anywhere; Spec Kit feature
  folders (`specs/<nnn>-<name>/spec.md` beside `plan.md` and `tasks.md`, a
  `.specify/` folder); `PRD*.md`, `requirements*.md`, `docs/**/spec*`,
  `docs/**/requirements*`, `docs/**/features/*`; user stories, FR/SC lists or
  Given/When/Then scenarios in any markdown file outside `node_modules`,
  vendored or generated folders.
- **How the team works** — the default and long-lived branches, branch names
  in `git branch -a` and recent merges (`git log --merges`), whether history
  is squashed, commit message style and any `Co-Authored-By` lines, a PR
  template or CI config, existing worktrees (`git worktree list`), and any
  rule in the agent's instructions (`CLAUDE.md`, `AGENTS.md`, the charter)
  about staging, committing or merging.

Report it in a few lines: which spec sources were found, how big each is
(stories, requirements, lines), and what the team's habits look like.

## 2. Propose the spec set

When specs were found, propose how they become a spec set, as a table the user
can amend:

| Source | Becomes | Prefix | Stories | Notes |
|---|---|---|---|---|
| `specs/spec.md` | `spec-core.md` | CORE | 27 | ids prefixed; status kept |
| `specs/003-billing/spec.md` | `spec-billing.md` | BILLING | 5 | its `plan.md`, `tasks.md` are how, not what: left where they are |

- **One large spec** → `spec-core.md`, or several specs where it already has
  parts a reader looks for separately (say which headings would split it).
- **Spec Kit features** → one `spec-<feature>.md` each; `plan.md`,
  `tasks.md`, research and contracts are how, and stay out of the spec set.
- **Prose requirements** (a PRD, a requirements doc) → stories, FR and SC
  drafted from them, marked as drafted, for /sdd-plan to clarify.
- **Ids** — `FR-012` → `CORE-FR-012`, `SC-004` → `CORE-SC-004`,
  `User Story 3` / `Story 3` → `CORE Story 3`, in every citation of the set.
  Citations in code, tests and other docs are listed with their count, and
  rewritten only if the user asks.
- **Status** — kept where a story has one; otherwise proposed per story
  (`Done` where the code or history shows it shipped, `Todo` otherwise) for
  the user to confirm.
- **plan.json** — every story, with `dependsOn` drawn from what each story
  says it builds on, from the source's order, and from Spec Kit's task
  dependencies; proposed as a list for the user to correct.

**Gate:** the user accepts the table, amended or not. With nothing found,
say so and propose an empty spec set.

## 3. Ask how work is carried out

One question at a time, each with the recommendation the survey supports, which
the user takes with "yes":

1. **Spec folder** — from the repository's root (where the specs already are,
   else `specs`).
2. **Worktree** — each story in a git worktree of its own (and where), or the
   main worktree on its own branch.
3. **Order** — one story at a time in plan.json order, or every ready story at
   once, each by its own agent in its own worktree (needs worktrees).
4. **Development branch** — the branch work starts from and lands in between
   releases, which a phase branch starts from and a bug fix lands in. Ask it
   by name; where the user names none, it is `develop`.
5. **Branches** — phase and story branch names, or none. A bug fix is always
   on `fix/<slug>`, started from the development branch.
6. **While working** — leave changes unstaged for the user, or commit at each
   step that passes its checks.
7. **Commit message** — the convention, and whether to add a
   `Co-Authored-By` line for the agent.
8. **Finishing** — merge, squash-merge or pull request, into which branch, and
   what happens when a phase is done.

## 4. Write, and check

- `.sdd/settings.json`: `{ "specFolder": "<folder>" }`.
- `<folder>/manifest.md` from [sdd-manifest](../../template/sdd-manifest/index.md), every bracket answered.
- `<folder>/.gitignore` holding `report.html`, which /sdd-report generates.
- The spec set as accepted: `spec.md` from [sdd-spec-index](../../template/sdd-spec-index/index.md), each
  `spec-<key>.md` (from the sources, or [sdd-spec](../../template/sdd-spec/index.md) for an empty set),
  `plan.json`, and `ADR.md` titled `# Architecture Decision Records`.
- A source that was moved is removed only once its content is in the set and
  `check` passes, and only if the user said to; a Spec Kit `plan.md` or
  `tasks.md` is never touched.

Run `link`, then `check` of [sdd-specs](../../script/sdd-specs/index.md), until it passes. End by saying
which file holds what, what `ready` lists, and anything left drafted for
/sdd-plan to clarify.

<!-- Generated by cherry-works. Do not edit; edit the charter and build again. -->
