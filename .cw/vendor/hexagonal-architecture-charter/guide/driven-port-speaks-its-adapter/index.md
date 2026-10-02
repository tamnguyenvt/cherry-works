---
kind: guide
id: driven-port-speaks-its-adapter
description: Name what crosses a driven port after what its adapter deals in, never after a domain concept.
globs: ["src/hexagon/port/zdriven/**"]
rationale: corpus:driven-port-speaks-its-adapter
---

A driven port speaks the language of the adapter behind it, not the domain's.
Name every type, method and parameter that crosses it after what that adapter
deals in: version control knows commits and branches, not releases; a file
store knows files and folders, not invoices; a mail server knows messages and
recipients, not customers. Turning those into domain values is the service's
job, on the hexagon's side of the port.
