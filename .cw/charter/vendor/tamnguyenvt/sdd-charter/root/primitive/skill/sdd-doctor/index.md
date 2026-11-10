---
kind: skill
id: sdd-doctor
description: Check that the repository's spec set is set up — settings, spec folder, every manifest answer — and offer the fix of each fault.
triggers: ["sdd doctor", "check the sdd setup", "is the spec setup healthy"]
rationale: sdd-concept
---

Run `doctor` of [[sdd-specs]] and give its report in the developer's conversation
language, preserving commands, paths and quoted errors exactly. Change
nothing until the user picks a fix.

The `hint` for a missing personal language is informational: it never fails
the setup check, and points to /sdd-init. A missing **Document language**
answer means English and does not fail either. Do not create personal settings
until the developer chooses a language.

Then offer each fix the `fail` lines name, one at a time, each once:

- **ask /sdd-init's question on** `**<Question>**` — ask that question of
  /sdd-init, with its recommendation, and write each failed line it
  answers into `manifest.md` under the heading the [[sdd-manifest]] template
  puts it; nothing else of the manifest changes.
- **ask /sdd-init's question on the spec folder** — ask it, and write the
  answer to `.sdd/settings.json` as `specFolder` and to the manifest's
  **Folder**.
- **/sdd-init** — offer to run it.

Run `doctor` again after the fixes, and end on its report in that same language.
