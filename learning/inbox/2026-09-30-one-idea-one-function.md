One idea gets one function, even when two callers want slightly different
subsets of it.

**Why:** `identitiesMentionedIn` (names in a body) and `identitiesNamedBy`
(those plus an agent's `tools`) were written side by side. Two names that close
did not say what the difference was, and the user's reading was that a mention
in a header and a mention in a body are both mentions. Merging them also removed
a second fault that said the same thing as the first.

**How to apply:** before adding a second function next to a near-identical one,
ask whether the domain has one word for both. If it does, write one function and
let the caller that wanted the narrower set lose its special case, or drop the
duplicate rule that needed it.
