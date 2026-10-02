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
