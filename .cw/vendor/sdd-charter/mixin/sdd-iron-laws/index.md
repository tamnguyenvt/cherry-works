---
kind: mixin
id: sdd-iron-laws
description: "The iron laws every change to code walked by a playbook of the spec set is held to, closing the playbook: evidence before a claim, no commit the manifest does not allow."
position: end
---

## Iron laws of every change

- **No completion claim without fresh evidence.** Checks run this turn.
- **No commit the manifest does not allow, and none with failing checks.**
  Never `--no-verify`.
