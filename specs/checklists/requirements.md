# Specification Quality Checklist: Cherry Works

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-30
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`

### Resolved during specification

- **The kind set is closed at nine.** The external-callable, governed-document and documentation-pattern kinds were dropped. The reference design's own charter never exercises the document graph, and for this product the lifecycle of a work item belongs to a later application. The producing and consuming relationships on a unit of work went with the document kind; the explicit done-condition stayed, since it stands alone.
- **The composition kind is named `mixin`.** The reference design calls it `concern`, a name chosen when the kind still meant a cross-cutting review lens. Once the mechanism generalised into a reusable fragment the name stopped describing it — which is why that design's own documentation and code disagree about what it is.
- **Self-regression tests assert activation only** ([FR-082](../spec.md#fr-082) – [FR-085](../spec.md#fr-085)). They are not primitives: nothing compiles them and no agent is instructed by them, so they sit beside the charter as `.cw/test/<name>.json`, and `eval` left the kind set. They are JSON rather than a document, since a primitive is a document because an agent opens its body and a test has no body — `cw test` is its one reader. They pin which rules apply to a described situation. They do not run a check's command, which would need a live environment and break the reader/writer split, and do not ask an agent for a judgement, which would be non-deterministic and make the suite flaky.
- **The outer layer is named `vendor`, not `shared`.** The reference design already uses `sources` for a different kind entirely — an external documentation endpoint an agent may reach for (Linear, Confluence, an HTTPS URL) — so reusing the word for installed charter content would mislead anyone who read it. Vendored content lands only under the vendor directory, beside the charter rather than inside it ([FR-044](../spec.md#fr-044)). The word "shared" is kept where it means something else: the shared entry point ([FR-009](../spec.md#fr-009)).
- **There is no machine-local layer.** A personal scope would leak per-developer rules into committed compiled output, making one repository behave differently for each developer.
- **Every new engine capability gets a port and a command.** Editing and deleting a primitive, and creating, rewriting and deleting a test file, are given `cw` equivalents in the same change ([FR-109](../spec.md#fr-109)), so the portal adds no behaviour the command line lacks.
- **The four extra health warnings belong to the engine.** Uncited corpus, unlent mixin, more than four primitives putting long content into the main agent's context, and a guide, sensor or posture no test case names are validation warnings ([FR-014](../spec.md#fr-014)), so `cw doctor` and the portal say the same thing.
- **Vendored content is committed, and its source is read from history.** The installing commit names the source and the version, and they are read back from it ([FR-053](../spec.md#fr-053)), so no record is kept beside vendored content.
- **No flows.** The portal shows one checkout's charter and knows nothing of flows.
- **No standing build status.** Whether the compiled output is behind is the health check's answer ([FR-080](../spec.md#fr-080)).
- **Three decisions for agent authoring were taken as informed defaults**, each recorded in Assumptions: one header flag makes the whole run non-interactive; the engine-owned layer is supplied on every read and kept nowhere in the repository; the identity the shipped skill claims collides like any other.

### Notes on judgement calls

- **"No implementation details"** is read as excluding languages, frameworks and library choices from the requirements. The command-line surface (`cw add`, `cw kinds`, `cw build`, `cw init` …), the layer names and the local page are the product's user-facing surface, not implementation detail: they are what an author and an agent both touch. How the page is served is the plan's business.
- Requirements are written in the vocabulary of the domain (primitive, kind, layer, vendor source, catalogue, compiled output) rather than the reference implementation's names, so the spec stays readable without knowing keystone.
- **Kind and identity are fixed on edit.** Renaming in place would rewrite what names the old identity, so it is out of scope.
- **Vendor drift is reported by the health check only.** The vendor view does not mark an edited source, since `cw doctor` already answers it.
