# Spec: Vendor — sharing charters as charters of primitives

**Created**: 2026-11-17

**Updated**: 2026-11-19

**Input**: User description: "Working in a vendor repository is awkward: Claude only works right when the right charter's subfolder is opened, yet a release is made from the root. `cw build` should build every charter under `charters/` into the `.cw/out` of the repository's root, so the author opens only the root, and `/sdd-init` there works across the repository." Then: "Move `cw vendor init` here: this spec is for vendor development." Then: "`cw test` and `cw eval` must be run at the root; let a flag test one charter alone." Then: "Telling vendor from non-vendor is too complex. Keep primitive groups, each with a name of its own and none by default. No vendor folder: `cw vendor add` copies a group straight into the primitive folder as `cw vendor inject` does, but adds a `cw-vendor.json` naming the group, the source and the version installed, which makes it read-only. No owner or repository when installed: it is a group like any other. Whoever writes primitives, a user or a vendor's author, writes one format." Then: "When adding or injecting, install every other group a group includes." Then: "I do not like the name group: call it a charter, a set of primitives — charter `sdd`, inside the charter root." Then: "Refusing a primitive that holds or names a reserved id is enough."

## Overview

A repository's charter root is made of charters. Every primitive belongs to one, named by its author: `.cw/charter/<charter>/primitive/<kind>/<id>/`. A charter is also what a repository shares: another repository installs it with `cw vendor add`, which copies the whole charter, test cases and eval cases included, into its own `.cw/charter/<charter>/`, beside a `cw-vendor.json` naming where it came from. That file is the only difference between a charter installed and a charter authored: an installed charter is read-only, and is brought up to date by installing it again. So an author writes one format, whether they write for themselves or for others; a team publishing many charters keeps them as charters of one repository, and opens its root alone to author, build, test and release every one. This spec serves both: the authors of charters, and the repositories installing them.

## Clarifications

### Session 2026-11-18

