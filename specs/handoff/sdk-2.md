# SDK Story 2 — handoff

**Updated**: 2026-11-03

## Done

- Picked SDK Story 2 on its story branch from `008-sdk`.
- Baseline passed on 2026-11-03: `pnpm typecheck`; `pnpm test` (dependency rules, CLI/portal build, 778 tests passed, 0 failed); specs check passed. No known failures.
- Spec gate accepted on 2026-11-03. Eight consumer tests failed before implementation because the package did not exist.
- Built the explicit package entry, isolated ESM/declaration build and generated manifest in `packages/engine/dist`; embedded builtin text, copied license and package README; included the engine build in the root `build` command.
- Package-consumer tests cover all eight scenarios, strict NodeNext type imports and binary port values, exact runtime exports and blocked internal paths, version agreement, fault identity, validation by file, embedded builtin script bytes with filesystem calls blocked, and unchanged CLI packaging.
- The user-approved roadmap reorder is carried in the working tree: CORE Story 39 follows SDK Story 4.

- Verification on 2026-11-03: `pnpm typecheck` passed; `pnpm test` passed (786 tests, 0 failures; dependency rules, CLI/portal and ESM/declaration builds included); specs check, clean-state scan and `git diff --check` passed. A tarball installed into a separate temporary consumer reported version 0.9.0, read only `db://charters/team/.cw/out/sensors.json`, returned an empty successful sensor outcome, listed primitive kinds, refused `urn:x` as DomainFault and blocked an internal import; no warnings or errors logged.

- First independent review found two naming-guide violations only: `root` is now `repositoryUrl` and the text-or-bytes variable `bytes` is now `fileContents`. Coverage, scope and security passed. Reverification after the renames passed: typecheck, full suite (786 pass, 0 fail), specs, diff whitespace and clean-state checks.

- Second independent review passed with one nit: the URL rename had also changed “composition root” in a test description. Restored that phrase under the inbox note on settling nits; typecheck and the full suite passed again (786 tests, 0 failures).

- Final independent review on 2026-11-03 passed with no findings. Guides read: name-like-the-files-before-it, no-arbitrary-function-split, no-single-word-naming, sdd-learnings-go-to-the-inbox and sdd-voice for every changed file; sdd-spec-format for the spec and roadmap. All eight acceptance scenarios and cited requirements are supported by tests and fresh verification evidence.

- Unified-build verification on 2026-11-03: removed the generated engine output and ran only `pnpm build`; both CLI/portal and engine JS/declarations/manifest were produced. CLI and engine each reported 0.9.0, without warnings or errors. `pnpm typecheck` and `pnpm test` passed again (786 tests, 0 failures), with one unified build in the test pipeline. Specs check, clean-state scan and `git diff --check` passed.

- Independent review after the unified-build correction passed with no findings. Both packages are produced by one build and all eight acceptance scenarios remain covered.

- Landing verification on 2026-11-03 passed afresh: typecheck, 786 tests with 0 failures, unified build, manual memory: sensor outcome and invalid-address refusal, both package versions 0.9.0, specs and clean-state checks.

## Remaining

- None. User approved the unified-build correction on 2026-11-03. Story marked Done, evidence recorded and work finished into `008-sdk` under the manifest.

## Decisions

- Accepted at the spec gate: separate `packages/engine` ESM package with bundled declarations and an explicit root export list for use cases, ports, crossing types/DTOs and public faults; no internal subpath exports.
- Accepted: external runtime dependencies only `picomatch` and `zod`; builtin assets embedded at build time; version derived from root package version; CLI package contents unchanged.
- Accepted: test through packed tarball installed into an empty consumer and typecheck imports; keep publication and release orchestration for SDK Story 4.

- User correction on 2026-11-03: `pnpm build` builds both cw and engine; no separate `build:engine` command. `pnpm test` calls this unified build once.

## Blockers

- None.
