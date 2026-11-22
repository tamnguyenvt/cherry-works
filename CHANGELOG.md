# Changelog

## Unreleased

## 1.4.1 — 2026-11-22

- **Breaking:** primitives, tests and evals live in charters you name under `.cw/charter/<charter>/` (a 1.3.0 layout is refused: follow `/cw-author` to move it); `cw add`, `cw list`, `cw suite`, `cw test`, `cw eval` and the portal take `--charter=<name>`, and `--skill` is gone.
- **Breaking:** `cw charter` (`pull`, `create`, `update`, `remove`) replaces `cw vendor`, and `/charter-release` comes with cw in place of `/vendor-release`, keeping the changelog in `.cw/CHANGELOG.md`; `npm install -g cherry-works` installs the stable version, `@next` the newest.
- **Breaking:** the library names charters where it named vendors and takes a charter's name in its ports: update code that calls or implements them.
- Library declarations changed or removed: `CharterDTOs`, `CharterPath`, `CharterRoot`, `FileCharterRepository`, `ForAuthoringCharter`, `ForBuildingCharter`, `ForFetchingCharterSources`, `ForManagingCharter`, `ForRunningCharter`, `GitSources`, `LAYER_NAMES`, `PrimitiveLayer`, `RawEvalSuite`, `RawSourceSkill`, `RawTestSuite`, `RawVendorRoot`, `RawVendorSource`, `SourceCharter`, `SourceSkill`, `VendorSource`, `VendorSourceOrigin`.

## 1.3.0 — 2026-11-17

- `cw run mcp`, `cw run sensor <signal>` and `cw run portal` replace `cw mcp serve`, `cw sensor run` and `cw portal`, which still work until the next major; run `cw build` so your agent's files use the new names.
- `cw --help` lists the commands that author the charter apart from those that run it.
- Every `cw` answer is laid out the same way, in colour at a terminal and without it in a file or with `NO_COLOR` set.
- Every `cw` command except `cw run` takes `--json` and prints one JSON document, even on failure.
- `cw list` groups primitives by kind.
- In the portal, typing `[[` in a body lists every primitive and writes `[[<id>]]` for the one you choose.

## 1.2.0 — 2026-11-15

- `cw vendor init` sets a charter vendor repository up in an empty folder: it asks the repository's name and what its charters give at the terminal, runs `cw init`, and writes a README with your answers, a `CHANGELOG.md`, a `.gitignore` leaving out what `cw build` writes, an empty `charters/`, and the `/vendor-release` skill with the script it runs. Nothing is committed.
- `/vendor-release`, in a repository `cw vendor init` set up, releases its charters from the default branch of `origin`: it builds each charter, lists how to install each one and its skills in the README, proposes the version and the changelog entry, and once you confirm, commits, pushes and tags. Where `origin` names no default branch yet, it asks which branch to release from.
- **Breaking:** `cw vendor add` and `cw vendor inject` read a source's charters under `charters/<name>/` and its skills under `skills/`, and nothing else: a charter at the source's root is never installed, and a source holding neither is refused as no vendor. Move a charter published at a source's root to `charters/<name>/`.
- With neither `--charter` nor `--skill`, `cw vendor add` installs every charter and every skill a source holds.
- A charter set up by `cw init` is no longer refused when installed for the `.gitkeep` in its vendor folder.
- **Breaking:** `VendorSource` and `RawVendorSource` no longer hold `ownCharter`, and their constructors no longer take it.

## 1.1.0 — 2026-11-14

- **Breaking:** a charter store of your own hands the engine the vendors it keeps by name: `ForManagingCharter.loadVendorRoot()` answers a `RawVendorRoot`, and the engine makes the installed vendors from it. The port no longer lends `VendorRootFactory`, and `VendorRoot` is no longer exported. `FileCharterRepository` refuses a vendor laid out the old way itself, with the same message as before.
- **Breaking:** `WorkspaceSettings` holds the agents a repository chose as `agentProviders`, each an `AgentProvider`; `JSON.stringify` still writes `{ "agents": [...] }`, and `FileWorkspaceSettingsRepository` writes the settings file as before.
- **Breaking:** `ProviderComponent` holds `agentProvider`, an `AgentProvider`, in place of `agentName`, and its file's content as `text`; `DocumentBasedComponent.document` is the `StampedDocument`, and `SettingBasedComponent` takes an `AgentProvider`.
- **Breaking:** `CharterDTOs` lists `ProjectionPlanSummary` after the `Primitive` DTOs; no DTO itself changed.
- A change to the package's contract now takes at least a new minor version; a new major is the maintainer's choice.
- Every value in the engine's source is named for what it holds. `cw` behaves as before.

