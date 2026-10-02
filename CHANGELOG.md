# Changelog

## 0.5.0 — 2026-10-02

- Small enhancement to naming for Claude: a skill is invoked as `/<id>`, not `/skill-<id>`, and an agent is spawned by its id. Run `cw build` to apply it.
- **Breaking:** big refactoring that removes the identity (`kind:id`) and names every primitive by its id only; write `<id>` in headers and tests and `[[<id>]]` in bodies (see `specs/ADR.md`).

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
