---
kind: script
id: sdd-clean
description: Say what a change would leave behind if it landed — a stray or temporary file, debug output, a leftover marker, a secret — each by where it is; changes nothing.
executionPath: ./clean.mjs
---

The clean-state check /sdd-finish runs before it lands a story or a fix.
Node 20 or later, nothing else; run from the repository's root.

```bash
node .cw/out/script/sdd-clean/clean.mjs <target>                       # exit 1 on any finding
node .cw/out/script/sdd-clean/clean.mjs <target> --accept app.mjs:12   # that finding no longer fails it
```

`<target>` is the branch the change lands in. The change is everything the
working tree holds beyond where the current branch left it — committed on the
branch, staged or not, and untracked files git does not ignore — and only the
lines it adds are looked at: what was already there is never its finding.

Each finding is a line, `<path>:<line>: <kind>: <what>`, sorted by path and
line; a file found for its name alone is `<path>: <kind>: <what>`:

- **stray** — a file the change adds named `*.tmp`, `*.temp`, `*.bak`,
  `*.orig`, `*.rej`, `*.swp`, `*.swo`, `*.log` or `*~`; `.DS_Store`,
  `Thumbs.db`; `.env` or `.env.<name>`, except `.env.example`, `.env.sample`
  and `.env.template`; any file under a `tmp/` or `temp/` folder.
- **debug** — in code, not in prose (`.md`, `.txt`, `.json`, `.yaml`…): a
  call to `console.log`, `console.debug`, `console.trace`, `console.dir`,
  `print`, `breakpoint`, `var_dump`, `print_r`, `dbg!` or `pdb.set_trace`; a
  line holding only `debugger`, `byebug` or `binding.pry`.
- **marker** — in any file: a `TODO`, `FIXME`, `XXX` or `HACK`, or a conflict
  marker `<<<<<<<` or `>>>>>>>` opening a line.
- **secret** — a private key, an AWS access key, a GitHub, Slack, Anthropic
  or OpenAI token, or a password, secret, API key or token assigned a quoted
  value of eight characters or more. A secret is named by its kind, never
  printed: a `debug` or `marker` finding on a line holding one names the
  secret's kind instead of the line.

`--accept <path>:<line>`, or `--accept <path>` for a file found for its name,
takes a finding the developer has accepted for this change — a fixture, a
test value, a CLI's real output — out of the result. Nothing is stored: the
next change is checked afresh.

Run twice on the same state, it prints the same lines and exits the same way.
Exit 0 with nothing found, 1 with a finding, 2 when `<target>` shares no
history with `HEAD`.

Its tests, beside it:

```bash
node --test .cw/out/script/sdd-clean/clean.test.mjs
```
