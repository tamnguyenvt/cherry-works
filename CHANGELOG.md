# Changelog

Each entry says what changed for a user of `cw`, and what a user of the version before must do differently. Newest first.

## 0.2.0 — 2026-09-29

### Upgrading from 0.1.0

1. **Move every `command` to a skill.** The `command` kind is gone: a file declaring `kind: command` is refused, and nothing is built until it is moved. A file left under `.cw/charter/command/` is no longer read at all. For each one:
   - move it from `.cw/charter/command/<id>.md` to `.cw/charter/skill/<id>.md`;
   - change `kind: command` to `kind: skill`;
   - add `triggers`, the requests that should bring it up; a skill requires them:

     ```markdown
     ---
     kind: skill
     id: release
     description: Cut a release from the main branch.
     triggers: ["cut a release", "publish a version"]
     ---
     ```

   - call it as `/skill-<id>` where you typed `/<id>`, for example `/skill-release` rather than `/release`.
2. **Keep every `id` to 40 characters or fewer.** A longer one is now refused under its file.
3. **Run `cw build`, then commit what it wrote.** It removes what your commands were compiled to under `.claude/commands/`, and writes the new files below.

### Removed

- The `command` kind. A command and a skill reached the agent the same way, called by name, so the charter keeps the skill. A playbook's body is now described as a sequence of skills.

### Added

- **Every primitive compiled, where you can open it.** A build writes each primitive of every layer to `.cw/out/<kind>/<id>.md`: its headers, then the bodies of the mixins it pulls in, then its own. What the agent's host is given — a rule, a skill, an agent — points to that document rather than repeating it, and the full catalogue names it as each primitive's file.
- **The `mcp` kind: a place outside the repository.** An `mcp` primitive declares one MCP server, either an endpoint reached over HTTP or a command `cw` starts as a local process, and the tools of it the agent may use. Any primitive names a place in its body as `mcp:<id>`. A name no layer holds, and a place no primitive names, are warnings that stop nothing.
- **Identities grouped with `/`**, as in `mcp:mfbs/billing`. The file is kept, and compiled, in the folders its segments name.
- **`cw mcp auth`** signs you in to every place the charter declares, as yourself: by browser where the place offers OAuth, by a token typed at a hidden prompt where it does not. Credentials are kept in the operating system's credential store, never in the repository, and renewed without asking where the place allows it. `cw mcp auth --status` lists each place and whether you are signed in; `cw mcp auth <identity>` signs in again to one.
- **`cw mcp serve`**, the one MCP server your agent is given. It serves every place the last build listed, forwards each call under your own credential, and starts and stops the places declared as a local process. The build adds it to the agent's MCP configuration (`.mcp.json` for Claude Code) and leaves every other entry there as it was.
- **A subagent held to the places it lists.** An `agent`'s `tools` may list `mcp:<id>` for every tool of a place, or `mcp:<id>:<tool>` for one of them. The subagent is given those and no tool of any other place, whatever its body mentions.

## 0.1.0 — 2026-09-22

The first published version.

### Added

- **The charter.** Standards authored as small markdown files under `.cw/charter/`, one folder per kind: `guide`, `sensor`, `command`, `skill`, `playbook`, `agent`, `posture`, `corpus` and `mixin`. Each kind has its own required headers and comes up at its own time.
- **The command line.** `cw init` sets a repository up; `cw build` compiles the charter into what the agent reads, and `cw build --preview` shows what a build would write; `cw list`, `cw kinds` and `cw explain` show what the charter holds and why; `cw add`, `cw edit` and `cw remove` author it; `cw doctor` checks the agents, the charter, the vendor sources and the compiled output, and fails when something needs fixing, so it can gate CI.
- **Compiled for Claude Code**, and to an agent-neutral `CLAUDE.md` pointing at the charter: guides as rules, sensors as hooks, postures as permissions, skills and playbooks as skills, agents as subagents, commands as slash commands.
- **Vendor sources.** `cw vendor add`, `remove` and `list` install another team's charter from git, pinned to a version, as a read-only layer. An identity claimed twice, in any layers, is refused with both files named.
- **Self-regression tests.** `cw test` runs the cases under `.cw/test/`, each asking which primitives come up in a described situation; `cw suite add`, `edit` and `remove` manage the files.
- **Authoring by an agent.** `cw add` takes every header as a flag and asks nothing, `cw kinds <kind>` says what a kind requires with a sample, and the `cw-author` skill comes with the engine in every repository.
- **The portal.** `cw portal` opens the charter in a browser on your machine: every primitive, when it comes up and where it lives, with authoring, vendor sources, tests, the build and the health check, all through the same engine as the command line.
- **Distribution.** One install from npm, `cherry-works`, puts `cw` on the path; `cw --version` names the version, and `cw doctor` reports it.
