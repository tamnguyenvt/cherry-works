# Feature Specification: Cherry Works

**Created**: 2026-08-30

**Updated**: 2026-09-27

**Status**: Draft

**Input**: User descriptions: "Build the Cherry Works charter and its charter engine — the substance that governs a coding agent, before any UI exists. Two deliverables: a shared policy repository holding the charter, and an engine with a `cw` CLI that resolves and applies it." Then: "The charter portal: a graphical interface over one repository's charter, driving the charter engine." Then: "Implement a cherry skill so a coding agent authors charter primitives, without typing them by hand." Then: "Phase 003: publish to npm, so a user can install it from npm." Then: "The catalogue must not send an agent into the charter: build every primitive into the output folder and point there."

## Overview

Cherry Works exists to make a coding agent's output reliable enough to ship. Reliability here is not determinism — it is narrowing the band the output can land in, using three levers applied in order: narrow the input (scope written down, including what is out of scope, plus acceptance criteria that can be falsified), narrow the output (gates that fire on every iteration rather than in CI ten minutes later), and narrow the recovery (the next move after each class of failure is named, not improvised).

The **charter** is everything a team authors to specify how the agent must behave. The **harness** is the engine that applies it. The product has three surfaces over one engine.

- **The charter and its engine, on the command line.** A repository authors its charter as small markdown files, installs other teams' charters as vendor sources, and runs `cw` to validate it, list it, explain it, compile it into what its agent reads, test it and check its health. The command line is the whole of the engine's surface: nothing can be done elsewhere that cannot be done there.
- **The portal.** A developer starts it from the command line inside a governed repository and gets a page that shows everything the charter holds — what each primitive says, when it comes up, which file it lives in and which layer it arrived from — and lets them author, edit and delete primitives, install and remove vendor sources, write and run the self-regression tests, build, and ask the health check, without remembering a single command or field name. The portal drives the same engine the command line drives and adds no behaviour of its own: what it shows is what the engine said, and everything it does has a command-line equivalent.
- **Agent authoring.** The coding agent running in a governed repository is the third author, and the one that never sits at a terminal. A kind says what it requires to whoever asks (`cw kinds <kind>`), a primitive can be written with no terminal to answer at (`cw add <kind> <id> --header k=v`), and every governed repository gets the instructions: a skill, `skill:cw-author`, arrives in a layer of the charter that `cw` itself owns and compiles to whatever skill surface the repository's agent reads. The skill's body copies no rule out of the engine. It says to ask `cw kinds` and it says how to answer; which headers a kind requires stays where its contract is ([FR-004](#fr-004), [FR-064](#fr-064)). A surface compiled by an older `cw` would otherwise hand the agent a header table that a later `cw` has moved on from, and an agent reading a stale table writes files the engine refuses. Nothing here teaches the agent what to *write*: what a guide should say is the repository's business.

Every surface above reaches a user the same way: **one install from the public package registry**. A developer who has never seen this repository installs `cw` with the command their package manager already knows and has the whole product — the command line, the portal and the builtin layer — with nothing to clone and nothing to build. Building from source is a contributor's path, not a user's.

A single charter covering design, planning and implementation at once has to be wide enough to fit all three — which is another way of saying it narrows nothing. Cherry Works therefore splits work into flows, and gives each flow its own charter. That split is a **convention, not a mechanism**: a flow is one branch holding one charter, so the separation falls out of git. Each flow's checkout has its own charter, and the engine never needs to know flows exist. Flows belong to the product and to a later application; the engine, the command line and the portal are unaware of them. The portal shows one checkout's charter and never groups, filters or colours anything by flow.

## Clarifications

### Session 2026-09-21

- Q: The portal design shows no agent context anywhere; how far does it go? → A: Removed everywhere. No listing, explanation or form says it, and the warning for more than four primitives putting long content into the main agent's context is dropped from [FR-014](#fr-014), which now raises three warnings.
- Q: The Explain modal's "What it costs" section says the same line for every primitive, and is wrong for a guide with no globs; keep it? → A: Removed from the explanation, on the portal and in the spec.
- Q: The mockup reports a guide with no globs as an error and writes its own "when it comes up" text; which is right? → A: The engine. The mockup's activation text is a placeholder: the portal always shows the kind's own `activatesWhen`, and a guide with no globs is valid and comes up every turn.
- Q: The assumptions still say a primitive declares `always` to be carried in every session; is that still a concept? → A: No. The header is gone from the code, and the assumption is removed.

### Session 2026-09-22

- Q: Which name do users install the package by? → A: `cherry-works`, unscoped, the name the package already has ([FR-126](#fr-126)). The command it puts on the path is `cw`.
- Q: Which license is the project opened under? → A: MIT ([FR-133](#fr-133)).
- Q: How is a release started — by the maintainer on their own machine, or by CI when a version tag is pushed? → A: By the maintainer running one command on their own machine ([FR-137](#fr-137)). There is no CI publishing path, so the package carries no registry provenance.

## User Scenarios & Testing *(mandatory)*

Stories 1 to 4 are the charter and its engine, Stories 5 to 9 the portal, Stories 10 to 12 agent authoring, Stories 13 to 15 distribution, and [Story 16](#user-story-16---open-every-primitive-as-it-was-compiled-priority-p1) the charter compiled for an agent to open. A story's priority ranks it among the stories of its own part of the product.

### User Story 1 - Author a charter and put the agent under it (Priority: P1)

A developer has a repository and a coding agent, and wants the agent to work under written standards instead of ad-hoc prompting. They run the setup command, answer a couple of prompts, and get a charter directory scaffolded in their working tree. They author their first rule as a small markdown file, run the build, and their agent immediately reads it — the rule is now in force for every session in that repository.

**Why this priority**: This is the whole product in miniature. Without it there is nothing to share, nothing to inspect, and nothing for the portal to sit on top of. Everything else refines or distributes what this story produces.

**Independent Test**: Run setup in an empty git repository, author one rule, run the build, and confirm the agent's own instruction surface now contains that rule. Delivers a governed repository with no other story implemented.

**Acceptance Scenarios**:

1. **Given** a git repository with no charter, **When** the developer runs setup, **Then** the charter root, with a directory per kind, and the agents the repository chose are written, nothing is compiled, and all of it is left in the working tree for the developer to read over and commit.
2. **Given** a charter containing a rule, **When** the developer runs the build, **Then** the indexes and every projected file are regenerated from one pass over the charter, and a projection whose source primitive was deleted is removed.
3. **Given** a primitive missing a field its kind requires, **When** the developer runs the health check, **Then** the file and the missing field are named and the command exits with a failure status.
4. **Given** a primitive whose file sits in a kind's directory without declaring its kind, **When** the charter is read, **Then** the kind is taken from the directory and the primitive is treated as valid.
5. **Given** an initialized repository, **When** the developer runs setup again, **Then** their previous answers appear as the defaults and no authored content is discarded.
6. **Given** an agent's entry file that carries the charter's section twice over, **When** the developer runs the build, **Then** the file carries that section once.
7. **Given** an agent's entry file holding the developer's own prose, **When** the developer runs the build twice, **Then** every line of that prose is kept, and the second build changes nothing.

---

### User Story 2 - Adopt shared governance without copying files (Priority: P2)

A team keeps its baselines — security rules, review roles, permissions — in one shared repository, and wants every project to inherit them without anyone copy-pasting. A developer points their repository at that vendor source, and the content arrives committed, pinned to a version. Their own rules keep working beside it: an identity names one primitive in the whole charter, so a repository that redefines a vendored one is told at once and renames its own rather than shadowing someone else's.

**Why this priority**: A charter that lives in one repository helps one team. Distribution is what makes it governance. It depends on [Story 1](#user-story-1---author-a-charter-and-put-the-agent-under-it-priority-p1) having produced something to distribute.

**Independent Test**: Point an initialized repository at a vendor source, confirm the content arrives committed and pinned, and confirm a local rule that reuses a vendored identity is reported.

**Acceptance Scenarios**:

1. **Given** an initialized repository, **When** the developer adds a vendor source by its short git form, **Then** its content is installed under the vendor directory at a pinned version and committed to the repository.
2. **Given** a repository with both a local rule and a vendored rule of the same identity, **When** the charter is read, **Then** both files are named and the charter is refused until one of them is renamed.
3. **Given** a repository with a vendor source installed, **When** the developer brings it up to date or removes it, **Then** the vendored content is updated or deleted to match, each as a commit.

---

### User Story 3 - Trust the charter, and prove it in CI (Priority: P3)

Before relying on a charter, a developer wants to know what the agent will actually see: which file declares each rule, and whether anything is stale or broken. In CI, the team wants a hard gate proving that the committed projections still match the authored charter, so nobody merges a rule change that never reached the agent.

**Why this priority**: Stories 1 and 2 make the charter work. This one makes it trustworthy and keeps it honest over time. Valuable, but a team can ship without it.

**Independent Test**: Explain one primitive and confirm the report names its layer and file; edit a rule without rebuilding and confirm the CI check fails and names the pending changes.

**Acceptance Scenarios**:

1. **Given** a primitive of any layer, **When** the developer asks to explain it, **Then** the layer and the file that declare it are named.
2. **Given** an authored charter, **When** the developer runs the build in preview mode, **Then** nothing is written and every target is listed as create, update, delete or unchanged, with a count.
3. **Given** an authored charter with pending changes, **When** the preview build runs, **Then** it exits with a failure status so CI can gate on it.
4. **Given** a repository already fully built, **When** the preview build runs, **Then** every target is unchanged and it exits successfully.
5. **Given** a repository in any state, **When** the developer runs the health check, **Then** it reports which agents the repository chose, whether validation passes, whether vendored content has drifted, and whether projections are out of date — the last by running the preview build rather than tracking staleness separately.
6. **Given** a self-regression test stating which primitives must be active for a described situation, **When** the developer runs the tests, **Then** each case is resolved against the current charter and reported pass or fail, naming any primitive that was expected active but was not, or active but should not have been.

---

### User Story 4 - Create a correctly-shaped primitive without looking anything up (Priority: P5)

Nine kinds each demand their own fields, and nobody remembers which. A developer names the kind and the id, and is asked for exactly the mandatory fields, and gets a file at the right path holding the answers — nothing invented, nothing missing.

**Why this priority**: Pure convenience. Every kind can be authored by hand in a text editor, and validation already names anything left out, so nothing is blocked without this. It removes a lookup, not an obstacle.

**Independent Test**: Create one primitive of each kind and confirm each lands at the right path carrying exactly its mandatory fields with the answers given, and that validation passes on all of them.

**Acceptance Scenarios**:

1. **Given** an initialized repository, **When** the developer creates a new primitive of a given kind and id, **Then** each field that kind requires is asked for, and a markdown file appears in that kind's directory holding the answers and nothing else.
2. **Given** a kind that is not in the closed set, **When** the developer tries to create a primitive of it, **Then** the command refuses and lists the kinds that exist.
3. **Given** a primitive that already exists at the target path, **When** the developer creates one with the same kind and id, **Then** the command refuses rather than overwriting, so re-running it is safe.

---

### User Story 5 - See what the charter holds and why each rule comes up (Priority: P1)

A developer opens the portal in a governed repository and sees the charter laid out by layer and by kind: the repository's own primitives, then what each vendor source installed. Each row says the primitive's identity, its description, the file it lives in, and what makes it come up. They search for a word and see every primitive that mentions it. They pick one and ask the portal to explain it: what it is, when it activates, what it pulls in, what cites it, and which test cases pin it down.

**Why this priority**: Reading is the whole point of an interface over a charter nobody can hold in their head, and everything else in the portal is built on this view. It delivers value on its own: a team can adopt the portal only to understand its charter and keep authoring by hand.

**Independent Test**: Run the portal in a repository whose charter holds primitives of several kinds and one vendor source; confirm every primitive appears under its layer and kind with the right fields, that a search returns exactly the matching primitives, that the explanation of a guide names its globs, its mixins, its rationale and the cases that cite it, and that a charter holding an error shows its faults instead of a listing.

**Acceptance Scenarios**:

1. **Given** a governed repository, **When** the developer starts the portal, **Then** the command says the address it can be reached at, and the page shows the repository layer with one filter per kind, each carrying the number of primitives of that kind.
2. **Given** a kind selected, **When** the list is shown, **Then** one line above the table says when that kind comes up at all, in the words the kind's own contract declares it in, and each row names the identity, the description, the file path, and what that kind is pinned down by — the globs it matches and the corpus it cites for a guide, the mixins it pulls in for every kind that may name one.
3. **Given** a word typed into the search, **When** the results are shown, **Then** every primitive in any layer whose identity, kind, description, "activates when", path or any header value contains the word is listed, and nothing else.
4. **Given** a primitive, **When** the developer asks for its explanation, **Then** the portal shows its kind and description, when it comes up, the mixins and the corpus it pulls in (each marked if it does not resolve), the primitives that cite or lend from it, every test case that names it with that case's last outcome, and its file and layer.
5. **Given** a charter holding an error, such as two files claiming one identity, **When** the portal is opened, **Then** it says the engine will not read the charter and shows every fault under the file that has to change, the same faults `cw doctor` prints, instead of a listing.
6. **Given** a kind of which the layer holds no primitive, **When** the list is shown, **Then** that kind still has its filter with its count, and selecting it shows an empty state.
7. **Given** a search's results listed under the search box, **When** the developer chooses one, **Then** the portal shows the tab of that primitive's layer with its kind selected and opens the primitive; and **When** the developer clears the search instead, **Then** the list closes and the tab it was showing is left as it was.

---

### User Story 6 - Author, edit and delete a primitive without looking anything up (Priority: P2)

A developer picks a kind and asks for a new one. The portal asks exactly the headers that kind requires, in the shape each takes — one box per glob for a guide, a closed choice of signal for a sensor — and offers the repository's corpus entries when they fill in a rationale. They write the body in a markdown editor with a source and a preview view, and save. One file appears where that kind is authored. Later they open the same primitive, change its globs and body, and save again; or they delete it. A vendored primitive opens read-only and says how to differ from it.

**Why this priority**: Authoring is the second reason to open the portal, and the one it spends most of its surface on. It depends on [Story 5](#user-story-5---see-what-the-charter-holds-and-why-each-rule-comes-up-priority-p1) to find the primitive being edited.

**Independent Test**: Create one primitive of each kind through the portal and confirm each file is what `cw add` writes for the same answers, with the body typed in; edit one and confirm the file changed and nothing else did; delete one and confirm the file is gone; open a vendored one and confirm nothing on it can be saved.

**Acceptance Scenarios**:

1. **Given** a kind selected, **When** the developer asks for a new primitive, **Then** the form asks the identity, the description, every header that kind requires and nothing it does not, with a body editor.
2. **Given** answers the kind refuses — an identity that is not a lowercase slug, a guide with no glob, a sensor with no command, a mixin naming a mixin — **When** the developer saves, **Then** nothing is written and each refusal is shown in the words the engine gives it.
3. **Given** an identity already claimed anywhere in the charter, **When** the developer saves a new primitive under it, **Then** nothing is written and the file already claiming it is named.
4. **Given** an existing repository primitive, **When** the developer opens it, **Then** its kind and identity are shown but cannot be changed, and the form says a rename is a new primitive and a deletion.
5. **Given** an existing repository primitive, **When** the developer changes its headers or body and saves, **Then** its file is rewritten with the new content.
6. **Given** an existing repository primitive, **When** the developer deletes it, **Then** its file is removed, and primitives or test cases still naming it are reported by the next validation as dangling rather than being changed.
7. **Given** a vendored primitive, **When** the developer opens it, **Then** it is shown read-only with its file under the vendor folder, and the portal says that to differ from it they author a primitive under an identity of their own.
8. **Given** any save or delete, **When** it completes, **Then** nothing is compiled and nothing is committed: the change sits in the working tree, and the health check reports the compiled output behind until the next build.
9. **Given** a primitive file changed on disk after the developer opened it, **When** they save, **Then** the save is refused and the file is named, rather than their edit overwriting the other change.

---

### User Story 7 - Build, preview and check the repository's health (Priority: P3)

Before committing, the developer wants to know what a build would change and whether anything is wrong. From the portal's header they preview the build and see every file it would create, update or delete, then build from that preview. They ask for the health check and read the same four answers `cw doctor` gives — agents, charter, vendors, compiled output — together with every error and warning under its file, including the warnings the engine raises about corpus nobody cites, mixins nobody lends from, more than four primitives whose long content is put into the main agent's context, and guides and sensors no test case pins down.

**Why this priority**: Stories 5 and 6 change the charter; this one gets the change to the agent and confirms nothing is broken. A team can still build from the command line without it.

**Independent Test**: Edit a primitive, preview and confirm the listing matches `cw build --preview`; build and confirm the health check says the compiled output is up to date; add an uncited corpus and confirm the health check shows the warning in both the portal and `cw doctor`.

**Acceptance Scenarios**:

1. **Given** a charter with pending changes, **When** the developer previews the build, **Then** nothing is written and every target is listed as create, update, delete or unchanged, with a count, as the engine's preview says it.
2. **Given** a preview, **When** the developer builds from it, **Then** the build runs and the portal lists what it wrote and deleted.
3. **Given** a charter with an error, **When** the developer builds, **Then** nothing is written and the faults are shown under their files.
4. **Given** any repository, **When** the developer asks for the health check, **Then** the portal shows the four answers and every fault that `cw doctor` reports for the same repository, with nothing added and nothing left out, and offers to build when the compiled output is behind.
5. **Given** a corpus no primitive cites, a mixin no primitive lends from, or a guide or sensor that no test case names, **When** the charter is validated from either surface, **Then** each is reported as a warning naming the primitive, and none of them stops a build.

---

### User Story 8 - Install, see and remove vendor sources (Priority: P4)

The developer opens the vendor view and sees each source the repository installed: the folder it landed in, and how many primitives of each kind it brought. They add a baseline by its short git form and a version, and its primitives appear read-only. They remove one they no longer want.

**Why this priority**: Vendoring is done rarely — once per repository per baseline, then an occasional bump — and it is already one command. The portal makes it visible more than it makes it easier.

**Independent Test**: Add a vendor source from the portal and confirm it is installed as `cw vendor add` would install it, committed on the checked-out branch; confirm its primitives are listed read-only with the installing commit named; remove it and confirm its folder is gone.

**Acceptance Scenarios**:

1. **Given** a repository with no vendor source, **When** the developer opens the vendor view, **Then** it says none is installed and offers to add one, and adding one lists the directory names reserved at a source's root.
2. **Given** a source in short git form and an optional version, **When** the developer adds it, **Then** it is installed the way `cw vendor add` installs it, and the portal lists the folder and the primitives it brought.
3. **Given** staged or uncommitted work, or no version control, **When** the developer adds or removes a source, **Then** nothing is installed or removed and the portal shows why, in the engine's words.
4. **Given** installed sources, **When** the vendor view is shown, **Then** each is listed with its folder and its primitives counted by kind.
5. **Given** an installed source, **When** the developer removes it, **Then** its folder is taken away as `cw vendor remove` takes it, and its primitives leave the listing.
6. **Given** a source whose folder would land on a reserved directory name, or a source that cannot be reached, **When** the developer adds it, **Then** nothing already installed is touched and the reason is shown.
7. **Given** a folder under the vendor directory that git put there by hand rather than through the engine, **When** the vendor view is shown, **Then** it is listed as any other source is: the folder is all the view names of a source.

---

### User Story 9 - Write, run and correct the self-regression tests (Priority: P5)

The developer opens the test view and sees every test file the repository wrote, with its description and how many cases it holds. They open one to read its cases — the file touched or the event raised, and what must come up — and run all the tests. The portal says how many cases pass, marks each case pass or fail, says for a failing case what came up instead, and opens the first failing file. They correct a case in the file's text and save it; a file that does not read as a suite is refused with the engine's sample of one that does. They start a new test file, which opens holding one sample case to edit, and delete a file they no longer need.

**Why this priority**: Tests are the smallest surface of the portal and `cw test` already answers them in full. The portal adds reading and writing them beside the charter they pin down.

**Independent Test**: Run the tests from the portal in a repository with one passing and one failing case, and confirm the counts and the reason match `cw test`; create a test file, save an edit to it and confirm the file is written; save text that is not a suite and confirm nothing is written; delete the file and confirm it is gone.

**Acceptance Scenarios**:

1. **Given** a repository with test files, **When** the developer opens the test view, **Then** each file is listed with its name, its description and its case count, and each case shows its situation and its expectation.
2. **Given** test files, **When** the developer runs all tests, **Then** every case is resolved by the engine and shown pass or fail, a summary says how many of how many pass, and each failing case says what came up instead of what was expected.
3. **Given** a test file open for editing, **When** the developer saves text that reads as a suite, **Then** the file is rewritten and every earlier outcome is cleared until the tests run again.
4. **Given** a test file open for editing, **When** the developer saves text that is not JSON or not a suite, **Then** nothing is written and the engine's refusal is shown with its sample of a suite that reads.
5. **Given** a case expecting a primitive the charter holds, **When** it is shown, **Then** the expected identity opens that primitive; an identity the charter does not hold is marked as such.
6. **Given** the test view, **When** the developer asks for a new test file, **Then** a file is written under the test directory with a name no other test file has, holding one sample case, and it opens for editing.
7. **Given** a test file open for editing, **When** the developer deletes it, **Then** the file is removed and earlier outcomes are cleared.
8. **Given** a run in which a case fails, **When** the outcomes are shown, **Then** the first test file holding a failing case is opened.

---

### User Story 10 - Write a primitive with no terminal to answer at (Priority: P1)

A coding agent has decided this repository needs a guide about how its tests are named. It runs one command with the identity, the description and the globs as flags, and the file lands where that kind is authored, shaped the way the kind requires, with the body left for it to write. Nothing waited for a keystroke.

**Why this priority**: This is the whole gap. Without it an agent cannot author at all except by guessing at a file format, and everything else in agent authoring only points at this command. It delivers value on its own: a repository whose agent knows the flags can author correctly, told by hand.

**Independent Test**: Run `cw add` with every header as a flag, with no terminal attached at all, in a repository set up under a charter; confirm the file written is byte for byte the file the interactive run writes for the same answers, and that a run missing a required header writes nothing and names what is missing.

**Acceptance Scenarios**:

1. **Given** a governed repository and no terminal to prompt at, **When** the agent runs `cw add guide test-naming --header description="How tests are named." --header globs="test/**"`, **Then** one file is written where that kind is authored, holding those headers and an empty body, and the command says which file and that the body is still to be written.
2. **Given** a kind whose header takes a list, **When** the flag is given more than once for that header, **Then** every value is kept, in the order given.
3. **Given** a required header left out, **When** the command runs, **Then** nothing is written, and each missing header is named with what it takes — the same words the engine refuses a bad header with anywhere else.
4. **Given** a header the kind does not take, **When** the command runs, **Then** nothing is written and that header is named.
5. **Given** an identity already claimed anywhere in the charter, **When** the command runs, **Then** nothing is written and the file already claiming it is named.
6. **Given** any run where a header was given as a flag, **When** the command runs, **Then** nothing is asked at a prompt, whether or not a terminal is attached.
7. **Given** a successful run, **When** it finishes, **Then** nothing is compiled and nothing is committed: the file sits in the working tree for the author to write the body into and build.

---

### User Story 11 - Ask a kind what it requires, rather than being told (Priority: P2)

Before writing anything the agent asks the engine which kind it should be writing and what that kind wants. One command per kind answers: the headers it requires, the shape each takes, and one complete example of that kind. The agent turns that answer into the flags of [Story 10](#user-story-10---write-a-primitive-with-no-terminal-to-answer-at-priority-p1).

**Why this priority**: [Story 10](#user-story-10---write-a-primitive-with-no-terminal-to-answer-at-priority-p1) works when someone already knows the headers. This is what keeps that knowledge out of every surface that would otherwise go stale — the skill body of [Story 12](#user-story-12---the-instructions-arrive-with-the-engine-not-with-the-repository-priority-p3) above all. It is independently useful: a person choosing a kind reads the same answer.

**Independent Test**: Run `cw kinds <kind>` for every kind there is and confirm each answer names exactly the headers that kind's contract requires, with each header's shape and the kind's own sample; confirm `cw kinds` with no argument prints one line per kind and when it comes up; confirm a word that is no kind is answered with every kind there is.

**Acceptance Scenarios**:

1. **Given** any kind, **When** the agent asks `cw kinds <kind>`, **Then** the answer names every header that kind requires, the shape each takes, and the kind's sample as an author writes one.
2. **Given** no argument, **When** the agent asks `cw kinds`, **Then** the answer is one line per kind, saying when a primitive of that kind comes up.
3. **Given** a word that is no kind, **When** it is asked about, **Then** the answer says so and lists every kind there is.
4. **Given** any kind, **When** its answer here is compared with what `cw add` asks for and what a refusal says, **Then** all three name the same headers in the same words, because all three read the kind's one contract.

---

### User Story 12 - The instructions arrive with the engine, not with the repository (Priority: P3)

A repository is set up under `cw`. Without anyone installing, copying or writing anything, its agent already reads a skill that tells it how to author a primitive here: ask the kind, answer with flags, write the body, build. Nothing was added to the repository for it. The charter it is governed by is what the repository authored, what it installed, and what the engine itself brings — and a listing says which of the three each primitive came from.

**Why this priority**: Stories 10 and 11 give the agent the means; this one means nobody has to tell it. It is last because a repository can be told by hand, once, and still get everything above.

**Independent Test**: Set a fresh repository up and build it; confirm `skill:cw-author` is listed under the layer the engine owns and has compiled to the agent's skill surface with no extra command run and no charter file added; confirm a repository that authors a primitive under that identity is refused with the collision naming both.

**Acceptance Scenarios**:

1. **Given** any governed repository, **When** its charter is read, **Then** what the engine brings is part of it, without any file having been written into the repository to put it there.
2. **Given** any governed repository, **When** `cw build` runs, **Then** this primitive compiles to the agent's skill surface like any other skill in the charter, and nothing under the workspace is written for it.
3. **Given** the engine being upgraded, **When** the next read happens, **Then** what this primitive says is the running engine's, with nothing to refresh and nothing that can be out of date.
4. **Given** the charter being read, **When** it is listed, explained, counted or validated, **Then** this primitive appears like any other, under the layer it came from, and says which layer that is.
5. **Given** a repository that authors a primitive claiming this identity under its own layer, **When** the charter is read, **Then** it is the collision two files claiming one identity always is, naming both ([FR-015](#fr-015)).
6. **Given** this layer, **When** vendor commands are run, **Then** they do not touch it: nothing installed it, and there is nothing under the workspace for them to act on.
7. **Given** this primitive, **When** anyone tries to change it where the charter is authored, **Then** there is nothing to change: what a repository does instead is author its own primitive, which its own layer holds.

---

### User Story 13 - Install `cw` with one command and use it in any repository (Priority: P1)

A developer reads about Cherry Works and wants to try it on their own repository. They install it from the public package registry with the one command their package manager already knows, and `cw` is on their path. They never clone this repository, never build anything and never install a browser or a compiler: `cw init`, `cw build` and `cw portal` work for them exactly as they work for someone who built from source.

**Why this priority**: Until this, the only way in is to clone and build, which is a contributor's path, not a user's. Everything the product does sits behind it.

**Independent Test**: On a machine holding only the supported runtime and git, install the published package, set a fresh repository up, author one rule, build it, and open the portal.

**Acceptance Scenarios**:

1. **Given** a machine with the supported runtime and git, **When** the developer installs the package globally, **Then** `cw` is on their path and `cw --help` lists every command.
2. **Given** the installed `cw`, **When** it is run in any git repository, **Then** every command behaves as it does from a source build, the portal's page included, and nothing of this repository's source is needed.
3. **Given** a developer who does not want a global install, **When** they run `cw` once through their package manager's run-without-installing command, **Then** that run works and nothing is left installed.
4. **Given** a runtime older than the one supported, **When** the developer runs `cw`, **Then** they are told which version it needs and nothing is done.
5. **Given** the installed `cw` and no network, **When** any command but adding or updating a vendor source is run, **Then** it works, as it does from a source build.
6. **Given** the install, **When** what it put on the machine is looked at, **Then** it holds only what `cw` runs on: nothing that exists only to build, bundle or test it.

---

### User Story 14 - Know which `cw` is running, and move to another (Priority: P2)

A developer is asked which version they are on when they report a problem, and a team wants every member and its CI to run the same version. They can ask `cw` its version, upgrade it with their package manager, and pin one version to a repository so that the repository's own scripts always run that one, whatever is installed globally.

**Why this priority**: [Story 13](#user-story-13---install-cw-with-one-command-and-use-it-in-any-repository-priority-p1) gets `cw` onto a machine once. This one keeps it there across releases: without a version to name, a bug report cannot be matched to a release, and a team cannot agree on one.

**Independent Test**: Install one published version globally and another as a development dependency of a repository; confirm `cw --version` names each where it runs; upgrade the global one and confirm the next run is the new version, with the builtin layer the new version's.

**Acceptance Scenarios**:

1. **Given** the installed `cw`, **When** the developer runs `cw --version`, **Then** it prints the version it was published as, and nothing else, and exits successfully.
2. **Given** a newer version published, **When** the developer upgrades with their package manager, **Then** the next run is the new version, and what the builtin layer brings is the new version's with nothing to migrate ([SC-021](#sc-021)).
3. **Given** a repository that declares one version of the package as a development dependency, **When** `cw` is run through that repository's own scripts, **Then** it is that version, whatever version is installed globally.
4. **Given** any repository, **When** the health check runs, from the command line or from the portal, **Then** its report names the version of `cw` that produced it.

---

### User Story 15 - Publish a release that users can trust (Priority: P3)

A maintainer wants to put a new version in users' hands. They ask for a release of one version, and it is published only if what would be published is known to work: the tests pass, the working tree holds nothing uncommitted, the version is new, and the exact package about to be published has been installed apart from the repository and seen to set a repository up and build it. Each published version can be traced back to the commit it was built from.

**Why this priority**: Stories 13 and 14 are what a user sees. This one is how the maintainer gets there without publishing something broken, and it can be done carefully by hand until it exists.

**Independent Test**: Ask for a release with a failing test, then with an uncommitted change, then of a version already published, and confirm each is refused with nothing published; ask for a release from a clean, green tree and confirm the version is published, installable, and tagged at the commit it came from.

**Acceptance Scenarios**:

1. **Given** a clean working tree whose tests pass, **When** the maintainer releases a new version, **Then** that version is published and the repository records the commit it was built from under a tag named after it.
2. **Given** a failing test, or a change not committed, **When** a release is asked for, **Then** it is refused, saying which, and nothing is published.
3. **Given** a version already published, **When** a release of it is asked for, **Then** it is refused, and nothing is published.
4. **Given** the package a release would publish, **When** it is installed apart from the repository and fails to set a fresh repository up and build it, **Then** the release is refused, and nothing is published.
5. **Given** a published package, **When** its contents are listed, **Then** they are the runnable program, the portal's page, the README and the license, and nothing else of the development repository — no specs, tests, sources or its own charter.

---

### User Story 16 - Open every primitive as it was compiled (Priority: P1)

An agent surveying the charter finds a primitive in the catalogue and opens the file the catalogue names. Today that file is the one its author wrote: it lacks the mixins the primitive pulls in, it sits in whichever layer brought it, and for what the engine itself brings it is a name no one can open. After this, a build writes every primitive, from every layer, as one compiled document in the output folder — its headers, then the bodies of its mixins, then its own — and the catalogue names that document. What the agent opens is the whole of what the primitive says, in one place, whoever authored it. A person listing the charter is still shown the file they would edit.

**Why this priority**: The catalogue is the agent's way into every body the charter holds, and today it sends the agent to partial text and, for one layer, to nothing.

**Independent Test**: In a repository with one guide pulling in one mixin, one vendored primitive and the builtin skill, build; confirm `.cw/out/<kind>/<id>.md` exists for each, holds the mixin's body before the guide's, and is what `catalog.json` names; confirm `cw list` still names `.cw/charter/…`, `.cw/vendor/…` and `(built into cw)/…`; delete the guide and build; confirm its compiled document is gone.

**Acceptance Scenarios**:

1. **Given** a charter, **When** it is built, **Then** every primitive of every layer has one document at `.cw/out/<kind>/<id>.md`, holding its headers and, below them, the bodies of the mixins it pulls in, in the order it names them, before its own body.
2. **Given** that build, **When** `catalog.json` is read, **Then** each entry's `file` is that primitive's compiled document, and no entry names a file under `.cw/charter/`, `.cw/vendor/` or the engine.
3. **Given** the builtin skill, **When** the catalogue's `file` for it is opened, **Then** it is a file on disk holding the skill.
4. **Given** a primitive deleted from the charter, **When** the charter is built again, **Then** its compiled document is gone.
5. **Given** a compiled document hand-edited, or a primitive changed since the last build, **When** the build is previewed, **Then** the document is listed as one the build would write.
6. **Given** any charter, **When** it is listed from the command line or the portal, **Then** each primitive is shown with the file it was authored in, as before.

---

### Edge Cases

**The charter and its engine**

- A primitive declares a kind that is not in the closed set — validation fails and names the file and the offending kind.
- Two primitives share an identity, wherever they were authored — validation fails as a collision and names both files.
- A mixin tries to pull in another mixin — validation fails, because mixins are leaves.
- A mixin and its host both set the same single-valued field — the host wins; both set the same list-valued field — the values merge with the host's last.
- A primitive cites reasoning that does not exist — validation reports a dangling reference.
- The vendor source is unreachable, or the pinned version does not exist — the command fails without touching what is already installed.
- A projected file was hand-edited — the next build overwrites it, and the preview build reports it as an update.
- A projection exists whose source primitive was deleted — the build deletes the projection.
- The host's entry file already carries the section — the build writes that section again and leaves the rest of the file, whoever wrote it, untouched.
- The host's entry file exists with no section, or does not exist at all — the build puts the section after what the file holds, or writes the file holding only the section.
- Setup runs outside a git repository — it stops and says so rather than scaffolding into an untracked directory.
- Setup runs with nobody to ask in a repository that has chosen no agent yet — it stops and names the flag that answers it, since the agent has no default there.
- Two commands run back to back over an unchanged charter — the charter is read once, not twice.
- The engine stops shipping a primitive it once shipped — the next build deletes the surface it compiled to, the way a build deletes the projection of any primitive that is gone.
- A catalogue built before compiled documents existed — the next build names the compiled documents in it, and `cw build --preview` lists every one as added.
- A repository set up before the engine brought any primitive of its own — its charter holds what the engine brings from the first read, with nothing to migrate.

**The portal**

- The portal is started outside a git repository, or in one that was never set up — it stops before serving anything and says which, and that `cw init` is how a repository is set up.
- The address the portal would listen on is taken — it listens on another one and says which.
- Two portals are started on one repository — each works; a save made through one is caught by the other's check for changes on disk ([Story 6](#user-story-6---author-edit-and-delete-a-primitive-without-looking-anything-up-priority-p2), scenario 9).
- The charter holds an error when the portal opens — the portal shows the faults under their files; the developer fixes them in their editor, and the listing returns on the next view once the charter holds.
- A file is changed on disk by an editor, an agent or a branch checkout while the portal is open — the next view the developer opens shows the charter as it now is; the portal keeps no copy of the charter between views.
- The developer switches branch while the portal is open — the portal shows the newly checked-out charter on the next view, like any other change on disk.
- A primitive's body is empty — it is saved as empty; whether that is acceptable is the kind's business, reported by validation.
- A deleted primitive is still named by a mixin list, a rationale or a test case — validation reports the dangling reference; the portal does not rewrite the primitives or tests that name it.
- No network is available — everything but adding or updating a vendor source works, the body editor included.
- The repository has no test files — the test view says what a test is for and offers to create one; the health check warns about every guide and sensor that no case pins down.
- A vendored file was hand-edited — the health check names its source and says how to undo it, as `cw doctor` does.

**Distribution**

- `cw` installed globally and another version installed as a repository's development dependency — the repository's scripts run the repository's version; `cw --version` says which one is running wherever it is asked.
- Another program called `cw` already on the path — the developer is told, by the package name in the README, which package this is; `cw --version` on this one names Cherry Works.
- A package published without the portal's page — cannot happen: the release installs what it would publish and runs it first ([FR-135](#fr-135)).
- The registry is unreachable at install time — the package manager fails as it does for any package; nothing of `cw` has run.
- A user upgrades `cw` in a repository whose compiled output an older `cw` wrote — the health check says the output is behind wherever the new version would write something different, as it does after any charter change ([FR-080](#fr-080)).

**Agent authoring**

- A `--header` value that itself contains `=` — everything after the first `=` is the value.
- `--header` given with no `=` at all — nothing is written, and the flag is named.
- The same single-valued header given twice — nothing is written, and the header is named; only a header that takes a list may be repeated.
- No header flag given and no terminal to ask at — nothing is written, and the command says the headers it would have asked for, rather than waiting for an answer nobody will type.
- A header value that is empty — it is refused where the kind refuses an empty value, in the kind's own words.
- The agent asks for a kind it invented — answered with every kind there is, as an unknown kind is everywhere else.
- The charter holds an error — `cw kinds` still answers, because what a kind requires is not read off the charter; `cw add` refuses as it always does.

## Requirements *(mandatory)*

### Functional Requirements

**The charter format**

- <a id="fr-001"></a>**FR-001**: The system MUST recognise exactly these primitive kinds — guide, sensor, command, skill, playbook, agent, posture, corpus and mixin — and MUST treat any other kind as a validation error. The set is closed.
- <a id="fr-002"></a>**FR-002**: Every primitive MUST be a single markdown file kept in the directory of its kind within the charter root, and MUST carry at minimum a kind, an identity and a description. The system MUST look for primitives in those directories and nowhere else, so that the catalogues, the lockfile and every other generated file beside them are never read as primitives.
- <a id="fr-003"></a>**FR-003**: Every primitive MUST declare its own kind, and the system MUST read it as that kind wherever the file sits. A file that declares no kind, or one outside the set, MUST be reported.
- <a id="fr-004"></a>**FR-004**: The system MUST enforce, per kind, the additional fields that kind requires: a triggering signal and the command it runs, for a sensor; activation triggers for a skill and for a playbook; a tool list for an agent; and permission lists for a posture. A mixin MUST NOT pull in mixins of its own.
- <a id="fr-005"></a>**FR-005**: The system MUST let any primitive cite the reasoning behind it, and MUST treat that reasoning as loaded only on demand rather than always present.
- <a id="fr-006"></a>**FR-006**: The system MUST let a primitive pull in one or more mixins, each lending its body to the host at projection time. No field is merged: a mixin lends text, not fields. Where both the host and the mixin name the files they apply to, one side's globs MUST cover the other's, in either direction, and a pair that covers neither way MUST be reported. A mixin MUST NOT itself pull in another mixin.
- <a id="fr-007"></a>**FR-007**: A primitive that names a mixin no layer holds MUST be reported.
- <a id="fr-008"></a>**FR-008**: The system MUST support an orthogonal tagging taxonomy across all kinds, independent of kind and directory.

**Reading and validating the charter**

- <a id="fr-009"></a>**FR-009**: The system MUST read the charter through a single shared entry point used by every command that needs it, and a command MUST read each charter file at most once, whatever it goes on to do with the charter.
- <a id="fr-010"></a>**FR-010**: The system MUST validate the charter against the closed kind set, per-kind required fields, identity shape, tag shape, and identity collisions, and MUST report each failure with its file and the specific problem.
- <a id="fr-011"></a>**FR-011**: Validation MUST write nothing and MUST signal failure through its exit status so an automated pipeline can gate on it.
- <a id="fr-012"></a>**FR-012**: Every fault the system reports MUST say, beside what is wrong, the next move that fixes it, wherever there is one.
- <a id="fr-013"></a>**FR-013**: Validation MUST NOT be a command of its own. What is wrong with the charter MUST be reported, in full, by the health check ([FR-080](#fr-080)), so that no two commands read one charter and answer differently.
- <a id="fr-014"></a>**FR-014**: Validation MUST raise a warning for each corpus no primitive cites, each mixin no primitive lends from, and each guide and sensor that no test case names. A posture is not warned about: a case asking whether a file is allowed names no posture, and a posture's `deny` may name commands no case can touch. None of them MUST stop a build or a listing ([FR-010](#fr-010)). The command line and the portal both show them, because both read validation.

**Identity and layers**

- <a id="fr-015"></a>**FR-015**: An identity MUST name one primitive in the whole charter, whichever layer authored it — the repository, a vendor source, or the engine itself. Two files claiming one identity, in any two layers or in one, MUST be reported as a collision naming both, never resolved by precedence.
- <a id="fr-016"></a>**FR-016**: A repository MUST therefore take what it vendors, and what the engine brings, as it stands: to differ from such a primitive it authors one under its own identity, rather than shadowing it.
- <a id="fr-017"></a>**FR-017**: The charter MUST have a third layer, beside what the repository authored and what it installed, holding what the running engine itself brings.
- <a id="fr-018"></a>**FR-018**: This layer MUST be supplied by the engine on every read of the charter, and MUST NOT be written into the repository: no command may add, refresh or remove a file for it.
- <a id="fr-019"></a>**FR-019**: This layer MUST be read as part of the charter everywhere a charter is read: listed, searched, explained, compiled, counted, validated, and shown by the portal, each time saying which layer it came from.
- <a id="fr-020"></a>**FR-020**: Its primitives MUST be read the way every other primitive is read — against the same kind contracts, with the same faults — so nothing reaches the charter by a path that skips what a charter file is checked for.
- <a id="fr-021"></a>**FR-021**: When a repository's primitive claims an identity this layer holds, the collision MUST be filed against the repository's file, and its fix MUST say that the engine brings that identity, so it is the repository's own primitive that is renamed.
- <a id="fr-022"></a>**FR-022**: The generated charter document (`.cw/out/CHARTER.md`), where it explains identities, MUST name this third layer.
- <a id="fr-023"></a>**FR-023**: The vendor commands MUST NOT act on this layer: nothing installed it, and there is nothing under the workspace for them to act on.
- <a id="fr-024"></a>**FR-024**: What this layer compiles to MUST be compiled and deleted by the build exactly as any other primitive's projection is, so an engine that stops shipping one leaves nothing behind.

**Discovery**

- <a id="fr-025"></a>**FR-025**: The system MUST produce a full catalogue of every primitive's descriptive fields together with its location.
- <a id="fr-026"></a>**FR-026**: The system MUST also produce a reduced catalogue carrying only kind, identity and description, so an agent can survey what exists cheaply before opening anything.
- <a id="fr-027"></a>**FR-027**: Neither catalogue MUST contain primitive bodies. A body is opened only when its activation condition is met, by way of its recorded location.
- <a id="fr-028"></a>**FR-028**: The system MUST list the charter one primitive to a line: the full listing by default, the reduced one on request, and narrowed to one kind on request. A charter with an error MUST list nothing and send the reader to the health check.

**Explaining a primitive**

- <a id="fr-029"></a>**FR-029**: The system MUST be able to say, for any identity, which file declares it — or, for a primitive the engine brings, that it is the engine's own — and the layer that file was authored in. The explanation MUST also say when it comes up, the mixins and corpus it pulls in with each marked where it does not resolve, the primitives that lend from it or cite it, and the test cases that name it. The command line and the portal MUST say the same. A collision is not answered there: both files that claim the identity are named by the health check, where every other fault is.

**Applying the charter**

- <a id="fr-030"></a>**FR-030**: The system MUST compile the charter into the instruction surface the agent actually reads, including an agent-neutral instruction file and, when an agent is chosen, that agent's own command, role, capability and permission surfaces.
- <a id="fr-031"></a>**FR-031**: An agent-neutral target MUST always exist, so that applying the charter is possible even when no agent is installed.
- <a id="fr-032"></a>**FR-032**: Compiled output MUST be treated as generated: regenerated wholesale on every build, never hand-edited, and deleted when the primitive it came from is removed.
- <a id="fr-033"></a>**FR-033**: The system MUST regenerate the catalogues and the compiled output together from one reading of the charter, so the two cannot fall out of step. There MUST NOT be a way to produce one without the other.
- <a id="fr-034"></a>**FR-034**: The system MUST offer a preview that writes nothing and instead lists every target as create, update, delete or unchanged with a count, and signals through its exit status whether anything would change.
- <a id="fr-035"></a>**FR-035**: The build MUST put the charter in front of each agent it compiles for where that agent reads instructions unasked — for claude, `CLAUDE.md` at the repository root — as one section, opened by `<!-- CHERRYWORKS START -->` and closed by `<!-- CHERRYWORKS END -->`, that sends the reader to the agent-neutral orientation and carries nothing else. That file is the repository's own and not generated output: everything outside the section MUST be left exactly as it was, a section already there MUST be written in place, one that is not there MUST be put after what the file holds, and the file MUST never be deleted by a build.
- <a id="fr-036"></a>**FR-036**: The agent-neutral orientation MUST say what governs the repository, send its reader to the reduced catalogue first, and say for each kind when it applies. It MUST carry no primitive body, so it does not grow with the charter.
- <a id="fr-037"></a>**FR-037**: Each primitive compiled for an agent MUST carry its body, preceded by the bodies of the mixins it pulls in.
- <a id="fr-038"></a>**FR-038**: The build MUST compile for the agents the repository chose at setup, so a charter builds the same files wherever it is checked out.
- <a id="fr-039"></a>**FR-039**: A host's settings file MUST be written into rather than over: every posture and sensor of the charter lands in it beside whatever the repository set there for itself, and a build MUST NOT delete it.
- <a id="fr-040"></a>**FR-040**: A charter with an error MUST make the build write nothing at all.

**Vendor sources**

- <a id="fr-041"></a>**FR-041**: The system MUST install vendored charter content from a git source identified by a short form carrying optional host, owner, repository and version, pinned to that version.
- <a id="fr-042"></a>**FR-042**: The system MUST install a source repository whole.
- <a id="fr-043"></a>**FR-043**: The system MUST attach no meaning to a vendored directory's name. Any grouping such a name implies belongs to the people using it, not to the system.
- <a id="fr-044"></a>**FR-044**: The system MUST install vendored content only under the vendor directory, beside the charter rather than inside it, so no vendor source can land on a kind directory or on what this repository authored.
- <a id="fr-045"></a>**FR-045**: The system MUST allow more than one vendor source per repository.
- <a id="fr-046"></a>**FR-046**: The system MUST commit vendored content to the repository it installs into, so a checkout carries the whole charter it is governed by with nothing left to fetch. It MUST NOT exclude that content from version control, and MUST NOT keep a record of its own beside it: the repository's history is that record.
- <a id="fr-047"></a>**FR-047**: The system MUST support bringing an installed source up to date and removing it. Bringing one up to date MUST be the same thing as installing it, so there is one command rather than two.
- <a id="fr-048"></a>**FR-048**: Installing vendored content MUST NOT depend on any central service beyond the git source itself.
- <a id="fr-049"></a>**FR-049**: Installing MUST accept a source address as it was typed, so that every transport git supports works. A source that cannot be reached, or a version that is not there, MUST be refused in git's own words, installing nothing.
- <a id="fr-050"></a>**FR-050**: An installed source MUST land in a folder of its own under the vendor directory, named by the end of its address without a trailing `.git`.
- <a id="fr-051"></a>**FR-051**: Installing, updating and removing a vendor source MUST each land as a commit on the branch checked out, and MUST therefore be refused while the repository has uncommitted work in hand.
- <a id="fr-052"></a>**FR-052**: Installing a vendor source MUST compile nothing: the build is the one command that writes what an agent reads.
- <a id="fr-053"></a>**FR-053**: The engine MUST be able to list every installed vendor folder. It MUST NOT record where a folder came from or at which version: version control keeps no such record of a subtree, and a record kept beside it is one the repository's history does not hold ([FR-046](#fr-046)). Bringing a source up to date is installing it again with its source, as it was first typed.

**Setup**

- <a id="fr-054"></a>**FR-054**: Setup MUST run inside a git repository, and MUST stop with an explanation when there is none.
- <a id="fr-055"></a>**FR-055**: Setup MUST ask which agent the charter compiles for, offering the agents this engine compiles for and defaulting to the one the repository already chose, and MUST refuse to finish until at least one is chosen: a charter is authored to instruct an agent. It MUST NOT detect what is installed on the machine: choosing an agent compiles everything that agent reads, and the build creates the directory it reads from whether it was there or not.
- <a id="fr-056"></a>**FR-056**: Every setup prompt MUST have a default acceptable without typing and an equivalent that can be supplied non-interactively, so the whole run is scriptable. The one exception is the agent in a repository that has chosen none yet: it has no default, so a run with nobody to ask MUST stop and name the flag that answers it.
- <a id="fr-057"></a>**FR-057**: Setup MUST create the charter root with a directory per kind and record the agents the repository chose, and MUST compile nothing: compiling the charter is the build's, run once there is a charter to compile. It MUST NOT commit the result: what it wrote is left in the working tree for whoever ran it to read over and commit themselves.
- <a id="fr-058"></a>**FR-058**: Re-running setup in an initialized repository MUST reconfigure it — offering current answers as defaults — and MUST NOT discard authored content.

**Asking a kind what it requires**

- <a id="fr-059"></a>**FR-059**: `cw kinds <kind>` MUST answer with that kind's required headers, the shape each takes, and the kind's sample.
- <a id="fr-060"></a>**FR-060**: `cw kinds` with no argument MUST answer with one line per kind, saying when a primitive of that kind comes up.
- <a id="fr-061"></a>**FR-061**: A word that is no kind MUST be answered with every kind there is, as an unknown kind is answered elsewhere.
- <a id="fr-062"></a>**FR-062**: What this answers MUST be the kind's one declaration of what it requires — the same one the prompts ask from and the same one a refusal is worded from. No surface may restate it.
- <a id="fr-063"></a>**FR-063**: Asking a kind MUST add no capability of its own to the engine: it is another way of asking what the engine already answers when it prompts and when it refuses.

**Creating a primitive**

- <a id="fr-064"></a>**FR-064**: The system MUST create a new primitive of a named kind and identity, holding the answers given for the headers that kind takes and nothing else.
- <a id="fr-065"></a>**FR-065**: With someone at the terminal and no header given as a flag, creating a primitive MUST ask for each header its kind requires, and an answer the kind refuses MUST be said before anything is written. With no header flag and nobody at the terminal, it MUST write nothing and MUST say which headers it would have asked for, rather than waiting or writing a file the next build refuses.
- <a id="fr-066"></a>**FR-066**: `cw add <kind> <id>` MUST accept `--header <name>=<value>`, given once per header.
- <a id="fr-067"></a>**FR-067**: A header that takes a list MUST accept the flag repeated, keeping every value in the order given. A header that takes one value MUST refuse a second.
- <a id="fr-068"></a>**FR-068**: A value MUST be everything after the first `=`. A flag with no `=` MUST be refused, naming the flag.
- <a id="fr-069"></a>**FR-069**: A header a kind takes without requiring it MUST be accepted as a flag, shaped as the kind takes it (a guide's globs, as in [Story 10](#user-story-10---write-a-primitive-with-no-terminal-to-answer-at-priority-p1), scenario 1). The prompt path MUST still ask only for the headers the kind refuses a file without.
- <a id="fr-070"></a>**FR-070**: When any header flag is given, the command MUST ask nothing at a prompt.
- <a id="fr-071"></a>**FR-071**: A run missing a required header MUST write nothing and MUST name every missing header with what it takes.
- <a id="fr-072"></a>**FR-072**: A header the kind does not take MUST write nothing and MUST be named.
- <a id="fr-073"></a>**FR-073**: Every refusal MUST be worded as the engine words it: the flag path and the prompt path MUST refuse the same answers with the same words.
- <a id="fr-074"></a>**FR-074**: A successful run MUST write exactly the file the prompt path writes for the same answers, with an empty body, and MUST compile nothing and commit nothing: the body is what its author has yet to write.

**Changing and deleting a primitive**

- <a id="fr-075"></a>**FR-075**: The engine MUST be able to rewrite an existing repository primitive's headers and body, keeping its kind and identity, and MUST refuse it with the same faults creating one gives for answers the kind refuses. The portal MUST show an existing primitive's kind and identity without letting them be changed.
- <a id="fr-076"></a>**FR-076**: The engine MUST be able to delete an existing repository primitive's file, and nothing else.
- <a id="fr-077"></a>**FR-077**: The engine MUST refuse to rewrite or delete a vendored primitive, naming the vendor folder it belongs to.
- <a id="fr-078"></a>**FR-078**: Rewriting a primitive MUST be refused, with the file named, when the file changed on disk after the author opened it.
- <a id="fr-079"></a>**FR-079**: Neither creating, rewriting nor deleting a primitive MUST compile or commit anything: what it writes is left in the working tree, and a build is the command that compiles ([FR-032](#fr-032)).

**Health**

- <a id="fr-080"></a>**FR-080**: The system MUST report, in one command, which agents the repository chose, whether validation passes, whether vendored content has drifted, and whether compiled output is out of date — determining the last by running the preview rather than tracking staleness independently.
- <a id="fr-081"></a>**FR-081**: The health check MUST say so rather than fail when the repository chose no agent; MUST name a vendor whose content differs from what was committed once, however many of its files differ; and MUST ask every one of its questions whatever the one before it answered, since one command is one report.

**Self-regression tests**

- <a id="fr-082"></a>**FR-082**: A self-regression test MUST describe one or more cases, each putting one situation — a file touched, or an event raised — and asserting the one thing expected of the charter in it: that a named primitive comes up, or that the path is allowed or refused. A test is not a primitive: it is no part of the charter, nothing compiles it, and no agent is instructed by it, so it lives beside the charter and is written in a machine format rather than as a document with a body.
- <a id="fr-083"></a>**FR-083**: Running the tests MUST resolve each described situation against the current charter and report pass or fail per case, naming every expectation that was not met.
- <a id="fr-084"></a>**FR-084**: Running the tests MUST NOT require an execution environment, a network, or an agent. Resolution alone decides the result, so the outcome is deterministic and the command stays a reader.
- <a id="fr-085"></a>**FR-085**: Running the tests MUST signal failure through its exit status so an automated pipeline can gate on it.
- <a id="fr-086"></a>**FR-086**: A test file that does not read — not in the machine format, a case putting no situation or two, an expectation that does not go with the situation put before it, a field nothing reads — MUST be reported as that file's own fault and answered with a sample of a file that does read.
- <a id="fr-087"></a>**FR-087**: An expectation naming an identity the charter holds nothing of, or one of a kind the case's situation cannot bring up, MUST be reported unmet rather than passed over.
- <a id="fr-088"></a>**FR-088**: A test file that does not read MUST stop the run, reported as the fault it is, since the cases beside it would report a pass that does not cover what it was written to cover.
- <a id="fr-089"></a>**FR-089**: A repository with no test MUST be told so, and the run MUST pass: writing none is not a failure.
- <a id="fr-090"></a>**FR-090**: The engine MUST be able to rewrite one existing test file with new text, and MUST refuse text that does not read as a suite with the same refusal and sample `cw test` gives.
- <a id="fr-091"></a>**FR-091**: The engine MUST be able to create a test file under a name no other test file has, holding one sample case that reads as a suite.
- <a id="fr-092"></a>**FR-092**: The engine MUST be able to delete one test file, and nothing else.

**The command line**

- <a id="fr-093"></a>**FR-093**: The command surface MUST be divided by side effect: commands that only read MUST write nothing, and every write MUST come from one command whose purpose is to write.
- <a id="fr-094"></a>**FR-094**: Asked for help, the command line MUST print its usage and exit successfully.
- <a id="fr-095"></a>**FR-095**: The command line MUST refuse an unknown command or flag, and MUST answer a near miss with the command it most likely meant.

**The authoring skill the engine ships**

- <a id="fr-096"></a>**FR-096**: `cw` MUST ship a primitive of kind `skill`, in the layer the engine owns, whose subject is authoring a primitive in this repository.
- <a id="fr-097"></a>**FR-097**: Its body MUST name no kind's headers and MUST restate no kind's requirements. It MUST say to ask the engine instead.
- <a id="fr-098"></a>**FR-098**: Its body MUST say the procedure: ask the kind what it requires, write the primitive with one flag per header, write the body, build.
- <a id="fr-099"></a>**FR-099**: Its body MUST say that it is the engine's own and is not authored in this repository, and that a repository wanting something else authors its own primitive.
- <a id="fr-100"></a>**FR-100**: Its triggers MUST bring it up when what is being asked is to write a rule, a standard, a skill, a command or any other primitive of this charter.
- <a id="fr-101"></a>**FR-101**: It MUST say that changing or removing a primitive that already exists is not what it covers.
- <a id="fr-102"></a>**FR-102**: Its body MUST say that a refusal from `cw add` or `cw build` is read and answered, and MUST send a refused build to `cw doctor`.
- <a id="fr-103"></a>**FR-103**: Every `cw` command its body names MUST be a command `cw` has, so it describes nothing that does not answer.

**The portal: starting it**

- <a id="fr-104"></a>**FR-104**: The system MUST offer a command that starts the portal for the repository it is run in, and MUST print the address the portal can be reached at.
- <a id="fr-105"></a>**FR-105**: The portal MUST serve one repository for as long as it runs: the one it was started in. It MUST NOT offer a way to point it at another.
- <a id="fr-106"></a>**FR-106**: The portal MUST be reachable only from the machine it runs on. It MUST NOT ask anyone to sign in.
- <a id="fr-107"></a>**FR-107**: The command MUST stop before serving anything when run outside a git repository or in a repository that was never set up, and MUST say which and how to set one up.

**The portal: reaching the engine**

- <a id="fr-108"></a>**FR-108**: The portal MUST reach the engine only the way the command line does, and MUST hold no rule about the charter of its own: every validation, listing, explanation, build, preview, test result and health answer it shows MUST be what the engine returned.
- <a id="fr-109"></a>**FR-109**: Everything the portal shows or does MUST also be available from the command line. Each capability the portal needs from the engine MUST be added to the engine and given a command-line equivalent in the same change, so the two surfaces cannot drift apart.
- <a id="fr-110"></a>**FR-110**: The portal MUST read the charter afresh whenever it shows a view, and MUST NOT keep a copy of the charter between views, so a change made on disk by anyone is what the next view shows.
- <a id="fr-111"></a>**FR-111**: The portal MUST work without a network connection for everything except adding or updating a vendor source.

**The portal: reading the charter**

- <a id="fr-112"></a>**FR-112**: The portal MUST show the repository layer and the vendor layer separately, and within each MUST let the developer narrow to one kind, showing beside every kind how many primitives of it the layer holds.
- <a id="fr-113"></a>**FR-113**: Every listed primitive MUST show its identity, description, file path, and the headers its kind is activated by, as described in [Story 5](#user-story-5---see-what-the-charter-holds-and-why-each-rule-comes-up-priority-p1), scenario 2; and each listing MUST say, once per kind rather than once per primitive, when that kind comes up, read off that kind's own contract. Which kinds there are, and when each comes up, MUST be answered by the engine rather than known by whichever surface is listing.
- <a id="fr-114"></a>**FR-114**: The portal MUST search every primitive in every layer by identity, kind, description, path and header value, and MUST show only the primitives that match.
- <a id="fr-115"></a>**FR-115**: When the charter holds an error, the portal MUST say the engine will not read the charter and show every fault under the file that has to change, in the words the engine gives it, instead of a listing.
- <a id="fr-116"></a>**FR-116**: The portal MUST offer the explanation ([FR-029](#fr-029)) from every listed primitive, and each identity in it MUST open that primitive's own explanation.

**The portal: authoring**

- <a id="fr-117"></a>**FR-117**: Creating a primitive from the portal MUST ask the headers the engine says the kind requires ([FR-064](#fr-064)), in the shape each takes, plus the description, the rationale, the mixins and the body, and MUST write the primitive the way `cw add` writes it, with the body the author typed.
- <a id="fr-118"></a>**FR-118**: A header drawn from a closed set, such as a sensor's signal or a new primitive's kind, MUST be chosen from that set rather than typed. A rationale MUST offer the corpus the charter holds.
- <a id="fr-119"></a>**FR-119**: The body editor MUST offer a source view with markdown highlighting and a rendered preview, and MUST work offline ([FR-111](#fr-111)).

**The portal: building and health**

- <a id="fr-120"></a>**FR-120**: The portal MUST offer a preview of the build, listing every target as create, update, delete or unchanged with a count, and a real build, listing what it wrote and deleted — both as the engine returns them.
- <a id="fr-121"></a>**FR-121**: The portal MUST offer the health check, showing the same four answers and the same faults `cw doctor` reports for the same repository, and MUST offer a build from it when the compiled output is behind.

**The portal: vendor sources**

- <a id="fr-122"></a>**FR-122**: The portal MUST list every installed vendor source with the folder it landed in and its primitives counted by kind.
- <a id="fr-123"></a>**FR-123**: The portal MUST offer adding a source by its short git form and an optional version, and removing an installed one by its folder, through the engine's vendoring, and MUST show the engine's refusal whenever one is refused.

**Distribution**

- <a id="fr-126"></a>**FR-126**: The engine MUST be published to the public npm registry as one package named `cherry-works`, whose install puts one command, `cw`, on the path.
- <a id="fr-127"></a>**FR-127**: The installed package MUST run every command, the portal and its page included, with no build step, no source checkout, and no compiler, native toolchain or browser download on the user's machine.
- <a id="fr-128"></a>**FR-128**: The package MUST declare the oldest runtime version it supports, and `cw` run on an older one MUST name the version it needs and exit with a failure status before doing anything else.
- <a id="fr-129"></a>**FR-129**: Installing the package MUST install only what `cw` needs at run time. What exists only to build, bundle or test it — including everything the portal's page was built from — MUST NOT be installed.
- <a id="fr-130"></a>**FR-130**: The package MUST hold only what a user needs: the runnable program, the portal's page, the README and the license. The specs, the tests, the sources, the repository's own charter and anything else of the development repository MUST NOT be in it.
- <a id="fr-131"></a>**FR-131**: `cw --version` MUST print the version the package was published as, and nothing else, and exit successfully.
- <a id="fr-132"></a>**FR-132**: The health check MUST name the version of `cw` that produced it, on the command line and in the portal alike ([FR-121](#fr-121)).
- <a id="fr-133"></a>**FR-133**: The repository MUST carry the MIT license, declared in the package and shipped in it.
- <a id="fr-134"></a>**FR-134**: A release MUST be refused, publishing nothing, unless the working tree holds no uncommitted change, every test passes, and the version has never been published.
- <a id="fr-135"></a>**FR-135**: Before a release publishes, the exact package it would publish MUST be installed apart from the repository and used to set a fresh repository up and build it; the release MUST be refused if either fails.
- <a id="fr-136"></a>**FR-136**: Every published version MUST be traceable to the commit it was built from, recorded in the repository as a tag named after the version.
- <a id="fr-137"></a>**FR-137**: A release MUST be started by the maintainer running one command on their own machine, and every check of [FR-134](#fr-134) and [FR-135](#fr-135) MUST run on that path.
- <a id="fr-138"></a>**FR-138**: The README MUST give the install from the registry as the way to get `cw`, and building from source as the contributor's way.

**The compiled charter**

- <a id="fr-139"></a>**FR-139**: A build MUST write every primitive of every layer as one compiled document at `.cw/out/<kind>/<id>.md`: its headers, and below them the bodies of the mixins it pulls in, in the order it names them, before its own. A compiled document MUST carry the mark of generated output, and MUST be deleted by the build that no longer compiles it.
- <a id="fr-140"></a>**FR-140**: The full catalogue MUST name, as each primitive's file, its compiled document. A listing of the charter — on the command line and in the portal — MUST name the file each primitive was authored in, read off the charter rather than off the catalogue.

**The portal: tests**

- <a id="fr-124"></a>**FR-124**: The portal MUST list every test file with its name, description and case count, and each case's situation and expectation.
- <a id="fr-125"></a>**FR-125**: The portal MUST run every test through the engine and show each case's outcome, the count passing out of the total, and for a failing case what came up instead.

### Key Entities

The shape of each is in the data model.

- **Primitive**: One authored markdown file with structured fields and a body, the unit everything else operates on (data-model).
- **Kind**: One of a closed set of categories, deciding the directory, the required fields and the activation rule (data-model).
- **Kind requirement**: What a kind says it requires — a header, and the shape that header takes. Declared once, where the kind's contract is, and answerable to whoever asks (data-model).
- **Header answer**: One name and one value, given at a prompt by a person or as a flag by an agent. The same answer either way (data-model).
- **Mixin**: A primitive whose purpose is to be pulled into others, written once and reused (data-model).
- **Charter root**: The directory in a repository holding authored primitives and the catalogues, with vendored content installed beside it (data-model).
- **Layer**: Where a primitive came from — this repository, one vendor source it installed, or the running engine itself (data-model).
- **Builtin layer**: The part of the charter the running engine itself brings. It is supplied on every read rather than kept anywhere in the repository, and is read, checked and compiled exactly as the other two layers are. Installed from nothing, removable by nothing, and never out of date (data-model).
- **`skill:cw-author`**: The primitive the builtin layer brings: what a coding agent reads when it is about to author a primitive here (data-model).
- **Vendor source**: Charter content installed whole from a pinned git source (data-model).
- **Catalogue**: The full and reduced listings of every primitive's descriptive fields (data-model).
- **Compiled output**: The instruction surfaces generated from the charter for the agent to read (data-model).
- **Compiled primitive**: One primitive as an agent opens it: its headers and the whole of its body, its mixins' included, written into the output folder whichever layer it came from (data-model).
- **Explanation**: What the engine says about one identity: its file and layer, when it comes up, what it pulls in, what names it, and which cases pin it down (data-model).
- **Warning**: A fault that is worth saying and not worth stopping on. Validation raises three of them ([FR-014](#fr-014)); shape in the data-model.
- **Portal**: The graphical interface over one repository's charter, served on the developer's own machine for as long as its command runs. Holds no state about the charter of its own.
- **View**: One of the portal's pages — the repository layer, the vendor layer, the tests, a search, an explanation, a health report, a build result. Each is read from the engine when it is shown.
- **Draft**: The answers and body an author has typed for a primitive not yet saved. The only thing the portal holds that the engine has not been told, and gone when it is saved or cancelled (data-model).
- **Package**: What one release publishes to the registry: the runnable program, the portal's page, the README and the license, under one version.
- **Release**: One version of the package, published once, never replaced, and tagged at the commit it was built from.
- **Flow**: One branch holding one charter. A convention of the product and of a later application; carries no meaning inside the engine, the command line or the portal.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- <a id="sc-001"></a>**SC-001**: A developer with an existing repository goes from no charter to a governed repository — set up, first rule authored, agent reading it — in under five minutes.
- <a id="sc-002"></a>**SC-002**: Creating a correctly-shaped primitive of any kind takes one command and requires no reference to documentation for which fields are mandatory.
- <a id="sc-003"></a>**SC-003**: 100% of validation failures name the offending file and the specific problem; none report only that something is wrong.
- <a id="sc-004"></a>**SC-004**: The catalogues and the compiled output cannot disagree: no sequence of supported commands produces one without the other.
- <a id="sc-005"></a>**SC-005**: An agent surveying what the charter contains reads a listing at least ten times smaller than the full charter before opening anything.
- <a id="sc-006"></a>**SC-006**: Any identity can be traced in one command to the single file that declares it, and any collision names both files that claim it.
- <a id="sc-007"></a>**SC-007**: A pipeline can prove that committed compiled output still matches the authored charter, and fails when it does not.
- <a id="sc-008"></a>**SC-008**: Any modification to installed vendored content is detected and reversible, with no case in which an edited vendored file is silently trusted.
- <a id="sc-009"></a>**SC-009**: Adopting a team's shared governance in a new repository takes one command.
- <a id="sc-010"></a>**SC-010**: A command reads each charter file once, however many of validation, compilation and testing it performs.
- <a id="sc-011"></a>**SC-011**: The entire setup runs unattended from supplied values, with no interactive prompt required.
- <a id="sc-012"></a>**SC-012**: A developer goes from running the portal command to reading their charter in under ten seconds, for a charter of two hundred primitives.
- <a id="sc-013"></a>**SC-013**: A developer who has never read the charter format creates a valid primitive of any kind from the portal on the first attempt, without opening documentation.
- <a id="sc-014"></a>**SC-014**: For every repository state, the portal's health report and `cw doctor` name the same faults, and the portal's build preview and `cw build --preview` list the same targets.
- <a id="sc-015"></a>**SC-015**: 100% of what the portal can do can also be done from the command line.
- <a id="sc-016"></a>**SC-016**: No save from the portal overwrites a change made on disk after the file was opened.
- <a id="sc-017"></a>**SC-017**: With the network disconnected, every portal capability but vendor installation works, the body editor included.
- <a id="sc-018"></a>**SC-018**: Any primitive can be traced from the portal, in one step, to its file, its layer, what makes it come up and every test case that pins it down.
- <a id="sc-019"></a>**SC-019**: A coding agent with no terminal attached authors a valid primitive of any kind, on the first attempt, having read nothing but what the engine answered it.
- <a id="sc-020"></a>**SC-020**: The shipped skill's body names zero header names and zero kinds' requirements, and stays correct when a kind's requirements change without it being edited.
- <a id="sc-021"></a>**SC-021**: Upgrading `cw` changes what an agent is told about a kind immediately, with no rebuild, no migration and no file to refresh.
- <a id="sc-022"></a>**SC-022**: For every answer a kind refuses, the flag path and the prompt path refuse it in the same words.
- <a id="sc-023"></a>**SC-023**: For every set of answers, the flag path and the prompt path write the same file.
- <a id="sc-024"></a>**SC-024**: A repository set up and built from scratch has the authoring skill on its agent's surface with no command run beyond set-up and build, and with nothing added under its workspace to put it there.
- <a id="sc-025"></a>**SC-025**: 100% of what the agent can do here can also be done from the command line by a person, and the reverse: the flags answer exactly the prompts.
- <a id="sc-026"></a>**SC-026**: Every user story is delivered as one reviewable change, leaving the repository building and passing its tests. No cap is set on how many lines that change touches.
- <a id="sc-027"></a>**SC-027**: A developer with only the supported runtime and git goes from nothing installed to `cw --help` with one command, in under one minute on an ordinary connection.
- <a id="sc-028"></a>**SC-028**: For the same repository, 100% of commands answer the same from the published package as from a source build.
- <a id="sc-029"></a>**SC-029**: Installing `cw` adds under 20 MB to the machine.
- <a id="sc-030"></a>**SC-030**: No version is ever published whose tests failed, or whose package failed to set a fresh repository up and build it.
- <a id="sc-031"></a>**SC-031**: Any published version is traced to the one commit it was built from in one step, and any running `cw` names its version in one command.
- <a id="sc-032"></a>**SC-032**: A maintainer publishes a release with one action, and a refused release leaves the registry and the repository as they were.
- <a id="sc-033"></a>**SC-033**: Every file the full catalogue names opens, and holds everything its primitive says with its mixins, for 100% of primitives, the engine's own included.

## Assumptions

- **Work is delivered one story at a time.** Each user story is built and reviewed as one change ([SC-026](#sc-026)): the story is the unit a reviewer can test on its own, so it is also the unit that is reviewed and merged. Its steps are still listed one by one in the task list, engine before page, so the order the work is done in is written down; they are not reviewed apart. The change must leave the repository working — it builds, its tests pass.
- **Users are developers.** The command line is the product surface, not an implementation detail. The portal drives these same commands and adds no behaviour of its own.
- **Implementation is a standalone runtime with no compiled or native dependency**, distributed so that a single install command makes the tool available. Chosen so the portal and the engine ship as one artifact.
- **The portal is a page served on the developer's machine by a `cw` command**, not a separate desktop application. The engine and the interface are one artifact, installed with one command; a local page keeps that, and needs nothing but a browser.
- **The portal is a second way into the engine beside the command line.** That is why every engine capability it needs is added to the engine first, and why the command line gets it in the same change.
- **One developer, one machine.** The portal is not shared over a network and has no accounts, as the product has none.
- **The reference design is keystone** (github.com/tacoda/keystone) for the primitive kinds, their field contracts and the vendored-content installation flow, and *Harness Engineering* by Ian Johnson for the concentric layers and the reliability levers. Neither is a runtime or build dependency; this is an independent implementation. Where keystone splits catalogue generation and compilation into two commands that repeat the same work, this product deliberately merges them.
- **Three kinds in the reference design are deliberately not adopted**: the external-callable declaration, the governed-output-document kind, and the reusable-documentation-pattern kind. The reference's own charter never exercises the document graph — no primitive in it declares a producing or consuming relationship — so nothing proven is lost. For this product specifically, the lifecycle of a work item (its state, its gates, its board) belongs to a later application, and expressing it a second time in the charter would duplicate it. The producing and consuming relationships on a unit of work are dropped alongside the document kind, since their referent is gone, and so are the lifecycle phase and the explicit done-condition: the reference declares neither, and a command reaches an agent as a slash command whose description is all that host reads before loading it — a phase it has no field for is a header nothing carries.
- **The three warnings are validation warnings, not portal features.** A primitive no case pins down is limited to guides and sensors because those are the only kinds a case names ([FR-082](#fr-082)); a posture is asserted only through whether a file is allowed, which names none. All three are warnings and never errors.
- **Self-regression tests assert activation, not behaviour.** A test pins which rules apply to a described situation, which is what catches the common failure of a rule quietly going dead after a glob or cascade change. It deliberately does not run a check's command or ask an agent for a judgement: the first needs a live environment and would break the reader/writer split, and the second is non-deterministic, so a suite built on it becomes flaky and then gets ignored. Both may be added later once there are real checks to exercise.
- **Sensors are run by the agent's own harness, not by this system.** A check that runs a command and a check that asks an agent for a judgement are both declared in the charter and compiled into the agent's activation surface; firing them is the agent's job. This system declares and compiles; it does not execute agent work.
- **Two files defining the same identity are reported as a collision**, in whichever layers they sit, rather than resolved by an implicit rule, because any silent winner would be arbitrary.
- **Reasoning citations that do not resolve are reported but do not block the build**, so a charter under construction stays usable.
- **The first agent supported in full is Claude Code**, with the agent-neutral target always available alongside it. Other agents are additive and do not change the charter format.
- **There is no machine-local layer.** The reference design places a personal scope inside the repository scope, but compiled output is committed, so merging a developer's machine-local rules into it would make one repository behave differently for each developer — the exact failure the layered model exists to prevent. Nothing resolves from a developer's home directory.
- **Flows are never represented in this system.** Their branches, their work-item prefixes, their merge behaviour and their session handling all belong to a later application.
- **Kind and identity are fixed once a primitive exists.** Renaming is creating a primitive under the new identity and deleting the old one. A rename that rewrote everything naming the old identity would be the portal changing primitives and tests nobody asked it to touch.
- **A new test file is named for the author to rename.** The engine picks a free name and writes one sample case; the author renames the file by hand if the name matters. A name chosen at creation would be one more question for a file whose content is the point.
- **Flags mean no prompting, for the whole run.** A run that answers some headers as flags and is asked for the rest would hang wherever there is nobody to ask, which is every place agent authoring is for. One header flag makes the run a non-interactive one, and a missing header is a refusal rather than a question.
- **The builtin layer is the engine's, and is not a folder.** It is supplied on every read and kept nowhere in the repository. A folder would be a copy: something to refresh, to go stale, to be hand-edited, to report drift about, and to restore. What makes it visible instead is that everything already showing the charter shows it — `cw list`, `cw explain`, the catalogue and the portal all name the layer it came from — and that it compiles to the same surface every other skill compiles to.
- **What the builtin layer is checked against is what every charter file is checked against.** It reaches the charter by the one reading every primitive goes through, so a kind's contract holds over it, a collision over it is the usual collision, and no fault a charter file would raise is skipped because the engine happened to supply it.
- **A builtin primitive has no file to point at.** Everything that names a primitive's file names this one as the engine's own rather than as a path in the repository, because there is no path to open. The name still says which layer it came from, which is what a path says everywhere else.
- **A repository that wants to differ authors its own primitive.** As with a vendored primitive ([Story 6](#user-story-6---author-edit-and-delete-a-primitive-without-looking-anything-up-priority-p2)): it does not edit what it does not own, it writes something under an identity of its own.
- **The identity `skill:cw-author` is spoken for**, in every repository, the way any installed identity is. A repository that had authored a primitive under it will see the collision the engine always reports, and renames its own.
- **Only creating is covered for the agent.** Changing a primitive that exists, and deleting one, are left to the person and the portal. An agent that rewrites a rule it did not author is a larger question than the shape of a file.
- **Versions follow semantic versioning, starting at 0.1.0.** A version below 1.0 says the charter format and the commands may still change between minor versions. A published version is never replaced or taken back; a fix is a new version.
- **The command is `cw` whatever the package is called.** An unrelated package already holds the name `cw` on the registry, so users install this one by its package name, and the command it puts on the path is still `cw`.
- **Any package manager that reads the public registry installs it.** npm, pnpm and yarn all read the same registry, so no manager is favoured and none is required; the README shows npm, which every runtime install brings.
- **The supported runtime is the one the engine already requires**, and the supported platforms are macOS and Linux, where the engine is built and tested. Windows is not promised until it is tested.
- **The browser the portal's tests drive is a contributor's tool.** A user needs only their own browser to open the portal; nothing downloads one for them.
- **The maintainer's registry account, its second factor and the rights to the package name are held outside the product.** A release uses them; it does not create or manage them.
- **The engine already knows what a kind requires.** Asking a kind and answering with flags add no capability to the engine: what a kind requires is answered at `cw add`'s prompts, and `cw add` writes the file. Agent authoring is two new ways of asking and one primitive.

## Dependencies

- A git repository, and git available on the machine, for setup, for installing vendored content, and for drift detection.
- A network path to the vendor source's git host when installing or updating vendored content. Everything else works offline.
- An installed coding agent for the compiled output to be consumed. Authoring, validation, cataloguing and the agent-neutral compilation all work without one.
- A web browser on the developer's machine, for the portal.
- The public npm registry, reachable when `cw` is installed or upgraded, and a maintainer account holding publish rights for the package name, for a release.

## Out of Scope

- A later application beyond the portal: agent sessions, a terminal, a work-item board, and anything such an application stores for itself.
- Flows in any form: any representation of them inside the system, a view per flow, a flow per branch, colours or grouping by flow. A flow is a branch holding a charter; the system never learns the mapping.
- Any account system, sign-in, licensing or payment. There is no login and no cost; users bring their own agent subscription.
- Installing one directory of a vendor source rather than the whole of it.
- Running agent sessions, managing worktrees, or executing the work loop. The product declares and compiles the standards; the agent's own harness applies them.
- More than one repository in one portal, and reaching the portal from another machine.
- Setting a repository up from the portal. `cw init` does that.
- Renaming a primitive, or changing its kind, in place. Renaming a test file.
- A standing build status outside the health check.
- Committing, branching or any other version-control operation beyond what vendoring already does.
- Changing or deleting a primitive that already exists, from the agent or from a header flag.
- Writing a primitive's body for its author: what a rule should say stays the author's.
- Any second builtin source, or a name for one. There is one owner of that layer.
- Turning the builtin layer off, pinning it, or removing what it brings. A repository that disagrees authors its own primitive.
- Keeping any of the builtin layer on disk: no folder, no cache, no copy to refresh.
- Teaching the agent which kind something ought to be. It is told what each kind is for, and chooses.
- Running the build, the health check or the tests on the agent's behalf.
- Publishing anywhere but the public npm registry: no private registry, no standalone binary, no operating-system package manager such as Homebrew.
- `cw` updating itself, or telling a user that a newer version exists. Upgrading is the package manager's.
- Taking a published version back or publishing over it.
- Writing release notes or a changelog for a release.
- Publishing from CI, and the registry provenance that only a CI publish can attach.
