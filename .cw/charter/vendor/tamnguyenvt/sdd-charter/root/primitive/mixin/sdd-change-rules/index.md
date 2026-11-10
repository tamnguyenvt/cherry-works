---
kind: mixin
id: sdd-change-rules
description: "What every change to code walked by a playbook of the spec set is held to: the manifest first, and a change handed over only once checked."
---

## Every change

Read `.sdd/settings.json` for the spec folder, and `manifest.md` there: it
decides the worktree, the order, the branches — the development branch
`develop` where it names none — and how changes are committed. Do as it says;
where it says nothing about the case at hand, ask.

- **Handed over only once checked.** The user is handed a change only after
  /sdd-verify and /sdd-review have passed. With **Review** quick in the
  manifest, a `nit` is not acted on but written to the handoff note, and a `q`
  whose answer changes no FR, scenario or out of scope and touches only the
  changed files is settled, what was chosen written there, and an edit it
  brings is checked the same way again before the hand-over; neither is said
  in the chat. With **Review** auto, in either form, each `nit` is fixed
  within the reach **Review** sets, then the change is verified and reviewed
  again; each `nit` that review leaves is fixed the same way, for three rounds
  of fixing at most, and each `nit` left after the third is written to the
  handoff note, not fixed. Each `nit` fixed has its fix and its round of
  fixing written to the handoff note, and is never asked of the user; a `nit`
  written there unfixed is not said in the chat. With **Review**
  `auto, changed files only`, a `nit` whose fix needs a file the change did
  not touch is not fixed but written to the handoff note; with auto alone, it
  is fixed wherever its fix reaches. In both, a `q` is handled as with
  **Review** quick. With **Review** strict, or no answer, every `nit` and `q`
  is left for the user. With **Conversation** short, open on each `nit` and
  `q` left for the user to decide, and the chat says nothing of a `nit` fixed;
  with it detailed, say what changed, each `nit` fixed among what changed, and
  what each check showed, then each `nit` and `q` left for the user. Either
  way, name each known failure the baseline recorded, where it recorded any.
  Each change the user asks for then is made and checked the same way again
  before it is handed back; a requested change is never reported done on the
  edit alone.
