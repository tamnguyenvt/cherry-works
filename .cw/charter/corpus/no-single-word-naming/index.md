---
kind: corpus
id: no-single-word-naming
description: Why a variable is named after the type it holds, and how to name a call's result.
---
**Why:** the type name is what a reader looks up. A situational name such as
`done`, `result` or `it` makes the reader go and find the function to learn
what the value is.

**How to apply:** when binding a call's result, take the returned type's name
in camelCase. Add a qualifier only when two values of one type sit side by side
