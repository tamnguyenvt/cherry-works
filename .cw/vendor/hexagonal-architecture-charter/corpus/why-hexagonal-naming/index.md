---
kind: corpus
id: why-hexagonal-naming
description: Why each part of a hexagon is named by its role, why faults and not errors, and why a fault is internal unless it says otherwise.
---

**Why:** a hexagon is read far more than it is written, and most reads start
from a name — a file in a tree, a type in a stack trace. A name that says its
role (`For…` a port, the port's noun a use case, `…Service` a service,
`…Fault` a fault) tells the reader which layer they are in, and so what that
code may import and decide, before a line of it is read. The naming of use
cases after their ports comes from Alistair Cockburn's ports and adapters
(`ForParkingCars`, `CarParker`); verb-first services from Tom Hombergs'
*BuckPal* (`SendMoneyService`).

Services are a layer of their own because a use case should read like its
story: when logic strings several models together, or two use cases follow
it, keeping it in one of them makes that one heavy and the other a copy.

DTOs as cherry-works writes them — one `dto(type, data)` for every one, each
`{ type, data }`, schemas in zod — because a DTO is the contract with
whatever calls in, and a contract is worth checking at both ends: the type
the hexagon answers with and the schema a client parses by are the same
object, and `type` tells two DTOs apart without guessing from their fields.

Faults and not errors, after cherry-works: a fault is a value as much as an
exception — collected, sent, shown — and its base constructor is the one
place that asks for what every report of it owes. There are only two kinds:
the person's, which they can act on, and the system's own, which tells how
it is set up and must never reach a client. Internal is the default because
forgetting to mark a fault then hides too much rather than too little; the
use case is where an internal fault is cooked into words a client may read,
since it is the last place that still knows which kind it holds.

**How to apply:** before naming a new file, find its row in
[[hexagonal-naming]]; before raising an error, find the fault file of the
layer raising it and add the fault there.
