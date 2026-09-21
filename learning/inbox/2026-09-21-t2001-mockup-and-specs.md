# T2.001: what surprised us (2026-09-21)

## The mockup is a placeholder for rules, never a source of them

Tam: the activation text the mockup's Explain modal writes, and the rules it
computes by, are placeholders. The portal always shows what the engine says:
each kind's own `activatesWhen`, and each kind's contract. Where the two
differ, the engine is right. For example, a guide with no `globs` is valid and
comes up every turn, even though the mockup reports it as an error.

Written into plan §12.5 and into the spec's Clarifications.

## Agent context, "what it costs" and `always` are not concepts any more

All three were removed from the spec on 2026-09-21. The design has no agent
context, the Explain modal has no "What it costs", and the `always` header was
already gone from the code. FR-014 now raises three warnings.

## Reading the mockup

`specs/mockup/portal.html` is a bundle. The page itself is one JSON-escaped
string on line 388. Decode it before you read or grep it:

```sh
node -e 'const l=require("fs").readFileSync("specs/mockup/portal.html","utf8").split("\n")[387];
require("fs").writeFileSync("mockup.html", JSON.parse(l.trim().replace(/[;,]$/,"")))'
```

To edit it, change the escaped text in place: `\"` for a quote, `/` for
`/`, `\n` for a newline. Then check that the line still parses as JSON.

## Tooling that points to the wrong place

- `.specify/scripts/bash/check-prerequisites.sh` still answers
  `specs/003-cw-author-skill/`. That folder is from before the squash. The one
  spec is `specs/spec.md`, with `plan.md`, `data-model.md`, `checklists/` and
  `tasks/<phase>.md` beside it.
- `node --import tsx main.ts` only works inside the repository, because `tsx`
  is not found anywhere else. To run `cw` against a scratch repository, run
  `pnpm run build` first and then use `node <repo>/dist/main.js`.
- Under zsh, `echo =====` fails with "not found", because `=word` is expanded
  as a command path. Use `echo '---'` instead.

## A task can already be half done

The test-case part of T2.001 (`testCasesByFile`, `pinned down by …`) was
already in the code when the task opened. Before writing a spec, compare the
task against the code, and rescope it to what the FR still asks for.
