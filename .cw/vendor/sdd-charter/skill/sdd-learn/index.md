---
kind: skill
id: sdd-learn
description: Write what this conversation taught — a correction, a preference, a constraint — as a note in learning/inbox.
triggers: ["learn from the conversation"]
rationale: sdd-why-learnings-go-to-the-inbox
---

Find what this conversation taught that the next one should know: a correction
the user made, a preference they stated, a constraint that surprised. Skip what
the code, the spec or the charter already says.

Write each as `learning/inbox/<yyyy-mm-dd>-<slug>.md`: the lesson in one
sentence, then **Why:** and **How to apply:**. Never write to the agent's own
memory ([[sdd-learnings-go-to-the-inbox]]).

Finish by saying what was learned, one line per note.
