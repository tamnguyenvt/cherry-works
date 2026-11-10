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
primitive's compiled file. A catalogue entry holds its kind, its id, its description, the file its body is in, and the files it applies to where it names any. The id remains the only name the primitive has; the kind is a field of its entry.

### Why

- **The host file is named by the id.** A skill is invoked as `/sdd-plan`, so
  `guide:x` and `skill:x` would both want one name.
- **The kind was noise.** The id already says what the primitive is.
- **One way to name, one way to link.** Only text written `[[<id>]]` is a
  reference, so prose is never taken for one.

### Consequences

- **Breaking for every charter.** `rationale: corpus:x` becomes
  `rationale: x`; `script:x`, `mcp:x` and `template:x` in a body become `[[x]]`.
  The earlier way is not read, and not reported either.
- **Two kinds no longer share an id.** The corpus explaining a guide becomes
  `why-<id>`.
- **Quote a header value that starts with `[[`**: `run: "[[check]]"`, since YAML
  reads `[[check]]` as a list.
- **A field that takes one kind reads an id of another as missing**; no
  separate "wrong kind" error exists.

## ADR-002: The engine's public contract is what its package exports

**Date**: 2026-11-02 · **Status**: Accepted · **Story**: [SDK Story 2](spec-sdk.md#sdk-story-2---import-the-engine-from-the-package-cw-comes-in-priority-p1), [SDK Story 4](spec-sdk.md#sdk-story-4---publish-the-engine-with-every-release-priority-p2) ([SDK-FR-001](spec-sdk.md#sdk-fr-001), [SDK-FR-014](spec-sdk.md#sdk-fr-014), [SDK-FR-015](spec-sdk.md#sdk-fr-015), [SDK-FR-016](spec-sdk.md#sdk-fr-016))

### Decision

The engine is a library of `cherry-works` itself: the package that installs
`cw` also exports the engine (`import … from "cherry-works"`), and no other
package is published. What it exports, with what it states an adapter owes
the engine, is a public contract under semantic versioning from 1.0.0,
recorded in `contract.d.ts` and compared at each release; everything else is
internal.

### Why

- **One package is one thing to install and to release**, and nothing can
  be published halfway; its library, like `cw`, bundles what it uses.
- **Integrators build on ports**, and a port changed in a minor release breaks
  an adapter whose author cannot be asked first.

### Consequences

- **A port, a constructor or a type that crosses them can no longer change
  freely**: ask first whether the change is a major release.
- **A breaking change to the contract moves `cw`'s major version too**, even
  when `cw` behaves the same.
- **`cw` goes from 0.9 to 1.0.0** with the first release.
