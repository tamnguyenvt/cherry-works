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

- `cw vendor init` checks its folder, runs git and writes its template in
  `src/presentation/cli/commands/vendor-init.command.ts`: it is CLI-only work,
  neither the charter's nor runtime's (2026-11-19).
- [VENDOR Story 1](spec-vendor.md#vendor-story-1---set-a-charter-repository-up-in-an-empty-folder-priority-p2) scenario 6: an answer on more than one line cannot be typed
  at a terminal, so no test holds that case; the blank name and the empty
  description are held (2026-11-19).

## Last pass

**Date**: 2026-11-19

**Cross-check story**: [VENDOR Story 5](spec-vendor.md#vendor-story-5---quality-cross-check-of-core-story-72-vendor-story-1-vendor-story-2-vendor-story-3-priority-p3), on task/vendor-5-quality-cross-check (the working tree over 2e36cb0), the thirteenth pass

**Product grade**: **A** — every item passes; the two choices `## Bypassed` lists are not counted.

### Scope and evidence

Read `spec.md`, the four specs, `plan.json`, `manifest.md`, `docs/`, `README.md` and the guides; checked the code and tests of [CORE Story 72](spec-core.md#core-story-72---read-the-charter-grouped-by-kind-in-cw-list-priority-p2) and VENDOR Stories 1, 2 and 3 (`4b677d5`, `421f9fc`, `16bb4a4`, `2e36cb0`) against every item. Thirteen passes, each by sdd-review-agent (claude-opus-5-5), the first two with one reviewer for the code and one for the specs; what each found was repaired in this story before the next, as the assumption on cross-checks from [CORE Story 55](spec-core.md#core-story-55---quality-cross-check-of-sdk-story-8-core-story-53-sdk-story-10-core-story-56-eval-story-9-priority-p3) on says.

| Check | First run | Second run |
|---|---|---|
| `pnpm typecheck` | passed | — |
| `pnpm lint:deps` | no violation (342 modules, 1129 dependencies) | — |
| `pnpm test` (dependency rules, Biome, builds, tests) | 1120 passed; 0 failed; 0 skipped | 1120 passed; 0 failed; 0 skipped |
| `node --test .cw/out/script/sdd-specs/specs.test.mjs` | 70 passed; 0 failed | — |
| `node .cw/out/script/sdd-specs/specs.mjs check` | passed | — |

### Results for each checklist item

| Item | Result | Violations |
|---|---|---|
| Every scenario of a `Done` story is held by a test or by its evidence | **pass** | |
| Every test and static check passes twice, none skipped | **pass** | |
| The code of each `Done` story does what its FR say | **pass** | |
| No code beyond the FR, nothing out of scope built | **pass** | |
| The code keeps the guides that apply to it | **pass** | |
| Consistent | **pass** | |
| Complete | **pass** | |
| No conflict | **pass** | |
| Roadmap | **pass** | `check` passes; [VENDOR Story 5](spec-vendor.md#vendor-story-5---quality-cross-check-of-core-story-72-vendor-story-1-vendor-story-2-vendor-story-3-priority-p3) `In Progress` |
| Format | **pass** | |

### Violations and proposed repairs

None left. Repaired in this story, by pass:

- Pass 1: the contract test raced a probe file another test puts in `src/` (`scripts/bundle-contract.ts` skips `.probe.` files); scenarios no test held got tests ([VENDOR Story 1](spec-vendor.md#vendor-story-1---set-a-charter-repository-up-in-an-empty-folder-priority-p2) scenario 6's blank name, Story 2 scenario 6's tag push, Story 3 scenario 1 for both agents, 29, 30); `InstallCharterService` moved to the domain as `CharterInstallService`; CORE, EVAL and VENDOR specs, `spec.md`, `plan.json`'s order and the docs brought to the charter root (`.cw/charter/<charter>/`, `cw-vendor.json`, `--as`). `cw vendor inject --as` written into [VENDOR-FR-022](spec-vendor.md#vendor-fr-022) (the user).
- Pass 2: the rest of the specs, docs and README brought to the charter root; [VENDOR Story 1](spec-vendor.md#vendor-story-1---set-a-charter-repository-up-in-an-empty-folder-priority-p2) no longer names `/vendor-release`; `cw init` makes no charter ([CORE-FR-057](spec-core.md#core-fr-057)).
- Pass 3: a source address needs its repository folder alone ([CORE-FR-049](spec-core.md#core-fr-049), the user); [CORE-FR-043](spec-core.md#core-fr-043) cited; [CORE-FR-180](spec-core.md#core-fr-180); old-layout paths; terminal tests no longer skipped without `python3`.
- Pass 4: the old-layout fault names the vendor folder held, `.cw/vendor/` tested; the portal's vendor dialog lists no name (the user).
- Passes 5 to 13: the specs say one thing in one term — "the address git fetches, as typed" for a source; "installed charter" for a charter installed from a vendor source (the user), "vendor" kept for the commands, the vendor layer, the vendor source, `cw-vendor.json`, the old folders and the engine's "no vendor"; "installing a charter or bringing an installed charter up to date" for what needs the network; [CORE-FR-227](spec-core.md#core-fr-227) and [CORE-SC-065](spec-core.md#core-sc-065) except the installed charters deleted; the edge case of a source under `charters/` answered by [CORE-FR-042](spec-core.md#core-fr-042); [VENDOR-FR-020](spec-vendor.md#vendor-fr-020) names the names a charter may not take, tested; the faults the domain raises extend `DomainFault`.

Beside the story, at the user's request: the portal page names `logo.png` as its icon.

Bypassed, as `## Bypassed` above lists, not counted: `cw vendor init` working in the presentation, and [VENDOR Story 1](spec-vendor.md#vendor-story-1---set-a-charter-repository-up-in-an-empty-folder-priority-p2) scenario 6's answer on more than one line, which has no test.

Of note, not a violation: a `.cw/charter/root/` folder made by hand is not refused; the portal's vendor view keeps its heading "Vendor sources" and its empty state "No vendor source installed" (the user asked the portal be left as it is). The contract of the package is as at `2e36cb0`.
