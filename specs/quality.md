# Quality

The checklist /sdd-quality checks against, item by item. Add, change or drop
items as this project needs; each must be one a pass can find passing or
failing.

## Code against the stories

- Every scenario of a `Done` story is held by a test that would fail without
  it, or by the run its evidence in `plan.json` names.
- Every test and static check the project defines passes, twice in a row,
  none skipped.
- The code of each `Done` story does what its FR say, and no later change
  bent an FR it cites.
- No code does what no FR asks for, and nothing an out of scope excludes is
  built.
- The code keeps the guides that apply to it.

## Specs against each other

- **Consistent** — a term means one thing in every spec, and one thing has
  one term.
- **Complete** — every FR is cited by a story, every scenario cites an FR or
  SC and can be tested, every edge case is answered by an FR, every SC has a
  number to measure.
- **No conflict** — no two FR, stories, clarifications, assumptions or out
  of scope lines contradict each other, in one spec or across specs.
- **Roadmap** — every dependency in `plan.json` is borne out by the stories,
  and `check` passes.
- **Format** — every spec keeps the spec format of the charter's
  `sdd-spec-format` guide.

<!-- Add the checks this project needs, under either heading or one of your
own: one line each, something a pass can find passing or failing — "Every
endpoint checks the caller's role", "No query is built by string
concatenation". The quality pass writes its report in the last-pass section
below this comment; leave that section to it. -->

## Bypassed

What the user chose on purpose: a pass checks it against this list and counts
none of it as a warning or a violation.

## Last pass

**Date**: 2026-11-20

**Cross-check story**: on request, on 011-vendor-development over `222d10d` with its working tree, after [VENDOR Story 6](spec-vendor.md#vendor-story-6---pull-a-charter-from-its-source-with-cw-charter-pull-priority-p1), [VENDOR Story 7](spec-vendor.md#vendor-story-7---see-create-update-and-remove-charters-with-cw-charter-priority-p1) and [VENDOR Story 8](spec-vendor.md#vendor-story-8---release-charters-from-any-repository-with-charter-release-priority-p2) landed; the passes of 2026-11-19 and 2026-11-20 run until one found nothing

**Product grade**: **A** — every item passes. The last code pass (the forty-seventh) and the last spec pass (the fifty-fifth) found nothing, and only the specs, `CHANGELOG.md` and `docs/` changed between them. Each pass since the first, of 2026-11-19, which graded D, repaired what the one before found.

### Scope and evidence

Read `spec.md`, the four specs, `plan.json`, `manifest.md`, `README.md`, `CHANGELOG.md`, `docs/`, `contract/` and the guides; checked the whole codebase against every story. Each pass by sdd-review-agent reviewers (claude-opus-5-5), one for the code against the stories, one for the specs against each other and against the docs; each finding was read again at its line before it was counted or repaired.

| Check | First run | Second run |
|---|---|---|
| `pnpm typecheck` | passed | — |
| `pnpm test` (dependency rules, Biome, builds, tests) | 1151 passed; 0 failed; 0 skipped | 1151 passed; 0 failed; 0 skipped |
| `node --test .cw/out/script/sdd-specs/specs.test.mjs` | 70 passed; 0 failed | — |
| `node .cw/out/script/sdd-specs/specs.mjs check` | passed | — |

### Results for each checklist item, last pass

| Item | Result |
|---|---|
| Every scenario of a `Done` story is held by a test or by its evidence | **pass** |
| Every test and static check passes twice, none skipped | **pass** |
| The code of each `Done` story does what its FR say | **pass** |
| No code beyond the FR, nothing out of scope built | **pass** |
| The code keeps the guides that apply to it | **pass** |
| Consistent | **pass** |
| Complete | **pass** |
| No conflict | **pass** |
| Roadmap | **pass** — `check` passes, no story `ready` |
| Format | **pass** |

### What the passes repaired, by the user's choices

- The specs and the roadmap brought to what VENDOR Stories 6, 7 and 8 made true: old clarifications annotated "(now …)", one term for each thing (the charter source, the charters' changelog, a charter release, a release of `cw`), VENDOR Stories 1, 2 and 3 marked as reworded by the later stories, and `plan.json` in build order with each dependency borne out.
- `root` a name refused only where a charter is made or pulled; a charter `.cw/charter/root/` made by hand read as any.
- `/charter-release` lists the charters the repository authored alone, naming each on the line installing them all, and is refused where any charter held does not build; it puts its section at the end of a README holding none, refuses one marker alone and the markers of `/vendor-release`, and keeps the charters' changelog in `.cw/CHANGELOG.md`, linked from the README, a `CHANGELOG.md` at the root never read.
- A release of `cw` publishes under npm's tag `next` as the current version; `pnpm release <version> --stable` marks a published version stable, what `npm install -g cherry-works` installs; the README names both versions and how to install each ([CORE-FR-247](spec-core.md#core-fr-247)).
- `CHANGELOG.md` names the move into named charters, `--charter` on `cw add`, `cw test` and `cw eval`, the two install channels and the charters' changelog; the README gains a Discord line, a `/cw-author` paragraph and `## Contributors`.
- The passes of 2026-11-20 after the ninth, run without asking: `/charter-release` writes the address `origin` names into the README, a credential left out, refuses before it writes anything of its own — a build changing what is committed, a changelog not opening with `# Changelog`, a version or date `draft --version --date` refuses — and writes the README only after the gate; `cw list --charter` gives the command line what the portal lists; the library exports every type its ports take or name, a test holding it; the changelog names every change to the library's contract since 1.3.0; and the specs, `plan.json`, the test labels, the port comments and `docs/` were brought to one another and to the code.

The two entries `## Bypassed` held were stale — `vendor-init.command.ts` gone, [VENDOR Story 1](spec-vendor.md#vendor-story-1---set-a-repository-releasing-charters-up-in-an-empty-folder-priority-p2) holding two scenarios — and were dropped at the user's word.

Of note, not a violation: the built `.cw/out` guides and the git-ignored `src/AGENTS.md` still name the vendor models, as no build runs here without `.cw/settings.json`.
