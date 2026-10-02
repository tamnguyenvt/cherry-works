---
kind: skill
id: init-hexagon
description: Ask the user what a hexagonal setup needs — folder, language (TypeScript or JavaScript only), dependency-cruiser, example, overwrite — show the plan, and start only once they confirm.
triggers: ["init hexagonal architecture", "scaffold hexagon", "set up ports and adapters", "init hexagon step by step"]
---

Initialise a hexagonal architecture the user has decided on, not one guessed
for them: collect every choice first, show exactly what will happen, and start
only on an explicit yes. Nothing is written before the gate.

Only **TypeScript** and **JavaScript** are supported. For any other language,
say so and stop: there is no skeleton to offer, and none is improvised.

## 1. Collect

Ask with the question tool where there is one, a few questions per round;
otherwise ask in plain text, one round at a time. A choice the user already
gave in their request is taken, not asked again.

1. **Target folder** — the path to initialise. Free text: when the request
   holds none, ask for it and wait. Never default to the current folder.
   Resolve a relative path against the repository root and show the absolute
   one back.

   Then detect what the folder is written in, read-only:

   ```bash
   .cw/out/script/scaffold-hexagon/run.sh <absolute-target-path> --detect-language
   ```

2. **Language** — asked according to what was detected:
   - `ts` or `js` — TypeScript / JavaScript, with the detected one first and
     marked "(detected)". The user may still pick the other; say then that
     the folder looks like the detected one.
   - `none` (missing or empty folder) — TypeScript (recommended) / JavaScript.
   - `unsupported:<file>` — do not ask. Say the folder is a project in another
     language, name the file that shows it, say only TypeScript and
     JavaScript are supported, and stop. Nothing else is asked or run.
   - The user names any other language, at any point — the same answer: not
     supported, and stop.
3. **dependency-cruiser** — enforce the layer rules on every import with
   `lint:deps`? Yes (recommended) / No, the rules are kept by review.
4. **Greeting example** — scaffold a sample use case through every layer, with
   a test? Yes (recommended for a first hexagon) / No, empty layers only.
5. **Package manager** — only when the folder (or the nearest parent with a
   `package.json`) holds no lockfile: pnpm (recommended) / npm / yarn / bun.

Then look at the folder, read-only: does it exist, is it a folder (stop if it
is a file), and what does a dry run of `[[scaffold-hexagon]]` say?

```bash
.cw/out/script/scaffold-hexagon/run.sh <absolute-target-path> --language <ts|js> --dry-run [--no-dependency-cruiser] [--no-example]
```

6. **Existing files** — only when the dry run lists files to skip: keep them
   and merge into them (recommended) / overwrite them with `--force`. Name the
   files in the question. Overwriting is never the default.

## 2. Gate

Show the plan in one message, and nothing else in it:

- target folder (absolute), and whether it will be created;
- language: TypeScript / JavaScript, and whether it was detected or chosen
  against what was detected;
- dependency-cruiser: yes / no; example: yes / no; package manager;
- the dry run's lists: files to write, files to skip (or to overwrite, with
  `--force`), and that `package.json` will get scripts and dev dependencies;
- the exact command the agent will run.

Then ask one question: **Proceed / Change something / Cancel**.

- **Proceed** — go to step 3.
- **Change something** — ask what, update the choices, rerun the dry run,
  and show the gate again. Every change goes back through the gate.
- **Cancel**, no answer, or anything that is not a clear yes — stop, and say
  that nothing was written.

The yes holds for this plan only. If the folder changed since the dry run (the
agent's script reports different files), that is a new plan: gate again.

## 3. Run

Spawn `[[hexagon-initializer]]` with a prompt naming every choice, so it
decides nothing on its own:

> Initialise a hexagonal architecture in `<absolute-target-path>`.
> Language: ts|js. dependency-cruiser: yes|no. Greeting example: yes|no. Overwrite existing
> files: yes|no. Package manager: <pm>. The user confirmed this plan.

## 4. Verify against the guides, and refactor

The init is not done because the agent says so. Before telling the user
anything, review it, fix what the review finds, and review again.

1. Spawn `[[hexagon-reviewer]]` with the target path, the language,
   and the files written or merged, from the initializer's report:

   > Review `<absolute-target-path>` (language: ts|js). Files: <list>.

2. Read its verdict.
   - `clean` — go to step 5.
   - `findings` — spawn `[[hexagon-initializer]]` with the findings, word for
     word, so it fixes them:

     > Fix findings in `<absolute-target-path>` (language: ts|js):
     > <the reviewer's findings>

     Then review again from 1, with the files the fix changed added to the list.
   - `conflicts only` — go to step 5; the conflicts go to the user.
3. At most **three** rounds of review and fix. A finding still there after the
   third is not fixed by a fourth: it goes to the user as unresolved, with the
   reviewer's last word on it.

Never settle a conflict between two guides yourself, and never fix a finding
by loosening `.dependency-cruiser.cjs`, turning off `checkJs`, or editing a
guide.

## 5. Report

Only now tell the user it is done — or how far it got. Relay:

- the language, and what was written, skipped, merged;
- the scripts and dependencies added;
- typecheck, `lint:deps` and test results from the last round — any that were
  skipped, and why; any failure with the line that names it;
- the guides it was checked against, how many review rounds it took, and
  what was refactored along the way;
- **conflicts** between guides, each with both sides, asking the user which
  wins;
- **unresolved** findings, if any, with why.

Say "done" only when the last review was `clean`. Otherwise say what is left.
End with the next step: `src/ARCHITECTURE.md` and `[[hexagonal-architecture]]`.
