---
kind: skill
id: sdd-report
description: Draw the roadmap — every story of plan.json, where it stands and what it waits on — into report.html in the spec folder, and say what it shows.
triggers: ["sdd report", "draw the roadmap", "show the roadmap", "report the plan"]
rationale: sdd-concept
---

1. Run `check` of [[sdd-specs]]. With a fault, say it and stop: a roadmap
   drawn from a spec set that disagrees with itself would mislead.
2. Read **Document language** in the manifest (English when absent). For a
   non-English document language, prepare a temporary JSON file outside the
   repository with `language` exactly as the manifest, its HTML `lang` code,
   and `messages` translated into that language. Pass it as `report --labels
   <file>`. The complete message keys and placeholders are listed in
   [[sdd-specs]]; keep placeholders unchanged. Translate only generated labels,
   never existing story titles, finding prose or reasons. Delete the temporary
   file afterwards. The generated report stays in the document language;
   the spoken report follows the developer's conversation language.
   Run `report` of [[sdd-specs]]. It writes `report.html` into the spec
   folder `.sdd/settings.json` names; never write or edit that file by hand.
3. Open it for the user where the host can (`open <file>` on macOS,
   `xdg-open` on Linux), else give its path.
4. Say in a few lines what it shows: how many stories are `Done`,
   `In Progress`, ready and waiting, the stories `ready` lists — the ones that
   can be built side by side now — and the longest chain still to go; then
   what the code smell section says.
