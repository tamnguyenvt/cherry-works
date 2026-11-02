# CORE Story 35 — handoff

**Updated**: 2026-11-02

## Done

- The baseline: passed on 2026-11-02, typecheck clean, 732 tests pass, 0 fail.
- The spec gate: passed on 2026-11-02.
- Scenarios 1 to 4 built and tested: 740 tests pass, 0 fail; checked by hand in a folder with no git.
- Eight reviews run. The last one failed on two names only: `held` in `test/evaluating-the-charter.test.ts` and `results` in `test/starting-the-portal.test.ts`, names of existing test helpers. No behaviour, scope or security finding. Tests: 740 pass, 0 fail; `lint:deps` clean.

## Remaining

- Nothing: accepted by the user on 2026-11-02.

## Decisions

- `vcs` stays in `CharterAuthoring`, since `doctor` asks `changedUnder` until CORE Story 36.
- Evaluating does not ask `isInstalled`: the user chose on 2026-11-02 to keep the refusal from `addWorktree`, so a run with no case answers that there is none outside git too. CORE-FR-206, scenario 4 and a clarification say so.
- `addWorktree` and `removeWorktree` moved to `ForKeepingWorktrees`, on `GitWorktrees`, for CORE-FR-206; the rest of `ForVCS` is left to CORE Story 36 and CORE Story 37.
- The user chose on 2026-11-02 to fix the four `nit`s, with `loadEvalRoot` as the one read of what a case is, and the renames reverted.
- The user accepted on 2026-11-02 keeping `held` and `printed` on the new test lines.
- The user accepted on 2026-11-02 that a repository with only a non-JSON file left under `.cw/eval/` answers that it holds no case, and that the last review's two names stay.

## Blockers

- None.
