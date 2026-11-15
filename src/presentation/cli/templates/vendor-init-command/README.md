# {{name}}

{{description}}

<!-- vendor-release-action: charters -->
## Install

No charter is released yet.
<!-- /vendor-release-action: charters -->

## Authoring

Each charter lives in `charters/<name>/`, set up there with `cw init`,
authored with `/cw-author` and built there with `cw build`. The `.cw/` at the
root is this repository's own charter, for its authors, and is never
installed: it holds `/vendor-release`. What `cw build` writes, `.cw/out/` and
each agent's files, is never committed: after cloning, run `cw init` at the
root, choosing your agent, and `cw build` in each charter you author.

## Releasing

Ask your agent `/vendor-release` on the default branch of `origin`, at the
repository's root. It checks that branch, builds each charter, lists how to
install each one and its skills in the section above, proposes the version
and the changelog entry, and once you confirm, commits, pushes and tags
`v<version>`.
