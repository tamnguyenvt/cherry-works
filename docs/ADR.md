# Architecture Decision Records

## ADR-001: The engine is a hexagonal library of cw, every store and runner an adapter it is handed

**Date**: 2026-11-12 · **Status**: Accepted

### Decision

- **One package.** The engine is a library of `cherry-works`, published in
  the package `cw` is installed from. Its contract is what that package
  exports — how `cw` composes the engine, the driver ports and their DTOs,
  the port of every adapter with the models it names, and `cw`'s own
  adapters — recorded at each release in the folder `contract/`, and
  versioned by semantic versioning from 1.0.0, with `cw`'s own version.
- **Hexagonal, in modules.** The engine is two modules, charter (authoring
  and building a charter) and runtime (running what was built: sensors, mcp
  calls, evaluations, the sessions), with the workspace — what a repository
  configured itself with — a module of its own that neither knows, and a
  shared kernel. Each is laid out as `app/`, `domain/` and `infra/`; `app/`
  and `domain/` are the engine and import no adapter. A module asks another
  only through its applications, in DTOs, never its models.
- **Every store and runner is an adapter it is handed.** The engine is
  composed from one `EngineAdapters`, which may be partial: each adapter
  handed replaces `cw`'s own, each left out is `cw`'s own, and the engine
  itself is never replaced. What each agent reads of a charter is that
  agent's projection, an adapter handed under the agent's name.
- **A driven port speaks its adapter's words and carries no workspace
  path.** A store keeps a repository's state by layer, kind and id, never by
  where it sits; it hands what it keeps as it is kept, and the domain's
  factories make the models. The hexagon holds no address: every adapter is
  told where it works when it is set up. An evaluation's worktree is handed
  once to the output's and each projection's factory method for a checkout
  (`createCheckoutOutput`, `createCheckoutProjection`), which an
  integrator's extension overrides or is refused; no store opens a checkout,
  so an evaluation builds the charter as the store holds it now.
- **The use case is the failure boundary.** Every operation of a driver port
  answers a fault as a DTO, writing the diagnostics for the operator first;
  no caller catches one.
- **Driver ports read verb first.** Every operation of a driver port is
  named verb first, for what it acts on.

### Why

The user decided, story by story, that one package is one thing to install
and to release; that a tool using the engine brings its own way of keeping
and running a charter, often by extending `cw`'s own adapters; that keeping,
testing and building a charter is one boundary and running it another; that
where a file sits, or what address a machine has, matters only to the
adapter that keeps or lays it, so a store kept in a database is never asked
to open a copy of itself; that the operator reads the logs while a caller
reads DTOs; and that the ports an integrator reads first are named as the
use cases are.

### Consequences

- **The contract cannot change freely.** A change to a driver port, a DTO,
  a driven port, a model a port names or one of `cw`'s adapters is judged
  by the version policy, and a breaking one moves at least `cw`'s minor
  version, even when `cw` behaves the same; a major is the maintainer's
  choice (2026-11-14). Before 1.0.0 nothing is published, so a
  rename breaks no integrator.
- **A new kind of state** belongs to the module whose work it is, and is
  kept by an adapter of that module's port; a new agent is a projection of
  its own, never a change to the domain.
- **An integrator replaces any adapter, never the engine**, and sets each
  adapter up on its own address or connection.
- How the engine is written inside these lines — naming, layout, value
  objects, factories — is kept in [architecture-note.md](architecture-note.md),
  rewritten as the code moves.
