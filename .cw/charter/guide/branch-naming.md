---
kind: guide
id: branch-naming
description: Name a phase branch <three-digit number>-<slug>, such as 006-scripts-and-templates, and a story branch task/<story number>-<slug> started from it.
---
Name branches this way:

- A phase branch is `<three-digit phase number>-<slug>`, with no prefix:
  `006-scripts-and-templates`, not `phase/006-scripts-and-templates`. Create it
  once the phase's stories are planned (playbook plan-task).
- A story branch is `task/<story number>-<slug>`, started from its phase branch:
  `task/21-scripts-and-templates` (playbook implement-task).