- Q: Can an author install a charter they have not pushed, from its folder on disk, to try it in another repository? → A: Yes, as it is: `cw vendor add` takes a local path as git does ([CORE-FR-049](spec-core.md#core-fr-049)), installing what the source has committed, never its uncommitted changes; no story is needed.
- Q: How does a repository keep the charters it authors, shares and installs? → A: As named charters of primitives, `.cw/charter/<charter>/`, with no default charter and no vendor folder. A charter installed holds a `cw-vendor.json` naming the charter, the source and the version, and is read-only; a charter without one is the repository's own. Whoever writes primitives writes this one format.
- Q: Is moving every charter into named charters a breaking change worth a major version? → A: No: the next release is 1.4.0, its changelog naming the change and how to move.
- Q: What is a charter installed under? → A: Its name in the source by default, or the name `--as=<name>` gives; a name already held is replaced where that charter was installed from the same source, and refused otherwise, naming it and suggesting `--as`.
- Q: What of a charter that names what another charter of the source holds? → A: `cw vendor add` and `cw vendor inject` install that other charter with it.
- Q: A charter pulled in that the source itself installed from elsewhere? → A: Copied from that one source as it stands, its `cw-vendor.json` with it, naming the source and version it came from; no other source is reached.
- Q: Where are a charter's test cases and eval cases kept, and are they installed? → A: In the charter, `.cw/charter/<charter>/test/` and `eval/`; `cw vendor add` and `cw vendor inject` take the whole charter, those included. `cw test` and `cw eval` run every charter's with no flag, and one charter's with `--charter=<name>`.
- Q: What of a repository laid out the old way, primitives right under their kind and vendors under `vendor/<owner>/<repository>/<name>/`? → A: Every `cw` command refuses it, naming the move, as an older layout is refused ([CORE-FR-226](spec-core.md#core-fr-226)); `/cw-author` moves it, asking the charter name for its own primitives; a vendor laid out the old way is not moved but deleted and installed again with the latest `cw`, its source laid out as that `cw` reads.
- Q: Which charter does `cw add` write into? → A: The one `--charter=<name>` names, made where it is not there yet, and refused where it was installed; with no `--charter`, the charters held are listed to pick from at the terminal, and where none is held a name is asked; with nobody at the terminal it is refused, naming the charters held. `cw init` makes no charter.
- Q: Where does `cw vendor init` put `/vendor-release`, with no charter made by default? → A: Nowhere: `/vendor-release` is written in `cw`'s own code, and `cw build` builds it into the output of a repository `cw vendor init` set up alone ([VENDOR Story 2](#vendor-story-2---release-the-charters-with-vendor-release-priority-p2)).
- Q: What is a set of primitives called, and the whole the repository holds? → A: A charter, `sdd`; the whole is the charter root, holding every charter the repository authored or installed. The word group is no longer used.
- Q: Are skills still taken from a skills repository, as `npx skills` publishes them? → A: No: a source is read for the charters it authored alone; `--skill`, and taking skills, are dropped, with what CORE said of them.
- Q: Where is a charter kept? → A: In `.cw/charter/<charter>/`, holding its primitives under `primitive/<kind>/<id>/`, its test cases under `test/`, its eval cases under `eval/`, and, where it was installed, its `cw-vendor.json`. A charter is never named `primitive`, `test`, `eval`, `vendor` or as a kind is.
- Q: How do `cw suite add`, `cw suite edit` and `cw suite remove` name a test file's charter? → A: With `--charter=<name>` beside the file's name; with no `--charter`, they take the one charter the repository authored, and are refused naming the charters held where it authored none or more than one.
- Q: What of `test/` and `eval/` kept right under `.cw/charter/`? → A: The old layout, refused naming the move into `<charter>/test/` and `<charter>/eval/`.

### Session 2026-11-19

- Q: How does `/vendor-release` know each charter builds with the charters it includes alone? → A: No primitive of any repository may hold or name the id of what `cw` builds into a repository `cw vendor init` set up alone, so a build at the root proves it ([VENDOR-FR-028](#vendor-fr-028)).
- Q: What marks a repository `cw vendor init` set up? → A: A mark in its settings that `cw vendor init` writes.

## User Scenarios & Testing *(mandatory)*

### VENDOR Story 1 - Set a charter repository up in an empty folder (Priority: P2)

**Status**: Done

A team that wants to publish charters starts from an empty clone. Before this, they laid the repository out by hand and copied its release steps from another one. They run `cw vendor init` at a terminal: it asks the repository's name, the folder's by default, and what its charters give a team, runs `cw init` there as it always does, makes the folder a git repository where it is not one, and writes a README holding their answers, a changelog and a `.gitignore` leaving out what a build writes, and marks the repository so its build lays the `/vendor-release` skill with the script it runs, from `cw` itself. It builds, commits nothing, and says how to add each charter.

**Why this priority**: Every repository publishing charters starts the same way; one fixed command keeps each one laid out and released alike.

**Independent Test**: In an empty folder at a terminal, run `cw vendor init`, answer both questions, and confirm the folder is a git repository on `main` holding the README with the answers, the changelog and the `.gitignore`, built with `/vendor-release`, with no commit. Run it again in the same folder and confirm it is refused and the folder is left as it was.

**Acceptance Scenarios**:

1. **Given** an empty folder and someone at the terminal, **When** they run `cw vendor init` and answer its two questions, **Then** the folder is set up as a charter repository on `main`, its README filled with the answers, built, and nothing is committed ([VENDOR-FR-001](#vendor-fr-001), [VENDOR-FR-002](#vendor-fr-002), [VENDOR-SC-001](#vendor-sc-001)).
2. **Given** a git repository with no commit yet, on a branch of any name, **When** the command runs, **Then** it is set up on that branch ([VENDOR-FR-003](#vendor-fr-003)).
3. **Given** a folder holding anything but a `.git`, or a git repository with a commit, **When** the command runs, **Then** it is refused, and the folder is left as it was ([VENDOR-FR-003](#vendor-fr-003)).
4. **Given** nobody at the terminal, **When** the command runs, **Then** it stops before asking anything, writing nothing ([VENDOR-FR-004](#vendor-fr-004)).
5. **Given** the command and a flag, such as `--description`, **When** it runs, **Then** it is refused as a wrong use, writing nothing: every answer is asked ([VENDOR-FR-004](#vendor-fr-004)).
6. **Given** a name or a description left empty, or given on more than one line, **When** it is answered, **Then** it is refused, writing nothing ([VENDOR-FR-004](#vendor-fr-004)).

---

### VENDOR Story 2 - Release the charters with `/vendor-release` (Priority: P2)

**Status**: Done

An author asks their agent `/vendor-release` at the repository's root. It checks they stand on the default branch of `origin`, level with it and with a clean working tree, and that every charter the repository authors builds as it will build where it is installed: with the charters it includes and nothing else. It rewrites the README's install section from those charters, proposes the version and the changelog entry from the commits since the last tag, and, once the author confirms, commits, pushes and tags `v<version>`. What can be refused is refused before anything is written; nothing reaches `origin` before the author confirms. The command exists already; this story holds it to its scenarios, read off the charters.

**Why this priority**: A release is what other repositories install; a release made by hand differs each time and breaks the installs that follow it.

**Independent Test**: In a repository `cw vendor init` set up, with a charter `sdd` committed and pushed to an `origin`, run `/vendor-release`; confirm the README lists how to install `sdd` and its skills, the changelog holds the confirmed entry, and `v0.1.0` is on `origin`; install `sdd` in another repository with the line the README gives. Then run it on another branch, with an uncommitted change, and with a charter that does not build with the charters it includes alone, and confirm each is refused with nothing written.

**Acceptance Scenarios**:

1. **Given** the default branch of `origin`, clean and level with it, and charters that each build where they are installed, **When** the author confirms the version and the entry, **Then** the README's install section and the changelog are committed, pushed, and tagged `v<version>` on `origin` ([VENDOR-FR-005](#vendor-fr-005), [VENDOR-FR-006](#vendor-fr-006), [VENDOR-FR-008](#vendor-fr-008), [VENDOR-SC-002](#vendor-sc-002)).
2. **Given** another branch, a working tree that is not clean, no `origin`, or a branch behind or diverged from `origin`, **When** a release is asked for, **Then** it is refused naming which, and nothing is written ([VENDOR-FR-005](#vendor-fr-005)).
3. **Given** a charter that does not build with the charters it includes alone, **When** a release is asked for, **Then** it is refused naming that charter and why, and nothing is written ([VENDOR-FR-005](#vendor-fr-005), [VENDOR-SC-004](#vendor-sc-004)).
4. **Given** no tag yet, **When** a release is drafted, **Then** `0.1.0` is proposed; **Given** a last tag the changelog's top heading does not name, **Then** it stops quoting both ([VENDOR-FR-007](#vendor-fr-007)).
5. **Given** an `origin` naming no default branch, **When** a release is asked for, **Then** the author is asked which branch releases are made from, and a branch other than `origin`'s default is refused ([VENDOR-FR-005](#vendor-fr-005)).
6. **Given** a push or a tag that fails, **When** the release runs, **Then** it stops at that step saying which steps ran and the command that finishes the rest, and never force-pushes, moves or deletes a tag ([VENDOR-FR-008](#vendor-fr-008)).
7. **Given** a repository `cw vendor init` set up, **When** it is built, **Then** `/vendor-release` and its script are in its output, from `cw` itself; **Given** any other repository, **Then** they are not ([VENDOR-FR-027](#vendor-fr-027)).
8. **Given** a primitive whose id is `vendor-release` or `vendor-release-action`, or that names either, **When** the charter root is read, in a repository `cw vendor init` set up or any other, **Then** it is refused naming its file ([VENDOR-FR-028](#vendor-fr-028)).

---

### VENDOR Story 3 - Keep, author, install and test charters in the charter root (Priority: P1)

**Status**: Done

An author keeps each primitive in a charter they name: `.cw/charter/<charter>/primitive/<kind>/<id>/`, the charter's test cases under `<charter>/test/` and its eval cases under `<charter>/eval/`. A repository holds as many charters as it likes, none of them by default, and a build at the root holds every one, so the author opens the root alone, and their agent is offered every charter's primitives. A charter holding a `cw-vendor.json` was installed, and is read as a vendor's, read-only; a charter without one is the repository's own. A repository laid out the old way is refused by every command, naming the move, and `/cw-author` moves it. An author, or their agent through `/cw-author`, writes a new primitive into a charter with `cw add <kind> <id> --charter=<name>`; the charter is made where it is not there yet. With no `--charter`, `cw add` lists the charters held to pick from at the terminal, and asks a name where none is held. A charter installed is read-only, and is refused. The portal asks the charter in the form that creates a primitive. A repository installs a charter a source shares with `cw vendor add <source> --charter=<name>`: the whole charter, its test cases and eval cases included, is copied into its own `.cw/charter/<charter>/`, beside a `cw-vendor.json` naming the charter, the source and the version installed. With no `--charter`, every charter the source authored is installed. `--as=<name>` installs it under another name. Every other charter of the source it includes is installed with it, a charter the source itself installed copied as it stands, its `cw-vendor.json` with it; no other source is reached. Installing the same charter from the same source again brings it up to date; `cw vendor list` names each installed charter with its source and version, and `cw vendor remove <charter>` deletes it. `cw vendor inject <source> --charter=<name>` copies a charter, and every charter it includes, into the repository's `.cw/charter/` as `cw vendor add` does, but writes no `cw-vendor.json`: from then on the charter is the repository's own, to edit and delete. At the root, `cw test` runs every charter's test cases, and `cw eval` every charter's eval cases; `--charter=<name>` runs one charter's alone, an installed charter's as an authored one's, so a repository proves a charter it installed still holds there.

**Why this priority**: Every other story of this spec reads and writes charters; until the charter root is made of them, authored into them, installed and tested by them, nothing can be shared as one.

**Independent Test**: In a repository holding charters `sdd` and `baseline`, a skill in each, and a charter `grill` holding a `cw-vendor.json`, run `cw build` and confirm the three skills are offered to the agent, `grill`'s as a vendor's; edit `grill`'s skill with `cw edit` and confirm it is refused as read-only. Move a primitive to `primitive/<kind>/<id>/` and confirm `cw build` and `cw list` are refused, naming the move; have `/cw-author` move a repository laid out the old way, and confirm it asks the charter name and leaves every primitive in a charter. In a repository holding no charter, run `cw add guide no-any` at a terminal and answer `team`; confirm the guide is in `.cw/charter/team/primitive/guide/no-any/`. Run `cw add guide no-mocks --charter=review` and confirm a new charter `review` holds it. Run `cw add guide x` and confirm `team` and `review` are listed to pick from; run it with nobody at the terminal and confirm it is refused naming both. Run it with `--charter` naming an installed charter and confirm it is refused, nothing written. Create a primitive in the portal and confirm the form asks the charter. Make a source holding charters `sdd`, which names an id of `baseline`, `baseline`, and `grill` holding a `cw-vendor.json` of `mattpocock/skills`; run `cw vendor add <source> --charter=sdd` and confirm `sdd` and `baseline` are in `.cw/charter/`, each with its test and eval cases and a `cw-vendor.json` naming the source and version, and `grill` is not. Run it with no `--charter` and confirm `sdd` and `baseline` are installed and `grill` too only where an installed charter includes it, with `mattpocock/skills` in its `cw-vendor.json`. Install `sdd` again `--as=sdd-next`; confirm it is refused naming both files of an id the two would share. Install a charter whose name an authored charter holds, and confirm it is refused suggesting `--as`. Run `cw vendor inject <source> --charter=sdd` and confirm `sdd` and the charters it includes are in `.cw/charter/` with no `cw-vendor.json`, and `cw edit` changes them. In a repository holding charters `sdd` and `baseline`, each with test cases and eval cases, run `cw test` and confirm both charters' cases run; run `cw test --charter=sdd` and confirm only `sdd`'s run. Do the same with `cw eval`. Run with `--charter=nothing-here` and confirm it is refused naming the charters held.

**Acceptance Scenarios**:

1. **Given** charters `sdd` and `baseline`, **When** the root is built, **Then** the compiled output and the agent files of every agent chosen hold the primitives of both, and the agent is offered each charter's skills ([VENDOR-FR-009](#vendor-fr-009), [VENDOR-SC-003](#vendor-sc-003)).
2. **Given** a charter holding a `cw-vendor.json`, **When** the charter root is read, **Then** its primitives are a vendor's, read-only, and `cw edit` and `cw remove` refuse them as installed ([VENDOR-FR-010](#vendor-fr-010)).
3. **Given** one id held in two charters, **When** the charter root is read, **Then** it is refused naming both files, as an id names one primitive in the whole charter root ([VENDOR-FR-009](#vendor-fr-009)).
4. **Given** a primitive right under its kind's folder in `.cw/charter/` or in `.cw/charter/primitive/`, test cases or eval cases right under `.cw/charter/`, or a vendor under `vendor/<owner>/<repository>/<name>/`, **When** any `cw` command runs, **Then** it is refused, naming the move into a named charter, and nothing is written ([VENDOR-FR-011](#vendor-fr-011)).
5. **Given** a repository laid out the old way, **When** `/cw-author` is asked to move it, **Then** it asks the charter name for the repository's own primitives, moves them and their test and eval cases into that charter, says to delete each vendor and install it again with the latest `cw`, and once that is done the repository builds ([VENDOR-FR-012](#vendor-fr-012)).
6. **Given** a repository set up with `cw init` or `cw vendor init`, **When** it is read, **Then** it holds no charter, and `/vendor-release` is in no charter of it ([VENDOR-FR-013](#vendor-fr-013)).
7. **Given** a folder right under `.cw/charter/` named as a kind is, or `primitive`, `test`, `eval` or `vendor`, **When** the charter root is read, **Then** it is refused as the old layout, naming the move ([VENDOR-FR-011](#vendor-fr-011)).
8. **Given** `--charter=<name>` naming a charter the repository authored, **When** `cw add` runs, **Then** the primitive is written into it, and nothing else is written ([VENDOR-FR-014](#vendor-fr-014)).
9. **Given** `--charter=<name>` naming no charter yet, **When** `cw add` runs, **Then** the charter is made holding the primitive ([VENDOR-FR-014](#vendor-fr-014)).
10. **Given** `--charter=<name>` naming an installed charter, **When** `cw add` runs, **Then** it is refused as read-only, and nothing is written ([VENDOR-FR-014](#vendor-fr-014)).
11. **Given** no `--charter` and someone at the terminal, **When** `cw add` runs, **Then** the charters the repository authored are listed to pick from, or, where it holds none, a charter name is asked ([VENDOR-FR-015](#vendor-fr-015)).
12. **Given** no `--charter` and nobody at the terminal, or `--json`, **When** `cw add` runs, **Then** it is refused, naming the charters held, and nothing is written ([VENDOR-FR-015](#vendor-fr-015)).
13. **Given** the portal, **When** the author creates a primitive, **Then** the form asks its charter among those the repository authored, or a new one ([VENDOR-FR-016](#vendor-fr-016)).
14. **Given** a source authoring `sdd`, **When** `cw vendor add` runs with `--charter=sdd`, **Then** `.cw/charter/sdd/` holds the whole charter, its test and eval cases included, and a `cw-vendor.json` naming `sdd`, the source and the version, left unstaged, and nothing is built ([VENDOR-FR-017](#vendor-fr-017), [VENDOR-SC-006](#vendor-sc-006)).
15. **Given** no `--charter`, **When** `cw vendor add` runs, **Then** every charter the source authored is installed, and no charter the source itself installed unless one installed includes it ([VENDOR-FR-017](#vendor-fr-017), [VENDOR-FR-019](#vendor-fr-019)).
16. **Given** a charter naming an id another charter of the source holds, **When** it is installed, **Then** that other charter is installed with it, and so on for what that one names ([VENDOR-FR-018](#vendor-fr-018)).
17. **Given** a charter included that the source itself installed, **When** it is installed, **Then** it is copied as it stands, its `cw-vendor.json` written on this machine naming the source asked and the version, as for any charter installed, never the source's own, and no other source is reached ([VENDOR-FR-019](#vendor-fr-019)).
18. **Given** `--as=<name>`, **When** the charter is installed, **Then** it is held under that name, its `cw-vendor.json` naming the charter it was in the source ([VENDOR-FR-020](#vendor-fr-020)).
19. **Given** a name already held by a charter installed from the same source, **When** the charter is installed again, **Then** it is replaced whole by the version asked for; **Given** one held by a charter authored or installed from another source, **Then** it is refused, naming it and suggesting `--as`, and nothing is written ([VENDOR-FR-020](#vendor-fr-020)).
20. **Given** `--charter` naming a charter the source does not author, **When** the command runs, **Then** nothing is installed, and the charters it authors are named ([VENDOR-FR-017](#vendor-fr-017)).
21. **Given** installed charters, **When** `cw vendor list` runs, **Then** each is named with its source and version; **When** `cw vendor remove <charter>` runs, **Then** that charter is deleted whole, and an authored charter named is refused ([VENDOR-FR-021](#vendor-fr-021)).
22. **Given** a source authoring `sdd`, which includes `baseline`, **When** `cw vendor inject` runs with `--charter=sdd`, **Then** `sdd` and `baseline` are in `.cw/charter/`, whole, with no `cw-vendor.json`, and editable as any charter the repository authored ([VENDOR-FR-022](#vendor-fr-022)).
23. **Given** a charter to inject whose name, or one of whose ids, the repository already holds, **When** the command runs, **Then** it is refused naming both, and nothing is written ([VENDOR-FR-022](#vendor-fr-022)).
24. **Given** two charters with test cases, **When** `cw test` runs with no `--charter`, **Then** every case of both runs ([VENDOR-FR-024](#vendor-fr-024)).
25. **Given** the same, **When** `cw test --charter=sdd` runs, **Then** only `sdd`'s cases run ([VENDOR-FR-024](#vendor-fr-024)).
26. **Given** two charters with eval cases, **When** `cw eval` runs with no `--charter`, and then with `--charter=sdd`, **Then** it runs every case, and then `sdd`'s alone, each at the repository's root ([VENDOR-FR-025](#vendor-fr-025)).
27. **Given** `--charter` naming no charter held, **When** `cw test` or `cw eval` runs, **Then** it is refused, naming the charters held, and nothing runs ([VENDOR-FR-026](#vendor-fr-026)).
28. **Given** the portal and charters `team` and `other`, **When** `team`'s primitives are asked for, **Then** only `team`'s are listed; **When** a name no charter is held under is asked for, **Then** it is refused naming those held; **When** a new test file is written into `other`, **Then** it lands in `other/test/` ([VENDOR-FR-016](#vendor-fr-016)).

---

### VENDOR Story 5 - Quality cross-check of CORE Story 72, VENDOR Story 1, VENDOR Story 2, VENDOR Story 3 (Priority: P3)

**Status**: Todo

Once [CORE Story 72](spec-core.md#core-story-72---read-the-charter-grouped-by-kind-in-cw-list-priority-p2), [VENDOR Story 1](#vendor-story-1---set-a-charter-repository-up-in-an-empty-folder-priority-p2), [VENDOR Story 2](#vendor-story-2---release-the-charters-with-vendor-release-priority-p2) and [VENDOR Story 3](#vendor-story-3---keep-author-install-and-test-charters-in-the-charter-root-priority-p1) are `Done`, the code and every spec are checked against the checklist of the quality document, and each violation becomes a story.

**Why this priority**: Four stories landed one at a time can each pass their review and still disagree with the specs or with each other.

**Independent Test**: Run /sdd-quality and confirm it reports a grade and hands each violation on as a story.

**Acceptance Scenarios**:

1. **Given** [CORE Story 72](spec-core.md#core-story-72---read-the-charter-grouped-by-kind-in-cw-list-priority-p2), [VENDOR Story 1](#vendor-story-1---set-a-charter-repository-up-in-an-empty-folder-priority-p2), [VENDOR Story 2](#vendor-story-2---release-the-charters-with-vendor-release-priority-p2) and [VENDOR Story 3](#vendor-story-3---keep-author-install-and-test-charters-in-the-charter-root-priority-p1) `Done`, **When** /sdd-quality runs, **Then** it checks the code and every spec against the checklist of `quality.md`, and each violation it reports becomes a story ([VENDOR-SC-005](#vendor-sc-005)).

---

### Edge Cases

- `cw vendor init` stopped after `cw init` ran — the folder is left half set up, and it says to empty it and run again ([VENDOR-FR-002](#vendor-fr-002)).
- git is not installed — `cw vendor init` stops after `cw init`, saying to install it ([VENDOR-FR-002](#vendor-fr-002)).
- A charter naming an id that neither it nor any charter of the source holds — refused by the build of the source, as any name nothing holds ([VENDOR-FR-009](#vendor-fr-009)).
- Two charters of a source including each other — each installed once ([VENDOR-FR-018](#vendor-fr-018)).
- A charter installed `--as` another name, and then installed again under its own — two charters holding one id: refused naming both files, nothing written ([VENDOR-FR-020](#vendor-fr-020)).
- A `cw-vendor.json` that cannot be read — the charter is refused, naming the file, as a primitive that does not read is ([VENDOR-FR-010](#vendor-fr-010)).
- An installed charter edited by hand — overwritten whole by the next install of it ([VENDOR-FR-020](#vendor-fr-020)).

## Requirements *(mandatory)*

### Functional Requirements

**Setting a charter repository up**

- <a id="vendor-fr-001"></a>**VENDOR-FR-001**: `cw vendor init` MUST set a charter repository up in the folder it runs in: a README holding the repository's name and description, a changelog, a `.gitignore` leaving out what a build writes, and the mark in its settings that has its build lay `/vendor-release` with the script it runs ([VENDOR-FR-027](#vendor-fr-027)).
- <a id="vendor-fr-002"></a>**VENDOR-FR-002**: It MUST run `cw init` in that folder, asking the agents as `cw init` always does, make the folder a git repository on `main` where it holds no `.git`, then build, and MUST commit nothing; stopped once `cw init` ran, it MUST say the folder is left half set up, and to empty it and run again.
- <a id="vendor-fr-003"></a>**VENDOR-FR-003**: It MUST refuse a folder holding anything but a `.git`, or a git repository with a commit, leaving it as it was; a git repository with no commit MUST be set up on the branch it is on.
- <a id="vendor-fr-004"></a>**VENDOR-FR-004**: It MUST ask every answer at the terminal, the name defaulting to the folder's, refuse any flag, writing nothing, stop before asking where nobody is at the terminal, and refuse an empty answer or one on more than one line, writing nothing.

**Releasing**

- <a id="vendor-fr-005"></a>**VENDOR-FR-005**: `/vendor-release` MUST refuse, writing nothing, unless it stands on the default branch of `origin`, or the branch the author confirms where `origin` names none, with a clean working tree, neither behind nor diverged from `origin`, and every charter the repository authored building with the charters it includes alone; each refusal MUST name its cause.
- <a id="vendor-fr-006"></a>**VENDOR-FR-006**: It MUST rewrite only the README's install section, from the charters the repository authored: the line installing every charter, then for each charter the line installing it alone and its skills with their descriptions, leaving out cw's own skills.
- <a id="vendor-fr-007"></a>**VENDOR-FR-007**: It MUST propose `0.1.0` where no release was tagged, else a version and a changelog entry from the commits since the last tag, and stop where the changelog's top heading does not name that tag.
- <a id="vendor-fr-008"></a>**VENDOR-FR-008**: Only once the author confirms MUST it commit, push and tag `v<version>` on `origin`; it MUST stop at the first step that fails, saying which steps ran and how to finish the rest, and MUST never force-push, move or delete a tag.
- <a id="vendor-fr-027"></a>**VENDOR-FR-027**: `/vendor-release` and its script MUST be primitives of `cw`'s own, built into the output of a repository `cw vendor init` set up, marked so in its settings, and of no other repository.
- <a id="vendor-fr-028"></a>**VENDOR-FR-028**: A primitive of any repository MUST NOT hold the id of a primitive `cw` builds into a repository `cw vendor init` set up alone, nor name one through its body, its mixins, its rationale, an agent's tools or a sensor's run; each MUST be refused naming its file. So a charter that builds at the root of the repository releasing it builds with the charters it includes alone ([VENDOR-FR-005](#vendor-fr-005)).

**Charters**

- <a id="vendor-fr-009"></a>**VENDOR-FR-009**: Every primitive MUST belong to one charter named by its author, `.cw/charter/<charter>/primitive/<kind>/<id>/`, its test cases under `<charter>/test/` and its eval cases under `<charter>/eval/`, a command naming a test file naming its charter with `--charter=<name>`; a charter root MAY hold any number of charters, and a build MUST hold every one. An id MUST name one primitive across every charter.
- <a id="vendor-fr-010"></a>**VENDOR-FR-010**: A charter holding a `cw-vendor.json` MUST be read as installed, its primitives a vendor's, read-only; one without MUST be read as the repository's own. A `cw-vendor.json` that does not read MUST be refused, naming the file.
- <a id="vendor-fr-011"></a>**VENDOR-FR-011**: A folder right under `.cw/charter/` named as a kind is, or `primitive`, `test`, `eval` or `vendor`, MUST be refused by every command, writing nothing, naming the move into a named charter.
- <a id="vendor-fr-012"></a>**VENDOR-FR-012**: `/cw-author` MUST move a repository laid out the old way: asking the charter name for its own primitives and moving them, their test cases and eval cases there, and saying to delete each vendor under `.cw/charter/vendor/` and install it again with the latest `cw`, never moving one itself.
- <a id="vendor-fr-013"></a>**VENDOR-FR-013**: `cw init` and `cw vendor init` MUST make no charter; `/vendor-release` and the script it runs MUST never be written into a charter ([VENDOR-FR-027](#vendor-fr-027)).

**Authoring into a charter**

- <a id="vendor-fr-014"></a>**VENDOR-FR-014**: `cw add` MUST take `--charter=<name>` and write the primitive into that charter, making it where it is not held; a charter installed MUST be refused as read-only, writing nothing.
- <a id="vendor-fr-015"></a>**VENDOR-FR-015**: With no `--charter`, `cw add` MUST, at a terminal, list the charters the repository authored to pick from, or ask a charter name where it holds none; with nobody at the terminal, or with `--json`, it MUST be refused, naming the charters held, writing nothing.
- <a id="vendor-fr-016"></a>**VENDOR-FR-016**: The portal's form creating a primitive, and its new test file, MUST ask its charter, among those the repository authored or a new one; the portal MUST list one charter's primitives by the charter's name, refusing a name no charter is held under, naming those held. `root` names the charter root there, and so names no charter.

**Installing a charter**

- <a id="vendor-fr-017"></a>**VENDOR-FR-017**: `cw vendor add <source>` MUST install the charters `--charter=<name>` names, or every charter the source authored where none is named, each copied whole, its test and eval cases included, into `.cw/charter/<charter>/` with a `cw-vendor.json` naming the charter in the source, the source as typed and the version installed: the version asked for, or the id of the commit fetched where none was asked; a name the source does not author MUST install nothing, naming the charters it authors.
- <a id="vendor-fr-018"></a>**VENDOR-FR-018**: Every charter of the source that a charter installed names an id of, through its body, its mixins, its rationale, an agent's tools or a sensor's run, MUST be installed with it, and so on for what that one names, each once.
- <a id="vendor-fr-019"></a>**VENDOR-FR-019**: A charter the source itself installed MUST be taken only where a charter installed includes it, copied as it stands; its `cw-vendor.json` MUST be written by the machine installing it, as for any charter installed, never copied from the source; no source but the one asked MUST be reached.
- <a id="vendor-fr-020"></a>**VENDOR-FR-020**: `--as=<name>` MUST install the charter under that name. A name held by a charter installed from the same source MUST be replaced whole; one held by a charter authored or installed from another source MUST be refused, naming it and suggesting `--as`, writing nothing.
- <a id="vendor-fr-021"></a>**VENDOR-FR-021**: `cw vendor list` MUST name each installed charter with its source and version; `cw vendor remove <charter>` MUST delete an installed charter whole, and refuse a charter the repository authored.

**Injecting a charter**

- <a id="vendor-fr-022"></a>**VENDOR-FR-022**: `cw vendor inject <source>` MUST copy the charters named, and those they include, as `cw vendor add` does, but write no `cw-vendor.json`, leaving them the repository's own; a charter name or an id already held MUST be refused naming both, writing nothing.

**Testing a charter**

- <a id="vendor-fr-024"></a>**VENDOR-FR-024**: `cw test` MUST run every charter's test cases where no `--charter` is given, and with `--charter=<name>` that charter's alone, installed or authored.
- <a id="vendor-fr-025"></a>**VENDOR-FR-025**: `cw eval` MUST do the same with eval cases, every case at the repository's root.
- <a id="vendor-fr-026"></a>**VENDOR-FR-026**: `cw test` and `cw eval` MUST refuse a `--charter` naming no charter held, naming the charters held, and running nothing.

### Key Entities

- **Charter**: a named set of primitives with their test cases and eval cases, `.cw/charter/<charter>/`; what a charter is made of, and what is shared.
- **Installed charter**: a charter holding a `cw-vendor.json` — the charter's name in its source, the source and the version — read-only, brought up to date by installing it again.
- **Authored charter**: a charter with no `cw-vendor.json`: the repository's own, editable, and what it shares with others.
- **Source**: a repository whose authored charters are installed elsewhere; its installed charters are taken only as included by an authored one.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- <a id="vendor-sc-001"></a>**VENDOR-SC-001**: A charter repository is set up from an empty folder with one command and two answers.
- <a id="vendor-sc-002"></a>**VENDOR-SC-002**: A release is made with one request to the agent and one confirmation, and a charter it releases installs in another repository with the line its README gives.
- <a id="vendor-sc-003"></a>**VENDOR-SC-003**: An author authors, builds, tests and releases every charter of a repository with its root the only folder opened: zero changes of folder.
- <a id="vendor-sc-004"></a>**VENDOR-SC-004**: Every charter a release publishes builds with the charters it includes alone.
- <a id="vendor-sc-005"></a>**VENDOR-SC-005**: Each quality cross-check grades the product and hands every violation on as a story.
- <a id="vendor-sc-006"></a>**VENDOR-SC-006**: An installed charter and an authored charter differ by one file, `cw-vendor.json`; nothing else about its layout tells them apart.

## Assumptions

- The agents a build writes for are those chosen with `cw init`.
- What a build writes is never committed; an installed charter is committed as the repository's other files are.
- Charter names follow the rules of an id, and none is a kind's name, `primitive`, `test`, `eval`, `vendor` or `root`.

## Out of Scope

- A default charter.
- A folder for vendors apart from the charters.
- Reaching any source but the one asked, to install what a charter includes.
- Taking skills from a skills repository, as `npx skills` publishes them.
- Moving a primitive from one charter to another.