## 1.0.0 — 2026-11-14

- The Cherry Works engine can now be customized with adapters of your own: `import { composeApplications } from "cherry-works"` and hand it the adapters you replace — where files are kept, the charter's store, each agent's projection and command line, and the rest. See [Extending the engine](docs/extending-the-engine.md).
- **Breaking:** the workspace under `.cw/` is now laid out in three parts:
  - `.cw/charter/` — what you write: the primitives in `primitive/<kind>/`, the tests in `test/`, the evaluation cases in `eval/`, and the vendor sources you install in `vendor/`. Commit it.
  - `.cw/out/` — what `cw build` generates from the charter and what the agent reads. Never edit it; build again.
  - `.cw/log/` — what `cw` records while it works, such as each evaluation's working copy and its results. Version control ignores it.

  A repository laid out the old way is refused until the `cw-author` skill moves it.
- **Breaking:** a vendor source holds its primitives in `.cw/charter/primitive/`; a source laid out the old way is refused until it is moved.
- **Breaking:** `cw sensor run <signal>` runs the sensors kept for the agent named with `--agent`, and with none named only the sensors kept for no agent. Run `cw build` after upgrading so each hook names its agent.
- **Breaking:** `cw context --exact` is gone. `cw context --agent=<agent>` lists each primitive's estimate beside its count through that agent's command line, and warns where the totals differ by more than 15%; `cw context` alone estimates for every agent.
- **Breaking:** `cw doctor` no longer reports a vendored file edited in this repository.
- **Breaking:** the built-in `cw-session-cost` skill is gone; `cw sessions` still sums the tokens of the sessions kept on this machine, by day and by session.
- `cw init`, `cw vendor add` and `cw vendor remove` work in a folder that is not a git repository; adding needs git on the machine only to reach the source.
- A primitive's binary assets, such as images, are built and installed byte for byte.
- On Codex, `cw build` replaces whole the hooks of a signal the charter's sensors run on, as it does on Claude.

## 0.9.0 — 2026-10-30

- `cw eval` retains promptfoo logs and agent session links, and `cw eval-analyze` reads them without spending tokens.
- Evaluation cases can use `expect.read` to check that an agent read a file from successful tool evidence.

- Run `cw init --agent codex` to build charter instructions, skills, subagents, MCP, command permission rules and sensor hooks for Codex.

- One repository can gather several charters under `charters/<name>/.cw/charter/`, and `cw vendor add <source> --charter baseline` picks the ones you want, as `--skill` picks skills. Each lands in `.cw/vendor/<owner>/<repository>/<name>/`, updated and removed on its own.
- With neither `--charter` nor `--skill`, `cw vendor add` takes what the source's shape holds: its one charter, else every charter under `charters/`, else every skill under `skills/`. `--skill` is no longer refused for a source that holds a charter: it takes the skills named from its `skills/`.

## 0.8.0 — 2026-10-26

- `cw vendor add` installs skills from a skills repository made for `npx skills`, such as `cw vendor add https://github.com/mattpocock/skills --skill grill-me`; with no `--skill`, every skill it holds is installed.
- A vendor source now lands in `.cw/vendor/<owner>/<repository>/`, so two repositories of one name no longer collide. One installed before keeps working; to move it, run `cw vendor remove <name>`, then `cw vendor add` again.
- `cw vendor remove` takes the folder as `cw vendor list` shows it, such as `cw vendor remove mattpocock/skills`.
- A skill or a playbook can say `disable-model-invocation: true` so the agent never opens it on its own and only you run it as a `/` command. Run `cw build`.

## 0.7.4 — 2026-10-22

- Your agent's settings now hold one `cw sensor run <signal>` hook per signal instead of one hook per sensor. Run `cw build`, and make sure `cw` is on the path your agent runs hooks with.
- A sensor runs as the last build left it, so run `cw build` after changing one.

## 0.7.3 — 2026-10-22

- Small refactor

## 0.7.2 — 2026-10-21

- Small refactor

## 0.7.1 — 2026-10-21

