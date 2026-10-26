---
kind: guide
id: no-arbitrary-function-split
description: Read when you are about to write a helper function or split a function into smaller ones.
---

Don't name a function with just a verb or the past tense of a verb. When you
want to, most of the time the code belongs inline in the parent function.

Never split a function into many smaller ones that nothing else reuses. It is
the big function that gets reused; the smaller pieces are only the logic inside
it.

A function's name must be tied to a piece of business logic. If it is not,
write the code inline or use a library, and where a helper is unavoidable, put
it in the closest `helper.ts`.
