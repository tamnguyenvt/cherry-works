---
kind: guide
id: no-single-word-naming
description: rule for name a function or variable
rationale: corpus:no-single-word-naming
---

Never name a function or variable with a single vague word or generic verb like `known`, `it`, `a`, or `merged`; use descriptive names that clearly state what it holds or does."
If you need to do, try to name as returned type of function 

Name a local variable after the type of the value it holds: `const planSummary =
previewPlan(...)` because `previewPlan` returns a `PlanSummary`, never `const
done = ...`.

Only rename code you are already touching.
