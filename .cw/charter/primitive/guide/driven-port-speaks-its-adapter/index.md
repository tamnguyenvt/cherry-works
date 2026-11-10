---
kind: guide
id: driven-port-speaks-its-adapter
description: Name what crosses a driven port after what its adapter deals in, never after a domain concept.
globs: ["src/module/*/app/port/out/**"]
rationale: why-driven-port-speaks-its-adapter
---

A driven port speaks the language of the adapter behind it, not the domain's.
Name every type, method and parameter that crosses it after what that adapter
deals in: version control knows commits and branches, not releases; a file
store knows files and folders, not invoices; a mail server knows messages and
recipients, not customers. A storage port is one exception: it keeps one
part of a repository's state and speaks the domain's own models both ways,
each kept thing by its layer, kind and id or name, never by where it sits.
What is kept comes as it is kept (`RawPrimitive`), and
validating it into the model is the domain's factories' job, on the
hexagon's side of the port; what a build laid is read back through the
same store, each part by its host, the part it plays, its kind and its id.
The output ports are the other: `ForManagingLocalOutput` is handed the
domain's compiled output (`CharterOutput`), each part known by its path
inside the output (`OutputPart`), and decides where the output lands; and
`ForManagingLocalAgentOutput`, one per agent, is handed the charter and that output
and decides what the agent reads of it and where, since where a host reads
a file is that host's layout and never the engine's (CORE-FR-220,
CORE-FR-221).
