---
kind: script
id: vendor-release-action
description: For releasing this repository's charters the same way every time — the steps of /vendor-release that must not depend on the agent's judgement.
executionPath: ./vendor-release-action.mjs
---

The steps of `/vendor-release` that a script takes. Run it from the repository's
root, with Node 20 or later and nothing else. Which version, and what the
changelog says, are never its to decide.

```bash
node .cw/out/script/vendor-release-action/vendor-release-action.mjs check [--branch <name>]
node .cw/out/script/vendor-release-action/vendor-release-action.mjs readme
node .cw/out/script/vendor-release-action/vendor-release-action.mjs draft
node .cw/out/script/vendor-release-action/vendor-release-action.mjs publish <version> <entry-file> [--date yyyy-mm-dd] [--branch <name>]
```

The release branch is `origin`'s default branch, the one its `HEAD` names,
whatever it is called: `main`, `develop` or another. With no `origin`, or an
`origin` holding no commit yet, it is never guessed: **check** and **publish**
stop, naming the branch stood on, until the branch the user confirms is passed
as `--branch <name>`. A `--branch` other than `origin`'s default branch is
refused.

- **check** stops, writing nothing, unless the branch stood on is the release
  branch, the working tree is clean, the branch has an `origin` and is neither
  behind nor diverged from it there; then it runs `cw build` in each charter under
  `charters/`, never the root, and stops naming the first that does not
  build.
- **readme** rewrites the section of `README.md` between
  `<!-- vendor-release-action: charters -->` and `<!-- /vendor-release-action: charters -->`
  from the charters as built: the `cw vendor add <owner>/<repository>` that
  installs every charter, the owner and repository read off `origin`, then for
  each charter under `charters/`, the `--charter <name>` that installs it alone
  and a table of its skills with their descriptions. A skill is listed when its source is under the charter's
  `.cw/charter/`, authored or vendored; cw's own skills, such as `cw-author`,
  are left out. The rest of `README.md` is left as it is.
- **draft** reads the last release, the highest `v<version>` tag, and stops
  unless the top `## <version> — <date>` heading of `CHANGELOG.md` names
  it. It prints `0.1.0` with no tag, else the patch and the minor bump after
  it, what was removed or renamed under `charters/`, today's date and every
  commit since; with none, it says there is nothing to release.
- **publish** writes the entry the file holds as `## <version> — <date>`
  under `# Changelog`, commits it with what the builds and `readme` changed as
  `release v<version>`, pushes the release branch, makes the annotated tag `v<version>`
  and pushes it, in that order. It stops, writing nothing, where anything
  outside `charters/`, `README.md` and `CHANGELOG.md` changed since check. It
  stops at the first step that fails, quoting its decisive line, saying which
  steps ran and the command that finishes the rest. It never force-pushes, and
  never moves or deletes a tag.
