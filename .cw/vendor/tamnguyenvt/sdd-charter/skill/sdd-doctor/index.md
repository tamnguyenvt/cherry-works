---
kind: skill
id: sdd-doctor
description: Check that the repository's spec set is set up — settings, spec folder, every manifest answer — and offer the fix of each fault.
triggers: ["sdd doctor", "check the sdd setup", "is the spec setup healthy"]
rationale: sdd-concept
---

Run `doctor` of [[sdd-specs]] and give its report as it printed it. Change
nothing until the user picks a fix.

Then offer each fix the `fail` lines name, one at a time, each once:

- **ask /sdd-init's question on** `**<Question>**` — ask that question of
  /sdd-init, with its recommendation, and write each failed line it
  answers into `manifest.md` under the heading the [[sdd-manifest]] template
  puts it; nothing else of the manifest changes.
- **ask /sdd-init's question on the spec folder** — ask it, and write the
  answer to `.sdd/settings.json` as `specFolder` and to the manifest's
  **Folder**.
- **/sdd-init** — offer to run it.

Run `doctor` again after the fixes, and end on its report.
