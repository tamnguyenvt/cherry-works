# Cherry Works — specs

What the product must do and why, one spec per part of it. Each spec numbers
its own stories, FR and SC under its prefix: `spec-core.md` holds
`CORE Story 1`, `CORE-FR-001`, `CORE-SC-001`.

| Spec | Prefix | What it covers |
|---|---|---|
| [Core](spec-core.md) | CORE | The charter and its engine, the `cw` command line, the portal, agent authoring, distribution, mcp origins reached through MCP, scripts and templates, and how primitives are named. |
| [Eval](spec-eval.md) | EVAL | What a charter costs in the agent's context and in a session, searching an mcp origin's tools rather than listing them, and evaluating the charter against a real model. |
| [SDK](spec-sdk.md) | SDK | The engine as a published package: what it exports, the contract it keeps with integrators' adapters, the addresses a repository may have, and how that contract is versioned. |
| [Vendor](spec-vendor.md) | VENDOR | Developing a repository that publishes charters: setting it up, authoring every charter from its root, and releasing them. |

- [plan.json](plan.json) — every story and the stories it depends on: the roadmap.
- [manifest.md](manifest.md) — how work on a story is carried out and finished here.
- [ADR.md](../docs/ADR.md) — the decisions that shape the architecture; [architecture-note.md](../docs/architecture-note.md) — how it is written today.
- [mockup/](mockup/) — the portal's design.
