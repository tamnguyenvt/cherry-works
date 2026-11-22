# Spec: Charters — authoring, pulling and releasing them

**Created**: 2026-11-17

**Updated**: 2026-11-20

**Input**: User description: "Working in a vendor repository is awkward: Claude only works right when the right charter's subfolder is opened, yet a release is made from the root. `cw build` should build every charter under `charters/` into the `.cw/out` of the repository's root, so the author opens only the root, and `/sdd-init` there works across the repository." Then: "Move `cw vendor init` here: this spec is for vendor development." Then: "`cw test` and `cw eval` must be run at the root; let a flag test one charter alone." Then: "Telling vendor from non-vendor is too complex. Keep primitive groups, each with a name of its own and none by default. No vendor folder: `cw vendor add` copies a group straight into the primitive folder as `cw vendor inject` does, but adds a `cw-vendor.json` naming the group, the source and the version installed, which makes it read-only. No owner or repository when installed: it is a group like any other. Whoever writes primitives, a user or a vendor's author, writes one format." Then: "When adding or injecting, install every other group a group includes." Then: "I do not like the name group: call it a charter, a set of primitives — charter `sdd`, inside the charter root." Then: "Refusing a primitive that holds or names a reserved id is enough." Then: "Drop `vendor: true`. `cw charter` lists the charters held, telling which were installed; `cw charter create` makes a charter's folder; `cw charter pull` takes a charter from a repository, as `cw vendor add` does, and `--fork` as `cw vendor inject` does; `cw charter remove` deletes any charter, installed or authored; `cw charter update` pulls again from the current `cw-package.json`, which `cw-vendor.json` becomes. Drop the notion of a vendor: there is a charter source and a charter installed." Then: "Fix everything the quality pass of 2026-11-19 found."

## Overview

A repository's charter root is made of the charters it keeps, beside the builtin layer `cw` brings. Every primitive a repository keeps belongs to one, named by its author: `.cw/charter/<charter>/primitive/<kind>/<id>/`. A charter is also what a repository shares: another repository pulls it from its charter source with `cw charter pull`, which copies the whole charter, test cases and eval cases included, into its own `.cw/charter/<charter>/`, beside a `cw-package.json` naming where it came from. That file is the only difference between a charter installed and a charter authored: an installed charter is read-only, and is brought up to date with `cw charter update`. `cw charter` names every charter held, installed or authored; `cw charter create` makes one, and `cw charter remove` deletes one. Nothing sets a repository apart as one that releases charters: any repository authoring one releases it with `/charter-release`. So an author writes one format, whether they write for themselves or for others; a team publishing many charters keeps them as charters of one repository, and opens its root alone to author, build, test and release every one. This spec serves both: the authors of charters, and the repositories installing them.

## Clarifications

### Session 2026-11-18

