---
kind: playbook
id: plan-task
description: Instruction for writing a phase's stories into the spec
triggers: ["clarfify requirement"]
---

One job: write the stories of a phase into the spec. Nothing else is written: no plan, no task list, no decision records. How a story is built is decided when it is implemented (playbook implement-task).

Use /speckit-clarify to clarify requirements, and write them into `specs/spec.md`.

The output must be:
- specs
  - spec.md
  - mockup (optional)

`spec.md` answers **what** and **why**: user stories, Given/When/Then scenarios, FR-xxx, SC-xxx, out of scope, and each story's status. A story's scenarios are its acceptance criteria. It never holds file names, class names or how anything is built.

There is one spec for the whole product: a new phase extends it in place, writing what the product is now rather than an amendment beside what it was. FR, SC and story ids are numbered once across the whole spec.

**Stories.** Numbered in the order they will be implemented; that order is the schedule. Each carries a status line right under its heading — `**Status**: Todo` or `**Status**: Done` — never inside the heading, so the heading's anchor never changes. A story too big for one reviewable change is split into smaller stories here.

Cite by id (FR-012, SC-004, Story 1 scenario 3) rather than restating. Write ids as plain text and run `pnpm run specs:link`, which links each to where it is defined; `pnpm run specs:check` fails while a citation dangles. Never hand-edit a generated link or `<a id>` anchor.

**Iron law:**

When explaining anything to this user, write plain everyday Vietnamese in
complete sentences. No abbreviations, no compressed fragment style, no dropping connecting words to save space. Take the room needed to explain properly.

**Why:** The terse fragment style made explanations harder to follow, not faster to read.

**How to apply:** keep English only for code, identifiers, commit messages, CLI commands and exact error strings. Everything else in full Vietnamese prose. This outranks any terse-output style rule active in the session.

