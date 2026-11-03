The agent settles each `nit` a review leaves without asking: it fixes the nit at once when the fix makes the code more correct and harms nothing, or when leaving it could make a test fail; any other nit goes into the handoff note to handle later. Before putting any `nit` or `q` to the user, the agent checks `learning/inbox/` for a note that already answers it.

**Applied**: 7 — add 1 each time this note decides a `nit` or a `q`; once the count is high enough, the reviewer knows it is time to turn the note into a guide.

**Why:** On 2026-11-03 the user said "nit thì tôi cho bạn tự quyết định", although `manifest.md` sets **Review** to strict. Later the same day, at the hand-over of CORE Story 38, the agent put three points to the user. One was a nit whose fix is a single argument and changes nothing else: `{ ignoreBOM: true }`, so the in-memory test adapter keeps a leading BOM the way the disk adapter does. The user said a fix like that is made at once, without asking, and that a note already in the inbox should be read before a question is asked.

**How to apply:**
- For each `nit`, ask two things. Does the fix make the code more correct and harm nothing? Could leaving it make a test fail? If either answer is yes, fix it, then verify and review again as for any change. If both are no, write it under Remaining in the handoff note and leave it out of the hand-over.
- For each `q`, and for any nit still open, search `learning/inbox/` first. Where a note answers it, apply that note, and say which note in the handoff note. Ask the user only what no note answers.
- Each time this note decides a nit or a q, add 1 to **Applied**.
- Until `manifest.md` changes, ask the user whether its **Review** line should say this.
