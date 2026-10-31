# Manifest

How work on a story is carried out and finished in this repository. Read by
/sdd-implement and /sdd-finish; changed only by asking the user.

## Specs

- **Folder**: `specs`
- **Quality cross-check**: every 5 stories

## Working

- **Worktree**: main — every story in the main worktree, on its own branch.
- **Order**: linear — one story at a time, in plan.json order.
- **Development branch**: `develop`.
- **Branches**: phase branch `<nnn>-<slug>` (`007-sdd-and-host-names`); story branch `task/<prefix>-<n>-<slug>` started from it (`task/core-15-publish-a-release`); a bug fix on `fix/<slug>` from the development branch.

## Talking

- **Conversation**: short — a gate says only what it asks; what changed is never listed, the user reads the code and asks.
- **Review**: strict — every `nit` and `q` the review leaves is put to the user at the hand-over.

## Committing

- **While working**: unstaged — leave every change unstaged until the story or fix is finished; the user stages what they have read, and /sdd-finish commits. Never `git add` or `git commit` unless the user asks in that turn.
- **Message**: the story's id and title, `CORE Story 15: Publish a release that users can trust`, with a short body when the why is not obvious.
- **Handoff notes**: committed — a story's handoff note is committed with its work, so another machine resumes from it; with **While working** unstaged, it waits in the working tree with the rest of the work.
- **Co-Authored-By**: no — no AI attribution in commits, pull requests or comments.

## Finishing

- **Story**: squash-merge the story branch into its phase branch; the message is the story's id and title.
- **Phase**: fast-forward `develop` to the phase branch.
- **Pull request**: none.
- **Branch after finishing**: local and remote — delete the landed story or fix branch locally and on the remote.