- No change to `cw` itself. The coding guides this repository wrote for itself now ship as their own charter: `cw vendor add https://github.com/tamnguyenvt/happy-code-charter`.

## 0.7.0 — 2026-10-07

- An agent can name the model it runs on with `model: <provider>:<model>`, such as `model: claude:haiku`.
- A mixin can set `position: end` to put its body after the primitive that pulls it in; `start`, the default, keeps it before. Run `cw build`.
- `cw vendor add` works whatever you have in hand, leaves what it installs unstaged for you to read and commit, and copies the source's `README.md` beside it.

## 0.6.2 — 2026-10-06

- fix `cw mcp auth`
- update README to explain `mainContextCeiling` and `sessionContextMark` in `.cw/settings.json`

## 0.6.1 — 2026-10-06

- A guide with `globs` now loads only when the agent works on a matching file, instead of in every session, which saves tokens; run `cw build`.

## 0.6.0 — 2026-10-06

- New `cw context` says how many tokens each primitive puts into the agent's context when a session opens; `cw build` prints the total, and `cw doctor` warns past `mainContextCeiling` (20,000 unless set).
- Each session's tokens are now counted when the agent stops, kept on your machine, and you are told each time a session passes another 100,000 tokens (`sessionContextMark`); run `cw build` to add the hook.
- New `cw sessions` sums up the kept sessions by day and by session, over at most 31 days.
- New built-in `cw-session-cost` skill: ask your agent what the sessions cost, at prices you type or the provider's published ones.
- A charter reaching mcp origins now turns on the agent's tool search, so tools are looked up rather than all loaded into context; run `cw build`.
- New `cw eval` puts the cases in `.cw/eval/` to the real agent under promptfoo and reports which skills it invoked, which guides it followed and the tokens each case used.
- A skill or a playbook with `disable-user-invocation: true` in its headers is no longer offered as a `/` command; the agent still opens it, for instance as a step of a playbook.
- `cw test` now passes a case that expects a guide without `globs` to come up, since that guide comes up every turn.

## 0.5.0 — 2026-10-02

- **Breaking:** primitives are named by their id alone — `<id>` in headers and tests, `[[<id>]]` in bodies — and a skill is invoked as `/<id>`; rewrite each `kind:<id>` in your charter, then run `cw build`.
- Works with [sdd-charter](https://github.com/tamnguyenvt/sdd-charter) for spec-driven development and [hexagonal-architecture-charter](https://github.com/tamnguyenvt/hexagonal-architecture-charter), both installed with `cw vendor add`.

## 0.4.0 — 2026-10-02

- `cw vendor` is ready: `cw vendor add <source>` installs another repository's charter, from its `.cw/charter/` folder, under `.cw/vendor/<name>/`.
- A vendor source is any repository set up with `cw init`; one that has vendors of its own is refused.

## 0.3.0 — 2026-10-01

- **Breaking:** every primitive is now a folder holding its `index.md`; move `.cw/charter/<kind>/<id>.md` to `.cw/charter/<kind>/<id>/index.md`.
- Files kept beside a primitive's `index.md` are copied next to it when you build.
- New `script` kind: keep the files your agent or a sensor runs, and name the one to run with `executionPath`.
- New `template` kind: keep a file for your agent to fill or copy.

## 0.2.1 — 2026-09-29

- `cw init` now builds the charter, so the `cw-author` skill is ready at once.
- `cw init` selects Claude Code by default.

## 0.2.0 — 2026-09-29

- **Breaking:** the `command` kind is removed. Move each command to `.cw/charter/skill/`, set `kind: skill`, add `triggers`, and call it as `/skill-<id>`.
- **Breaking:** an `id` may be at most 40 characters.
- New `mcp` kind: declare an MCP server your agent may use.
- New `cw mcp auth` signs you in to those servers as yourself.
- New `cw mcp serve` gives your agent every server through one entry in `.mcp.json`.
- A subagent can be limited to the servers and tools it lists.
- Ids can be grouped with `/`, as in `mcp:team/billing`.
- Every primitive is compiled to `.cw/out/<kind>/<id>.md`, so you can read what the agent reads.

## 0.1.0 — 2026-09-22

- First release: write your team's rules as small markdown files, and `cw` checks, tests and compiles them for Claude Code.
- `cw portal` shows and edits the charter in your browser.
