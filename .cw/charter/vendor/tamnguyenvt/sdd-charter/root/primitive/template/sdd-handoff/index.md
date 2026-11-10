---
kind: template
id: sdd-handoff
description: The skeleton of a handoff note, <spec folder>/handoff/<prefix>-<n>.md in lower case (core-3.md for CORE Story 3) or fix-<slug>.md — where a story In Progress or a bug fix stands, for the next session to resume from.
---

# [CORE Story 3, or fix/<slug>] — handoff

**Updated**: [yyyy-mm-dd]

## Done

- [each known failure the baseline recorded, as the check printed it; with none, leave this line out]
- [a file or a scenario built, and what proves it; the agent that ran that check, by its name and model — never a step, such as the branch, the baseline, finding the cause, a verify or a review, which is a row of the timeline]

## Remaining

- [the step to go on at, then what is left to build or check, in order]

## Decisions

- [each decision taken with the user, and its answer]

## Blockers

- [what stops the story, and who or what it waits on; none — one agent's quota limit is none while another available agent can run the check]

## Timeline

| # | When | Step | Round | Agent | Result |
|---|------|------|-------|-------|--------|
| [1] | [yyyy-mm-dd hh:mm] | [each step of the walk as it ends: branch, baseline, spec gate, scenario, finding the cause, fix, verify, review, fixing nit; a question to the user is `asked`, its answer `answer`] | [1] | [the agent that ran it, by its name and model, such as claude-opus-5 or sdd-review-agent; `user` for an answer] | [passed, failed and why, waiting on the user, or the answer in short] |
