# SDK Story 3 — handoff

**Updated**: 2026-11-03

## Done

- Picked SDK Story 3 on its story branch from `008-sdk`.
- Baseline passed on 2026-11-03: `pnpm typecheck`; `pnpm test` (dependency rules, unified build, 786 tests passed, 0 failed). No known failures.

- Spec gate accepted on 2026-11-03.

- Added installed-consumer tests for all five scenarios and partial-write failure. Initial scenario 4 failed because `a #%.bin` was resolved as URL syntax; scenario 5 then reproduced the same problem deleting an asset. File path segments are now escaped at projection and deletion boundaries. Setup/add/validation needed no implementation changes; their new tests passed against existing behaviour.

- Verification on 2026-11-03: `pnpm typecheck` passed; `pnpm test` passed (792 tests, 0 failures, dependency rules and unified build included); specs check and `git diff --check` passed. A separate packed-package manual consumer set up, added a guide, validated with 0 errors, refused an invalid guide without writes and built its compiled body in memory: 0 forbidden filesystem/process calls, 31 files, stderr empty. Memory output matched `cw build` on disk byte for byte, including an escaped binary asset.

- Independent review passed on 2026-11-03 with no findings: all five scenarios and cited requirements covered. Guides read: architecture-map, hexagonal-architecture, hexagonal-naming for source; sdd-spec-format for the spec; name-like-the-files-before-it, no-arbitrary-function-split, no-single-word-naming, sdd-learnings-go-to-the-inbox and sdd-voice for all changed files.

- User approved the hand-over on 2026-11-03. Landing clean-state scan flagged the consumer snapshot `console.log`; changed it to `process.stdout.write` with the same JSON and newline. An overlapping build invalidated an intermediate suite (13 portal tests: "The portal's page is not built."); the subsequent isolated suite passed all 792 tests. Fresh typecheck, manual built-package memory flow (0 forbidden calls, stderr empty), clean-state scan and diff whitespace check passed.

- Independent re-review after the snapshot output correction passed with no findings on 2026-11-03; all five scenarios and cited requirements remain covered. Story marked Done and evidence recorded after user approval.

## Remaining

- None. User approved on 2026-11-03; story marked Done, evidence recorded, independent re-review and landing checks passed for finishing into `008-sdk` under the manifest.

## Decisions

- User selected SDK Story 3 on 2026-11-03.
- Accepted gate: installed-package consumer with its own map-backed reader/writer, YAML parser and token counter; forbid filesystem/process calls during engine operations; exercise setup, authoring, validation, build and remaining authoring methods; compare compiled bytes with cw on disk. Cover the documented file contract and address/write-failure edge cases; no constructor split, new storage port or release work.

## Blockers

- None.
