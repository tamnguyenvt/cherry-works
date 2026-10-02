---
kind: skill
id: sdd-finish
description: Finish the story or phase you stand on exactly as manifest.md says — merge, squash-merge or pull request, into the branch it names — then clean its worktree up.
triggers: ["finish the story", "finish the task", "merge branch", "finish the phase"]
rationale: sdd-concept
---

Read `<spec folder>/manifest.md` (the folder is in `.sdd/settings.json`). Do
what its **Finishing** section says and nothing it does not; if it says
nothing about the case at hand, ask, and offer to write the answer into it.

1. **Check** — the working tree is clean, the story's status is `Done`, and
   the checks pass (/sdd-verify). Refuse otherwise, saying what is missing.
2. **Story** — on a story branch, do what **Story** says:
   - merge or squash-merge into its target; a squash's message is the
     story's id and title, `CORE Story 4: Reset a password`, in the
     **Message** convention;
   - or push the branch and open a pull request into the target, with the
     story's id, title and acceptance scenarios in its body.

   Add a `Co-Authored-By` line only where **Co-Authored-By** says yes.
3. **Phase** — on a phase branch, do what **Phase** says: fast-forward,
   merge, or open a pull request. Where a fast-forward is impossible, stop and
   say why.
4. **Clean up** — with **Worktree** per story, remove the story's worktree
   once its branch is merged; delete a merged story branch only if the user
   says so.

Say which branch went where, the resulting commit or pull request, and the
next ready story (`ready` of [[sdd-specs]]).
