---
kind: skill
id: release
description: Release cherry-works to npm from develop — propose the version, update the README and the changelog for it, and once the user agrees, commit, push and run pnpm release.
triggers: ["release", "release a version", "publish to npm", "cut a release"]
disable-model-invocation: true
---

Release `cherry-works` the way `scripts/release.ts` and the release section of
`docs/reference.md` say. Read both before the first step. Nothing is
committed, pushed or published before the user agrees at the gate.

1. **Check** — the branch is `develop`. On another branch with a clean
   working tree, switch to `develop`; with changes left, refuse, naming them.
   Refuse a working tree that is not clean. Run `git fetch origin develop`:
   behind `origin/develop`, refuse and ask the user to pull; ahead of it, the
   push at step 4 carries those commits, and the gate names how many.
2. **Version** — read the version in `package.json`, the last tag `v<x.y.z>`,
   `git log v<last>..develop`, the `## Unreleased` section of `CHANGELOG.md`,
   and `git diff v<last> -- contract/` with the library's declarations the
   build leaves in `dist/index.d.ts`. Propose the version by what changed:
   - a declaration of the contract removed or changed, or a change that breaks
     how `cw` is used: major;
   - a new command, option, kind or newly named declaration: minor;
   - otherwise: patch.

   From `0.x`, the only version the script takes is `1.0.0`. Where the user
   named a version, take it, and say so only where it is not what the changes
   call for.
3. **Draft** — write, without committing:
   - `CHANGELOG.md`: the `## Unreleased` heading becomes
     `## <version> — <yyyy-mm-dd>`, and a new empty `## Unreleased` goes above
     it. Add what `git log v<last>..develop` changed for users and the section
     does not say yet, in the section's own voice: what a user can now do, one
     bullet each. For a major, a `**Breaking:**` bullet names each declaration
     of the contract that changed or went away, by its name; the script
     refuses the release otherwise.
   - `README.md`: what the changes made untrue — a command, an option, a
     path, a feature. Never the `Current version: **x.y.z**` line: the script
     writes it, and refuses a README where it does not match `package.json`.
4. **Gate** — show the user the version with its reason, the changelog
   section and the README diff, and the commits the push carries. Say that
   publishing to npm cannot be undone. Ask one question: agree, change the
   version, or change the text. Change and ask again until they agree.
5. **Release** — once they agree:
   - commit `CHANGELOG.md` and `README.md` on `develop` with the message
     `Changelog and README for <version>`, and no `Co-Authored-By` line;
   - `git push origin develop`;
   - `pnpm release <version>`, which runs the tests, checks the contract and
     the tarball, then commits `Release <version>`, tags `v<version>`, pushes
     and publishes.

   Where a commit or the tag fails to sign, say that the signing agent is
   locked, and stop until the user unlocks it. On `Release refused:`, quote
   the check it names, repair what is the changelog's or the README's, and go
   back to the gate; anything else, stop and ask. On
   `Release failed during publication:`, quote what it says to do and do
   nothing more.
6. **Report** — the version published, the tag, and
   `npm view cherry-works@<version> version` as the registry answers it.
