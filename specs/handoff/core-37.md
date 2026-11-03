# CORE Story 37 — handoff

**Updated**: 2026-11-03

## Done

- The baseline: passed on 2026-11-02, typecheck clean, 737 tests pass, 0 fail.
- The spec gate: passed on 2026-11-02.
- Scenarios 1 to 6 built and tested; install and remove run by hand in a folder with no git.
- Ten reviews run. The tenth failed on scope, settled by widening scenario 5 to injecting as the user's answer on CORE-FR-044 allows, and on a fault wrapped twice and a name, both fixed and not reviewed again.
- A `.cw-checkout` or `.cw-previous` folder left by a run killed mid-swap would be read as a vendor; left as it is, a `nit` Claude chose to keep.
- Tests: pass with commit signing off, as this machine's 1Password signing agent refuses every commit, also outside this repository.

## Remaining

- Nothing: accepted by the user on 2026-11-03.

## Decisions

- The user chose on 2026-11-03 that `CHANGELOG.md` takes the entries of CORE Story 35 and CORE Story 37 at release.
- The user accepted on 2026-11-02: `ForVCS` becomes `ForFetchingSources` (`GitSources`, `InMemorySources`), as ADR-003 says; each fetch lands in a temporary store of its own, removed by `forgetCommit`, never in the repository; a name is removed only where `cw vendor list` lists it.
- The user asked on 2026-11-02 that a folder left empty goes too. A first build widened `delete` to do it; review failed that, since it could take the repository's own folder and changed every caller. So `delete` is as it was, `deleteFolder` and `deleteEmptyFolder` are on `ForWritingFiles`, and `removeVendor` takes the empty folders above the vendor up to `.cw/vendor/` and never past it. CORE-FR-204 and a clarification now say so, as the iron law for a requirement the user reverses allows.
- `--depth=1`, accepted at the gate, is dropped: review showed git refuses it over dumb HTTP, which CORE-FR-049 forbids. Each fetch takes the whole history into its temporary store.
- `delete` before each write in `addVendor` closes a write through a link a source holds (CORE-FR-044), kept as the user chose on 2026-11-03, with CORE-FR-044 cited by scenario 5.
- The user chose on 2026-11-03: a fetch reads the repository's own git config; CORE-FR-205, a clarification and scenario 6 say so.
- `running` and the portal's `json` keep their names, and so does each `held` renamed in earlier rounds: older names used across files, and the user left every `nit` to Claude on 2026-11-03.
- The put-back after a failed swap in `checkoutFolderAt` has no test: nothing reaches it without a seam in the adapter.

## Blockers

- None.
