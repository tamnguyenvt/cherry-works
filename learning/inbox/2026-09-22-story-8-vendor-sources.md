# Story 8: what surprised us (2026-09-22)

## Git keeps no record of where a subtree came from

`git subtree` is a shell script in git's `contrib/`, not a part of git itself.
After `add`, the content is plain files. With `--squash`, the only record is two
lines it writes into the squash commit's message:

```
git-subtree-dir: .cw/vendor/acme
git-subtree-split: 524a67adba9460d99e23498d68c086d9e4568577
```

Neither the address nor the version asked for (`v1.0.0`, `main`) is kept
anywhere: no remote in `.git/config`, and `FETCH_HEAD` is overwritten on the
next fetch. `subtree pull` needs the address typed again for this reason.

Three ways to read them back were weighed and dropped:

- trailers written into the install commit with `-m`;
- a `vendors.lock.json` file beside the vendor folder;
- submodules, which do record the URL in `.gitmodules`, but do not commit the
  content, so a fresh clone lacks the vendor layer until someone runs
  `git submodule update --init`. That breaks FR-046.

Tam's decision: record nothing. `installed()` lists the folders under
`.cw/vendor/`, and the vendor view shows each folder and its primitives by kind.
FR-053, FR-122, Story 8 scenarios 4 and 7, data-model §10.2 and plan §7.2 were
rewritten, and T2.024 is marked dropped.

## A driven port carries no domain knowledge

Tam rejected `VendorInstallCommit` on `ForVCS`: version control knows about
commits and subtrees, not vendors. Name what crosses a driven port after what
the adapter deals in.

## Where vendoring logic lives

- The use case (`CharterVendoring`) only delegates. Adding, removing, listing,
  and the two checks before a write (is this a repository, is nothing in hand)
  live in `service/vendorRepo.ts`: `addVendor`, `removeVendor`, `loadVendors`,
  and a private `ensureVCSReady`.
- The folder a source lands in is a domain rule: `vendorSourceOf(source)` in
  `domain/models/vendor/VendorSource.ts`. It returns `VendorSource { source,
  name }` and throws `VendorFault` for a name that is empty, `.` or `..`.
- Tam wants the smallest check that does the job. A bad path only comes from
  someone crafting it on purpose, so the fault is just `Invalid path "<x>".`
  with the fix `Use correct git path.`. It is thrown from one place, with no
  helper method and no long explanation.

## A path parameter can climb out of the folder it names

Hono decodes `%2F` in a path parameter. `DELETE /api/vendors/..%2F..%2Fsrc`
reached `remove("../../src")`, and `git rm -r -- .cw/vendor/../../src` would
delete `src/`. A literal `/vendors/..` never reaches the route, because URL
parsing resolves it first and the request answers 404. So a test for this has
to send the encoded form. `vendorSourceOf` now takes the last segment, so the
name stays inside `.cw/vendor/`.

## Tooling that hides or blocks things

- The rtk hook trims the output of `git log`, `grep` and `curl`. It showed an
  install commit's message as `init`, and a JSON body cut short with `...`. Use
  `rtk proxy <command>` when the exact output matters.
- This machine signs commits through 1Password (`commit.gpgsign=true`, with
  `op-ssh-sign`). Every commit the engine makes, including one made from the
  portal, waits for 1Password to approve it. A portal request that seems to hang
  is waiting on that approval. When a test creates commits, pass
  `-c commit.gpgSign=false` (and `tag.gpgSign=false` when it tags).
- dependency-cruiser refuses the portal page importing `lodash-es`
  (`page-is-browser-code`). It also refuses a component that imports
  `useDialog` from `Dialogs.tsx` while `Dialogs.tsx` imports that component
  (`no-circular`). Put a dialog's content in its own file, as `PrimitiveForm`
  and `AddVendorSource` are.
- TypeScript 6, which the editor runs, deprecates `baseUrl`. `paths` resolves
  from the tsconfig's own folder without it, so the page tsconfig no longer
  sets it.
