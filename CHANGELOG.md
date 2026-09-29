# Changelog

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
- `cw vendor` shares a charter between repositories.
