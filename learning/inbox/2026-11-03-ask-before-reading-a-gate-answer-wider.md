When the user answers a gate with a short correction, implement it at the narrowest reading, and ask before widening a port or a shared method to do it.

**Why:** On CORE Story 37 the user's "delete the folder too if it is empty" was read as widening `delete` on `ForWritingFiles`; that change could delete the repository's own folder and changed every caller, and review failed it.

**How to apply:** At a gate, confirm the reading of a one-line answer in the next message, and keep the change inside the story's use case unless the user says otherwise.
