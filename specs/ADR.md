# Architecture Decision Records

## ADR-001: A primitive is named by its id alone

**Date**: 2026-10-02 · **Status**: Accepted · **Story**: [CORE Story 27](spec-core.md#core-story-27---name-every-primitive-by-its-id-alone-priority-p1) ([CORE-FR-015](spec-core.md#core-fr-015), [CORE-FR-171](spec-core.md#core-fr-171), [CORE-FR-172](spec-core.md#core-fr-172))

### Decision

The identity `kind:id` is removed. An id is unique across the whole charter,
whatever its kind, and it is the only name a primitive has.

| Where the name is written | How |
|---|---|
| A header (`rationale`, `mixins`), a test case, a command | the bare id: `rationale: why-small`, `cw explain no-any` |
| A body, a sensor's `run`, an agent's `tools` | `[[<id>]]`: `run [[check]]`, `"[[linear]]:list_issues"` |

Every `[[<id>]]` in a body, of any kind, is built into a link to that
primitive's compiled file. The catalogue lists `kind` and `id`, nothing else.

### Why

- **The host file is named by the id.** A skill is invoked as `/sdd-plan`,
  not `/skill-sdd-plan`, so `guide:x` and `skill:x` would both want one
  name. One id per primitive removes the clash instead of working around it.
- **The kind was noise.** The author already chose the id; writing
  `corpus:` or `script:` in front of it added nothing the primitive does not
  already say about itself.
- **One way to name, one way to link.** Before, only `mcp:`, `script:` and
  `template:` were found in a body, each by its own pattern. Now `[[<id>]]`
  finds any primitive, and only text written that way is a reference, so prose
  is never taken for one.

### Consequences

- **Breaking for every charter.** `rationale: corpus:x` becomes
  `rationale: x`; `script:x`, `mcp:x` and `template:x` in a body become `[[x]]`;
  `activate: "guide:x"` in a test becomes `activate: "x"`. The earlier way is
  not read, and not reported either.
- **Ids that two kinds shared must split.** A guide and the corpus explaining
  it can no longer share an id; the corpus becomes `why-<id>`.
- **Quote a header value that starts with `[[`.** YAML reads `run: [[check]]`
  as a list inside a list: write `run: "[[check]]"`.
- **A field that takes one kind reads an id of another as missing.**
  `rationale: some-guide` is a rationale no corpus answers to; no separate
  "wrong kind" error exists.
- The served name of an mcp's tools is hashed from its id rather than from
  `mcp:<id>`, so it changes once.

## ADR-002: The engine's public contract is what its package exports

**Date**: 2026-11-02 · **Status**: Accepted · **Story**: [SDK Story 2](spec-sdk.md#sdk-story-2---import-the-engine-from-a-package-of-its-own-priority-p1), [SDK Story 4](spec-sdk.md#sdk-story-4---publish-the-engine-with-every-release-priority-p2) ([SDK-FR-001](spec-sdk.md#sdk-fr-001), [SDK-FR-014](spec-sdk.md#sdk-fr-014), [SDK-FR-015](spec-sdk.md#sdk-fr-015), [SDK-FR-016](spec-sdk.md#sdk-fr-016))

### Decision

The engine is published as `@cherry-works/engine`, apart from `cherry-works`,
which does not depend on it. What that package exports, with what it states an
adapter owes the engine, is a public contract; everything else is internal.

The contract follows semantic versioning from its first publish, 1.0.0. The
package and `cw` share one version number and one release.

### Why

- **A separate package keeps `cw` as it is.** Installing `cherry-works` adds a
  bundle with no dependencies; an entry inside it would grow that, or bring
  dependencies with it.
- **Integrators build on ports.** A port changed in a minor release breaks
  someone else's adapter, and they cannot be asked first.
- **One number is one thing to trace.** Any report names one engine, whichever
  way it was reached.

### Consequences

- **A port, a constructor or a type that crosses them can no longer change
  freely.** Before changing one, ask whether it is a major release.
- **A breaking change to the contract moves `cw`'s major version too**, even
  when `cw` itself behaves the same.
- **Domain models, services and specifications stay free to change**, and a
  port must not leak them: what a port names is in the contract.
- **`cw` goes from 0.9 to 1.0.0** with the first release.

## ADR-003: Git fetches sources; it is not the engine's baseline

**Date**: 2026-11-02 · **Status**: Accepted · **Story**: [CORE Story 35](spec-core.md#core-story-35---set-a-repository-up-anywhere-with-or-without-git-priority-p2), [CORE Story 37](spec-core.md#core-story-37---install-and-remove-a-vendor-source-in-any-folder-priority-p3) ([CORE-FR-054](spec-core.md#core-fr-054), [CORE-FR-107](spec-core.md#core-fr-107), [CORE-FR-053](spec-core.md#core-fr-053), [CORE-FR-204](spec-core.md#core-fr-204), [CORE-FR-206](spec-core.md#core-fr-206))

### Decision

No use case asks for version control unless it cannot work without it.

| Asked of git | By |
|---|---|
| Reaching a source and reading what it holds | installing and injecting a vendor source, on a port of its own, named for fetching sources and not for vendors |
| Worktrees of the last commit | evaluating, on a port of its own |

Setup and the portal do not ask. Nothing tells an edited vendor any more
([ADR-004](#adr-004-nothing-tells-an-edited-vendor)), and removing a vendor
neither commits nor looks at work in hand. The one port for version control goes.

### Why

- **Those checks protected nothing they used.** Setup and the portal asked once
  and used nothing of the answer.
- **The engine is published for tools with no git**, and a port with ten
  questions, of which authoring asks two, is a cost with no return.

### Consequences

- **Breaking for `cw`.** A folder outside git is now set up rather than refused,
  and removing a vendor no longer commits.
- **A repository without git has no review, history or undo of its charter.**
  The engine does not enforce them; the tool or the developer takes them on.

## ADR-004: Nothing tells an edited vendor

**Date**: 2026-11-02 · **Status**: Accepted · **Story**: [CORE Story 37](spec-core.md#core-story-37---install-and-remove-a-vendor-source-in-any-folder-priority-p3) ([CORE-FR-046](spec-core.md#core-fr-046), [CORE-FR-053](spec-core.md#core-fr-053), [CORE-FR-080](spec-core.md#core-fr-080), [CORE-FR-081](spec-core.md#core-fr-081))

### Decision

The engine no longer checks whether a vendored file was edited, by git or by a
record of its own. `cw doctor` asks three questions, with no line for vendors,
`cw vendor add` and `cw vendor remove` compare nothing, and nothing is kept
beside a vendor.

A story that would have judged an edit from a hash in `.cw/vendor.json` was
built, reviewed and dropped before it landed.

### Why

- **The check cost more than the edit it catches.** A vendor is replaced by
  installing it again, and an edit is seen in the diff that brought it.
- **One hash could not tell an edit from noise.** `.DS_Store`, a file git
  ignores, a checkout's line endings, a folder that does not read and a
  removal each needed a rule of their own, and each rule brought the next
  fault: ten reviews of it failed.
- **A hash that refuses work has to be undone by hand.** Refusing installs and
  removals over a difference left a repository stuck with nothing to undo.
- **Git was no answer either.** It cannot see an edit that was committed, it
  reports a source just installed as edited, and the engine is published for
  tools with no git.

### Consequences

- **Breaking for `cw`.** `doctor` no longer fails on an edited vendor, so a CI
  gate on it no longer catches one.
- **Read-only is a convention.** Docs still call a vendor read-only; nothing
  enforces it, and review of the diff is what catches an edit.
- **`ForVCS` loses `changedUnder`**, and `CharterAuthoring` no longer takes
  version control.
