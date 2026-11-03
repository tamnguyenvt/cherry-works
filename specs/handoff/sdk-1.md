# SDK Story 1 — handoff

**Updated**: 2026-11-03

## Done

- The baseline: passed on 2026-11-03, typecheck clean, dependency rules clean, 763 tests pass, 0 fail.

- The spec gate: passed on 2026-11-03.
- Scenarios 1 to 5 and the hostless edge case built, tested in `test/keeping-a-repository-at-any-address.test.ts`.
- /sdd-verify on 2026-11-03: typecheck clean, dependency rules clean, 778 tests pass 0 fail; `cw sessions` output identical before and after; `cw build` changed nothing; an in-memory `db://` review read only its own folder; `urn:x` refused with a `DomainFault`; specs check passes.

- First review failed: an absolute `sessionAnalysisFolder` under a `file:` home had no test, and the `file:`-with-no-host rule was written twice, once in `application/dtos.ts`. Now tested both ways (each test fails when it resolves against the home instead of its root), and the rule is `localPathOf` in `domain/path.ts`. Its nits fixed, as `learning/inbox/2026-11-03-nits-are-agents-to-decide.md` says: the no-folder fault says the path does not start at "/"; the test names `sessionsFolderOfA`/`sessionsFolderOfB`; this note brought up to date. Its `q` on UNC paths was answered at the gate: a `file:` address with a host is named by the whole address.

- Second review failed: hosts differing only in `.` and `-` shared a folder, and credentials in an address named the folder and were answered. A non-local address is now named with each character that is not a letter or a digit as `_` and two hex digits, its credentials left out, and the answer leaves them out too; a test for each. Its nit fixed: `messagePattern`.

- Third review failed: a query or fragment on the repository's address still named the folder and was answered. `folderAddressOf` now leaves out user name, password, query and fragment, with a test.

- Fourth review failed: `folderURL`'s faults repeated an address's credentials, and the fix for an address with a query was no folder. Both faults now name `folderAddressOf`, with a test. Its nit on the `sessionsFolderOf` comment fixed. Its nit on a long name passing 255 bytes, first left for later, was raised to a risk by the fifth review. Its two `q`s, on the case of a host and on a Windows home, put to the user.

- Fifth review failed: a long address gave a folder name past 255 bytes. Past `REPO_NAME_LIMIT` (200) the name is cut and ended with an FNV-1a hash of the address, with a test that fails without the cut or without the hash. Its nit fixed: `folderURL` builds the fix in `fixFolderAddress`, leaving `folderAddress` as it was refused. It also named, outside this story, other faults that repeat a repository address in full (`settingsFileIn` in `settingsRepo`), worth a story before the first publish.

- Sixth review passed, with one nit, fixed as the inbox note says: an address with a host and no path, `db://h`, is told `db://h/` rather than a `file:` example; a test for it.

- Seventh review failed on one name: `address` in `folderAddressOf` is now `folderAddress`. Its nit fixed: `folderURL`'s comment names the refusal of a path not starting at `/`.

- Eighth review failed on one name: the test's `filesHolding` is now `fileReadersHolding`. Its nit fixed: `folderURL`'s comment reflowed.

- Resumed from Claude session `9e39c551-374f-450f-a946-40ebe05cfb60`. Its ninth review failed on two names, now fixed: `askedURL` in `folderURL`, and `longRepoAddressOf` / `teamName` in the long-address test. Its nit was fixed under the inbox note: `folderAddress` is built only in the refusing branches.

- Fresh verification on 2026-11-03: `pnpm typecheck` passed; `pnpm test` passed (778 tests, 0 failures, dependency rules and package build included); specs check and `git diff --check` passed. Manual `db:` review read only its own folder and `urn:x` raised `DomainFault`, with no warnings or errors. `cw sessions` succeeded; `cw build` wrote 0 files and left every `.cw` file byte-identical. Build printed four existing Codex capability-whitelist warnings; these describe host enforcement, outside SDK Story 1.

- Independent review on 2026-11-03 passed: all applicable guides read; scenarios 1–5 and SDK-FR-010, SDK-FR-011, SDK-FR-012 covered; no findings on scope, guides or security. The first review-agent launch lacked filesystem tools and performed no review; the replacement reviewer read the diff independently and passed it.

## Remaining

- None. User approved the hand-over on 2026-11-03; story marked Done, evidence recorded, landing checks passed, and work finished into `008-sdk` under the manifest.

## Decisions

- Accepted by the user at the gate on 2026-11-03: `folderURL` also refuses an address with no hierarchical path; every use case's constructor passes its repository (and `SessionReviewing` its home) through it; the default sessions folder of a `file:` address with no host is named from its path as before, and of any other from the whole address; an absolute `sessionAnalysisFolder` resolves against the root of the home; the review answer names a `file:` folder by its path as before and any other by its address.
- After the second review, the name of a non-local address changed from the gate's example `memory---a` to `memory_3a_2f_2fa`, so that no two addresses collide; put to the user at the hand-over.

## Blockers

- None.
