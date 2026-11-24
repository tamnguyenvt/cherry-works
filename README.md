# Cherry Works

Current version: **1.4.2**

Stable version: **1.4.1**

**Your team's way of working, written once for coding agents.**

Join the community on [Discord](https://discord.gg/QVErC87JB).

Keep coding standards, workflows, tools and permissions in a **charter**:
small Markdown files you can review, test and share. Cherry Works compiles
them into the files **Claude Code** and **Codex** read.

![Charter at the center, surrounded by its eleven primitive kinds](docs/images/charter-primitives.svg)

## Why use it?

- **Keep instructions maintainable.** One rule or workflow per file, with an
  explicit purpose and scope.
- **Build for your agent.** Generate instructions, skills and supported agent
  settings from the same source.
- **Check what you ship.** Validate the charter, test which rules apply, and
  evaluate whether a real agent follows them.
- **Share your team's practices.** Publish a charter and install a
  versioned copy in other repositories.

## Get started

You need **Node.js 22+**, **Git**, and Claude Code or Codex.

```bash
npm install -g cherry-works        # the stable version
npm install -g cherry-works@next   # the current version, newest released
```

The commands below are those of the current version: while it is newer than
the stable version, install `cherry-works@next` to run them.

Using a local checkout? [Build and link it globally with pnpm](docs/reference.md#install-from-a-local-checkout).

Inside the repository you want to govern:

```bash
cw init                    # choose your agent and set the repository up
cw add guide no-any --charter=team --header description="No any in TypeScript." --header globs="src/**/*.ts"
cw edit no-any             # write the rule in your editor
cw build                   # generate the agent's files
cw doctor                  # check the result
```

The fastest way to write one is to ask your agent: `cw init` gives it the
`/cw-author` skill, which asks cw what each kind needs and writes the file
for you. Say "write a rule that forbids `any` in TypeScript", or run
`/cw-author`.

Your rule lives at `.cw/charter/team/primitive/guide/no-any/index.md`, in the charter `team`. Edit that source and
rebuild when it changes. Review and commit `.cw/` together with the generated
agent files.

→ [Write your first charter](docs/writing-a-charter.md)

## What's in a charter?

Each building block is a **primitive**: an `index.md` with YAML headers and
instructions, plus any supporting files.

| Purpose | Primitives |
|---|---|
| Set standards and permissions | `guide`, `posture` |
| Describe tasks, workflows and delegated roles | `skill`, `playbook`, `agent` |
| Run checks and connect tools | `sensor`, `script`, `mcp` |
| Reuse instructions, documents and reasoning | `mixin`, `template`, `corpus` |

Run `cw kinds` to explore them, or `cw kinds guide` for one kind's fields.
Each id is unique across your charters, installed charters and built-ins.

## Reuse a team's charter

Install a published charter, then build it for your agent:

```bash
cw charter pull git@github.com:your-org/charter-baseline.git --ref v1.0.0
cw build
```

An installed charter is read-only, and `cw charter update --charter=<name>`
(or `--all`) brings it up to date from its source. To copy the content into your own editable charter
instead, use `cw charter pull --fork`.

To publish charters of your own, make one with `cw charter create <name>` and
ask your agent `/charter-release`.

→ [Create and publish a charter source](docs/creating-a-charter-source.md)

### Recommended charters

| Charter | What it gives your agent | Install |
| --- | --- | --- |
| sdd-charter | Spec-driven development: a spec set with a status per story and a roadmap of their dependencies, and six commands (`/sdd-init`, `/sdd-plan`, `/sdd-implement`, `/sdd-bug-fix`, `/sdd-status`, `/sdd-report`) that take each story from request to merge, stopping for your yes at each step. | Not public: [contact the author](#contributors) for access. |

## Work from the terminal or browser

```bash
cw run portal              # browse and edit the charter locally
cw test                    # test activation and permission rules, without an agent
cw context                 # estimate the charter's context size
cw eval --agent codex       # evaluate with the real agent; spends tokens
```

![The Cherry Works portal showing a repository's charter](docs/images/portal-charter.png)

## Documentation

- [Writing a charter](docs/writing-a-charter.md) — rules, workflows, references
  and tests.
- [Creating a charter source](docs/creating-a-charter-source.md) — publish,
  install and update a shared charter.
- [Using the portal](docs/use-portal.md) — edit, test and build in your browser.
- [Extending the engine](docs/extending-the-engine.md) — call the engine from
  your own integrator, and hand it adapters of your own.
- [Reference](docs/reference.md) — commands, agent mappings, evaluations,
  context costs, charter sources, MCP configuration, and
  [the engine as a library](docs/reference.md#the-engine-as-a-library) to
  `import` from `cherry-works`.
- [Development](docs/reference.md#development) — build from source, run checks
  and release.
- [Changelog](CHANGELOG.md) — releases and changes.

This repository uses [its own charter](.cw/charter/) and keeps its product
specifications in [specs/](specs/spec.md).

## Contributors

Tam Nguyen — [tamnvt1@gmail.com](mailto:tamnvt1@gmail.com)