- Q: Can an author install a charter they have not pushed, from its folder on disk, to try it in another repository? → A: Yes, as it is: `cw vendor add` (now `cw charter pull`) takes a local path as git does ([CORE-FR-049](spec-core.md#core-fr-049)), installing what the source has committed, never its uncommitted changes; no story is needed.
- Q: How does a repository keep the charters it authors, shares and installs? → A: As named charters of primitives, `.cw/charter/<charter>/`, with no default charter and no folder for installed charters apart from the others. A charter installed holds a `cw-vendor.json` (now `cw-package.json`) naming the charter, the source and the version, and is read-only; a charter without one is the repository's own. Whoever writes primitives writes this one format.
- Q: Is moving every charter into named charters a breaking change worth a major version? → A: No: the next release is 1.4.0, `cw`'s changelog of 1.4.0 naming the change and how to move.
- Q: What is a charter installed under? → A: Its name in the source by default, or the name `--as=<name>` gives; a name already held is replaced where that charter was installed from the same source, and refused otherwise, naming it and suggesting `--as`.
- Q: What of a charter that names what another charter of the source holds? → A: `cw vendor add` and `cw vendor inject` (now `cw charter pull`, with or without `--fork`) install that other charter with it.
- Q: A charter pulled in that the source itself installed from elsewhere? → A: Copied from that one source as it stands, its `cw-vendor.json` (now `cw-package.json`) written on this machine naming the source asked and the version installed, never the source's own; no other source is reached.
- Q: Where are a charter's test cases and eval cases kept, and are they installed? → A: In the charter, `.cw/charter/<charter>/test/` and `eval/`; `cw vendor add` and `cw vendor inject` (now `cw charter pull`, with or without `--fork`) take the whole charter, those included. `cw test` and `cw eval` run every charter's with no flag, and one charter's with `--charter=<name>`.
- Q: What of a repository laid out the old way, primitives right under their kind and installed charters under `.cw/vendor/` or `.cw/charter/vendor/<owner>/<repository>/<name>/`? → A: Every `cw` command refuses it, naming the move, as an older layout is refused ([CORE-FR-226](spec-core.md#core-fr-226)); `/cw-author` moves it, asking the charter name for its own primitives; an installed charter laid out the old way is not moved but deleted and installed again with a `cw` of 1.4.0 or later, its source laid out as that `cw` reads.
- Q: Which charter does `cw add` write into? → A: The one `--charter=<name>` names, made where it is not there yet, and refused where it was installed; with no `--charter`, the charters the repository authored are listed to pick from at the terminal, and where none is held a name is asked; with nobody at the terminal it is refused, naming the charters held. `cw init` makes no charter.
- Q: Where does `cw vendor init` put `/vendor-release`, with no charter made by default? → A: Nowhere: `/vendor-release` (now `/charter-release`) is written in `cw`'s own code, and `cw build` builds it into the output of a repository `cw vendor init` set up alone, and, since 2026-11-19, of every repository ([VENDOR Story 2](#vendor-story-2---release-the-charters-with-charter-release-priority-p2)).
- Q: What is a set of primitives called, and the whole the repository holds? → A: A charter, `sdd`; the whole is the charter root, holding every charter the repository authored or installed. The word group is no longer used.
- Q: Are skills still taken from a skills repository, as `npx skills` publishes them? → A: No: a source is read for its charters alone — since 2026-11-19 those it installed as those it authored ([VENDOR-FR-019](#vendor-fr-019)); `--skill`, and taking skills, are dropped, with what CORE said of them.
- Q: Where is a charter kept? → A: In `.cw/charter/<charter>/`, holding its primitives under `primitive/<kind>/<id>/`, its test cases under `test/`, its eval cases under `eval/`, and, where it was installed, its `cw-vendor.json` (now `cw-package.json`). A charter is never named `primitive`, `test`, `eval`, `vendor`, `root` or as a kind is (since 2026-11-20, `root` only where a charter is made or pulled, with or without `--fork`).
- Q: How do `cw suite add`, `cw suite edit` and `cw suite remove` name a test file's charter? → A: With `--charter=<name>` beside the file's name; with no `--charter`, they take the one charter the repository authored, and are refused naming the charters held where it authored none or more than one.
- Q: What of `test/` and `eval/` kept right under `.cw/charter/`? → A: The old layout, refused naming the move into `<charter>/test/` and `<charter>/eval/`.

### Session 2026-11-19

- Q: How does `/vendor-release` know each charter builds with the charters it includes alone? → A: No primitive of any repository may hold or name the id of what `cw` builds into a repository `cw vendor init` set up alone, so a build at the root proves it ([VENDOR-FR-028](#vendor-fr-028)); since `/charter-release` is built into every repository, the ids of `/charter-release` and its script are refused alone.
- Q: What marks a repository `cw vendor init` set up? → A: A mark in its settings that `cw vendor init` writes; dropped below, with `cw vendor init`.
- Q: Does [VENDOR Story 5](#vendor-story-5---quality-cross-check-of-core-story-72-vendor-story-1-vendor-story-2-vendor-story-3-priority-p3) hand each violation on as a story? → A: No: as every cross-check from [CORE Story 55](spec-core.md#core-story-55---quality-cross-check-of-sdk-story-8-core-story-53-sdk-story-10-core-story-56-eval-story-9-priority-p3) on, it repairs what its pass finds within itself and runs the pass again.
- Q: Is the word vendor kept? → A: No: there is a charter source, where a charter is pulled from, and an installed charter; `cw vendor` becomes `cw charter`, `cw-vendor.json` becomes `cw-package.json`, `/vendor-release` becomes `/charter-release`, and the `vendor` mark in the settings is dropped.
- Q: Where is `/charter-release` built, with no mark? → A: Into every repository, always: it is `cw`'s own, as its other built-in primitives are.
- Q: What does `cw vendor inject` become? → A: `cw charter pull <source> --fork`: the charter is copied as a pull copies it, with no `cw-package.json`, the repository's own from then on; `--clone` is not used, as it reads as `git clone`.
- Q: What of `cw vendor init`? → A: Dropped: `cw init` and `cw charter create` set a repository up to release charters; `/charter-release` writes the README's install section and the charters' changelog where they are not there yet.
- Q: What does `cw charter update` bring? → A: Every installed charter, or the one named, pulled again from the source its `cw-package.json` names at the newest version, as a pull naming no version does, the version written anew.
- Q: What do `cw charter update` and `cw charter remove` act on? → A: The charter `--charter=<name>` names, or every charter `--all` takes — every installed one for `update`, every one held for `remove`; with neither, or both, they are refused, nothing written. `remove` deletes an authored charter as an installed one, asking nothing; a name another charter still holds a mention of is left for the build to refuse.
- Q: What of a charter holding a `cw-vendor.json`, or a call to `cw vendor`? → A: Nothing: `cw-vendor.json` was never released, and `cw vendor` is dropped in 1.4.0, so neither is read, moved or named.
- Q: Is a charter the source itself installed pulled on its own? → A: Yes, as one it authored: with no `--charter` every charter the source holds is taken, and `--charter` may name one it installed; its `cw-package.json` is written by the machine installing it, never copied from the source.

### Session 2026-11-20

- Q: The changelog of 1.4.0 names a constant of the installed charters' layer as exported, and the library exports none: which holds? → A: The library as it is; `cw`'s changelog of 1.4.0 names the layer `package` alone.
- Q: What of what `/vendor-release` left in a repository — its README markers, its skill and script? → A: Handled as the code does: `/charter-release` refuses the old markers, naming the rename, and `/cw-author` names the old skill and script for the developer to delete ([VENDOR-FR-006](#vendor-fr-006), [VENDOR-FR-012](#vendor-fr-012)).
- Q: `root` is a name no charter may take, yet nothing gives it a meaning now: is it kept? → A: Kept, as a name a charter is refused when it is made or pulled, with or without `--fork` ([VENDOR-FR-020](#vendor-fr-020), [VENDOR-FR-029](#vendor-fr-029)); a folder `.cw/charter/root/` made by hand is read as any charter.
- Q: Does a release publish the charters the repository installed, which can be pulled from it? → A: No: a release lists the charters the repository authored alone, and its README's line installing them all names each, so a charter the repository installed is never taken with them but one an authored charter includes ([VENDOR-FR-018](#vendor-fr-018)); one it installed is released by its own source ([VENDOR-FR-005](#vendor-fr-005), [VENDOR-FR-006](#vendor-fr-006)).
- Q: Does a charter the repository installed that does not build stop a release? → A: Yes: a release builds at the root, which holds every charter; it lists the charters the repository authored alone ([VENDOR-FR-005](#vendor-fr-005)).
- Q: Where does a release keep the charters' changelog? → A: In `.cw/CHANGELOG.md`, the README's install section linking to it as the changelog of these charters, kept by Cherry Works; a `CHANGELOG.md` at the root is the repository's own and never read ([VENDOR-FR-007](#vendor-fr-007)).

## User Scenarios & Testing *(mandatory)*

### VENDOR Story 1 - Set a repository releasing charters up in an empty folder (Priority: P2)

**Status**: Done

A team that wants to publish charters starts from an empty clone. Before this, they laid the repository out by hand and copied its release steps from another one. They set it up as any repository is set up: `cw init`, then `cw charter create <name>` for each charter they will publish. No command and no mark sets it apart: `/charter-release` is in every repository's output, and writes the README's install section and the charters' changelog at the first release.

Reworded by [VENDOR Story 7](#vendor-story-7---see-create-update-and-remove-charters-with-cw-charter-priority-p1) and [VENDOR Story 8](#vendor-story-8---release-charters-from-any-repository-with-charter-release-priority-p2) for `cw charter create` and `/charter-release`, after `cw vendor init` first set a repository up; it depends on [VENDOR Story 2](#vendor-story-2---release-the-charters-with-charter-release-priority-p2), for `/charter-release` in every repository's output, and [VENDOR Story 7](#vendor-story-7---see-create-update-and-remove-charters-with-cw-charter-priority-p1), for `cw charter create`, while [VENDOR Story 8](#vendor-story-8---release-charters-from-any-repository-with-charter-release-priority-p2) runs its scenarios again.

**Why this priority**: Every repository publishing charters starts the same way; with nothing of its own to set it up, each one is laid out and released as any other.

**Independent Test**: In an empty git repository at a terminal, run `cw init` and `cw charter create sdd`; confirm the repository holds the charter `sdd`, empty, that `/charter-release` is in its output, and that its settings hold no mark of a repository releasing charters. Run `cw vendor init` and confirm it is refused as a command `cw` does not have.

**Acceptance Scenarios**:

1. **Given** an empty folder, **When** `cw init` and `cw charter create sdd` run, **Then** the repository holds the charter `sdd`, `/charter-release` is in its output, and its settings hold no mark setting it apart ([VENDOR-FR-032](#vendor-fr-032), [VENDOR-FR-029](#vendor-fr-029), [VENDOR-FR-027](#vendor-fr-027), [VENDOR-SC-001](#vendor-sc-001)).
2. **Given** `cw vendor init`, **When** it runs, **Then** it is refused as a command `cw` does not have, writing nothing ([VENDOR-FR-032](#vendor-fr-032), [VENDOR-FR-033](#vendor-fr-033)).

---

### VENDOR Story 2 - Release the charters with `/charter-release` (Priority: P2)

**Status**: Done

An author asks their agent `/charter-release` at the repository's root. It checks they stand on the default branch of `origin`, level with it and with a clean working tree, and that every charter the repository authors builds as it will build where it is installed: with the charters it includes and nothing else. It rewrites the README's install section from those charters, writing the README and the charters' changelog where they are not there yet, proposes the version and the changelog entry from the commits since the last tag, and, once the author confirms, commits, pushes and tags `v<version>`. What can be refused is refused before the release writes anything of its own; nothing reaches `origin` before the author confirms. The command exists already; this story holds it to its scenarios, read off the charters.

Reworded by [VENDOR Story 8](#vendor-story-8---release-charters-from-any-repository-with-charter-release-priority-p2) for `/charter-release` in every repository, after `/vendor-release` was first released.

**Why this priority**: A release is what other repositories install; a release made by hand differs each time and breaks the installs that follow it.

**Independent Test**: In a repository set up with `cw init`, with a charter `sdd` committed and pushed to an `origin`, run `/charter-release`; confirm the README lists how to install `sdd` and its skills, the charters' changelog holds the confirmed entry, and `v0.1.0` is on `origin`; install `sdd` in another repository with the line the README gives. Then run it on another branch, with an uncommitted change, and with a charter that does not build with the charters it includes alone, and confirm each is refused with nothing written.

**Acceptance Scenarios**:

1. **Given** the default branch of `origin`, clean and level with it, and charters that each build where they are installed, **When** the author confirms the version and the entry, **Then** the README's install section and the charters' changelog are committed, pushed, and tagged `v<version>` on `origin` ([VENDOR-FR-005](#vendor-fr-005), [VENDOR-FR-006](#vendor-fr-006), [VENDOR-FR-008](#vendor-fr-008), [VENDOR-SC-002](#vendor-sc-002)).
2. **Given** another branch, a working tree that is not clean, no `origin`, or a branch behind or diverged from `origin`, **When** a release is asked for, **Then** it is refused naming which, and nothing is written ([VENDOR-FR-005](#vendor-fr-005)).
3. **Given** a charter that does not build with the charters it includes alone, **When** a release is asked for, **Then** it is refused naming that charter and why, and nothing is written ([VENDOR-FR-005](#vendor-fr-005), [VENDOR-SC-004](#vendor-sc-004)).
4. **Given** no tag yet, **When** a release is drafted, **Then** `0.1.0` is proposed; **Given** a last tag the top heading of the charters' changelog does not name, **Then** it stops quoting both ([VENDOR-FR-007](#vendor-fr-007)).
5. **Given** an `origin` naming no default branch, **When** a release is asked for, **Then** the author is asked which branch releases are made from, and a branch other than `origin`'s default is refused ([VENDOR-FR-005](#vendor-fr-005)).
6. **Given** a push or a tag that fails, **When** the release runs, **Then** it stops at that step saying which steps ran and the command that finishes the rest, and never force-pushes, moves or deletes a tag ([VENDOR-FR-008](#vendor-fr-008)).
7. **Given** any repository, **When** it is built, **Then** `/charter-release` and its script are in its output, from `cw` itself ([VENDOR-FR-027](#vendor-fr-027)).
8. **Given** a primitive whose id is `charter-release` or `charter-release-action`, or that names either, **When** the charter root is read, **Then** it is refused naming its file ([VENDOR-FR-028](#vendor-fr-028)).
9. **Given** a repository holding no README or no charters' changelog, **When** a release is confirmed, **Then** the one missing is written, the README holding the install section alone, and committed with the release ([VENDOR-FR-006](#vendor-fr-006), [VENDOR-FR-007](#vendor-fr-007)).
10. **Given** a build that changes what is committed, **When** a release is asked for, **Then** it is refused naming what changed, and the release writes nothing of its own; **Given** a version or date the author names that a release would refuse, **When** it is drafted, **Then** it is refused before the README is written ([VENDOR-FR-005](#vendor-fr-005)).

---

### VENDOR Story 3 - Keep, author, install and test charters in the charter root (Priority: P1)

**Status**: Done

An author keeps each primitive in a charter they name: `.cw/charter/<charter>/primitive/<kind>/<id>/`, the charter's test cases under `<charter>/test/` and its eval cases under `<charter>/eval/`. A repository holds as many charters as it likes, none of them by default, and a build at the root holds every one, so the author opens the root alone, and their agent is offered every charter's primitives. A charter holding a `cw-package.json` was installed, and is read as installed, read-only; a charter without one is the repository's own. A repository laid out the old way is refused by every command, naming the move, and `/cw-author` moves it. An author, or their agent through `/cw-author`, writes a new primitive into a charter with `cw add <kind> <id> --charter=<name>`; the charter is made where it is not there yet. With no `--charter`, `cw add` lists the charters the repository authored to pick from at the terminal, and asks a name where none is held. A charter installed is read-only, and is refused. The portal asks the charter in the form that creates a primitive. A repository installs a charter a source shares with `cw charter pull <source> --charter=<name>`: the whole charter, its test cases and eval cases included, is copied into its own `.cw/charter/<charter>/`, beside a `cw-package.json` naming the charter, the source and the version installed. With no `--charter`, every charter the source holds is installed, one it installed itself as one it authored. `--as=<name>` installs it under another name. Every other charter of the source it includes is installed with it. A charter the source itself installed is copied as it stands, its `cw-package.json` written here naming the source asked; no other source is reached. Installing the same charter from the same source again brings it up to date; `cw charter` names each installed charter with its source and version, and `cw charter remove --charter=<charter>` deletes it. `cw charter pull <source> --fork --charter=<name>` copies a charter, and every charter it includes, into the repository's `.cw/charter/` as `cw charter pull` does, but writes no `cw-package.json`: from then on the charter is the repository's own, to edit and delete. At the root, `cw test` runs every charter's test cases, and `cw eval` every charter's eval cases; `--charter=<name>` runs one charter's alone, an installed charter's as an authored one's, so a repository proves a charter it installed still holds there.

Reworded by [VENDOR Story 6](#vendor-story-6---pull-a-charter-from-its-source-with-cw-charter-pull-priority-p1) and [VENDOR Story 7](#vendor-story-7---see-create-update-and-remove-charters-with-cw-charter-priority-p1) for `cw charter pull` and `cw charter remove`, after `cw vendor add`, `inject` and `remove` first did the same.

**Why this priority**: Every other story of this spec reads and writes charters; until the charters of the charter root are named charters, authored into them, installed and tested by them, nothing can be shared as one.

**Independent Test**: In a repository holding charters `sdd` and `baseline`, a skill in each, and a charter `grill` holding a `cw-package.json`, run `cw build` and confirm the three skills are offered to the agent, `grill`'s as installed; edit `grill`'s skill with `cw edit` and confirm it is refused as read-only. Move a primitive to `primitive/<kind>/<id>/` and confirm `cw build` and `cw list` are refused, naming the move; have `/cw-author` move a repository laid out the old way, and confirm it asks the charter name and leaves every primitive in a charter. In a repository holding no charter, run `cw add guide no-any` at a terminal and answer `team`; confirm the guide is in `.cw/charter/team/primitive/guide/no-any/`. Run `cw add guide no-mocks --charter=review` and confirm a new charter `review` holds it. Run `cw add guide x` and confirm `team` and `review` are listed to pick from; run it with nobody at the terminal and confirm it is refused naming both. Run it with `--charter` naming an installed charter and confirm it is refused, nothing written. Create a primitive in the portal and confirm the form asks the charter. Make a source holding charters `sdd`, which names an id of `baseline`, `baseline`, and `grill` holding a `cw-package.json` of `mattpocock/skills`; run `cw charter pull <source> --charter=sdd` and confirm `sdd` and `baseline` are in `.cw/charter/`, each with its test and eval cases and a `cw-package.json` naming the source and version, and `grill` is not. Run it with no `--charter` and confirm `sdd`, `baseline` and `grill` are installed, `grill`'s `cw-package.json` naming the source asked, not `mattpocock/skills`. Install `sdd` again `--as=sdd-next`; confirm it is refused naming both files of an id the two would share. Install a charter whose name an authored charter holds, and confirm it is refused suggesting `--as`. Run `cw charter pull <source> --fork --charter=sdd` and confirm `sdd` and the charters it includes are in `.cw/charter/` with no `cw-package.json`, and `cw edit` changes them. In a repository holding charters `sdd` and `baseline`, each with test cases and eval cases, run `cw test` and confirm both charters' cases run; run `cw test --charter=sdd` and confirm only `sdd`'s run. Do the same with `cw eval`. Run with `--charter=nothing-here` and confirm it is refused naming the charters held.

**Acceptance Scenarios**:

1. **Given** charters `sdd` and `baseline`, **When** the root is built, **Then** the compiled output and the agent files of every agent chosen hold the primitives of both, and the agent is offered each charter's skills ([VENDOR-FR-009](#vendor-fr-009), [VENDOR-SC-003](#vendor-sc-003)).
2. **Given** a charter holding a `cw-package.json`, **When** the charter root is read, **Then** its primitives are an installed charter's, read-only, and `cw edit` and `cw remove` refuse them as installed ([VENDOR-FR-010](#vendor-fr-010)).
3. **Given** one id held in two charters, **When** the charter root is read, **Then** it is refused naming both files, as an id names one primitive in the whole charter root ([VENDOR-FR-009](#vendor-fr-009), [CORE-FR-015](spec-core.md#core-fr-015)).
4. **Given** a primitive right under its kind's folder in `.cw/charter/` or in `.cw/charter/primitive/`, test cases or eval cases right under `.cw/charter/`, or a charter installed under `.cw/vendor/` or `.cw/charter/vendor/<owner>/<repository>/<name>/`, **When** any `cw` command runs, **Then** it is refused, naming the move into a named charter, and nothing is written ([VENDOR-FR-011](#vendor-fr-011), [CORE-FR-180](spec-core.md#core-fr-180), [CORE-FR-226](spec-core.md#core-fr-226)).
5. **Given** a repository laid out the old way, **When** `/cw-author` is asked to move it, **Then** it asks the charter name for the repository's own primitives, moves them and their test and eval cases into that charter, says to delete each charter installed the old way and install it again with a `cw` of 1.4.0 or later, and once that is done the repository builds ([VENDOR-FR-012](#vendor-fr-012), [CORE-FR-227](spec-core.md#core-fr-227)).
6. **Given** a repository set up with `cw init`, **When** it is read, **Then** it holds no charter, and `/charter-release` is in no charter of it ([VENDOR-FR-013](#vendor-fr-013)).
7. **Given** a folder right under `.cw/charter/` named as a kind is, or `primitive`, `test`, `eval` or `vendor`, **When** the charter root is read, **Then** it is refused as the old layout, naming the move ([VENDOR-FR-011](#vendor-fr-011)).
8. **Given** `--charter=<name>` naming a charter the repository authored, **When** `cw add` runs, **Then** the primitive is written into it, and nothing else is written ([VENDOR-FR-014](#vendor-fr-014)).
9. **Given** `--charter=<name>` naming no charter yet, **When** `cw add` runs, **Then** the charter is made holding the primitive ([VENDOR-FR-014](#vendor-fr-014)).
10. **Given** `--charter=<name>` naming an installed charter, **When** `cw add` runs, **Then** it is refused as read-only, and nothing is written ([VENDOR-FR-014](#vendor-fr-014)).
11. **Given** no `--charter` and someone at the terminal, **When** `cw add` runs, **Then** the charters the repository authored are listed to pick from, or, where it holds none, a charter name is asked ([VENDOR-FR-015](#vendor-fr-015)).
12. **Given** no `--charter` and nobody at the terminal, or `--json`, **When** `cw add` runs, **Then** it is refused, naming the charters held, and nothing is written ([VENDOR-FR-015](#vendor-fr-015)).
13. **Given** the portal, **When** the author creates a primitive, **Then** the form asks its charter among those the repository authored, or a new one ([VENDOR-FR-016](#vendor-fr-016)).
14. **Given** a source authoring `sdd`, **When** `cw charter pull` runs with `--charter=sdd`, **Then** `.cw/charter/sdd/` holds the whole charter, its test and eval cases included, and a `cw-package.json` naming `sdd`, the source and the version, left unstaged, and nothing is built ([VENDOR-FR-017](#vendor-fr-017), [CORE-FR-052](spec-core.md#core-fr-052), [VENDOR-SC-006](#vendor-sc-006)).
15. **Given** no `--charter`, **When** `cw charter pull` runs, **Then** every charter the source holds is installed, a charter the source itself installed among them ([VENDOR-FR-017](#vendor-fr-017), [VENDOR-FR-019](#vendor-fr-019)).
16. **Given** a charter naming an id another charter of the source holds, **When** it is installed, **Then** that other charter is installed with it, and so on for what that one names ([VENDOR-FR-018](#vendor-fr-018)).
17. **Given** a charter the source itself installed, picked or included, **When** it is installed, **Then** it is copied as it stands, its `cw-package.json` written on this machine naming the source asked and the version, as for any charter installed, never the source's own, and no other source is reached ([VENDOR-FR-019](#vendor-fr-019)).
18. **Given** `--as=<name>`, **When** the charter is installed, **Then** it is held under that name, its `cw-package.json` naming the charter it was in the source ([VENDOR-FR-017](#vendor-fr-017), [VENDOR-FR-020](#vendor-fr-020)).
19. **Given** a name already held by a charter installed from the same source, **When** the charter is installed again, **Then** it is replaced whole by the version asked for; **Given** one held by a charter authored or installed from another source, **Then** it is refused, naming it and suggesting `--as`, and nothing is written ([VENDOR-FR-020](#vendor-fr-020)).
20. **Given** `--charter` naming a charter the source does not hold, **When** the command runs, **Then** nothing is installed, and the charters it holds are named ([VENDOR-FR-017](#vendor-fr-017)).
21. **Given** installed charters, **When** `cw charter` runs, **Then** each is named with its source and version; **When** `cw charter remove --charter=<charter>` runs, **Then** that charter is deleted whole, an authored charter as an installed one ([VENDOR-FR-021](#vendor-fr-021), [VENDOR-FR-031](#vendor-fr-031)).
22. **Given** a source authoring `sdd`, which includes `baseline`, **When** `cw charter pull --fork` runs with `--charter=sdd`, **Then** `sdd` and `baseline` are in `.cw/charter/`, whole, with no `cw-package.json`, and editable as any charter the repository authored ([VENDOR-FR-022](#vendor-fr-022)).
23. **Given** a charter to fork whose name, or one of whose ids, the repository already holds, **When** the command runs, **Then** it is refused naming both, and nothing is written ([VENDOR-FR-022](#vendor-fr-022)).
24. **Given** two charters with test cases, **When** `cw test` runs with no `--charter`, **Then** every case of both runs ([VENDOR-FR-024](#vendor-fr-024)).
25. **Given** the same, **When** `cw test --charter=sdd` runs, **Then** only `sdd`'s cases run ([VENDOR-FR-024](#vendor-fr-024)).
26. **Given** two charters with eval cases, **When** `cw eval` runs with no `--charter`, and then with `--charter=sdd`, **Then** it runs every case, and then `sdd`'s alone, each at the repository's root ([VENDOR-FR-025](#vendor-fr-025)).
27. **Given** `--charter` naming no charter held, **When** `cw test` or `cw eval` runs, **Then** it is refused, naming the charters held, and nothing runs ([VENDOR-FR-026](#vendor-fr-026)).
28. **Given** the portal and charters `team` and `other`, **When** `team`'s primitives are asked for, **Then** only `team`'s are listed; **When** a name no charter is held under is asked for, **Then** it is refused naming those held; **When** a new test file is written into `other`, **Then** it lands in `other/test/` ([VENDOR-FR-016](#vendor-fr-016)).
29. **Given** a source authoring `lone`, **When** `cw charter pull --fork` runs with `--charter=lone --as=solo`, **Then** it is in `.cw/charter/solo/`, whole, with no `cw-package.json`; `--as` naming more than one charter, or given with no `--charter` where the source holds more than one, is refused, nothing written ([VENDOR-FR-020](#vendor-fr-020), [VENDOR-FR-022](#vendor-fr-022)).
30. **Given** no `--charter`, **When** `cw suite add`, `cw suite edit` or `cw suite remove` runs, **Then** it takes the one charter the repository authored, and is refused naming the charters held where it authored none or more than one, writing nothing ([VENDOR-FR-009](#vendor-fr-009)).
31. **Given** a repository laid out the old way holding the `vendor-release` skill and script an earlier `cw` wrote, **When** `/cw-author` moves it, **Then** it names both for the developer to delete, and deletes neither ([VENDOR-FR-012](#vendor-fr-012)).
32. **Given** a charter `.cw/charter/root/` made by hand, **When** `cw add --charter=root` runs, **Then** the primitive is written into it as into any charter; **Given** `--charter=root` with no `root` held, **Then** it is refused, writing nothing ([VENDOR-FR-014](#vendor-fr-014), [VENDOR-FR-020](#vendor-fr-020)).
33. **Given** an authored charter `team` beside an installed one, **When** `cw list --charter=team` runs, **Then** it lists `team`'s primitives alone; **When** it names a charter none is held under, **Then** it is refused naming those held ([VENDOR-FR-016](#vendor-fr-016)).

---

### VENDOR Story 5 - Quality cross-check of CORE Story 72, VENDOR Story 1, VENDOR Story 2, VENDOR Story 3 (Priority: P3)

**Status**: Done

Once [CORE Story 72](spec-core.md#core-story-72---read-the-charter-grouped-by-kind-in-cw-list-priority-p2), [VENDOR Story 1](#vendor-story-1---set-a-repository-releasing-charters-up-in-an-empty-folder-priority-p2), [VENDOR Story 2](#vendor-story-2---release-the-charters-with-charter-release-priority-p2) and [VENDOR Story 3](#vendor-story-3---keep-author-install-and-test-charters-in-the-charter-root-priority-p1) are `Done`, the code and every spec are checked against the checklist of the quality document, and what the check finds is repaired here, before the pass is run again.

**Why this priority**: Four stories landed one at a time can each pass their review and still disagree with the specs or with each other.

**Independent Test**: Run /sdd-quality and confirm it reports a grade, and that each violation is repaired within this story before the pass is run again.

**Acceptance Scenarios**:

1. **Given** [CORE Story 72](spec-core.md#core-story-72---read-the-charter-grouped-by-kind-in-cw-list-priority-p2), [VENDOR Story 1](#vendor-story-1---set-a-repository-releasing-charters-up-in-an-empty-folder-priority-p2), [VENDOR Story 2](#vendor-story-2---release-the-charters-with-charter-release-priority-p2) and [VENDOR Story 3](#vendor-story-3---keep-author-install-and-test-charters-in-the-charter-root-priority-p1) `Done`, **When** /sdd-quality runs, **Then** it checks the code and every spec against the checklist of `quality.md`, each reported violation is repaired within this story, not as a story of its own, and the pass is run again ([VENDOR-SC-005](#vendor-sc-005)).

---

### VENDOR Story 6 - Pull a charter from its source with `cw charter pull` (Priority: P1)

**Status**: Done

A developer who wants another team's charter runs `cw charter pull <source> --charter=<name>`: the charter, and every charter of the source it includes, is copied whole into `.cw/charter/`, beside a `cw-package.json` naming the charter in the source, the source and the version, and is read-only from then on. With `--fork`, it is copied the same way with no `cw-package.json`, and is the repository's own to edit and delete. Before this, the same was done by `cw vendor add` and `cw vendor inject`, and the file was a `cw-vendor.json`: a word, vendor, the rest of `cw` does not use. `cw vendor` is gone; a repository speaks of a charter source and a charter installed.

**Why this priority**: Pulling is how a charter is shared; every other command of this phase reads what a pull writes.

**Independent Test**: Make a source authoring `sdd`, which includes `baseline`; run `cw charter pull <source> --charter=sdd` and confirm `sdd` and `baseline` are in `.cw/charter/`, each with a `cw-package.json` naming the source and version, and that `cw edit` refuses their primitives as installed. In another repository run `cw charter pull <source> --fork --charter=sdd` and confirm both are there with no `cw-package.json`, and `cw edit` changes them. Run `cw vendor add <source>` and confirm it is refused as a command `cw` does not have. Confirm that every scenario of [VENDOR Story 3](#vendor-story-3---keep-author-install-and-test-charters-in-the-charter-root-priority-p1) still holds.

**Acceptance Scenarios**:

1. **Given** a source authoring `sdd`, **When** `cw charter pull <source> --charter=sdd` runs, **Then** `.cw/charter/sdd/` holds the whole charter beside a `cw-package.json` naming `sdd`, the source and the version, left unstaged, and nothing is built ([VENDOR-FR-017](#vendor-fr-017), [CORE-FR-052](spec-core.md#core-fr-052), [VENDOR-SC-006](#vendor-sc-006)).
2. **Given** a charter holding a `cw-package.json`, **When** the charter root is read, **Then** it is read as installed, read-only ([VENDOR-FR-010](#vendor-fr-010)).
3. **Given** `--fork`, **When** `cw charter pull` runs, **Then** the charters are copied as a pull copies them, with no `cw-package.json`, the repository's own ([VENDOR-FR-022](#vendor-fr-022)).
4. **Given** `cw vendor` and any of its commands, **When** it runs, **Then** it is refused as a command `cw` does not have, writing nothing ([VENDOR-FR-033](#vendor-fr-033), [VENDOR-SC-007](#vendor-sc-007)).
5. **Given** the scenarios of [VENDOR Story 3](#vendor-story-3---keep-author-install-and-test-charters-in-the-charter-root-priority-p1), [CORE Story 2](spec-core.md#core-story-2---adopt-shared-governance-without-copying-files-priority-p2), [CORE Story 8](spec-core.md#core-story-8---install-see-and-remove-charters-from-a-charter-source-priority-p4), [CORE Story 30](spec-core.md#core-story-30---install-each-charter-under-a-name-of-its-own-priority-p2), [CORE Story 33](spec-core.md#core-story-33---pick-charters-from-a-source-that-gathers-many-priority-p2), [CORE Story 34](spec-core.md#core-story-34---fork-a-charter-into-the-repository-as-its-own-priority-p2) and [CORE Story 37](spec-core.md#core-story-37---pull-and-remove-a-charter-in-any-folder-priority-p3), reworded for `cw charter pull`, `--fork` and `cw-package.json`, **When** each is run, **Then** each holds ([VENDOR-FR-017](#vendor-fr-017), [VENDOR-FR-022](#vendor-fr-022)).
6. **Given** a source authoring `baseline` and `sdd`, **When** `cw charter pull <source> --as=team` runs naming no charter, **Then** it is refused, and nothing is written ([VENDOR-FR-020](#vendor-fr-020)).

---

### VENDOR Story 7 - See, create, update and remove charters with `cw charter` (Priority: P1)

**Status**: Done

A developer runs `cw charter` and sees every charter the repository holds, each marked authored or installed, an installed one with its source and version. They make a new charter with `cw charter create <name>`, empty, ready for `cw add --charter=<name>`. They bring installed charters up to date with `cw charter update --charter=<name>`, or every one with `--all`: each is pulled again from the source its `cw-package.json` names, at the newest version. They delete a charter with `cw charter remove --charter=<name>`, authored or installed, or every charter with `--all`. Before this, only installed charters were listed, a charter was made only by adding a primitive to it, bringing one up to date meant typing its source again, and an authored charter could not be removed by `cw`.

**Why this priority**: Once nothing sets a charter source apart, every charter is handled by the same commands, whoever wrote it.

**Independent Test**: In a repository holding an authored charter `team` and a charter `sdd` pulled from a source, run `cw charter` and confirm both are named, `sdd` with its source and version. Run `cw charter create review` and confirm an empty charter `review` is held. Commit a change to the source, run `cw charter update --charter=sdd` and confirm `sdd` holds it and its `cw-package.json` names the new version. Run `cw charter update` and `cw charter remove` with no flag, and with both flags, and confirm each is refused, nothing written. Run `cw charter remove --charter=team` and confirm `team` is gone; run `cw charter remove --all` and confirm no charter is held.

**Acceptance Scenarios**:

1. **Given** authored and installed charters, **When** `cw charter` runs, **Then** every charter is named as authored or installed, an installed one with its source and version ([VENDOR-FR-021](#vendor-fr-021)).
2. **Given** a name no charter holds, **When** `cw charter create <name>` runs, **Then** an empty charter of that name is made, the repository's own ([VENDOR-FR-029](#vendor-fr-029)).
3. **Given** a name a charter already holds, or one a charter may not take, **When** `cw charter create` runs, **Then** it is refused naming why, and nothing is written ([VENDOR-FR-029](#vendor-fr-029)).
4. **Given** an installed charter whose source holds a newer version, **When** `cw charter update --charter=<name>` runs, **Then** it is pulled again at the newest version, its `cw-package.json` naming that version ([VENDOR-FR-030](#vendor-fr-030)).
5. **Given** several installed charters, **When** `cw charter update --all` runs, **Then** each is pulled again from its own source; **Given** one source that cannot be reached, **Then** it is refused naming it, and no charter is changed ([VENDOR-FR-030](#vendor-fr-030)).
6. **Given** `--charter` naming an authored charter, **When** `cw charter update` runs, **Then** it is refused, and nothing is written ([VENDOR-FR-030](#vendor-fr-030)).
7. **Given** neither `--charter` nor `--all`, or both, **When** `cw charter update` or `cw charter remove` runs, **Then** it is refused, and nothing is written ([VENDOR-FR-030](#vendor-fr-030), [VENDOR-FR-031](#vendor-fr-031)).
8. **Given** an authored charter or an installed one, **When** `cw charter remove --charter=<name>` runs, **Then** it is deleted whole, asking nothing; **When** `cw charter remove --all` runs, **Then** every charter is deleted ([VENDOR-FR-031](#vendor-fr-031)).
9. **Given** the scenarios of [VENDOR Story 3](#vendor-story-3---keep-author-install-and-test-charters-in-the-charter-root-priority-p1), [CORE Story 2](spec-core.md#core-story-2---adopt-shared-governance-without-copying-files-priority-p2), [CORE Story 8](spec-core.md#core-story-8---install-see-and-remove-charters-from-a-charter-source-priority-p4), [CORE Story 12](spec-core.md#core-story-12---the-instructions-arrive-with-the-engine-not-with-the-repository-priority-p3), [CORE Story 33](spec-core.md#core-story-33---pick-charters-from-a-source-that-gathers-many-priority-p2), [CORE Story 34](spec-core.md#core-story-34---fork-a-charter-into-the-repository-as-its-own-priority-p2) and [CORE Story 37](spec-core.md#core-story-37---pull-and-remove-a-charter-in-any-folder-priority-p3), reworded for `cw charter`, `cw charter update` and `cw charter remove`, **When** each is run, **Then** each holds ([VENDOR-FR-021](#vendor-fr-021), [VENDOR-FR-030](#vendor-fr-030), [VENDOR-FR-031](#vendor-fr-031)).

---

### VENDOR Story 8 - Release charters from any repository with `/charter-release` (Priority: P2)

**Status**: Done

An author releases the charters of any repository set up with `cw init`: `/charter-release` is in every repository's output, and nothing marks a repository as one releasing charters. Where the README or the charters' changelog is not there yet, the first release writes it. Before this, `/vendor-release` was built only where `cw vendor init` had set the repository up and marked its settings, and `cw vendor init` was the one way to get there.

**Why this priority**: Releasing follows pulling and authoring; it is done once per version, and works the day the earlier stories land.

**Independent Test**: In a repository set up with `cw init` and `cw charter create sdd`, with no README and no charters' changelog, a primitive in `sdd` committed and pushed to an `origin`, run `/charter-release` and confirm the README holds the install section, its lines installing with `cw charter pull`, the charters' changelog holds the confirmed entry, and `v0.1.0` is on `origin`. Confirm that `cw vendor init` is refused as a command `cw` does not have, that no setting marks the repository, and that every scenario of [VENDOR Story 1](#vendor-story-1---set-a-repository-releasing-charters-up-in-an-empty-folder-priority-p2) and [VENDOR Story 2](#vendor-story-2---release-the-charters-with-charter-release-priority-p2) holds.

**Acceptance Scenarios**:

1. **Given** any repository, **When** it is built, **Then** `/charter-release` and its script are in its output ([VENDOR-FR-027](#vendor-fr-027)).
2. **Given** a repository with no README and no charters' changelog, **When** a release is confirmed, **Then** both are written and committed with it, the README holding the install section, each line installing with `cw charter pull` ([VENDOR-FR-006](#vendor-fr-006), [VENDOR-FR-007](#vendor-fr-007), [VENDOR-SC-002](#vendor-sc-002)).
3. **Given** a repository set up with `cw init`, **When** its settings are read, **Then** they hold no mark of a repository releasing charters, and `cw vendor init` is refused as a command `cw` does not have ([VENDOR-FR-032](#vendor-fr-032), [VENDOR-FR-033](#vendor-fr-033)).
4. **Given** the scenarios of [VENDOR Story 1](#vendor-story-1---set-a-repository-releasing-charters-up-in-an-empty-folder-priority-p2) and [VENDOR Story 2](#vendor-story-2---release-the-charters-with-charter-release-priority-p2), reworded for `/charter-release`, **When** each is run, **Then** each holds ([VENDOR-FR-005](#vendor-fr-005), [VENDOR-FR-028](#vendor-fr-028), [VENDOR-SC-001](#vendor-sc-001)).
5. **Given** a repository holding a charter it installed beside those it authored, **When** a release writes the README, **Then** the line installing them all names each charter authored with `--charter`, and neither that line nor the section names the installed one ([VENDOR-FR-005](#vendor-fr-005), [VENDOR-FR-006](#vendor-fr-006)).
6. **Given** a README holding the install section under the markers an earlier `/vendor-release` wrote, **When** `/charter-release` runs, **Then** it is refused, naming the markers to rename, and nothing is written ([VENDOR-FR-006](#vendor-fr-006)).
7. **Given** a README holding no install section, **When** a release writes the README, **Then** the section is put at its end, and the rest is left as it is ([VENDOR-FR-006](#vendor-fr-006)).
8. **Given** a charter the repository installed that does not build at the root, **When** a release is asked for, **Then** it is refused, naming that charter and why, and nothing is written ([VENDOR-FR-005](#vendor-fr-005)).
9. **Given** a README holding one of the section's two markers alone, or the two out of order, **When** a release writes the README, **Then** it is refused, naming both lines, and nothing is written ([VENDOR-FR-006](#vendor-fr-006)).
10. **Given** a repository whose root holds a `CHANGELOG.md` of its own, **When** a release is confirmed, **Then** the entry is written to `.cw/CHANGELOG.md`, the root's left as it is, and the README's install section ends with a link to `.cw/CHANGELOG.md` as the changelog of these charters ([VENDOR-FR-007](#vendor-fr-007)).

---

### Edge Cases

- `cw charter update --all` or `cw charter remove --all` with no charter it would act on — it says so, and nothing is written ([VENDOR-FR-030](#vendor-fr-030), [VENDOR-FR-031](#vendor-fr-031)).
- `cw charter update --all` with one source that cannot be reached — refused naming it, and no charter is changed ([VENDOR-FR-030](#vendor-fr-030)).
- A charter removed whose ids another charter still names — removed all the same; the next build refuses each name nothing holds ([VENDOR-FR-031](#vendor-fr-031), [CORE-FR-162](spec-core.md#core-fr-162)).
- A charter naming an id that neither it nor any charter of the source holds — refused by the build of the source, as any name nothing holds ([VENDOR-FR-005](#vendor-fr-005), [CORE-FR-162](spec-core.md#core-fr-162)).
- Two charters of a source including each other — each installed once ([VENDOR-FR-018](#vendor-fr-018)).
- A charter installed `--as` another name, and then installed again under its own — two charters holding one id: refused naming both files, nothing written ([VENDOR-FR-009](#vendor-fr-009), [VENDOR-FR-020](#vendor-fr-020)).
- A `cw-package.json` that cannot be read — the charter is refused, naming the file, as a primitive that does not read is ([VENDOR-FR-010](#vendor-fr-010)).
- An installed charter edited by hand — overwritten whole by the next install of it ([VENDOR-FR-020](#vendor-fr-020)).

## Requirements *(mandatory)*

### Functional Requirements

**Setting a repository up to release charters**

- <a id="vendor-fr-032"></a>**VENDOR-FR-032**: A repository MUST be set up to author and release charters with `cw init` and `cw charter create` alone; no command of `cw` sets one up apart, and its settings MUST hold no mark of it.

**Releasing**

- <a id="vendor-fr-005"></a>**VENDOR-FR-005**: `/charter-release` MUST refuse, writing nothing, unless it stands on the default branch of `origin`, or the branch the author confirms where `origin` names none, with a clean working tree, neither behind nor diverged from `origin`, and every charter the repository authored building with the charters it includes alone; each refusal MUST name its cause. Where the build changes what is committed, it MUST refuse naming what changed, writing nothing of its own, the compiled output left for the author to commit or have git ignore; a version or date the author names MUST be refused before anything is written, as the release would refuse it. `/charter-release` MUST be refused, naming the charter, where any charter held, installed or authored, does not build at the root ([VENDOR-FR-009](#vendor-fr-009)); a release MUST list the charters the repository authored alone, one it installed being released by its own source.
- <a id="vendor-fr-006"></a>**VENDOR-FR-006**: It MUST rewrite only the README's install section, writing a README holding that section alone where the repository holds no README, and putting the section at the end of a README that holds no install section, from the charters the repository authored: the `cw charter pull` line installing every one of them, naming each with `--charter` so that no charter the repository installed is taken with them but one an authored charter includes ([VENDOR-FR-018](#vendor-fr-018)), then for each charter the `cw charter pull` line installing it alone and its skills with their descriptions, leaving out cw's own skills. A README holding that section under the markers an earlier `/vendor-release` wrote MUST be refused, naming the markers to rename, writing nothing; one holding one of its two markers alone, or the two out of order, MUST be refused, naming both lines, writing nothing.
- <a id="vendor-fr-007"></a>**VENDOR-FR-007**: It MUST keep the changelog of the charters in `.cw/CHANGELOG.md`, writing it where it is not there and never reading a changelog at the repository's root; it MUST propose `0.1.0` where no release was tagged, else a version and a changelog entry from the commits since the last tag, and stop where the changelog, when there, has a top heading that does not name that tag, quoting the tag and the heading. The README's install section MUST end with a link to that changelog, named as the changelog of these charters, kept by Cherry Works.
- <a id="vendor-fr-008"></a>**VENDOR-FR-008**: Only once the author confirms MUST it commit, push and tag `v<version>` on `origin`; it MUST stop at the first step that fails, saying which steps ran and how to finish the rest, and MUST never force-push, move or delete a tag.
- <a id="vendor-fr-027"></a>**VENDOR-FR-027**: `/charter-release` and its script MUST be primitives of `cw`'s own, built into the output of every repository, always.
- <a id="vendor-fr-028"></a>**VENDOR-FR-028**: A primitive of any repository MUST NOT hold the id of `/charter-release` or of the script it runs, nor name either through its body, its mixins, its rationale, an agent's tools or a sensor's run; each MUST be refused naming its file. So a charter that builds at the root of the repository releasing it builds with the charters it includes alone ([VENDOR-FR-005](#vendor-fr-005)).

**Charters**

- <a id="vendor-fr-009"></a>**VENDOR-FR-009**: Every primitive a repository keeps MUST belong to one charter named by its author, `.cw/charter/<charter>/primitive/<kind>/<id>/`, its test cases under `<charter>/test/` and its eval cases under `<charter>/eval/`, a command naming a test file naming its charter with `--charter=<name>`, or, with none named, taking the one charter the repository authored, refused naming the charters held where it authored none or more than one; a charter root MAY hold any number of charters, and a build MUST hold every one. An id MUST name one primitive across every charter.
- <a id="vendor-fr-010"></a>**VENDOR-FR-010**: A charter holding a `cw-package.json` MUST be read as installed, its primitives read-only; one without MUST be read as the repository's own. A `cw-package.json` that does not read MUST be refused, naming the file.
- <a id="vendor-fr-011"></a>**VENDOR-FR-011**: A folder right under `.cw/charter/` named as a kind is, or `primitive`, `test`, `eval` or `vendor`, MUST be refused by every command, writing nothing, naming the move into a named charter.
- <a id="vendor-fr-012"></a>**VENDOR-FR-012**: `/cw-author` MUST move a repository laid out the old way: asking the charter name for its own primitives and moving them, their test cases and eval cases there, and saying to delete each charter installed under `.cw/vendor/` or `.cw/charter/vendor/` and install it again with a `cw` of 1.4.0 or later, never moving one itself; and naming the `vendor-release` skill and script an earlier `cw` wrote, for the developer to delete, deleting neither itself.
- <a id="vendor-fr-013"></a>**VENDOR-FR-013**: `cw init` MUST make no charter; `/charter-release` and the script it runs MUST never be written into a charter ([VENDOR-FR-027](#vendor-fr-027)).

**Authoring into a charter**

- <a id="vendor-fr-014"></a>**VENDOR-FR-014**: `cw add` MUST take `--charter=<name>` and write the primitive into that charter, making it where it is not held; a name no charter holds that is not written as an id is, or is a kind's, `primitive`, `test`, `eval`, `vendor` or `root` ([VENDOR-FR-020](#vendor-fr-020)), MUST be refused, writing nothing; a charter installed MUST be refused as read-only, writing nothing.
- <a id="vendor-fr-015"></a>**VENDOR-FR-015**: With no `--charter`, `cw add` MUST, at a terminal, list the charters the repository authored to pick from, or ask a charter name where it holds none; with nobody at the terminal, or with `--json`, it MUST be refused, naming the charters held, writing nothing.
- <a id="vendor-fr-016"></a>**VENDOR-FR-016**: The portal's form creating a primitive, and its new test file, MUST ask its charter, among those the repository authored or a new one, a new one's name refused as [VENDOR-FR-020](#vendor-fr-020) refuses one; the portal, and `cw list --charter=<name>`, MUST list one charter's primitives by the charter's name, refusing a name no charter is held under, naming those held.

**Installing a charter**

- <a id="vendor-fr-017"></a>**VENDOR-FR-017**: `cw charter pull <source>` MUST install the charters `--charter=<name>` names, or every charter the source holds where none is named, each copied whole, its test and eval cases included, into `.cw/charter/<charter>/` with a `cw-package.json` naming the charter in the source, the source as typed and the version installed: the version asked for, or the id of the commit fetched where none was asked; a name the source does not hold MUST install nothing, naming the charters it holds. It MUST leave what it writes unstaged, whatever else is in hand, and build nothing ([CORE-FR-052](spec-core.md#core-fr-052)).
- <a id="vendor-fr-018"></a>**VENDOR-FR-018**: Every charter of the source that a charter installed names an id of, through its body, its mixins, its rationale, an agent's tools or a sensor's run, MUST be installed with it, and so on for what that one names, each once.
- <a id="vendor-fr-019"></a>**VENDOR-FR-019**: A charter the source itself installed MUST be taken as one it authored, picked by `--charter`, taken where none is named, or included, copied as it stands; its `cw-package.json` MUST be written by the machine installing it, as for any charter installed, never copied from the source; no source but the one asked MUST be reached.
- <a id="vendor-fr-020"></a>**VENDOR-FR-020**: `--as=<name>` MUST install the charter under that name; `--as` naming more than one charter, or given with no `--charter` where the source holds more than one, MUST be refused, writing nothing; a charter it includes keeps its own name. A name held by a charter installed from the same source MUST be replaced whole; one held by a charter authored or installed from another source MUST be refused, naming it and suggesting `--as`, writing nothing; a name not written as an id is, or a kind's, `primitive`, `test`, `eval`, `vendor` or `root`, MUST be refused, writing nothing; an id another charter already holds MUST be refused naming both files, writing nothing.
- <a id="vendor-fr-021"></a>**VENDOR-FR-021**: `cw charter` MUST name every charter held, each as authored or installed, an installed one with its source and version.
- <a id="vendor-fr-029"></a>**VENDOR-FR-029**: `cw charter create <name>` MUST make an empty charter of that name, the repository's own; a name a charter already holds MUST be refused naming it, and a name refused as [VENDOR-FR-020](#vendor-fr-020) refuses one MUST be refused, writing nothing.
- <a id="vendor-fr-030"></a>**VENDOR-FR-030**: `cw charter update` MUST pull again the installed charter `--charter=<name>` names, or every installed charter with `--all`, from the source its `cw-package.json` names, at the newest version as a pull naming no version takes it, writing the version anew; an authored charter named MUST be refused; with neither flag, or both, it MUST be refused, writing nothing; where one source cannot be reached, it MUST be refused naming it, no charter changed; with `--all` and no installed charter, it MUST say so, writing nothing.
- <a id="vendor-fr-031"></a>**VENDOR-FR-031**: `cw charter remove` MUST delete whole the charter `--charter=<name>` names, or every charter held with `--all`, authored or installed, asking nothing; with neither flag, or both, or a name no charter is held under, it MUST be refused, writing nothing; with `--all` and no charter held, it MUST say so, writing nothing.
- <a id="vendor-fr-033"></a>**VENDOR-FR-033**: `cw vendor` and each of its commands MUST be refused as a command `cw` does not have, writing nothing.

**Forking a charter**

- <a id="vendor-fr-022"></a>**VENDOR-FR-022**: `cw charter pull <source> --fork` MUST copy the charters named, and those they include, as `cw charter pull` does, but write no `cw-package.json`, leaving them the repository's own; `--as` MUST name one charter alone, as for `cw charter pull` ([VENDOR-FR-020](#vendor-fr-020)); a charter name or an id already held MUST be refused naming both, writing nothing.

**Testing a charter**

- <a id="vendor-fr-024"></a>**VENDOR-FR-024**: `cw test` MUST run every charter's test cases where no `--charter` is given, and with `--charter=<name>` that charter's alone, installed or authored.
- <a id="vendor-fr-025"></a>**VENDOR-FR-025**: `cw eval` MUST do the same with eval cases, every case at the repository's root.
- <a id="vendor-fr-026"></a>**VENDOR-FR-026**: `cw test` and `cw eval` MUST refuse a `--charter` naming no charter held, naming the charters held, and running nothing.

### Key Entities

- **Charter**: a named set of primitives with their test cases and eval cases, `.cw/charter/<charter>/`; what a charter is made of, and what is shared.
- **Installed charter**: a charter holding a `cw-package.json` — the charter's name in its source, the source and the version — read-only, brought up to date with `cw charter update`.
- **Authored charter**: a charter with no `cw-package.json`: the repository's own, editable, and what it shares with others.
- **Charter source**: a repository whose charters, authored or installed there, are pulled elsewhere, each one it installed taken as one it authored.
- **Charter release**: one `v<version>` tag of the charters a repository authored, made by `/charter-release`, with its entry in the charters' changelog, `.cw/CHANGELOG.md`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- <a id="vendor-sc-001"></a>**VENDOR-SC-001**: A repository releasing charters is set up from an empty folder with `cw init` and one `cw charter create` per charter: no command of its own.
- <a id="vendor-sc-002"></a>**VENDOR-SC-002**: A release is made with one request to the agent and one confirmation, and a charter it releases installs in another repository with the line its README gives.
- <a id="vendor-sc-003"></a>**VENDOR-SC-003**: An author authors, builds, tests and releases every charter a repository authored with its root the only folder opened: zero changes of folder.
- <a id="vendor-sc-004"></a>**VENDOR-SC-004**: Every charter a release lists, one the repository authored, builds with the charters it includes alone.
- <a id="vendor-sc-005"></a>**VENDOR-SC-005**: Each quality cross-check grades the product and repairs every violation it reports within itself, running the pass again until none is left.
- <a id="vendor-sc-006"></a>**VENDOR-SC-006**: An installed charter and an authored charter differ by one file, `cw-package.json`; nothing else about its layout tells them apart.
- <a id="vendor-sc-007"></a>**VENDOR-SC-007**: No command, file, flag or setting of `cw` is named for a vendor: a repository speaks of charters, charter sources and installed charters alone.

## Assumptions

- The agents a build writes for are those chosen with `cw init`.
- An installed charter is committed as the repository's other files are.
- Charter names follow the rules of an id, and none is made or pulled as a kind's name, `primitive`, `test`, `eval`, `vendor` or `root`.

## Out of Scope

- A default charter.
- A folder for installed charters apart from the others.
- Reaching any source but the one asked, to install what a charter includes.
- Taking skills from a skills repository, as `npx skills` publishes them.
- Moving a primitive from one charter to another.
- A command or a mark setting a repository apart as one releasing charters.
- Reading a `cw-vendor.json`, never released, or keeping `cw vendor`, dropped in 1.4.0.
