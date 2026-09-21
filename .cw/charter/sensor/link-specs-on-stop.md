---
kind: sensor
id: link-specs-on-stop
description: Link every id the specs cite to where it is defined, and refuse to stop while a citation dangles.
signal: Stop
run: '[ -z "$(git status --porcelain -- specs)" ] || { pnpm -s run specs:link && pnpm -s run specs:check || exit 2; }'
---

Every FR, SC, task id, story and plan or data-model § cited under `specs/` is a
link to where it is defined (playbook `plan-task`). Writing the ids as plain text
is enough: when the agent stops with anything under `specs/` changed, added or
removed — what `git status` reports there, staged or not — `specs:link` anchors
every definition and links every citation, so a spec edited this turn is never
left unlinked. With nothing changed there, nothing runs.

`specs:check` then fails only on a citation nothing defines — an FR renumbered
away, a task id that no longer exists. Exit code 2 hands its message back to the
agent and keeps it working: fix the citation, or define what it names, rather
than stop with a link that goes nowhere.
