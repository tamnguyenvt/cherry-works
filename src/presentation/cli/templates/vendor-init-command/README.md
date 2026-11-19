# {{name}}

{{description}}

<!-- vendor-release-action: charters -->
## Install

No charter is released yet.
<!-- /vendor-release-action: charters -->

## Authoring

Each charter lives in `.cw/charter/<charter>/`, written with
`cw add <kind> <id> --charter=<charter>` or `/cw-author`, its test cases under
`<charter>/test/` and its eval cases under `<charter>/eval/`. What `cw build` writes,
`.cw/out/` and each agent's files, is never committed: after cloning, run
`cw init` at the root, choosing your agent, then `cw build`.

## Releasing

Ask your agent `/vendor-release` on the default branch of `origin`, at the
repository's root. It checks that branch, builds the charters, lists how to
install each one and its skills in the section above, proposes the version
and the changelog entry, and once you confirm, commits, pushes and tags
`v<version>`.
