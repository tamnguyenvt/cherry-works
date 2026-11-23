# Manifest

How work on a story is carried out and finished in this repository. Read by
/sdd-implement and /sdd-finish; changed only by asking the user.

## Specs

- **Document language**: English
- **Folder**: `specs`
- **Quality cross-check**: every 5 stories
- **Decision records**: `docs/ADR.md`
- **Architecture notes**: `docs/architecture-notes.md`
- **Feature list**: `docs/features.md`
- **Architecture overview**: `docs/architecture.md`

## Working

- **Worktree**: main — every story in the main worktree, on its own branch.
- **Order**: linear — one story at a time, in plan.json order.
- **Development branch**: `develop`.
- **Ceiling**: 1000000 changed lines per change, generated files and comment lines not counted
- **Branches**: phase branch `<nnn>-<slug>` (`007-sdd-and-host-names`); story branch `task/<prefix>-<n>-<slug>` started from it (`task/core-15-publish-a-release`); a bug fix on `fix/<slug>` from the development branch.

## Talking

- **Conversation**: short — a gate says only what it asks; what changed is never listed, the user reads the code and asks.
- **Review**: auto, until no nit — each `nit` is fixed wherever its fix reaches and written to the handoff note with its fix, the change verified and reviewed again, round after round, with no cap on the rounds, until a review leaves no `nit`; a `q` is handled as in quick — a `q` whose answer changes no FR, scenario or out of scope and touches only the changed files is settled and written to the handoff note; every other `q` is asked.

## Committing

- **While working**: unstaged — leave every change unstaged until the story or fix is finished; the user stages what they have read, and /sdd-finish commits. Never `git add` or `git commit` unless the user asks in that turn.
- **Message**: the story's id and title, `CORE Story 15: Publish a release that users can trust`, with a short body when the why is not obvious.
- **Handoff notes**: ignored — a story's handoff note stays on the machine that wrote it, under `specs/handoff/`, which git ignores; it is never committed.
- **Co-Authored-By**: no — no AI attribution in commits, pull requests or comments.

## Finishing

- **Story**: squash-merge the story branch into its phase branch; the message is the story's id and title.
- **Phase**: fast-forward `develop` to the phase branch.
- **Pull request**: none.
- **Branch after finishing**: local and remote — delete the landed story or fix branch locally and on the remote.
