# Changelog

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
