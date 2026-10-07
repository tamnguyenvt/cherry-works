# Manifest

How work on a story is carried out and finished in this repository. Read by
/sdd-implement and /sdd-finish; changed only by asking the user.

## Specs

- **Folder**: `specs`

## Working

- **Worktree**: main — every story in the main worktree, on its own branch.
- **Order**: linear — one story at a time, in plan.json order.
- **Development branch**: `develop`.
- **Branches**: phase branch `<nnn>-<slug>` (`007-sdd-and-host-names`); story branch `task/<prefix>-<n>-<slug>` started from it (`task/core-15-publish-a-release`); a bug fix on `fix/<slug>` from the development branch.

## Talking

- **Conversation**: short — a gate says only what it asks; what changed is never listed, the user reads the code and asks.

## Committing

- **While working**: leave every change unstaged; the user stages what they have read and commits. Never `git add` or `git commit` unless the user asks in that turn.
- **Message**: the story's id and title, `CORE Story 15: Publish a release that users can trust`, with a short body when the why is not obvious.
- **Co-Authored-By**: no — no AI attribution in commits, pull requests or comments.

## Finishing

- **Story**: squash-merge the story branch into its phase branch; the message is the story's id and title.
- **Phase**: fast-forward `develop` to the phase branch.
- **Pull request**: none.
