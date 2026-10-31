---
kind: template
id: sdd-manifest
description: The skeleton of manifest.md — how work is carried out and finished in a repository, as /sdd-init asked the user.
---

# Manifest

How work on a story or a bug fix is carried out and finished in this
repository. Read by /sdd-implement, /sdd-bug-fix and /sdd-finish; changed only
by asking the user.

## Specs

- **Folder**: `[spec folder, from the repository's root]`
- **Quality cross-check**: every [5, unless the user names another number] stories

## Working

- **Worktree**: [main — every story in the main worktree, on its own branch | per story — each story in a git worktree of its own, under `[path]`]
- **Order**: [linear — one story at a time, in plan.json order | parallel — every ready story at once, each by its own agent in its own worktree]
- **Development branch**: `[the branch work starts from and lands in between releases; develop unless the user names another]`
- **Branches**: [phase branch `<nnn>-<slug>`; story branch `task/<prefix>-<n>-<slug>` started from it | story branch from `[base]` | none]; a bug fix on `fix/<slug>` from the development branch

## Talking

- **Conversation**: [short — a gate says only what it asks; what changed is never listed, the user reads the code and asks | detailed — each step reports what it did and what it showed]
- **Review**: [strict — every `nit` and `q` the review leaves is put to the user at the hand-over | quick — a `nit` is not acted on but written to the handoff note; a `q` whose answer changes no FR, scenario or out of scope and touches only the changed files is settled and written there; neither is said in the chat, and every other `q` is asked]

## Committing

- **While working**: [unstaged — leave every change unstaged until the story or fix is finished; the user stages what they have read, and /sdd-finish commits | linear — commit at each step that passes its checks]
- **Message**: [the convention: `CORE Story 4: <title>`, Conventional Commits, …]
- **Handoff notes**: [committed — a story's handoff note is committed with its work, so another machine resumes from it; with **While working** unstaged, it waits in the working tree with the rest of the work | ignored — `handoff/` is in the spec folder's `.gitignore`; a note stays on the machine that wrote it]
- **Co-Authored-By**: [yes — end each commit with the agent's Co-Authored-By line | no — no AI attribution]

## Finishing

- **Story**: [merge into `[target]` | squash-merge into `[target]` | open a pull request into `[target]` | leave the branch]
- **Phase**: [fast-forward `[branch]` to it, then `[branch]` | open a pull request | none]
- **Pull request**: [none | title and body convention]
- **Branch after finishing**: [local and remote — delete the landed story or fix branch locally and on the remote | local — delete only the local branch | keep — delete neither]
