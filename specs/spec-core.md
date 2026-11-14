# Spec: Core — the Cherry Works engine, command line and portal

**Created**: 2026-08-30

**Updated**: 2026-11-14

**Input**: User descriptions: "Build the Cherry Works charter and its charter engine — a shared policy repository holding the charter, and an engine with a `cw` CLI that resolves and applies it." Then: "The charter portal: a graphical interface over one repository's charter, driving the charter engine." Then: "Implement a cherry skill so a coding agent authors charter primitives, without typing them by hand." Then: "Phase 003: publish to npm…" Then: "The catalogue must not send an agent into the charter: build every primitive into the compiled output and point there." Then: "Phase 005: let every primitive point at the knowledge that lives outside the repository … reached through MCP, each developer signed in as themselves, and served to the agent through one `cw` server." Then: "Phase 006: … Add two kinds, `template` and `script` …; every `template:<id>` and `script:<id>` is written as the path to that file." Then: "Phase 007: drop the `{kind}-` prefix …, so a skill is invoked as `/<id>`." Then: "Drop the identity altogether: an id is unique, so it is what a primitive is known by." Then: "A skill or a playbook that is only a step of another should not be offered as a command the user types…" Then: "Let the hooks go through … `cw sensor run <signal>` …" Then: "`cw vendor add mattpocock/skills --skill=grill-me`: a source holding a charter is installed as a charter; otherwise its `SKILL.md` are … converted into skills of the charter." Then: "`cw vendor inject` … writes what it takes straight into the repository's own charter. A source may gather many charters under `charters/` …" Then: "Git is only how a vendor source is fetched … carry binary assets whole, so the engine can be published for tools with no git and no disk." Then: "Delete the directory too if it is empty." Then: "Use the repository's own git config." Then: "Accept the quality-pass repair stories…" Then: "Make it modular…" Then: "Drop the modules…" Then: "Everything in the domain is a class…" Then: "Nothing inside the engine knows the repository's path…" Then: "… `.cw/` holds the charter (primitives, tests, eval cases, vendors), the output and the log. … A repository laid out the old way is refused, and the authoring skill moves it." Then: "Gather everything of the charter into one charter repository…" Then: "Split the engine into two modules … each adapter replaceable where the engine is composed, the engine never." Then: "The two modules are charter and runtime…" Then: "Hand the engine its adapters, one for every way out — each agent's projection and command line, the charter's store and the rest — the engine's own by default, any of it written anew." Then: "Export only what a tool needs of the engine: compose it handing only the adapters it replaces; keep the charter's store and the agents' projections and command lines out of the package's contract for now." Then: "Keep [SDK-FR-020](spec-sdk.md#sdk-fr-020): export `cw`'s own adapters for a tool to extend." Then: "Keep each compiled entry's path inside the output: the catalogue is written from it." Then: "When no agent is chosen, stop and ask." Then: "Repair what the quality pass of [CORE Story 55](#core-story-55---quality-cross-check-of-sdk-story-8-core-story-53-sdk-story-10-core-story-56-eval-story-9-priority-p3) found: prove every Done scenario a test misses, make each test say what its scenario says, keep the engine to its naming guides, and say each thing in one term, as behaviour." Then: "Repair what the next quality pass found: `cw context` estimates with no agent named, `cw context --agent=<agent>` counts exactly beside the estimate, and `--exact` is dropped; the architecture map names every operation the engine asks of what is outside it; every value naming an agent is named for it; the place an author edits the charter is always the one its store says, and no agent's files are told cw's own layout." Then: "Fix what the old hand-over notes left: names the guides refuse, code nothing uses, tests and guards that could not fail, and docs behind the code." Then: "`cw sensor run` has no default agent: with none named, it runs only the sensors kept for no agent."

## Overview

Cherry Works exists to make a coding agent's output reliable enough to ship. Reliability here is not determinism — it is narrowing the band the output can land in, using three levers applied in order: narrow the input (scope written down, including what is out of scope, plus acceptance criteria that can be falsified), narrow the output (gates that fire on every iteration rather than in CI ten minutes later), and narrow the recovery (the next move after each class of failure is named, not improvised).

The **charter** is everything a team authors to specify how the agent must behave. The **engine** is what compiles and applies it. The product has three surfaces over one engine.

- **The charter and its engine, on the command line.** A repository authors its charter as small folders, each with its `index.md`, installs other teams' charters as vendor sources, and runs `cw` to validate it, list it, explain it, compile it into what its agent reads, test it and check its health. Nothing can be done elsewhere that cannot be done there.
- **The portal.** Started from the command line inside a governed repository, a page shows everything the charter holds — what each primitive says, when it comes up, which file it lives in and which layer it came from — and lets a developer author, install vendors, run the tests, build and ask the health check without remembering a command or a field name. It drives the same engine and adds no behaviour of its own.
- **Agent authoring.** The coding agent is the third author, and the one that never sits at a terminal. A kind says what it requires to whoever asks (`cw kinds <kind>`), a primitive can be written with no terminal to answer at (`cw add <kind> <id> --header k=v`), and a skill, `cw-author`, arrives in a layer of the charter `cw` itself owns. The skill copies no rule out of the engine: it says to ask `cw kinds`, so a skill compiled by an older `cw` never hands the agent a stale header table ([CORE-FR-004](#core-fr-004), [CORE-FR-064](#core-fr-064)). What a guide should say stays the repository's business.

- **Knowledge outside the repository.** A corpus holds the reasoning the repository wrote down; the rest sits in other repositories, in Notion, in Slack, each reached through an MCP server. An `mcp` primitive declares one such mcp origin once, under an id of its own, with the tools the agent may use there, and any primitive names it in its body as `[[<id>]]` ([CORE-FR-143](#core-fr-143)). `cw mcp auth` signs each developer in to each mcp origin as themselves, and `cw mcp serve` is the one MCP server the agent is given, forwarding each call with that developer's own credential. No credential is shared: every call reaches the mcp origin under the name of the person whose agent made it, and taking someone's access away there is the whole of taking it away.

- **Files the agent uses.** A skill often needs a script to run or a template to fill. Each is a primitive like any other, a folder whose `index.md` holds its headers and its body; a template's body is the file to fill, and a script's files are copied beside it. Any primitive names one as `[[<id>]]`, and the build writes the name as the path the agent opens or runs.

Every surface reaches a user the same way: **one install from the public package registry**, with nothing to clone and nothing to build — the command line, the portal and the builtin layer in one package.

A single charter covering design, planning and implementation at once has to be wide enough to fit all three, so it narrows nothing. Cherry Works therefore gives each flow its own charter, as a **convention, not a mechanism**: a flow is one branch holding one charter, so the separation falls out of git. Flows belong to the product and to a later application; the engine, the command line and the portal never know of them, and never group, filter or colour anything by flow.

## Clarifications

### Session 2026-09-21

- Q: Does an explanation say what a primitive costs? → A: No: the line was the same for every primitive, and wrong for a guide with no globs.

### Session 2026-09-26

- Q: Is the knowledge an agent should reach modelled as an ontology of its own — concepts, labels, relations? → A: No. A corpus is the reasoning kept in the repository, and an `mcp` primitive is where the rest of it is kept. Every primitive names an mcp origin it uses in its body, as `[[<id>]]`; there is no header for it ([CORE-FR-143](#core-fr-143)). A concept layer is added only if a pilot shows the agent finding the wrong mcp origin without one.
- Q: Does `cw` run a gateway holding one credential for everyone? → A: No. A shared credential hides who made a call from the mcp origin it reached, and leaves two places to revoke access in ([CORE-FR-148](#core-fr-148)).
- Q: Is the name of an `mcp` primitive its address? → A: No. It is an id like any other, so an address can change without anything naming it changing. Any id may hold `/` to be grouped, as `mfbs/billing` ([CORE-FR-141](#core-fr-141)).
- Q: Is an mcp origin only an MCP server on the network, or also one started on the developer's machine? → A: Both; a local process is signed in to by token only, handed to it in the environment variable the `mcp` primitive names ([CORE-FR-142](#core-fr-142)).
- Q: Can a run be held to fewer mcp origins than the charter declares? → A: No flag for it. A run on a schedule or in CI reaches only the mcp origins it was signed in to, and a call to one that is not signed in to answers why ([CORE-FR-153](#core-fr-153), [CORE-FR-154](#core-fr-154), [EVAL-FR-031](spec-eval.md#eval-fr-031)). A subagent holds an mcp origin by listing it under `tools`, in the charter's own words — `[[<id>]]` or `[[<id>]]:<tool>` ([CORE-FR-156](#core-fr-156)).

### Session 2026-09-30

- Q: Does a skill become a folder holding its `SKILL.md` and the files it uses? → A: It is a folder, as every primitive is: `index.md` and its assets beside it ([CORE-FR-168](#core-fr-168)). A script and a template stay kinds of their own ([CORE-FR-001](#core-fr-001)), so two skills can share one, naming it by id.
- Q: What does a name become where it is read? → A: What its reader can use. In a compiled document, `[[<id>]]` becomes a markdown link to the file the catalogue names, so a person opens it with a click and an agent with a read ([CORE-FR-147](#core-fr-147)); in a sensor's `run`, which nothing reads, the built script's path from the repository's root ([CORE-FR-169](#core-fr-169)); among an agent primitive's `tools`, the names the agent calls those tools by ([CORE-FR-156](#core-fr-156)). A name written any other way, such as `script:<id>`, is only text.
- Q: Which bodies are rewritten? → A: Every body compiled to a document, a template's included; a file of a script's folder is copied as it is ([CORE-FR-166](#core-fr-166)).
- Q: Does an agent still survey a reduced catalogue first? → A: No. There is one catalogue, `catalogue.json`, and no reduced copy ([CORE-FR-026](#core-fr-026)); a build deletes a reduced copy left on disk.
- Q: What does a catalogue entry hold? → A: Kind, id, description, file, and globs where the primitive names any ([CORE-FR-025](#core-fr-025)). No tags, rationale or mixins: they are read from the file the entry names, or asked of `cw explain`. `cw list` says the id, the description, the file and the files it applies to ([CORE-FR-028](#core-fr-028)).

### Session 2026-10-02

- Q: The kind kept a guide and a skill of one id apart; what keeps them apart now? → A: Nothing keeps them as two primitives. An id names one primitive whatever its kind, so a guide and a skill of one id are the same collision a skill and a playbook are ([CORE-FR-015](#core-fr-015)).
- Q: Is a charter written as `corpus:x` or `script:x` told so? → A: Not as such: nothing reads that way. `rationale: corpus:x` is a rationale no corpus answers to, which `cw doctor` reports; `script:x` in a body is text, the author's to find.
- Q: Are a vendor's guides warned about as untested, and its test cases run here? → A: No: a vendor is tested and checked in its own repository. Here the health check says only its errors, and only the repository's own tests run ([CORE-FR-014](#core-fr-014), [CORE-FR-042](#core-fr-042)).

### Session 2026-10-22

- Q: What does `cw sensor run <signal>` do with a signal the charter does not know? → A: Nothing of its own: an agent is given the command only by a build, which refuses an unknown signal, and it reads the last compiled output, which a failed build leaves as it was ([CORE-FR-176](#core-fr-176)).

### Session 2026-10-26

- Q: Is a source installed under a folder an earlier version named moved for the repository? → A: No: it is removed and installed again ([CORE-FR-050](#core-fr-050)).
- Q: A charter skill must carry `triggers`, and a `SKILL.md` has none: where do they come from? → A: Its `name` is its one trigger ([CORE-FR-186](#core-fr-186)). The description is not made a trigger: the agent would read it twice, once as what the skill is for and once as when to use it.
- Q: Which command takes a skill from a skills repository? → A: `cw vendor add` itself, with no flag naming the source's shape ([CORE-FR-184](#core-fr-184), [CORE-FR-193](#core-fr-193)): a command of its own named for skills would read as acting on skill primitives.
- Q: What is an agent given that has no header keeping it from opening a skill? → A: Nothing is decided for it yet: every agent built for has one, and the story adding an agent without one decides.

### Session 2026-10-28

- Q: Why is each charter of a source of many laid out as a single-charter source holds one? → A: So its author can build and test each there as any charter ([CORE-FR-195](#core-fr-195)).

### Session 2026-11-11

- Q: Does a compiled entry carry the agent it is for, and its place left wholly to the projection? → A: No: the catalogue and the links between entries are written as the charter is built, so each entry keeps its path inside the output, linked from the output's root; the projection decides where the output lands and writes each link from where its file lands; an entry for one agent alone names it in its path ([CORE-FR-220](#core-fr-220), [CORE-FR-221](#core-fr-221)).
- Q: Does the package export the stores and runners `cw` is composed of? → A: Yes, for an integrator to extend, as [SDK-FR-020](spec-sdk.md#sdk-fr-020) says; [CORE-FR-228](#core-fr-228) and [CORE Story 52](#core-story-52---replace-any-store-or-runner-and-find-the-workspace-in-three-parts-priority-p2) scenario 3 are rewritten to it.
- Q: Are the operations a driver port offers renamed before the contract's first release? → A: Yes: each is named verb first, for what it acts on, before 1.0.0, so no rename breaks an integrator after it ([CORE-FR-232](#core-fr-232)).

### Session 2026-11-12

- Q: Does setup with nobody to ask take an agent by default where the engine compiles for one only? → A: No: a repository that has chosen no agent has no default, however many agents the engine compiles for; at a terminal setup asks with none ticked, and with nobody to ask it stops naming `--agent` ([CORE-FR-055](#core-fr-055), [CORE-FR-056](#core-fr-056)).

### Session 2026-11-13

- Q: Does `cw list` print each primitive on one line, as [CORE-FR-028](#core-fr-028) said, or its file and the files it applies to on lines of their own beneath it? → A: On lines of their own beneath it, as it does: a description and a path on one line read badly; [CORE-FR-028](#core-fr-028) and [CORE Story 3](#core-story-3---trust-the-charter-and-prove-it-in-ci-priority-p3) scenario 10 are rewritten to it.
- Q: Does the package export the workspace's folders as loose constants beside the values? → A: No: the layout of the store `cw` keeps is one value, as the output's layout is, and nothing is exported beside the values ([SDK-FR-020](spec-sdk.md#sdk-fr-020), [CORE-FR-215](#core-fr-215)).
- Q: Which sensors does `cw sensor run` run when no agent is named? → A: Only those kept for no agent; no agent is taken by default, Claude included ([CORE-FR-234](#core-fr-234)).

## User Scenarios & Testing *(mandatory)*

Stories 1 to 4 are the charter and its engine, Stories 5 to 9 the portal, Stories 10 to 12 agent authoring, Stories 13 to 15 distribution, [CORE Story 16](#core-story-16---open-every-primitive-as-it-was-compiled-priority-p1) the charter compiled for an agent to open, Stories 17 to 20 knowledge reached through MCP, Stories 21 to 25 the files an agent runs and fills, and how a primitive, its assets and the names in it are kept, [CORE Story 26](#core-story-26---invoke-a-skill-by-its-id-alone-priority-p2) the names an agent is given, [CORE Story 27](#core-story-27---name-every-primitive-by-its-id-alone-priority-p1) the name a primitive is known by, Stories 28 to 38 skills, sensors, vendor sources and assets, Stories 39 to 43 quality cross-checks and their repairs, Stories 44 to 52 the engine as stores, projections and two parts an integrator composes, Stories 53 and 56 repairs of Story 43's pass, and Story 55 the cross-check of those repairs. A story's priority ranks it among the stories of its own part of the product.

### CORE Story 1 - Author a charter and put the agent under it (Priority: P1)

**Status**: Done

A developer has a repository and a coding agent, and wants the agent to work under written standards instead of ad-hoc prompting. They run the setup command, answer a couple of prompts, and get a charter directory scaffolded in their working tree. They author their first rule as a small `index.md` in a folder of its own, run the build, and their agent immediately reads it — the rule is now in force for every session in that repository.

**Why this priority**: This is the whole product in miniature. Without it there is nothing to share, nothing to inspect, and nothing for the portal to sit on top of. Everything else refines or distributes what this story produces.

**Independent Test**: Run setup in an empty git repository, author one rule, run the build, and confirm the agent's own instruction surface now contains that rule. Delivers a governed repository with no other story implemented.

**Acceptance Scenarios**:

1. **Given** a git repository with no charter, **When** the developer runs setup, **Then** the charter, with a directory per kind, and the agents the repository chose are written, the charter is built so the agent can already author with the skill the engine brings, and all of it is left in the working tree for the developer to read over and commit ([CORE-FR-057](#core-fr-057)).
2. **Given** a charter containing a rule, **When** the developer runs the build, **Then** the indexes and every compiled file are regenerated from one pass over the charter, and a compiled file whose source primitive was deleted is removed ([CORE-FR-033](#core-fr-033), [CORE-FR-032](#core-fr-032), [CORE-FR-030](#core-fr-030)).
3. **Given** a primitive missing a field its kind requires, **When** the developer runs the health check, **Then** the file and the missing field are named and the command exits with a failure status ([CORE-FR-004](#core-fr-004), [CORE-FR-010](#core-fr-010), [CORE-FR-013](#core-fr-013), [CORE-FR-011](#core-fr-011)).
4. **Given** a primitive whose file sits in a kind's directory without declaring its kind, **When** the charter is read, **Then** it is refused under that file, saying it declares no kind ([CORE-FR-003](#core-fr-003)).
5. **Given** an initialized repository, **When** the developer runs setup again, **Then** their previous answers appear as the defaults and no authored content is discarded ([CORE-FR-058](#core-fr-058), [CORE-FR-055](#core-fr-055)).
6. **Given** an agent's entry file that carries the charter's section twice over, **When** the developer runs the build, **Then** the file carries that section once ([CORE-FR-035](#core-fr-035)).
7. **Given** an agent's entry file holding the developer's own prose, **When** the developer runs the build twice, **Then** every line of that prose is kept, and the second build changes nothing ([CORE-FR-035](#core-fr-035)).
8. **Given** a primitive declaring `tags`, **When** it is explained, **Then** its tags are said ([CORE-FR-008](#core-fr-008)).
9. **Given** a charter, **When** it is read, **Then** one read of the charter reads each of its files once ([CORE-FR-009](#core-fr-009)).
10. **Given** a built charter, **When** the agent-neutral orientation is read, **Then** it says what governs the repository, sends its reader to the one catalogue first and says for each kind when it applies; neither it nor the catalogue holds a primitive body, and no reduced copy of the catalogue is written ([CORE-FR-036](#core-fr-036), [CORE-FR-026](#core-fr-026), [CORE-FR-027](#core-fr-027)).
11. **Given** a repository that chose no agent, **When** the developer builds, **Then** the agent-neutral orientation and the catalogue are still written ([CORE-FR-031](#core-fr-031)).
12. **Given** the agents a repository chose at setup, **When** the charter is built in any checkout, **Then** it is built for those agents alone, whatever is installed on the machine ([CORE-FR-038](#core-fr-038)).
13. **Given** a primitive whose `rationale` names a corpus no layer holds, **When** the charter is validated, **Then** it is said under that file as a warning, and the charter does not fail ([CORE-FR-211](#core-fr-211)).

---

### CORE Story 2 - Adopt shared governance without copying files (Priority: P2)

**Status**: Done

A team keeps its baselines — security rules, review roles, permissions — in one shared repository, and wants every project to inherit them without anyone copy-pasting. A developer points their repository at that vendor source, and the content arrives pinned to a version, for them to read and commit. Their own rules keep working beside it: an id names one primitive in the whole charter, so a repository that redefines a vendored one is told at once and renames its own rather than shadowing someone else's.

**Why this priority**: A charter that lives in one repository helps one team. Distribution is what makes it governance. It depends on [CORE Story 1](#core-story-1---author-a-charter-and-put-the-agent-under-it-priority-p1) having produced something to distribute.

**Independent Test**: Point an initialized repository at a vendor source, confirm the content arrives pinned, and confirm a local rule that reuses a vendored id is reported.

**Acceptance Scenarios**:

1. **Given** an initialized repository, **When** the developer adds a vendor source by its short git form, **Then** its content is installed under the vendor directory at a pinned version, left for the developer to commit ([CORE-FR-041](#core-fr-041), [CORE-FR-046](#core-fr-046), [CORE-FR-042](#core-fr-042), [CORE-FR-048](#core-fr-048)).
2. **Given** a repository with both a local rule and a vendored rule of the same id, **When** the charter is read, **Then** both files are named and the charter is refused until one of them is renamed ([CORE-FR-015](#core-fr-015), [CORE-FR-016](#core-fr-016)).
3. **Given** a repository with a vendor source installed, **When** the developer brings it up to date or removes it, **Then** the vendored content is updated or deleted to match, each left for the developer to commit ([CORE-FR-047](#core-fr-047), [CORE-FR-204](#core-fr-204)).
4. **Given** a source holding neither a charter folder nor a skill at the version asked for, **When** the developer adds it, **Then** it is refused as holding no charter and no skill, and nothing is installed ([CORE-FR-042](#core-fr-042)).
5. **Given** a source that holds vendored content of its own at the version asked for, **When** the developer adds it, **Then** it is refused, since vendoring is one level deep, and nothing is installed ([CORE-FR-170](#core-fr-170)).

---

### CORE Story 3 - Trust the charter, and prove it in CI (Priority: P3)

**Status**: Done

Before relying on a charter, a developer wants to know what the agent will actually see: which file declares each rule, and whether anything is stale or broken. In CI, the team wants a hard gate proving that the committed compiled output still matches the authored charter, so nobody merges a rule change that never reached the agent.

**Why this priority**: Stories 1 and 2 make the charter work. This one makes it trustworthy and keeps it honest over time. Valuable, but a team can ship without it.

**Independent Test**: Explain one primitive and confirm the report names its layer and file; edit a rule without rebuilding and confirm the CI check fails and names the pending changes.

**Acceptance Scenarios**:

1. **Given** a primitive of any layer, **When** the developer asks to explain it, **Then** the layer and the file that declare it are named ([CORE-FR-029](#core-fr-029)).
2. **Given** an authored charter, **When** the developer runs the build in preview mode, **Then** nothing is written and every target is listed as create, update, delete or unchanged, with a count ([CORE-FR-034](#core-fr-034), [CORE-FR-093](#core-fr-093)).
3. **Given** an authored charter with pending changes, **When** the preview build runs, **Then** it exits with a failure status so CI can gate on it ([CORE-FR-034](#core-fr-034)).
4. **Given** a repository already fully built, **When** the preview build runs, **Then** every target is unchanged and it exits successfully ([CORE-FR-034](#core-fr-034)).
5. **Given** a repository in any state, **When** the developer runs the health check, **Then** it reports which agents the repository chose, whether validation passes, and whether the compiled output is out of date — the last by running the preview build rather than tracking staleness separately ([CORE-FR-080](#core-fr-080)).
6. **Given** a self-regression test stating which primitives must be active for a described situation, **When** the developer runs the tests, **Then** each case is resolved against the current charter and reported pass or fail, naming any primitive that was expected active but was not, or active but should not have been ([CORE-FR-082](#core-fr-082), [CORE-FR-083](#core-fr-083), [CORE-FR-084](#core-fr-084)).
7. **Given** a case that fails, **When** the developer runs the tests, **Then** the run exits with a failure status, so a pipeline can gate on it ([CORE-FR-085](#core-fr-085)).
8. **Given** a test file that does not read beside others that do, **When** the developer runs the tests, **Then** the run stops, reporting that file's fault, and no case is resolved ([CORE-FR-088](#core-fr-088)).
9. **Given** a repository with no test, **When** the developer runs the tests, **Then** they are told so and the run passes ([CORE-FR-089](#core-fr-089)).
10. **Given** a charter, **When** the developer runs `cw list`, **Then** each primitive opens on a line of its id and description, with the file it was authored in and the files it applies to each on a line of its own beneath, `--min` gives the id and description alone, one line each, `--kind` narrows the listing to one kind, and a charter with an error lists nothing and sends the developer to `cw doctor` ([CORE-FR-028](#core-fr-028)).

---

### CORE Story 4 - Create a correctly-shaped primitive without looking anything up (Priority: P5)

**Status**: Done

Nine kinds each demand their own fields, and nobody remembers which. A developer names the kind and the id, and is asked for exactly the mandatory fields, and gets a file at the right path holding the answers — nothing invented, nothing missing.

**Why this priority**: Pure convenience. Every kind can be authored by hand in a text editor, and validation already names anything left out, so nothing is blocked without this. It removes a lookup, not an obstacle.

**Independent Test**: Create one primitive of each kind and confirm each lands at the right path carrying exactly its mandatory fields with the answers given, and that validation passes on all of them.

**Acceptance Scenarios**:

1. **Given** an initialized repository, **When** the developer creates a new primitive of a given kind and id, **Then** each field that kind requires is asked for, and `<kind>/<id>/index.md` appears holding the answers and nothing else ([CORE-FR-064](#core-fr-064), [CORE-FR-065](#core-fr-065)).
2. **Given** a kind that is not in the closed set, **When** the developer tries to create a primitive of it, **Then** the command refuses and lists the kinds that exist ([CORE-FR-001](#core-fr-001)).
3. **Given** a primitive that already exists at the target path, **When** the developer creates one with the same kind and id, **Then** the command refuses rather than overwriting, so re-running it is safe ([CORE-FR-015](#core-fr-015)).

---

### CORE Story 5 - See what the charter holds and why each rule comes up (Priority: P1)

**Status**: Done

A developer opens the portal in a governed repository and sees the charter laid out by layer and by kind: the repository's own primitives, then what each vendor source installed. Each row says the primitive's id, its description, the file it lives in, and what makes it come up. They search for a word and see every primitive that mentions it. They pick one and ask the portal to explain it: what it is, when it activates, what it pulls in, what cites it, and which test cases pin it down.

**Why this priority**: Reading is the whole point of an interface over a charter nobody can hold in their head, and everything else in the portal is built on this view. It delivers value on its own: a team can adopt the portal only to understand its charter and keep authoring by hand.

**Independent Test**: Run the portal in a repository whose charter holds primitives of several kinds and one vendor source; confirm every primitive appears under its layer and kind with the right fields, that a search returns exactly the matching primitives, that the explanation of a guide names its globs, its mixins, its rationale and the cases that cite it, and that a charter holding an error shows its faults instead of a listing.

**Acceptance Scenarios**:

1. **Given** a governed repository, **When** the developer starts the portal, **Then** the command says the address it can be reached at, and the page shows the repository layer with one filter per kind, each carrying the number of primitives of that kind ([CORE-FR-104](#core-fr-104), [CORE-FR-112](#core-fr-112)).
2. **Given** a kind selected, **When** the list is shown, **Then** one line above the table says when that kind comes up at all, in the words the kind's own contract declares it in, and each row names the id, the description, the file path, and what that kind is pinned down by — the globs it matches and the corpus it cites for a guide, the mixins it pulls in for every kind that may name one ([CORE-FR-113](#core-fr-113)).
3. **Given** a word typed into the search, **When** the results are shown, **Then** every primitive in any layer whose id, kind, description, "activates when", path or any header value contains the word is listed, and nothing else ([CORE-FR-114](#core-fr-114)).
4. **Given** a primitive, **When** the developer asks for its explanation, **Then** the portal shows its kind and description, when it comes up, the mixins and the corpus it pulls in (each marked if it does not resolve), the primitives that cite or lend from it, every test case that names it with that case's last outcome, and its file and layer ([CORE-FR-116](#core-fr-116), [CORE-FR-029](#core-fr-029)).
5. **Given** a charter holding an error, such as two files claiming one id, **When** the portal is opened, **Then** it says the engine will not read the charter and shows every fault under the file that has to change, the same faults `cw doctor` prints, instead of a listing ([CORE-FR-115](#core-fr-115)).
6. **Given** a kind of which the layer holds no primitive, **When** the list is shown, **Then** that kind still has its filter with its count, and selecting it shows an empty state ([CORE-FR-112](#core-fr-112)).
7. **Given** a search's results listed under the search box, **When** the developer chooses one, **Then** the portal shows the tab of that primitive's layer with its kind selected and opens the primitive; and **When** the developer clears the search instead, **Then** the list closes and the tab it was showing is left as it was ([CORE-FR-114](#core-fr-114)).
8. **Given** the portal started, **When** it is reached under any address but this machine's own, **Then** it is refused, and nobody is asked to sign in ([CORE-FR-106](#core-fr-106)).
9. **Given** a primitive file written on disk while the portal runs, **When** the developer shows the view again, **Then** it lists what is on disk now ([CORE-FR-110](#core-fr-110)).

---

### CORE Story 6 - Author, edit and delete a primitive without looking anything up (Priority: P2)

**Status**: Done

A developer picks a kind and asks for a new one. The portal asks exactly the headers that kind requires, in the shape each takes — one box per glob for a guide, a closed choice of signal for a sensor — and offers the repository's corpus entries when they fill in a rationale. They write the body in a markdown editor with a source and a preview view, and save. One file appears where that kind is authored. Later they open the same primitive, change its globs and body, and save again; or they delete it. A vendored primitive opens read-only and says how to differ from it. A guide with no globs is valid and comes up every turn.

**Why this priority**: Authoring is the second reason to open the portal, and the one it spends most of its surface on. It depends on [CORE Story 5](#core-story-5---see-what-the-charter-holds-and-why-each-rule-comes-up-priority-p1) to find the primitive being edited.

**Independent Test**: Create one primitive of each kind through the portal and confirm each file is what `cw add` writes for the same answers, with the body typed in; edit one and confirm the file changed and nothing else did; delete one and confirm the file is gone; open a vendored one and confirm nothing on it can be saved.

**Acceptance Scenarios**:

1. **Given** a kind selected, **When** the developer asks for a new primitive, **Then** the form asks the id, the description, every header that kind requires, the rationale and the mixins, and no header of another kind, with a body editor ([CORE-FR-117](#core-fr-117)).
2. **Given** answers the kind refuses — an id that is not a lowercase slug, a sensor with no command, a mixin naming a mixin — **When** the developer saves, **Then** nothing is written and each refusal is shown in the words the engine gives it ([CORE-FR-117](#core-fr-117), [CORE-FR-108](#core-fr-108)).
3. **Given** an id already claimed anywhere in the charter, **When** the developer saves a new primitive under it, **Then** nothing is written and the file already claiming it is named ([CORE-FR-015](#core-fr-015)).
4. **Given** an existing repository primitive, **When** the developer opens it, **Then** its kind and id are shown but cannot be changed, and the form says a rename is a new primitive and a deletion ([CORE-FR-075](#core-fr-075)).
5. **Given** an existing repository primitive, **When** the developer changes its headers or body and saves, **Then** its file is rewritten with the new content ([CORE-FR-075](#core-fr-075)).
6. **Given** an existing repository primitive, **When** the developer deletes it, **Then** its file is removed, and primitives or test cases still naming it are reported by the next validation as dangling rather than being changed ([CORE-FR-076](#core-fr-076), [CORE-FR-007](#core-fr-007)).
7. **Given** a vendored primitive, **When** the developer opens it, **Then** it is shown read-only with its file under the vendor folder, and the portal says that to differ from it they author a primitive under an id of their own ([CORE-FR-077](#core-fr-077), [CORE-FR-016](#core-fr-016)).
8. **Given** any save or delete, **When** it completes, **Then** nothing is compiled and nothing is committed: the change sits in the working tree, and the health check reports the compiled output behind until the next build ([CORE-FR-079](#core-fr-079)).
9. **Given** a primitive file changed on disk after the developer opened it, **When** they save, **Then** the save is refused and the file is named, rather than their edit overwriting the other change ([CORE-FR-078](#core-fr-078)).
10. **Given** a header drawn from a closed set, such as a sensor's signal, **When** the form asks for it, **Then** it is chosen from that set rather than typed ([CORE-FR-118](#core-fr-118)).
11. **Given** a body in the editor, **When** the developer opens its preview, **Then** the body is shown rendered, raw HTML shown as text rather than run ([CORE-FR-119](#core-fr-119)).

---

### CORE Story 7 - Build, preview and check the repository's health (Priority: P3)

**Status**: Done

Before committing, the developer wants to know what a build would change and whether anything is wrong. From the portal's header they preview the build and see every file it would create, update or delete, then build from that preview. They ask for the health check and read the same answers `cw doctor` gives ([CORE-FR-080](#core-fr-080)), and the main context each chosen agent opens a session with, against the ceiling ([EVAL-FR-006](spec-eval.md#eval-fr-006)), together with every error and warning under its file, including the warnings the engine raises about corpus nobody cites, mixins nobody lends from, and guides and sensors no test case pins down.

**Why this priority**: Stories 5 and 6 change the charter; this one gets the change to the agent and confirms nothing is broken. A team can still build from the command line without it.

**Independent Test**: Edit a primitive, preview and confirm the listing matches `cw build --preview`; build and confirm the health check says the compiled output is up to date; add an uncited corpus and confirm the health check shows the warning in both the portal and `cw doctor`.

**Acceptance Scenarios**:

1. **Given** a charter with pending changes, **When** the developer previews the build, **Then** nothing is written and every target is listed as create, update, delete or unchanged, with a count, as the engine's preview says it ([CORE-FR-120](#core-fr-120)).
2. **Given** a preview, **When** the developer builds from it, **Then** the build runs and the portal lists what it wrote and deleted ([CORE-FR-120](#core-fr-120)).
3. **Given** a charter with an error, **When** the developer builds, **Then** nothing is written and the faults are shown under their files ([CORE-FR-040](#core-fr-040)).
4. **Given** any repository, **When** the developer asks for the health check, **Then** the portal shows the same answers `cw doctor` gives, the same main-context line per chosen agent ([EVAL-FR-006](spec-eval.md#eval-fr-006)) and every fault that `cw doctor` reports for the same repository, with nothing added and nothing left out, and offers to build when the compiled output is behind ([CORE-FR-080](#core-fr-080), [CORE-FR-121](#core-fr-121)).
5. **Given** a corpus no primitive cites, a mixin no primitive lends from, or a guide or sensor that no test case names, **When** the charter is validated from either surface, **Then** each is reported as a warning naming the primitive, and none of them stops a build ([CORE-FR-014](#core-fr-014)).

---

### CORE Story 8 - Install, see and remove vendor sources (Priority: P4)

**Status**: Done

The developer opens the vendor view and sees each source the repository installed: the folder it landed in, and how many primitives of each kind it brought. They add a baseline by its short git form and a version, and its primitives appear read-only. They remove one they no longer want.

**Why this priority**: Vendoring is done rarely — once per repository per baseline, then an occasional bump — and it is already one command. The portal makes it visible more than it makes it easier.

**Independent Test**: Add a vendor source from the portal and confirm it is installed as `cw vendor add` would install it; confirm its primitives are listed read-only; remove it and confirm its folder is gone.

**Acceptance Scenarios**:

1. **Given** a repository with no vendor source, **When** the developer opens the vendor view, **Then** it says none is installed and offers to add one, and adding one lists the directory names reserved under a source's charter folder ([CORE-FR-123](#core-fr-123)).
2. **Given** a source in short git form and an optional version, **When** the developer adds it, **Then** it is installed the way `cw vendor add` installs it, and the portal lists the folder and the primitives it brought ([CORE-FR-123](#core-fr-123), [CORE-FR-109](#core-fr-109)).
3. **Given** a source that cannot be reached, **When** the developer adds it, **Then** nothing is installed and the portal shows why, in the engine's words ([CORE-FR-123](#core-fr-123), [CORE-FR-049](#core-fr-049)).
4. **Given** installed sources, **When** the vendor view is shown, **Then** each is listed with its folder and its primitives counted by kind ([CORE-FR-122](#core-fr-122), [CORE-FR-045](#core-fr-045)).
5. **Given** an installed source, **When** the developer removes it, **Then** its folder is taken away as `cw vendor remove` takes it, and its primitives leave the listing ([CORE-FR-123](#core-fr-123), [CORE-FR-204](#core-fr-204)).
6. **Given** a source whose folder would land on a reserved directory name, or a source that cannot be reached, **When** the developer adds it, **Then** nothing already installed is touched and the reason is shown ([CORE-FR-123](#core-fr-123)).
7. **Given** a folder under the vendor directory that git put there by hand rather than through the engine, **When** the vendor view is shown, **Then** it is listed as any other source is: the folder is all the view names of a source ([CORE-FR-053](#core-fr-053), [CORE-FR-122](#core-fr-122), [CORE-FR-043](#core-fr-043)).

---

### CORE Story 9 - Write, run and correct the self-regression tests (Priority: P5)

**Status**: Done

The developer opens the test view and sees every test file the repository wrote, with its description and how many cases it holds. They open one to read its cases — the file touched or the event raised, and what must come up — and run all the tests. The portal says how many cases pass, marks each case pass or fail, says for a failing case what came up instead, and opens the first failing file. They correct a case in the file's text and save it; a file that does not read as a suite is refused with the engine's sample of one that does. They start a new test file, which opens holding one sample case to edit, and delete a file they no longer need.

**Why this priority**: Tests are the smallest surface of the portal and `cw test` already answers them in full. The portal adds reading and writing them beside the charter they pin down.

**Independent Test**: Run the tests from the portal in a repository with one passing and one failing case, and confirm the counts and the reason match `cw test`; create a test file, save an edit to it and confirm the file is written; save text that is not a suite and confirm nothing is written; delete the file and confirm it is gone.

**Acceptance Scenarios**:

1. **Given** a repository with test files, **When** the developer opens the test view, **Then** each file is listed with its name, its description and its case count, and each case shows its situation and its expectation ([CORE-FR-124](#core-fr-124)).
2. **Given** test files, **When** the developer runs all tests, **Then** every case is resolved by the engine and shown pass or fail, a summary says how many of how many pass, and each failing case says what came up instead of what was expected ([CORE-FR-125](#core-fr-125)).
3. **Given** a test file open for editing, **When** the developer saves text that reads as a suite, **Then** the file is rewritten and every earlier outcome is cleared until the tests run again ([CORE-FR-090](#core-fr-090)).
4. **Given** a test file open for editing, **When** the developer saves text that is not JSON or not a suite, **Then** nothing is written and the engine's refusal is shown with its sample of a suite that reads ([CORE-FR-090](#core-fr-090), [CORE-FR-086](#core-fr-086)).
5. **Given** a case expecting a primitive the charter holds, **When** it is shown, **Then** the expected id opens that primitive; an id the charter does not hold is marked as such ([CORE-FR-124](#core-fr-124), [CORE-FR-087](#core-fr-087)).
6. **Given** the test view, **When** the developer asks for a new test file, **Then** a file is written under the test directory with a name no other test file has, holding one sample case, and it opens for editing ([CORE-FR-091](#core-fr-091)).
7. **Given** a test file open for editing, **When** the developer deletes it, **Then** the file is removed and earlier outcomes are cleared ([CORE-FR-092](#core-fr-092)).
8. **Given** a run in which a case fails, **When** the outcomes are shown, **Then** the first test file holding a failing case is opened ([CORE-FR-125](#core-fr-125)).

---

### CORE Story 10 - Write a primitive with no terminal to answer at (Priority: P1)

**Status**: Done

A coding agent has decided this repository needs a guide about how its tests are named. It runs one command with the id, the description and the globs as flags, and the file lands where that kind is authored, shaped the way the kind requires, with the body left for it to write. Nothing waited for a keystroke.

**Why this priority**: This is the whole gap. Without it an agent cannot author at all except by guessing at a file format, and everything else in agent authoring only points at this command. It delivers value on its own: a repository whose agent knows the flags can author correctly, told by hand.

**Independent Test**: Run `cw add` with every header as a flag, with no terminal attached at all, in a repository set up under a charter; confirm the file written is byte for byte the file the interactive run writes for the same answers, and that a run missing a required header writes nothing and names what is missing.

**Acceptance Scenarios**:

1. **Given** a governed repository and no terminal to prompt at, **When** the agent runs `cw add guide test-naming --header description="How tests are named." --header globs="test/**"`, **Then** one file is written where that kind is authored, holding those headers and an empty body, and the command says which file and that the body is still to be written ([CORE-FR-066](#core-fr-066), [CORE-FR-074](#core-fr-074), [CORE-FR-069](#core-fr-069)).
2. **Given** a kind whose header takes a list, **When** the flag is given more than once for that header, **Then** every value is kept, in the order given ([CORE-FR-067](#core-fr-067)).
3. **Given** a required header left out, **When** the command runs, **Then** nothing is written, and each missing header is named with what it takes — the same words the engine refuses a bad header with anywhere else ([CORE-FR-071](#core-fr-071), [CORE-FR-073](#core-fr-073)).
4. **Given** a header the kind does not take, **When** the command runs, **Then** nothing is written and that header is named ([CORE-FR-072](#core-fr-072)).
5. **Given** an id already claimed anywhere in the charter, **When** the command runs, **Then** nothing is written and the file already claiming it is named ([CORE-FR-015](#core-fr-015)).
6. **Given** any run where a header was given as a flag, **When** the command runs, **Then** nothing is asked at a prompt, whether or not a terminal is attached ([CORE-FR-070](#core-fr-070)).
7. **Given** a successful run, **When** it finishes, **Then** nothing is compiled and nothing is committed: the file sits in the working tree for the author to write the body into and build ([CORE-FR-074](#core-fr-074), [CORE-FR-079](#core-fr-079)).
8. **Given** a `--header` value holding `=`, **When** the command runs, **Then** the value is everything after the first `=`; a flag with no `=` is refused, naming the flag ([CORE-FR-068](#core-fr-068)).

---

### CORE Story 11 - Ask a kind what it requires, rather than being told (Priority: P2)

**Status**: Done

Before writing anything the agent asks the engine which kind it should be writing and what that kind wants. One command per kind answers: the headers it requires, the shape each takes, and one complete example of that kind. The agent turns that answer into the flags of [CORE Story 10](#core-story-10---write-a-primitive-with-no-terminal-to-answer-at-priority-p1).

**Why this priority**: [CORE Story 10](#core-story-10---write-a-primitive-with-no-terminal-to-answer-at-priority-p1) works when someone already knows the headers. This is what keeps that knowledge out of every surface that would otherwise go stale — the skill body of [CORE Story 12](#core-story-12---the-instructions-arrive-with-the-engine-not-with-the-repository-priority-p3) above all. It is independently useful: a person choosing a kind reads the same answer.

**Independent Test**: Run `cw kinds <kind>` for every kind there is and confirm each answer names exactly the headers that kind's contract requires, with each header's shape and the kind's own sample; confirm `cw kinds` with no argument prints one line per kind and when it comes up; confirm a word that is no kind is answered with every kind there is.

**Acceptance Scenarios**:

1. **Given** any kind, **When** the agent asks `cw kinds <kind>`, **Then** the answer names every header that kind requires, the shape each takes, and the kind's sample as an author writes one ([CORE-FR-059](#core-fr-059)).
2. **Given** no argument, **When** the agent asks `cw kinds`, **Then** the answer is one line per kind, saying when a primitive of that kind comes up ([CORE-FR-060](#core-fr-060)).
3. **Given** a word that is no kind, **When** it is asked about, **Then** the answer says so and lists every kind there is ([CORE-FR-061](#core-fr-061)).
4. **Given** any kind, **When** its answer here is compared with what `cw add` asks for and what a refusal says, **Then** all three name the same headers in the same words, because all three read the kind's one contract ([CORE-FR-062](#core-fr-062), [CORE-FR-063](#core-fr-063)).

---

### CORE Story 12 - The instructions arrive with the engine, not with the repository (Priority: P3)

**Status**: Done

A repository is set up under `cw`. Without anyone installing, copying or writing anything, its agent already reads a skill that tells it how to author a primitive here: ask the kind, answer with flags, write the body, build. Nothing was added to the repository for it. The charter it is governed by is what the repository authored, what it installed, and what the engine itself brings — and a listing says which of the three each primitive came from.

**Why this priority**: Stories 10 and 11 give the agent the means; this one means nobody has to tell it. It is last because a repository can be told by hand, once, and still get everything above.

**Independent Test**: Set a fresh repository up and build it; confirm `cw-author` is listed under the layer the engine owns and has compiled to the agent's skill surface with no extra command run and no primitive's file added; confirm a repository that authors a primitive under that id is refused with the collision naming both.

**Acceptance Scenarios**:

1. **Given** any governed repository, **When** its charter is read, **Then** what the engine brings is part of it, without any file having been written into the repository to put it there ([CORE-FR-017](#core-fr-017), [CORE-FR-018](#core-fr-018)).
2. **Given** any governed repository, **When** `cw build` runs, **Then** this primitive compiles to the agent's skill surface like any other skill in the charter, and nothing under the workspace is written for it ([CORE-FR-024](#core-fr-024), [CORE-FR-096](#core-fr-096)).
3. **Given** the engine being upgraded, **When** the next read happens, **Then** what this primitive says is the running engine's, with nothing to refresh and nothing that can be out of date ([CORE-FR-018](#core-fr-018)).
4. **Given** the charter being read, **When** it is listed, explained, counted or validated, **Then** this primitive appears like any other, under the layer it came from, and says which layer that is ([CORE-FR-019](#core-fr-019), [CORE-FR-020](#core-fr-020)).
5. **Given** a repository that authors a primitive claiming this id under its own layer, **When** the charter is read, **Then** it is the collision two files claiming one id always is, naming both ([CORE-FR-015](#core-fr-015), [CORE-FR-021](#core-fr-021)).
6. **Given** this layer, **When** vendor commands are run, **Then** they do not touch it: nothing installed it, and there is nothing under the workspace for them to act on ([CORE-FR-023](#core-fr-023)).
7. **Given** this primitive, **When** anyone tries to change it where the charter is authored, **Then** there is nothing to change: what a repository does instead is author its own primitive, which its own layer holds ([CORE-FR-016](#core-fr-016), [CORE-FR-099](#core-fr-099)).
8. **Given** this primitive's body, **When** it is read, **Then** it names no kind's header or requirement and says to ask the engine; it says the procedure — ask the kind, add with one flag per header, write the body, build; it says it is the engine's own and does not cover changing or removing a primitive; and every `cw` command it names is one `cw` answers ([CORE-FR-097](#core-fr-097), [CORE-FR-098](#core-fr-098), [CORE-FR-099](#core-fr-099), [CORE-FR-101](#core-fr-101), [CORE-FR-103](#core-fr-103)).

---

### CORE Story 13 - Install `cw` with one command and use it in any repository (Priority: P1)

**Status**: Done

A developer reads about Cherry Works and wants to try it on their own repository. They install it from the public package registry with the one command their package manager already knows, and `cw` is on their path. They never clone this repository, never build anything and never install a browser or a compiler: `cw init`, `cw build` and `cw portal` work for them exactly as they work for someone who built from source.

**Why this priority**: Until this, the only way in is to clone and build, which is a contributor's path, not a user's. Everything the product does sits behind it.

**Independent Test**: On a machine holding only the supported runtime and git, install the published package, set a fresh repository up, author one rule, build it, and open the portal.

**Acceptance Scenarios**:

1. **Given** a machine with the supported runtime and git, **When** the developer installs the package globally, **Then** `cw` is on their path and `cw --help` lists every command ([CORE-FR-126](#core-fr-126), [CORE-FR-094](#core-fr-094)).
2. **Given** the installed `cw`, **When** it is run in any repository, **Then** every command behaves as it does from a source build, the portal's page included, and nothing of this repository's source is needed ([CORE-FR-127](#core-fr-127)).
3. **Given** a developer who does not want a global install, **When** they run `cw` once through their package manager's run-without-installing command, **Then** that run works and nothing is left installed ([CORE-FR-127](#core-fr-127)).
4. **Given** a runtime older than the one supported, **When** the developer runs `cw`, **Then** they are told which version it needs and nothing is done ([CORE-FR-128](#core-fr-128)).
5. **Given** the installed `cw` and no network, **When** any command is run but adding or updating a vendor source and what reaches an mcp origin or runs an agent — building a charter that declares an `mcp`, signing in, a tool call, an evaluation — **Then** it works, as it does from a source build ([CORE-FR-209](#core-fr-209)).
6. **Given** the install, **When** what it put on the machine is looked at, **Then** it holds only what `cw` runs on: nothing that exists only to build, bundle or test it ([CORE-FR-129](#core-fr-129)).

---

### CORE Story 14 - Know which `cw` is running, and move to another (Priority: P2)

**Status**: Done

A developer is asked which version they are on when they report a problem, and a team wants every member and its CI to run the same version. They can ask `cw` its version, upgrade it with their package manager, and pin one version to a repository so that the repository's own scripts always run that one, whatever is installed globally.

**Why this priority**: [CORE Story 13](#core-story-13---install-cw-with-one-command-and-use-it-in-any-repository-priority-p1) gets `cw` onto a machine once. This one keeps it there across releases: without a version to name, a bug report cannot be matched to a release, and a team cannot agree on one.

**Independent Test**: Install one published version globally and another as a development dependency of a repository; confirm `cw --version` names each where it runs; upgrade the global one and confirm the next run is the new version, with the builtin layer the new version's.

**Acceptance Scenarios**:

1. **Given** the installed `cw`, **When** the developer runs `cw --version`, **Then** it prints the version it was published as, and nothing else, and exits successfully ([CORE-FR-131](#core-fr-131)).
2. **Given** a newer version published, **When** the developer upgrades with their package manager, **Then** the next run is the new version, and what the builtin layer brings is the new version's with nothing to migrate ([CORE-SC-021](#core-sc-021)).
3. **Given** a repository that declares one version of the package as a development dependency, **When** `cw` is run through that repository's own scripts, **Then** it is that version, whatever version is installed globally ([CORE-FR-210](#core-fr-210)).
4. **Given** any repository, **When** the health check runs, from the command line or from the portal, **Then** its report names the version of `cw` that produced it ([CORE-FR-132](#core-fr-132)).

---

### CORE Story 15 - Publish a release that users can trust (Priority: P3)

**Status**: Done

A maintainer wants to put a new version in users' hands. They ask for a release of one version, and it is published only if what would be published is known to work: the tests pass, the working tree holds nothing uncommitted, the version is new, and the exact package about to be published has been installed apart from the repository and seen to set a repository up and build it. Each published version can be traced back to the commit it was built from.

**Why this priority**: Stories 13 and 14 are what a user sees. This one is how the maintainer gets there without publishing something broken, and it can be done carefully by hand until it exists.

**Independent Test**: Ask for a release with a failing test, then with an uncommitted change, then of a version already published, and confirm each is refused with nothing published; ask for a release from a clean, green tree and confirm the version is published, installable, and tagged at the commit it came from.

**Acceptance Scenarios**:

1. **Given** a clean working tree whose tests pass, **When** the maintainer releases a new version, **Then** that version is published and the repository records the commit it was built from under a tag named after it ([CORE-FR-136](#core-fr-136), [CORE-FR-137](#core-fr-137)).
2. **Given** a failing test, or a change not committed, **When** a release is asked for, **Then** it is refused, saying which, and nothing is published ([CORE-FR-134](#core-fr-134)).
3. **Given** a version already published, **When** a release of it is asked for, **Then** it is refused, and nothing is published ([CORE-FR-134](#core-fr-134)).
4. **Given** the package a release would publish, **When** it is installed apart from the repository and fails to set a fresh repository up and build it, **Then** the release is refused, and nothing is published ([CORE-FR-135](#core-fr-135)).
5. **Given** a published package, **When** its contents are listed, **Then** they are the runnable program, the portal's page, the library an integrator imports, the README and the license, and nothing else of the development repository — no specs, tests, sources or its own charter ([CORE-FR-130](#core-fr-130), [CORE-FR-133](#core-fr-133)).

---

### CORE Story 16 - Open every primitive as it was compiled (Priority: P1)

**Status**: Done

An agent surveying the charter finds a primitive in the catalogue and opens the file the catalogue names. Today that file is the one its author wrote: it lacks the mixins the primitive pulls in, it sits in whichever layer brought it, and for what the engine itself brings it is a name no one can open. After this, a build writes every primitive, from every layer, as one compiled document in the compiled output — its headers, then the bodies of its mixins, then its own — and the catalogue names that document. What the agent opens is the whole of what the primitive says, in one place, whoever authored it. A person listing the charter is still shown the file they would edit.

**Why this priority**: The catalogue is the agent's way into every body the charter holds, and today it sends the agent to partial text and, for one layer, to nothing.

**Independent Test**: In a repository with one guide pulling in one mixin, one vendored primitive and the builtin skill, build; confirm `.cw/out/<kind>/<id>/index.md` exists for each, holds the mixin's body before the guide's, and is what `catalogue.json` names; confirm `cw list` still names `.cw/charter/primitive/…`, `.cw/charter/vendor/…` and `(built into cw)/…`; delete the guide and build; confirm its compiled document is gone.

**Acceptance Scenarios**:

1. **Given** a charter, **When** it is built, **Then** every primitive of every layer has one document at `.cw/out/<kind>/<id>/index.md`, holding its headers and, below them, the bodies of the mixins it pulls in, in the order it names them, before its own body ([CORE-FR-139](#core-fr-139), [CORE-FR-037](#core-fr-037)).
2. **Given** that build, **When** `catalogue.json` is read, **Then** each entry's `file` is that primitive's compiled document, and no entry names a file under `.cw/charter/` or the engine ([CORE-FR-140](#core-fr-140), [CORE-FR-025](#core-fr-025)).
3. **Given** the builtin skill, **When** the catalogue's `file` for it is opened, **Then** it is a file on disk holding the skill ([CORE-FR-139](#core-fr-139), [CORE-FR-024](#core-fr-024)).
4. **Given** a primitive deleted from the charter, **When** the charter is built again, **Then** its compiled document is gone ([CORE-FR-032](#core-fr-032)).
5. **Given** a compiled document hand-edited, or a primitive changed since the last build, **When** the build is previewed, **Then** the document is listed as one the build would write ([CORE-FR-032](#core-fr-032), [CORE-FR-034](#core-fr-034)).
6. **Given** any charter, **When** it is listed from the command line or the portal, **Then** each primitive is shown with the file it was authored in, as before ([CORE-FR-140](#core-fr-140)).

---

### CORE Story 17 - Declare where knowledge lives once, and point any primitive at it (Priority: P1)

**Status**: Done

A team's rule about rounding tax on an invoice has reasons that live outside the repository: the service's code in another repository, the tax specification in Notion, the decisions taken in a Slack channel. The author declares each of those mcp origins once, as an `mcp` primitive with an id of the team's choosing, its address and the tools the agent may use there. Then the rule names each mcp origin it draws on in its body, as `[[<id>]]`. The build gathers every declared mcp origin into one list, and gives the agent one MCP server to reach them all.

**Why this priority**: Every other story here reaches an mcp origin this one declares. Without it an agent is told the rule and not where its reasons are.

**Independent Test**: Author two `mcp` primitives and one guide naming both; build; confirm the list of mcp origins holds both, the agent's MCP configuration holds one entry, and the guide's compiled surface names both mcp origins. Rename nothing and change one address; build; confirm the guide is unchanged.

**Acceptance Scenarios**:

1. **Given** a repository set up under `cw`, **When** the author runs `cw add mcp mfbs/billing` and answers its address, the ways to sign in it allows and the tools it opens, **Then** `.cw/charter/primitive/mcp/mfbs/billing/index.md` is written and `mfbs/billing` is an id of the charter ([CORE-FR-142](#core-fr-142), [CORE-FR-064](#core-fr-064)).
8. **Given** an `mcp` primitive declaring both an endpoint and a command, or neither, or a command taking a token with no variable named for it, **When** the charter is checked, **Then** it is refused under that file with the kind's sample ([CORE-FR-142](#core-fr-142)).
2. **Given** that primitive, **When** a guide's body says "take the requirements from [[mfbs/billing]]" and the charter is built, **Then** the guide's compiled document, and its rule for the agent, link that mcp origin by its id to its compiled document, the rule sends the agent to that document, and a subagent listing it is given its tools under the name they are served under ([CORE-FR-147](#core-fr-147), [CORE-FR-145](#core-fr-145)).
3. **Given** a primitive whose body names an `mcp` id no layer holds, **When** the charter is checked, built or tested, **Then** it is an error under that primitive's file naming the id, and nothing is built ([CORE-FR-162](#core-fr-162)).
4. **Given** an `mcp` primitive no primitive names, **When** the health check runs, **Then** it warns under that primitive's file, and the build still runs ([CORE-FR-144](#core-fr-144)).
5. **Given** the repository and a vendor each declaring the same address under a different id, **When** the charter is built, **Then** the list of mcp origins holds that address once, under both ids, and every tool either declares is served there ([CORE-FR-145](#core-fr-145)).
6. **Given** a charter, with or without an `mcp` primitive, **When** it is built for Claude Code, **Then** the repository's MCP configuration holds one entry that starts `cw mcp serve`, and nothing of the repository's own entries is changed ([CORE-FR-146](#core-fr-146)).
7. **Given** an mcp origin whose address changes, **When** only its `mcp` primitive is edited and the charter built, **Then** every primitive naming it reaches the new address, with no other file changed ([CORE-FR-143](#core-fr-143), [CORE-SC-038](#core-sc-038)).

---

### CORE Story 18 - Sign in to every mcp origin as yourself (Priority: P1)

**Status**: Done

A developer clones a repository whose charter declares four mcp origins. They run one command, and are taken through each address the charter holds that they have not signed in to yet: a browser sign-in where the mcp origin offers one, a token pasted at a hidden prompt where it does not. What they are signed in as is theirs, kept on their machine outside the repository, and used for every call their agent makes. Nobody else's access is lent to them, and when an mcp origin takes their access away, their agent loses it with them.

**Why this priority**: Without a credential no call reaches an mcp origin. Signing in as oneself is also what keeps every call attributable and every revocation whole — the reason there is no gateway.

**Independent Test**: In a repository declaring two addresses, run the sign-in and complete it for both; confirm the status lists both as signed in, no file under the repository changed, and a second run asks for nothing. Revoke one credential at its mcp origin and confirm the next call there says to sign in again.

**Acceptance Scenarios**:

1. **Given** a charter declaring mcp origins at two addresses, **When** the developer runs `cw mcp auth` at a terminal, **Then** they are asked about each address in turn, offered every way to sign in that any `mcp` primitive at that address allows, and signed in to each ([CORE-FR-148](#core-fr-148)).
2. **Given** two `mcp` primitives at one address, **When** the developer has signed in to that address once, **Then** both are signed in ([CORE-FR-148](#core-fr-148)).
3. **Given** a developer signed in to every address, **When** they run `cw mcp auth` again, **Then** nothing is asked, and they are told every address is signed in ([CORE-FR-148](#core-fr-148)).
4. **Given** no terminal to ask at, as when an agent runs the command, **When** `cw mcp auth` runs, **Then** nothing is asked, the addresses not signed in are named, and the command fails, saying to run it at a terminal ([CORE-FR-150](#core-fr-150)).
5. **Given** a token typed at the prompt, **When** it is entered, **Then** it is not shown, and after sign-in it appears in no file under the repository and in nothing `cw` prints ([CORE-FR-149](#core-fr-149)).
6. **Given** `cw mcp auth --status`, **When** it runs, **Then** it lists each address with the ids at it and whether the developer is signed in there, and changes nothing ([CORE-FR-150](#core-fr-150)).
7. **Given** `cw mcp auth mfbs/billing`, **When** it runs, **Then** the developer is signed in again to that primitive's address alone, whatever they were signed in as before ([CORE-FR-148](#core-fr-148)).

---

### CORE Story 19 - Give the agent one server that reaches every mcp origin (Priority: P1)

**Status**: Done

The developer's agent is given one MCP server, `cw mcp serve`. It shows the agent the tools the build kept that each mcp origin's ids declare, each under a name that says which mcp origin it belongs to, and nothing else the mcp origin has. A call goes to its mcp origin with the developer's own credential. An mcp origin that is down, or not signed in to, answers each call with why and what to do; every other mcp origin works as before.

**Why this priority**: This is where the agent actually reaches the knowledge Stories 17 and 18 declared and unlocked.

**Independent Test**: With two mcp origins declared and signed in, start the server from the agent; list its tools and confirm the tools the build kept that those ids declare, each under its mcp origin's name; call one of each; stop one mcp origin and confirm its calls answer why while the other's still work.

**Acceptance Scenarios**:

1. **Given** a built charter and a developer signed in, **When** the agent starts `cw mcp serve`, **Then** the tools it lists are the tools the build kept that those ids declare, each named after its mcp origin, and the mcp origin's own tools not declared are not listed ([CORE-FR-153](#core-fr-153)).
2. **Given** a tool it did not list, **When** the agent calls it, **Then** the call is refused and nothing reaches any mcp origin ([CORE-FR-153](#core-fr-153)).
3. **Given** a listed tool, **When** the agent calls it, **Then** the call reaches that tool's mcp origin under the developer's own credential and the mcp origin's answer is returned as it came ([CORE-FR-154](#core-fr-154)).
4. **Given** an mcp origin not signed in to, **When** a tool of it is called, **Then** the call answers that the developer must sign in, naming the command, and other mcp origins are unaffected ([CORE-FR-151](#core-fr-151), [CORE-FR-154](#core-fr-154)).
5. **Given** the tools the build kept, **When** the agent lists them, **Then** they are listed and no mcp origin is reached ([EVAL-FR-031](spec-eval.md#eval-fr-031)).
6. **Given** a tool an mcp declares that its mcp origin does not list, **When** the developer builds, **Then** the build stops, naming the mcp's file and the tools the origin lists, and writes nothing ([EVAL-FR-031](spec-eval.md#eval-fr-031)).
7. **Given** a charter never built, **When** `cw mcp serve` starts, **Then** it stops, saying the charter must be built first ([CORE-FR-152](#core-fr-152)).
8. **Given** an mcp origin declared by a command that takes a token, **When** a tool of it is called, **Then** the server starts that command with the developer's token in the variable the primitive names, and stops it once the call has been answered ([CORE-FR-152](#core-fr-152)).
9. **Given** an mcp origin that cannot be reached, **When** one of its tools is called, **Then** the call answers why and every other mcp origin's calls still work ([EVAL-FR-031](spec-eval.md#eval-fr-031)).
10. **Given** a declared tool the saved list does not hold, **When** the server lists tools, **Then** that tool is said, naming the primitive and the tool, and left out, and no mcp origin is reached ([EVAL-FR-031](spec-eval.md#eval-fr-031), [CORE-FR-153](#core-fr-153)).

---

### CORE Story 20 - Hold a subagent to the mcp origins it lists (Priority: P2)

**Status**: Done

A team keeps a subagent that looks for fraud in payments. Beside `Read`, its `tools` lists `[[mfbs/payments]]:list_payments` — one tool of one mcp origin — and `[[linear]]` — every tool that mcp origin declares. The author writes the charter's names and nothing else: what the agent calls those tools is the build's to write. When the charter is built for Claude Code, the subagent holds exactly those; an mcp origin its body only mentions, and any other mcp origin, does not exist for it. A run nobody watches — a job on a schedule, a check in CI — needs no flag of its own: it reaches only the mcp origins it was signed in to, and a call to one that is not signed in to answers that the developer must sign in, leaving every other mcp origin unaffected ([CORE-FR-154](#core-fr-154)).

**Why this priority**: The default — every declared tool — is right for a developer at work. A subagent is where a narrower set matters, and its `tools` already says what it holds.

**Independent Test**: Build a charter whose agent primitive lists one whole mcp origin and one tool of another under `tools`, and mentions a third mcp origin in its body; confirm the subagent's tool list holds its own tools, every tool of the first mcp origin and the one tool of the second, as the agent names them, and nothing of the third. List an mcp origin the charter does not hold, or a tool it does not declare, and confirm the build is refused under the agent's file.

**Acceptance Scenarios**:

1. **Given** an `agent` whose `tools` lists `[[<id>]]`, **When** the charter is built for Claude Code, **Then** the subagent holds every tool that mcp declares, under the name the agent is given it by ([CORE-FR-156](#core-fr-156)).
2. **Given** an `agent` whose `tools` lists `[[<id>]]:<tool>`, **When** the charter is built for Claude Code, **Then** the subagent holds that tool alone of that mcp origin ([CORE-FR-156](#core-fr-156)).
3. **Given** an `agent` whose body mentions `[[<id>]]` that its `tools` does not list, **When** the charter is built, **Then** the subagent holds no tool of that mcp origin ([CORE-FR-156](#core-fr-156)).
4. **Given** an `agent` whose `tools` lists an mcp the charter does not hold, a tool that mcp does not declare, or a `[[…]]` entry written neither as `[[<id>]]` nor as `[[<id>]]:<tool>`, **When** the charter is checked, **Then** it is an error under the agent's file, naming it, and nothing is built ([CORE-FR-156](#core-fr-156)).

---

### CORE Story 21 - Keep a script or a template in the charter, and get the file it is (Priority: P1)

**Status**: Done

A team's release skill tells the agent to check the changelog before tagging. The check is fifteen lines of shell, and the release note always follows one shape. Before this, the skill could only describe both in prose, and the agent rewrote the check each time. After this, the author keeps the note's shape as a `template` primitive: a folder `template/<id>` whose `index.md` holds its headers and a body that is the file to fill. A build compiles it like any other primitive, as `.cw/out/template/<id>/index.md`, and the agent reads what kind of file it is off the body. The check is kept as a `script` primitive, whose files are real files beside its `index.md` ([CORE Story 24](#core-story-24---keep-a-script-as-real-files-and-say-which-one-runs-priority-p1)). Both are listed, searched, explained and checked like every other primitive.

**Why this priority**: Without a file to run or fill, a skill can only describe what should happen. [CORE Story 22](#core-story-22---point-any-primitive-at-a-script-or-a-template-by-its-id-priority-p2) depends on the files this story builds.

**Independent Test**: Author `release-note`; build; confirm `.cw/out/template/release-note/index.md` holds its headers and its body; confirm `catalogue.json` names it; delete the template and build; confirm its file is gone.

**Acceptance Scenarios**:

1. **Given** a repository set up under `cw`, **When** the author runs `cw kinds template`, **Then** the answer names no header beyond those every kind takes, and the kind's sample; `cw kinds script` names `executionPath` ([CORE-FR-165](#core-fr-165)).
2. **Given** `cw add template release-note`, **When** it runs, **Then** `.cw/charter/primitive/template/release-note/index.md` is written with an empty body, and `release-note` is an id of the charter ([CORE-FR-158](#core-fr-158), [CORE-FR-064](#core-fr-064)).
3. **Given** a template with a body, **When** the charter is built, **Then** `.cw/out/template/<id>/index.md` is its compiled document: its headers, then the bodies of the mixins it pulls in and its own, stamped like any other ([CORE-FR-159](#core-fr-159)).
4. **Given** a built template, **When** it is looked at, **Then** it is not executable ([CORE-FR-160](#core-fr-160)).
5. **Given** a template declaring a header no kind takes, **When** it is added, **Then** it is refused naming that header, as for any kind ([CORE-FR-072](#core-fr-072), [CORE-FR-158](#core-fr-158)).
6. **Given** a template whose body changes, **When** the charter is built, **Then** its compiled document holds the new body ([CORE-FR-159](#core-fr-159)).
7. **Given** a built charter, **When** `catalogue.json` is read, **Then** each template's `file` is its compiled document; **When** it is listed from the command line or the portal, **Then** it is shown with the file it was authored in ([CORE-FR-164](#core-fr-164), [CORE-FR-140](#core-fr-140)).
8. **Given** a script or a template no primitive names, **When** the health check runs, **Then** it warns under that primitive's file, and the build still runs ([CORE-FR-163](#core-fr-163)).
9. **Given** a vendor source holding a template, **When** the repository builds, **Then** the template is built into the compiled output like one the repository authored ([CORE-FR-159](#core-fr-159)).
10. **Given** a body naming `[[<id>]]` that no layer holds, **When** the charter is checked, built or tested, **Then** it is an error under the file whose body names it, naming the id, and nothing is built ([CORE-FR-162](#core-fr-162)).

---

### CORE Story 22 - Point any primitive at a script or a template by its id (Priority: P2)

**Status**: Done

The release skill's body says "run `[[release/check-changelog]]` before tagging, and write the note from `[[release-note]]`". The author writes ids, not paths, and no path is kept in the charter. The agent finds each in the catalogue, whose `file` names what to open for that id. If the script is renamed or its id is mistyped, the author learns it at the build, not when the agent reaches for a file that is not there; and when a template's body changes, only its built file does.

**Why this priority**: [CORE Story 21](#core-story-21---keep-a-script-or-a-template-in-the-charter-and-get-the-file-it-is-priority-p1) puts the files where the agent can reach them. This story means no author ever writes, or keeps up to date, the path to one.

**Independent Test**: Build a charter holding a script, a template and a skill naming both; confirm the catalogue's `file` for each opens from the repository's root; change the template's body, build, and confirm only its built file changed; run `cw explain` on the script and confirm it names the skill.

**Acceptance Scenarios**:

1. **Given** a primitive of any kind whose body names `[[<id>]]` of a primitive the charter holds, **When** the charter is built, **Then** the catalogue's entry of that id names the file an agent opens for it ([CORE-FR-164](#core-fr-164)), and the name is written in the compiled output as [CORE Story 25](#core-story-25---write-each-name-as-what-its-reader-can-use-priority-p2) says.
2. **Given** a template whose body changes, **When** only its file is edited and the charter is built, **Then** the catalogue names the same file for that id, and no primitive naming it changes ([CORE-FR-164](#core-fr-164), [CORE-FR-161](#core-fr-161)).
3. **Given** `cw explain <id>`, **When** it runs, **Then** it says every primitive that mentions that script, as it names the primitives that cite a corpus; the portal says the same ([CORE-FR-163](#core-fr-163)).

---

### CORE Story 23 - Keep every primitive as a folder, with its index.md and its assets (Priority: P1)

**Status**: Done

Until now a primitive was one markdown file, and a skill that needed a checklist, a sample or a helper beside it had nowhere to keep one. After this, every primitive is a folder: `<kind>/<id>/index.md` under its layer, the `/` of an id a folder like any other, as in `mcp/team/billing/index.md`. Every other file in that folder is one of its assets; the body reaches each as `./<file>`. A build compiles `index.md` to `.cw/out/<kind>/<id>/index.md` and copies the assets beside it, so the same `./<file>` opens there too. Going down from a kind's folder, the first `index.md` found is a primitive and everything under it belongs to it, so `cw add` refuses a primitive that would sit inside another, or hold one.

**Why this priority**: A script is nothing but a primitive with files to run ([CORE Story 24](#core-story-24---keep-a-script-as-real-files-and-say-which-one-runs-priority-p1)); with assets for every kind, a script needs no layout of its own.

**Independent Test**: Run `cw add skill team/review` and confirm `.cw/charter/primitive/skill/team/review/index.md` is written; put `checklist.md` beside it and name `./checklist.md` in the body; build; confirm `.cw/out/skill/team/review/index.md` is what the catalogue names and that `checklist.md` sits beside it byte for byte; run `cw add skill team/review/strict` and `cw add skill team` and confirm both are refused; keep a primitive as `skill/old.md` and confirm the check names where to move it.

**Acceptance Scenarios**:

1. **Given** `cw add skill team/review` with its headers, **When** it runs, **Then** `.cw/charter/primitive/skill/team/review/index.md` is written, and `team/review` is an id of the charter; the portal writes the same file ([CORE-FR-141](#core-fr-141)).
2. **Given** a primitive of any kind and any layer with files beside its `index.md`, at any depth, **When** the charter is built, **Then** its compiled document is `.cw/out/<kind>/<id>/index.md`, the catalogue names that file, and every other file of its folder is copied beside it at the path it has there, byte for byte ([CORE-FR-168](#core-fr-168), [CORE-FR-139](#core-fr-139)).
3. **Given** a primitive at `skill/team/index.md` and another `index.md` at `skill/team/review/index.md`, **When** the charter is read, **Then** the second is one of the first one's assets, and no primitive ([CORE-FR-168](#core-fr-168)).
4. **Given** a primitive at `skill/team/review/index.md`, **When** the author adds `team/review/strict` or `team`, **Then** it is refused, naming the primitive whose folder it would sit inside or hold, and nothing is written ([CORE-FR-167](#core-fr-167)).
5. **Given** an `index.md` whose folder is not `<kind>/<id>` of the kind and id it declares, or a markdown file kept as `<kind>/<id>.md` by an earlier version, **When** the charter is checked or built, **Then** it is an error under that file saying where to move it, and nothing is built; listed, it lists nothing and sends the developer to the health check ([CORE-FR-003](#core-fr-003), [CORE-FR-141](#core-fr-141), [CORE-FR-002](#core-fr-002), [CORE-FR-012](#core-fr-012)).
6. **Given** a primitive deleted from the portal or the command line, **When** it is done, **Then** its `index.md` and every asset are gone from the charter; the next build deletes their copies ([CORE-FR-076](#core-fr-076)).
7. **Given** a primitive whose id holds `/`, **When** an agent is compiled for, **Then** every name that agent is given for it holds `/` written as `-` ([CORE-FR-141](#core-fr-141)).
8. **Given** an id longer than 40 characters, **When** the charter is checked, **Then** it is refused under its file like any header that does not hold ([CORE-FR-157](#core-fr-157)).

---

### CORE Story 24 - Keep a script as real files, and say which one runs (Priority: P1)

**Status**: Done

The changelog check is a shell file. Kept as the body of a markdown file, no editor colours it, no linter reads it, and it cannot be run to try it. After this, a script is a primitive like any other, and its real files are its assets: `script/check-changelog/index.md` beside `script/check-changelog/run.sh`. Its `executionPath` header names the one that runs, from `index.md`: `./run.sh`, typed by its author. Its body says how the script is called: its arguments, and when to run it. A build compiles it and copies its assets to `.cw/out/script/check-changelog/`; what an agent or a sensor runs is the copy, so a change that has not been built yet never reaches what runs.

**Why this priority**: A script nobody can lint or try is a script nobody trusts, and running the charter's own file would let a half-written edit run.

**Independent Test**: Run `cw add script check-changelog --header executionPath=./run.sh` and confirm `index.md` and an empty `run.sh` beside it are written, and that `cw add` says so; write the script, a helper beside it and a body saying its arguments; build; confirm `.cw/out/script/check-changelog/` holds both files byte for byte, that `run.sh` runs by its path and the helper is not executable; edit `run.sh` without building and confirm the copy is unchanged and the preview says it would be written.

**Acceptance Scenarios**:

1. **Given** a repository set up under `cw`, **When** the author runs `cw kinds script`, **Then** the answer names the `executionPath` header, its shape and the kind's sample ([CORE-FR-059](#core-fr-059), [CORE-FR-165](#core-fr-165)).
2. **Given** `cw add script check-changelog --header executionPath=./run.sh`, **When** it runs, **Then** `.cw/charter/primitive/script/check-changelog/index.md` is written with that header and an empty `run.sh` beside it, and both are said; the portal writes the same two files and says the same ([CORE-FR-165](#core-fr-165), [CORE-FR-167](#core-fr-167)).
3. **Given** a built script, **When** its copy is looked at, **Then** the file its `executionPath` names is executable and no other asset is ([CORE-FR-160](#core-fr-160)).
4. **Given** a script whose `executionPath` is missing, is not written as `./<path>`, leaves its folder, holds what a shell would read, or names no asset of it, **When** the charter is checked, **Then** it is an error under the script's `index.md`, and nothing is built ([CORE-FR-165](#core-fr-165)).
5. **Given** a built script, **When** one of its assets is edited, added or deleted and no build runs, **Then** the copy is as the last build left it, the preview lists what the build would write and delete, and the health check says the output is out of date ([CORE-FR-166](#core-fr-166)).
6. **Given** a vendor source holding a script, **When** the repository builds, **Then** its assets are copied into the compiled output like one the repository authored ([CORE-FR-168](#core-fr-168)).

---

### CORE Story 25 - Write each name as what its reader can use (Priority: P2)

**Status**: Done

The charter holds ids: `[[check-changelog]]` in a sensor's `run`, `[[linear]]` among an agent primitive's tools, `[[release-note]]` in a skill's body. Three readers meet them. The agent executes a sensor's command and looks nothing up, so it needs a path. An agent calls a tool by its own name for it. A person or an agent reading a compiled document can follow a link. After this, a build writes each name as what its reader can use: a sensor's `run` names the built script's file, an agent primitive's tools are the agent's names as before, and a name in a body is a markdown link to the file the catalogue names for it, which opens with a click.

**Why this priority**: Stories 23 and 24 put the files in place. Without this a sensor cannot run a charter script at all, and a reader of a compiled document has to look every name up.

**Independent Test**: Author a script, a template, an mcp, a sensor whose `run` is `[[<id>]] --strict`, and a skill whose body names all three; build for an agent; confirm the sensor's built command starts with `.cw/out/script/<id>/` and runs, that each name in the skill's compiled document is a link whose target opens from that document, and that `cw explain` on the script names the sensor and the skill.

**Acceptance Scenarios**:

1. **Given** a sensor whose `run` names `[[<id>]]` of a script the charter holds, **When** the charter is built for an agent, **Then** the command built for that sensor holds the built file's path from the repository's root in its place, with the rest of the command as written ([CORE-FR-169](#core-fr-169)).
2. **Given** a sensor whose `run` names a script no layer holds, **When** the charter is checked, **Then** it is an error under the sensor's file, as a body naming one is ([CORE-FR-162](#core-fr-162)); a script only a sensor names is not warned about, and `cw explain` on it names the sensor.
3. **Given** a primitive of any kind whose body names `[[<id>]]` of a primitive the charter holds, **When** the charter is built, **Then** its compiled document holds a markdown link in its place: the id as its text, and the file the catalogue names for it as its target, written from that document ([CORE-FR-147](#core-fr-147)).
4. **Given** a name written alone inside a code span, **When** the charter is built, **Then** the link's text is that code span; **Given** a name inside a longer code span or a fenced block, **Then** it is left as written ([CORE-FR-147](#core-fr-147)).
5. **Given** a template whose body names a script, **When** the charter is built, **Then** its compiled document holds a link in its place, as any compiled document does ([CORE-FR-147](#core-fr-147), [CORE-FR-161](#core-fr-161)).
6. **Given** an agent primitive listing `[[<id>]]` among its tools, **When** the charter is built for an agent, **Then** its tool list holds the names that agent calls them by, as before ([CORE-FR-156](#core-fr-156)).

---

### CORE Story 26 - Invoke a skill by its id alone (Priority: P2)

**Status**: Done

A charter names its skills for whoever invokes them: a vendor publishing a spec-driven workflow calls its skills `sdd-plan` and `sdd-implement` so its users type `/sdd-plan`. Before this, the agent was given every skill and rule with the kind in front, so the user typed `/skill-sdd-plan` and `/playbook-sdd-implement`, and had to know which kind each one was authored as. After this, every file an agent is given is named by the id alone, and the user types what the author named.

**Why this priority**: The name is the interface a user meets first. A prefix the author never wrote makes every vendor's skills awkward to call, and makes a skill turned into a playbook change its name.

**Independent Test**: Author a skill `sdd-plan`, a playbook `sdd-implement`, a guide `no-any` and an agent `ship`, build for Claude, and confirm the files are `.claude/skills/sdd-plan/SKILL.md`, `.claude/skills/sdd-implement/SKILL.md`, `.claude/rules/no-any.md` and `.claude/agents/ship.md`, and that the files the last build wrote under their old names are gone.

**Acceptance Scenarios**:

1. **Given** a skill, a playbook, a guide or an agent primitive, **When** the charter is built for an agent, **Then** every name the agent is given for it is its id, `/` written as `-`, with no kind ([CORE-FR-171](#core-fr-171)).
2. **Given** a guide and a skill of one id, in any layers, **When** the charter is checked, **Then** it is the collision two files claiming one id always are, naming both ([CORE-FR-015](#core-fr-015)).
3. **Given** a skill and a playbook of one id, in any layers, **When** the charter is checked, **Then** it is the collision two files claiming one id always are, naming both ([CORE-FR-015](#core-fr-015)).
4. **Given** a repository built by an earlier version, with files named `skill-<id>` and `guide-<id>`, **When** it is built again, **Then** those files are deleted and the files named by id alone are written ([CORE-FR-171](#core-fr-171)).

---

### CORE Story 27 - Name every primitive by its id alone (Priority: P1)

**Status**: Done

An author names primitives everywhere: the corpus a guide cites, the mixin it pulls in, the script a skill runs, the case a test expects to come up. Before this, every one of those was written `kind:id`, `corpus:sdd` or `guide:no-any`, though the id was already the name the author chose, and two kinds could share an id that an agent then had to tell apart. After this, an id names one primitive in the whole charter, whatever its kind, and it is all the author writes: `rationale: sdd`, `mixins: [house-style]`, `cw explain no-any`. Where the name sits among other text — a body, a sensor's command, an agent primitive's tools — it is written `[[sdd-link-specs]]`, so the build can find it, and every one becomes a link to the primitive it names.

**Why this priority**: Every primitive is named somewhere, and with agent files named by the id ([CORE Story 26](#core-story-26---invoke-a-skill-by-its-id-alone-priority-p2)) two kinds sharing one id can no longer be built at all. One name, and one way to write it, is simpler for authors, for agents and for the engine.

**Independent Test**: Author a guide citing `rationale: why-small`, pulling in `mixins: [house-style]`, whose body names `[[check-changelog]]` and `[[why-small]]`; a sensor whose `run` is `[[check-changelog]] --strict`; an agent primitive whose tools list `[[linear]]`; a test expecting `activate: no-any`. Build, test and explain `no-any`; confirm every name resolves, each `[[…]]` in the body is a link, and each catalogue entry is known by its id alone, with no `kind:id`. Then author a skill `no-any` and confirm it is refused as a collision.

**Acceptance Scenarios**:

1. **Given** a guide and a skill of one id, in any layers, **When** the charter is checked, **Then** it is the collision two files claiming one id always are, naming both ([CORE-FR-015](#core-fr-015)).
2. **Given** a primitive whose `rationale`, `mixins`, a test case's expectation, or a command's argument names a primitive by its bare id, **When** the charter is read, tested or the command runs, **Then** it resolves to that primitive, and where the field takes one kind, an id of another kind resolves to nothing ([CORE-FR-172](#core-fr-172), [CORE-FR-005](#core-fr-005)).
3. **Given** a body naming `[[<id>]]` of any kind the charter holds, **When** the charter is built, **Then** its compiled document holds a link to that primitive's file in its place ([CORE-FR-147](#core-fr-147)).
4. **Given** a sensor whose `run` names `[[<id>]]` of a script, and an agent primitive whose `tools` lists `[[<id>]]` or `[[<id>]]:<tool>` of an mcp, **When** the charter is built for an agent, **Then** they are written as the script's path and the agent's tool names, as before ([CORE-FR-156](#core-fr-156), [CORE-FR-169](#core-fr-169)).
5. **Given** the catalogue, `cw list` or `cw explain`, **When** it is read, **Then** each primitive is known by its id alone, and no other name, and the catalogue entry also holds its kind, its description, its file and its globs where it names any ([CORE-FR-025](#core-fr-025)).

---

### CORE Story 28 - Keep a step skill out of the user's commands (Priority: P2)

**Status**: Done

A charter's playbook is the command a user runs, and the skills it calls are its steps: `/sdd-implement` runs a review and a verification of its own. Before this, every skill and every playbook was offered to the user as a command, so the list of commands held every step as well, and a user could run a step on its own, outside the playbook it belongs to. After this, an author writes `disable-user-invocation: true` in a skill's or a playbook's headers, and the agent no longer offers it as a command; the agent still opens it whenever its description matches or a playbook sends it there.

**Why this priority**: The commands a user sees are the charter's interface. A list holding every step makes the few that matter hard to find, and invites running a step out of the order it was written for.

**Independent Test**: Author a playbook `ship` with `disable-user-invocation: false`, a skill `ship-review` with `disable-user-invocation: true` that `ship` names, and a skill `explain` with no such header. Build for Claude, and confirm `ship` and `explain` are offered as commands, `ship-review` is not, and the agent still opens `ship-review` when `ship` reaches that step. Then set `disable-user-invocation: maybe` and confirm the charter is refused under that file.

**Acceptance Scenarios**:

1. **Given** a skill or a playbook declaring `disable-user-invocation: true`, **When** the charter is built for an agent, **Then** the agent does not offer it as a command the user types, and can still open it ([CORE-FR-174](#core-fr-174)).
2. **Given** a skill or a playbook declaring `disable-user-invocation: false`, or not declaring it, **When** the charter is built, **Then** it is offered as a command exactly as before ([CORE-FR-173](#core-fr-173)).
3. **Given** a skill built with `disable-user-invocation: true`, **When** the header is removed and the charter built again, **Then** it is offered as a command again ([CORE-FR-174](#core-fr-174)).
4. **Given** a skill or a playbook whose `disable-user-invocation` is not `true` or `false`, **When** the charter is checked, **Then** it is an error under its file naming how the header is written, and nothing is built ([CORE-FR-173](#core-fr-173)).

---

### CORE Story 29 - Fire every sensor of a signal through one `cw` command (Priority: P2)

**Status**: Done

Before this, every sensor was written into the agent's settings as its own hook, its command copied there whole, with each script's built path in place of its id. A developer reading those settings sees commands, not which sensors fire on which signal, and every sensor added, removed or changed rewrites them. After this, the agent is given one command per signal, `cw sensor run Stop --agent <agent>`, and `cw` gathers every sensor of that signal from the last build and runs them all at once. The agent gets one exit status and one answer back, the same as when it ran each sensor as a hook of its own.

**Why this priority**: The settings file is shared with what the repository sets there for itself; keeping what the charter writes there to one line per signal keeps it readable, and makes a sensor's command the compiled output alone, where every other compiled thing already is.

**Independent Test**: Author sensors `say-a` and `say-b` on `Stop`, each answering with a message, and `gate` on `Stop`, exiting 2 with an error when a file exists. Build for Claude, and confirm its settings hold one `Stop` hook, `cw sensor run Stop --agent claude`, and no sensor's command. Give `cw sensor run Stop --agent claude` a `Stop` event: both messages come back as one answer, and it exits 0. Create the file: it exits 2 with `gate`'s error, and both messages still come back. Change `say-a`'s message without building: the old message comes back.

**Acceptance Scenarios**:

1. **Given** sensors on `Stop` and a sensor on `PreToolUse`, **When** the charter is built for an agent, **Then** that agent's settings hold exactly one command under each of those signals, `cw sensor run Stop --agent <agent>` and `cw sensor run PreToolUse --agent <agent>`, and none of the sensors' own commands ([CORE-FR-175](#core-fr-175), [CORE-SC-047](#core-sc-047)).
2. **Given** a hook the repository set under `Stop` for itself, **When** the charter is built, **Then** `Stop` holds `cw sensor run Stop --agent <agent>` alone: the charter speaks for each of its signals' hooks whole ([CORE-FR-039](#core-fr-039)).
3. **Given** a signal whose last sensor is removed, **When** the charter is built again, **Then** that signal's command is left in the agent's settings as the last build wrote it, and running it runs nothing and exits 0 ([CORE-FR-175](#core-fr-175), [CORE-FR-176](#core-fr-176)).
4. **Given** two sensors on `Stop`, **When** `cw sensor run Stop` is given an event on its standard input, **Then** both run at once, each given that same event ([CORE-FR-176](#core-fr-176)).
5. **Given** one sensor of a signal exiting 2 and another exiting 0, **When** that signal's command runs, **Then** it exits 2 with the first's error output, and the second has run to its end ([CORE-FR-177](#core-fr-177)).
6. **Given** one sensor of a signal exiting 1 and another exiting 0, **When** that signal's command runs, **Then** it exits 1, and the second has run to its end ([CORE-FR-177](#core-fr-177)).
7. **Given** two sensors of a signal each answering with a message, **When** that signal's command runs under the agent, **Then** the agent shows both, as it did when each was a hook of its own ([CORE-FR-178](#core-fr-178), [CORE-SC-048](#core-sc-048)).
8. **Given** a sensor whose `run` was changed in the charter and not yet built, **When** its signal's command runs, **Then** the sensor runs as last built ([CORE-FR-179](#core-fr-179)).
9. **Given** a signal no sensor names, **When** `cw sensor run` is given it, **Then** nothing runs, nothing is written, and it exits 0 ([CORE-FR-176](#core-fr-176)).
10. **Given** a sensor kept for one agent and a sensor kept for none, on the same signal, **When** `cw sensor run` is given that signal with no agent named, **Then** only the sensor kept for no agent runs; with that agent named, both run ([CORE-FR-234](#core-fr-234)).

---

### CORE Story 30 - Name every vendor folder by its owner and its repository (Priority: P2)

**Status**: Done

Before this, a vendor source landed in a folder named by the end of its address alone, so `mattpocock/skills` and `anthropics/skills` would both land in `skills`, and the second would write over the first. After this, every source lands in a folder named by its owner and its repository, `mattpocock/skills`, whichever kind of source it is. A source installed under the old name stays where it is and works as before; the developer moves it by removing it and installing it again.

**Why this priority**: Skills repositories share their names far more than charters do; without the owner in the folder, two of them cannot be installed side by side.

**Independent Test**: Install two sources whose repositories share a name under two owners, and confirm each lands in its own `<owner>/<repository>` folder and both are listed. Then put a source in a folder named by the end of its address alone, and confirm it is listed and builds as before.

**Acceptance Scenarios**:

1. **Given** a source `acme/baseline`, **When** the developer installs it, **Then** it lands in `acme/baseline` under the vendor directory ([CORE-FR-050](#core-fr-050), [CORE-SC-051](#core-sc-051)).
2. **Given** `acme/skills` installed, **When** the developer installs `other/skills`, **Then** both are installed, each in its own folder, and neither is touched by the other ([CORE-FR-050](#core-fr-050), [CORE-SC-051](#core-sc-051)).
3. **Given** a source installed by an earlier version in a folder laid out another way than `<owner>/<repository>/<name>/primitive/`, **When** the charter is listed or built, **Then** it is refused naming that folder, with the fix to delete it and install the source again ([CORE-FR-180](#core-fr-180)).
4. **Given** such a folder, **When** the developer removes it and installs its source again, **Then** the source lands in its `<owner>/<repository>` folder and the old folder is gone ([CORE-FR-050](#core-fr-050)).

---

### CORE Story 31 - Keep a skill out of the agent's own reach (Priority: P2)

**Status**: Done

Some skills are for the user to start and for nobody else: an interview that sharpens a plan is useless when the agent opens it on its own halfway through a task. Before this, the charter could keep a skill out of the user's commands ([CORE Story 28](#core-story-28---keep-a-step-skill-out-of-the-users-commands-priority-p2)) but not out of the agent's reach. After this, an author writes `disable-model-invocation: true` in a skill's or a playbook's headers; the agent still offers it as a command the user types, and the agent no longer opens it because its description matches what is asked.

**Why this priority**: Skills written for `npx skills add` carry this header, and a skill taken into the charter without it would behave otherwise than its author wrote it ([CORE Story 32](#core-story-32---take-a-skill-from-a-skills-repository-into-the-vendor-layer-priority-p2)).

**Independent Test**: Author a skill `grill` with `disable-model-invocation: true` and a skill `explain` with no such header. Build for Claude, and confirm both are offered as commands, `grill` carries the agent's own header saying not to open it by itself, and `explain` does not. Then set `disable-model-invocation: maybe` and confirm the charter is refused under that file.

**Acceptance Scenarios**:

1. **Given** a skill or a playbook declaring `disable-model-invocation: true`, **When** the charter is built for an agent, **Then** the agent offers it as a command and does not open it by itself ([CORE-FR-182](#core-fr-182), [CORE-SC-050](#core-sc-050)).
2. **Given** a skill or a playbook declaring `disable-model-invocation: false`, or not declaring it, **When** the charter is built, **Then** it is given to the agent exactly as before ([CORE-FR-181](#core-fr-181)).
3. **Given** a skill whose `disable-model-invocation` is not `true` or `false`, **When** the charter is checked, **Then** it is an error under its file naming how the header is written, and nothing is built ([CORE-FR-181](#core-fr-181)).
4. **Given** a skill declaring both `disable-model-invocation: true` and `disable-user-invocation: true`, **When** the charter is checked, **Then** it is an error under its file, since neither the user nor the agent could open it, and nothing is built ([CORE-FR-183](#core-fr-183)).

---

### CORE Story 32 - Take a skill from a skills repository into the vendor layer (Priority: P2)

**Status**: Done

Most skills are published not as charters but as skills repositories, each skill a folder holding a `SKILL.md`, installed with `npx skills add mattpocock/skills --skill=grill-me`. Before this, a developer who wanted one of them in their charter rewrote it by hand as a primitive. After this, they run `cw vendor add mattpocock/skills --skill=grill-me`: the skill is found, converted into a charter skill, and left read-only and unstaged in the vendor folder `mattpocock/skills`, for the developer to read and commit. With no `--skill`, every skill the source holds is taken. Its name is its id, its description is kept, its name is also its one trigger, `disable-model-invocation` is kept, and every file beside its `SKILL.md` comes with it. The next build hands it to every agent the repository chose, as any vendored skill.

**Why this priority**: The skills already written outside cherry-works far outnumber those written inside it; taking one should be one command, not an afternoon of copying.

**Independent Test**: In a repository with no uncommitted work, run `cw vendor add mattpocock/skills --skill=grill-me`, and confirm `mattpocock/skills` is added, unstaged, under the vendor directory holding the skill `grill-me`, with description `A relentless interview to sharpen a plan or design.`, trigger `grill-me`, `disable-model-invocation: true`, its body and its `agents/openai.yaml` as written upstream. Build for Claude and confirm `/grill-me` is offered. Then run it with `--skill=nothing-here` and confirm nothing is installed and the skills the source holds are named. Run it with no `--skill` and confirm every skill the source holds is installed.

**Acceptance Scenarios**:

1. **Given** a skills repository holding a skill named `grill-me`, **When** the developer runs `cw vendor add` with that source and `--skill=grill-me`, **Then** the skill is found by the `name` its `SKILL.md` declares, and the vendor folder `<owner>/<repository>` holds a skill primitive `grill-me`, left unstaged, and nothing is built ([CORE-FR-184](#core-fr-184), [CORE-FR-185](#core-fr-185), [CORE-FR-190](#core-fr-190), [CORE-SC-049](#core-sc-049), [CORE-FR-052](#core-fr-052)).
2. **Given** that skill's `SKILL.md`, **When** it is converted, **Then** its `name` is the id, its `description` is the description, its `name` is the one trigger, its `disable-model-invocation` is kept, and its body is as written ([CORE-FR-186](#core-fr-186)).
3. **Given** files beside the `SKILL.md`, at any depth, **When** the skill is taken, **Then** each arrives as an asset of the primitive, at the same path ([CORE-FR-187](#core-fr-187)).
4. **Given** a skills repository and no `--skill`, **When** the command runs, **Then** every skill the source holds is installed, with nothing asked ([CORE-FR-188](#core-fr-188)).
5. **Given** `--skill` naming a skill the source does not hold, among others it does, **When** the command runs, **Then** nothing is installed and the skills the source holds are named ([CORE-FR-188](#core-fr-188)).
6. **Given** `mattpocock/skills` already holding `grill-me`, **When** the developer takes `grilling` from it, **Then** `grilling` is added and `grill-me` is left as it was; **When** they take `grill-me` again, **Then** it is replaced whole by the version asked for ([CORE-FR-189](#core-fr-189)).
7. **Given** `root` holding a source's own charter, **When** the developer takes skills into it, **Then** each skill is written beside the charter's primitives; and given `root` holding taken skills, **When** the developer installs the source's own charter, **Then** it replaces every primitive `root` held ([CORE-FR-191](#core-fr-191)).
8. **Given** a `SKILL.md` with no name or no description, or a name that is not a valid id, **When** that skill is taken, **Then** it is refused naming the file, and nothing is installed ([CORE-FR-192](#core-fr-192)).
9. **Given** a source that cannot be reached, **When** the command runs, **Then** nothing is installed and the reason is given in git's words; **Given** other uncommitted work, **Then** the skills are installed all the same ([CORE-FR-190](#core-fr-190)).
10. **Given** a source holding a charter folder, skill folders beside it and `--skill`, **When** the command runs, **Then** only the skills named are taken, and the charter is not installed ([CORE-FR-193](#core-fr-193)).
11. **Given** a source holding a charter folder and skill folders beside it, **When** the developer runs `cw vendor add` with no `--skill`, **Then** it is installed as a charter exactly as before, and none of those skill folders is taken ([CORE-FR-193](#core-fr-193)).

---

### CORE Story 33 - Pick charters from a source that gathers many (Priority: P2)

**Status**: Done

A team keeping several charters — a baseline, a spec-driven workflow, an architecture — had to publish each from a repository of its own. After this, one repository gathers them under `charters/`, one folder each, `charters/<name>/.cw/charter/`, and a developer picks the ones they want with `cw vendor add acme/charters --charter=baseline`, as they pick skills with `--skill`. Each charter picked lands in a vendor folder of its own, `acme/charters/baseline`, brought up to date and removed on its own. With no flag, the source's shape decides what is taken.

**Why this priority**: One repository per charter is a cost every team publishing more than one pays; a source of many is how skills are already published, and how a team expects to find charters.

**Independent Test**: Make a source holding `charters/baseline/.cw/charter/` and `charters/sdd/.cw/charter/`; run `cw vendor add <source> --charter=baseline` and confirm only `<owner>/<repository>/baseline` is installed, unstaged; remove it with `cw vendor remove` and confirm `sdd`, installed beside it, is untouched. Run with `--charter=nothing-here` and confirm nothing is installed and `baseline` and `sdd` are named. Run with no flag and confirm both are installed.

**Acceptance Scenarios**:

1. **Given** a source holding charters `baseline` and `sdd` under `charters/`, **When** the developer runs `cw vendor add` with `--charter=baseline`, **Then** the vendor folder `<owner>/<repository>/baseline` holds that charter, left unstaged, and `sdd` is not installed ([CORE-FR-195](#core-fr-195), [CORE-FR-196](#core-fr-196), [CORE-SC-052](#core-sc-052)).
2. **Given** `baseline` and `sdd` both installed from that source, **When** the developer brings `baseline` up to date or removes it, **Then** `sdd` is left as it was ([CORE-FR-196](#core-fr-196)).
3. **Given** a source holding only `charters/`, **When** the command runs with neither `--charter` nor `--skill`, **Then** every charter it holds is installed, with nothing asked ([CORE-FR-193](#core-fr-193)).
4. **Given** a source holding a charter folder of its own, `charters/` and `skills/`, **When** the command runs with neither flag, **Then** its one charter is installed and nothing under `charters/` or `skills/` is taken; **When** it runs with `--skill`, **Then** only those skills are taken; **When** it runs with both `--charter` and `--skill`, **Then** those charters and those skills are taken ([CORE-FR-193](#core-fr-193)).
5. **Given** `--charter` naming a charter the source does not hold, among others it does, **When** the command runs, **Then** nothing is installed and the charters it holds are named ([CORE-FR-197](#core-fr-197)).
6. **Given** a source holding no `charters/` folder, **When** the command runs with `--charter`, **Then** nothing is installed and the shapes the source holds are named ([CORE-FR-193](#core-fr-193)).
7. **Given** a folder under `charters/` named as a kind is, or holding no charter folder, **When** that charter is picked, **Then** it is refused naming the folder, and nothing is installed ([CORE-FR-197](#core-fr-197)).

---

### CORE Story 34 - Inject a charter or a skill into the repository's own charter (Priority: P2)

**Status**: Done

A vendored primitive is read-only: to differ from it, a developer authors one of their own under another id, by hand. Often what they want is to start from someone else's skill or charter and make it theirs. After this, they run `cw vendor inject mattpocock/skills --skill=grill-me`, or `cw vendor inject acme/charters --charter=baseline`: it reads the source exactly as `cw vendor add` does, with the same flags, and writes each primitive it takes straight into the repository's own charter, as if it had been authored there. No vendor folder is made, nothing records where it came from, and from then on it is the repository's to edit, test and delete like any primitive it authored.

**Why this priority**: Starting from what someone already wrote is the common case of authoring; copying a vendored folder and renaming every id by hand is where it goes wrong.

**Independent Test**: In a repository with no uncommitted work, run `cw vendor inject mattpocock/skills --skill=grill-me`; confirm `grill-me` is in the repository's own charter, unstaged, converted as `cw vendor add` converts it, with nothing added under the vendor directory; edit its body and build, and confirm the edit is built; confirm `cw vendor list` does not name the source. Run it again and confirm it is refused naming both files, and nothing is written.

**Acceptance Scenarios**:

1. **Given** a skills repository holding `grill-me`, **When** the developer runs `cw vendor inject` with that source and `--skill=grill-me`, **Then** the repository's own charter holds the skill `grill-me`, converted and with its files beside it as `cw vendor add` would take it, left unstaged, nothing is built, and nothing is written under the vendor directory ([CORE-FR-198](#core-fr-198), [CORE-FR-199](#core-fr-199), [CORE-SC-053](#core-sc-053)).
2. **Given** a source holding one charter, or charters under `charters/`, **When** the developer injects it, with or without `--charter`, **Then** every primitive of each charter taken is written into the repository's own charter, with its files beside it, as authored there ([CORE-FR-193](#core-fr-193), [CORE-FR-198](#core-fr-198)).
3. **Given** an injected primitive, **When** the developer edits or deletes it, **Then** it is changed or deleted as any primitive the repository authored, with nothing refused as vendored ([CORE-FR-200](#core-fr-200)).
4. **Given** an injected primitive, **When** the vendor commands are run, **Then** none of them lists, brings up to date or removes it, and nothing names the source it came from ([CORE-FR-200](#core-fr-200)).
5. **Given** a primitive to inject whose id the charter already holds — the repository's own, a vendor's, the engine's, or one injected before — **When** the command runs, **Then** it is refused naming both files, and nothing is written ([CORE-FR-194](#core-fr-194)).
6. **Given** a source that cannot be reached, a version that does not exist, a source holding vendors of its own, or a flag naming what the source does not hold, **When** the command runs, **Then** nothing is written, and the reason is given as `cw vendor add` gives it ([CORE-FR-198](#core-fr-198)).
7. **Given** other uncommitted work, **When** the command runs, **Then** what it takes is written all the same ([CORE-FR-199](#core-fr-199)).

---

### CORE Story 35 - Set a repository up anywhere, with or without git (Priority: P2)

**Status**: Done

A developer tries a charter in a plain folder, and an integrator keeps one where no git exists. Setup and the portal used to refuse both, though they use nothing of git. After this, neither asks: a folder can be set up, authored in, built and served, and a repository that does use git behaves as it did.

**Why this priority**: The engine is about to be published for integrators with no git, and a check that protects nothing would be the first thing each of them works around.

**Independent Test**: In a folder with no version control, run `cw init`, add a guide, build and start the portal, and confirm each works. Repeat in a git repository, and confirm the same files are written.

**Acceptance Scenarios**:

1. **Given** a folder with no version control, **When** the developer runs setup, **Then** the charter is set up and built as in a git repository ([CORE-FR-054](#core-fr-054)).
2. **Given** a folder with no version control that was set up, **When** the portal starts, **Then** it serves the charter ([CORE-FR-107](#core-fr-107)).
3. **Given** a folder that was never set up, **When** the portal starts, **Then** it stops before serving anything and says `cw init` is how to set one up ([CORE-FR-107](#core-fr-107)).
4. **Given** a folder with no version control holding an evaluation case, **When** the developer evaluates the charter, **Then** it is refused in git's words, and nothing is left behind ([CORE-FR-206](#core-fr-206)).

---

### CORE Story 37 - Install and remove a vendor source in any folder (Priority: P3)

**Status**: Done

Removing a vendor used to make a commit and to refuse while anything was in hand, and installing one refused a folder with no repository, though both could do without. After this, the three ways a source moves — installing, injecting and removing — work the same: each leaves its result in the working tree for the developer to read and commit, whatever else is in hand, in a repository or out of one. Git on the machine is what reaches a source, and nothing else.

**Why this priority**: It makes fetching the one thing git is asked for on the charter's side, and removing consistent with installing.

**Independent Test**: In a folder with no version control, install a source, then remove it, and confirm its folder is gone. In a repository with work in hand, do the same, and confirm no commit was made and the work in hand is untouched.

**Acceptance Scenarios**:

1. **Given** a folder with no version control, **When** a source is installed or injected, **Then** it lands as in a repository ([CORE-FR-205](#core-fr-205)).
2. **Given** an installed source and work in hand, **When** it is removed, **Then** its folder is gone, nothing is committed, and the work in hand is as it was ([CORE-FR-204](#core-fr-204)).
3. **Given** a name no vendor folder answers to, **When** it is removed, **Then** it is refused and nothing changes ([CORE-FR-204](#core-fr-204)).
4. **Given** a machine with no git, **When** a source is installed, **Then** nothing is installed and it says git is what reaches a source ([CORE-FR-205](#core-fr-205)).
5. **Given** a source holding a link, or a file named to climb out of its folder, **When** it is installed or injected, **Then** nothing is written outside where it lands ([CORE-FR-044](#core-fr-044), [CORE-FR-198](#core-fr-198)).
6. **Given** a repository whose own version control settings say how a source is reached, **When** that source is installed, **Then** it is reached under them ([CORE-FR-205](#core-fr-205)).

---

### CORE Story 38 - Keep a binary asset whole (Priority: P2)

**Status**: Done

A skill keeps a diagram beside its `index.md`. Today the engine reads every asset as text, so a build writes a damaged image and says nothing, and installing or injecting a source that holds one can do the same. After this, whatever a primitive's folder holds arrives where it is copied exactly as it was.

**Why this priority**: It is silent damage to a user's file, and it changes what the file ports carry, which must land before those ports are published.

**Independent Test**: Author a skill with a PNG asset, build it, and confirm the compiled copy is identical to the file, byte for byte. Vendor a source holding one, then inject it, and confirm the same of each.

**Acceptance Scenarios**:

1. **Given** a primitive with a binary asset, **When** it is built, **Then** the copy is identical to the asset, byte for byte ([CORE-FR-207](#core-fr-207)).
2. **Given** a source holding a binary file, **When** it is installed or injected, **Then** the file lands identical to the source's ([CORE-FR-207](#core-fr-207)).
3. **Given** a primitive with a binary asset, **When** the charter is read, listed, validated or previewed, **Then** the asset is treated as any asset is, and an unchanged one is no change to the preview ([CORE-FR-207](#core-fr-207)).
4. **Given** the file ports, **When** an adapter answers them, **Then** a file's bytes cross them whole ([CORE-FR-208](#core-fr-208)).
5. **Given** a primitive with a binary asset, **When** it is deleted, **Then** the asset goes with it, as any asset does ([CORE-FR-076](#core-fr-076)).

---

### CORE Story 39 - Quality cross-check of CORE Story 35, CORE Story 37, CORE Story 38, SDK Story 1 (Priority: P3)

**Status**: Done

Five stories have changed what the engine asks of version control, what its ports carry and what an address may be. Before the package is built on them, the product is checked against every story.

**Why this priority**: It stops what those stories changed from reaching a published contract unchecked.

**Independent Test**: Run /sdd-quality once they are `Done`.

**Acceptance Scenarios**:

1. **Given** [CORE Story 35](#core-story-35---set-a-repository-up-anywhere-with-or-without-git-priority-p2), [CORE Story 37](#core-story-37---install-and-remove-a-vendor-source-in-any-folder-priority-p3), [CORE Story 38](#core-story-38---keep-a-binary-asset-whole-priority-p2) and [SDK Story 1](spec-sdk.md#sdk-story-1---keep-a-repository-at-any-address-priority-p2) `Done`, **When** /sdd-quality runs, **Then** it checks the code and every spec against the checklist of `quality.md`, and each violation it reports becomes a story ([CORE-SC-026](#core-sc-026)).

---

### CORE Story 40 - Read one consistent account of the charter's behaviour (Priority: P1)

**Status**: Done

An author reads the stories, requirements and edge cases and gets the same answer about identifiers, mixins, health reports, assets and MCP lifecycle. Earlier statements no longer contradict the decisions that replaced them.

**Why this priority**: Contradictory acceptance criteria cannot guide a reliable change.

**Independent Test**: Compare the affected earlier statements with the accepted current requirements and their existing behaviour tests; every pair must agree.

**Acceptance Scenarios**:

1. **Given** the statements about mixins and ids, **When** an author reads a story or an edge case, **Then** it agrees with the current body-only mixin and unique-id rules ([CORE-FR-006](#core-fr-006), [CORE-FR-015](#core-fr-015)).
2. **Given** setup and health reporting, **When** an author reads their requirements and scenarios, **Then** they agree on the current health questions and on valid guides without globs ([CORE-FR-080](#core-fr-080), [CORE-FR-081](#core-fr-081), [CORE-FR-113](#core-fr-113), [CORE-FR-121](#core-fr-121)).
3. **Given** a primitive holding assets, **When** its scope is read, **Then** its folder, binary assets and invocation restrictions are described consistently with the accepted behaviour ([CORE-FR-168](#core-fr-168), [CORE-FR-182](#core-fr-182), [CORE-FR-207](#core-fr-207), [CORE-FR-208](#core-fr-208)).
4. **Given** MCP serving and discovery, **When** their stories and edge cases are read together, **Then** they agree on the always-present server entry, listing saved tools and reaching an origin only for a call, and use one name for the catalogue ([CORE-FR-025](#core-fr-025), [CORE-FR-146](#core-fr-146), [EVAL-FR-031](spec-eval.md#eval-fr-031)).

---

### CORE Story 41 - Trace every acceptance scenario to its requirement (Priority: P2)

**Status**: Done

A reviewer can follow each acceptance scenario to the requirement it proves, and each functional requirement to a story that proves it, without inferring that relationship from implementation details.

**Why this priority**: The missing links prevent a complete coverage review even when the code has tests.

**Independent Test**: Inspect every scenario, functional requirement and edge case in the spec set; none is left without a valid, behaviourally relevant requirement-to-story relationship.

**Acceptance Scenarios**:

1. **Given** an acceptance scenario, **When** a reviewer follows its requirement citation, **Then** it resolves to the behaviour that scenario proves ([CORE-SC-057](#core-sc-057)).
2. **Given** a functional requirement, **When** a reviewer looks for its acceptance evidence, **Then** at least one story cites and proves that behaviour rather than only mentioning its id ([CORE-SC-057](#core-sc-057)).
3. **Given** an edge case, **When** a reviewer follows its requirement, **Then** the expected behaviour is answered without introducing a contradictory requirement ([CORE-SC-057](#core-sc-057)).

---

### CORE Story 42 - Keep the engine's architecture consistent with its charter (Priority: P2)

**Status**: Done

A contributor follows the architecture guidance and finds the same responsibilities and naming rules in the engine. An integrator keeps the same authoring behaviour while changes to the public contract follow its version policy.

**Why this priority**: Inconsistent architecture guidance makes each later change follow a different rule.

**Independent Test**: Review the architecture guidance and affected engine parts together, then exercise the existing use cases through their driver ports and inspect the public contract for the changes made.

**Acceptance Scenarios**:

1. **Given** the architecture guidance and an engine component, **When** a contributor identifies its responsibility, **Then** the guides agree and the component keeps the role and naming that they prescribe ([CORE-SC-058](#core-sc-058)).
2. **Given** the architecture changes, **When** existing use cases are exercised through their ports, **Then** their user-visible behaviour remains as specified ([CORE-SC-058](#core-sc-058), [SDK-FR-003](spec-sdk.md#sdk-fr-003)).
3. **Given** a public contract name affected by the changes, **When** a release is prepared, **Then** the contract change is treated according to the accepted version policy ([SDK-FR-015](spec-sdk.md#sdk-fr-015)).

---

### CORE Story 43 - Quality cross-check of CORE Story 40, CORE Story 41, SDK Story 5, CORE Story 42, SDK Story 6 (Priority: P3)

**Status**: Done

The first five repairs are checked together before later work builds on them.

**Why this priority**: It verifies the repairs against the whole product, not only the original findings.

**Independent Test**: Run the quality pass after the five named stories are Done.

**Acceptance Scenarios**:

1. **Given** [CORE Story 40](#core-story-40---read-one-consistent-account-of-the-charters-behaviour-priority-p1), [CORE Story 41](#core-story-41---trace-every-acceptance-scenario-to-its-requirement-priority-p2), [SDK Story 5](spec-sdk.md#sdk-story-5---receive-every-use-case-failure-as-a-dto-priority-p1), [CORE Story 42](#core-story-42---keep-the-engines-architecture-consistent-with-its-charter-priority-p2) and [SDK Story 6](spec-sdk.md#sdk-story-6---know-what-to-do-after-a-failed-publication-priority-p2) are Done, **When** the quality pass runs, **Then** it checks the code and every spec against the quality checklist and each reported violation becomes a repair story ([CORE-SC-026](#core-sc-026)).

---

### CORE Story 44 - Keep a repository's state in a store of one's own (Priority: P2)

**Status**: Done

An integrator keeps a repository's state — the charter, its settings, its vendors, its test and eval cases, the sensors a build listed, the sessions, the credentials — in a store of their own, laid out as they choose. The engine reads what the store hands it and hands back what it writes. A developer at the command line or the portal sees nothing change.

**Why this priority**: If how a repository is stored were bound to the engine's own rules, every other way of storing it would have to copy them.

**Independent Test**: Keep a repository's state in a store of the test's own and exercise every use case; then exercise the command line, the portal and the published package over the files there are.

**Acceptance Scenarios**:

1. **Given** a store of an integrator's own, **When** the engine reads a repository's state from it, **Then** it is handed what the store keeps, already read as what it is, and reads nothing off where it is kept ([CORE-FR-213](#core-fr-213), [CORE-SC-059](#core-sc-059)).
2. **Given** a repository's state kept, **When** a use case reads it and writes it, **Then** the engine validates what it is handed, and hands back what it writes ([CORE-FR-213](#core-fr-213)).
3. **Given** the change, **When** the command line, the portal and the published package are exercised, **Then** each answers as before ([CORE-FR-214](#core-fr-214), [CORE-SC-059](#core-sc-059)).

---

### CORE Story 45 - Find each rule of the engine beside the value it is about (Priority: P2)

**Status**: Done

A contributor reads the engine and finds every value it works with written one way, holding its data and the rules that belong to it, so each rule sits beside the value it is about. For whoever uses the command line or the portal, nothing changes; what the published package exports changes only as its contract's versioning says.

**Why this priority**: Values written several ways read differently from file to file, and a rule about a value is found far from it.

**Independent Test**: Review the engine against the architecture guides, then exercise every existing use case and read the published package's exports.

**Acceptance Scenarios**:

1. **Given** the engine, **When** a contributor looks for a rule about one of its values, **Then** it is written with that value, and nothing is exported beside the values, as the architecture guides say ([CORE-FR-215](#core-fr-215), [CORE-SC-060](#core-sc-060)).
2. **Given** the values rewritten, **When** the command line, the portal and the published package are exercised, **Then** each answers as before, and a name the published package exports changes only as its contract's versioning says ([CORE-FR-216](#core-fr-216), [CORE-SC-060](#core-sc-060)).

---

### CORE Story 46 - Set the engine up with no address of the machine (Priority: P2)

**Status**: Done

An integrator sets the engine up without naming a repository or a home. They hand the repository's address, and the developer's home, only to the stores that keep that repository's files and its sessions. The engine speaks of every path from the repository's root; where that root is, and where the home is, only those stores know.

**Why this priority**: Nothing the engine decides needs to know where a repository is; an engine that asks for it is tied to one machine's layout.

**Independent Test**: Set the engine up with no address, on stores set up on one repository's address and a home, and exercise each use case; set it up on another repository's stores, and confirm each answers for that one. Then run every `cw` command at a `file:` address, and confirm it reads, writes and says what it did before.

**Acceptance Scenarios**:

1. **Given** the engine, **When** an integrator sets it up, **Then** nothing asks for a repository's or a home's address ([CORE-FR-217](#core-fr-217), [CORE-SC-061](#core-sc-061)).
2. **Given** the sessions' store set up on a repository's address and the developer's home, **When** the sessions are reviewed, **Then** the sessions read are that repository's, and the review names the folder they were read from as before ([CORE-FR-218](#core-fr-218), [SDK-FR-011](spec-sdk.md#sdk-fr-011)).
3. **Given** an address with no hierarchical path, or one not ending in its separator, **When** a repository's store is set up on it, **Then** a fault says what the address must be ([SDK-FR-010](spec-sdk.md#sdk-fr-010)).
4. **Given** a repository at a `file:` address, **When** any `cw` command runs, **Then** it reads, writes and says what it did before this ([SDK-FR-012](spec-sdk.md#sdk-fr-012), [CORE-SC-061](#core-sc-061)).

---

### CORE Story 47 - Keep a charter in any layout and hand it over by layer and kind (Priority: P2)

**Status**: Done

An integrator keeps a charter — its primitives, test suites, eval suites and vendors — wherever and however they choose, and hands each to the engine already read, known by its layer and its kind, never by where it sits. The engine validates what it is handed and builds, tests and evaluates it the same whichever store it came from. A developer at the command line or the portal sees no change; the published package says where each thing is kept as the address its store gives.

**Why this priority**: An engine that reads a layer, a kind, a vendor or a suite's name off where a file sits makes every way of keeping a charter lay it out as the engine expects.

**Independent Test**: Hand the engine a charter, its suites and its vendors from a store of the test's own that keeps them with no path at all, and exercise every use case; then run every `cw` command over the files there are and confirm each answers as before.

**Acceptance Scenarios**:

1. **Given** a store of an integrator's own, **When** it hands the engine a charter, **Then** each primitive, suite and vendor arrives known by its layer and kind, and the engine reads no layer, kind, vendor or suite name off a path ([CORE-FR-213](#core-fr-213), [CORE-SC-059](#core-sc-059), [CORE-SC-062](#core-sc-062)).
2. **Given** a store that keeps primitives, suites and vendors with no path, **When** a use case validates, builds and tests that charter, **Then** it answers as it does for the same charter kept as files ([CORE-FR-213](#core-fr-213), [CORE-SC-062](#core-sc-062)).
3. **Given** any step of the engine, **When** it hands on what it found, **Then** it speaks of the charter in the same terms as every other step ([CORE-FR-219](#core-fr-219)).
4. **Given** the change, **When** the command line, the portal and the published package are exercised, **Then** the command line and the portal answer as before, and the package says where each thing is kept as its store's address ([CORE-FR-214](#core-fr-214)).

---

### CORE Story 48 - Decide where a compiled charter lands for each agent (Priority: P2)

**Status**: Done

An integrator builds a charter and gets one compiled output that names no place it lands: each item known by its path inside the output, holding its text and its assets, an item for one agent alone naming that agent in its path. Each agent's projection decides where the output lands, which files the agent reads, and how links read from where each file lands — and an integrator may hand one of their own; adding an agent changes nothing else. A developer's build lands where it always did, byte for byte.

**Why this priority**: Where an agent reads a rule, a skill or an agent is that agent's layout, not the charter's; an integrator laying a charter anywhere else must not have to undo the engine's paths.

**Independent Test**: Build a charter for every agent and read the output the engine compiles; lay it onto a repository and compare the compiled output and each agent's folders with what a build wrote before, byte for byte; then lay the same output with a projection of the test's own and confirm it is handed every entry.

**Acceptance Scenarios**:

1. **Given** a charter compiled, **When** its output is read, **Then** each item is known by its path inside the output and holds its text and its assets, an item for one agent alone names that agent in its path, and no item names where the output lands ([CORE-FR-220](#core-fr-220)).
2. **Given** that output laid onto a repository, **When** the compiled output and each agent's folders are compared with what a build wrote before, **Then** they are the same, byte for byte, but for the paths in the compiled output, each written from where its file lands ([CORE-FR-221](#core-fr-221), [CORE-SC-063](#core-sc-063)).
3. **Given** a projection of an integrator's own, **When** the same charter is built, **Then** it is handed the same output and decides where each entry lands ([CORE-FR-221](#core-fr-221)).
4. **Given** a charter built, **When** its mcp origins are served, **Then** they are read from what the build put out, where it was laid ([CORE-FR-221](#core-fr-221), [CORE-FR-222](#core-fr-222)).

---

### CORE Story 49 - Get answers made for the caller (Priority: P2)

**Status**: Done

An integrator calling the engine, as the command line and the portal do, gets answers made for the caller, never the engine's own account of the charter, so the engine may change how it holds a charter without breaking them. What the engine hands the adapters an integrator may replace is part of its published contract, and changing it is a major release.

**Why this priority**: A caller handed the engine's own account of the charter is tied to something free to change.

**Independent Test**: List what the published package offers its callers and what each answers; exercise every `cw` command and the portal and confirm each answers as before; read what a caller is answered for anything the engine holds.

**Acceptance Scenarios**:

1. **Given** the published package, **When** what it offers callers is listed, **Then** it covers keeping, testing and building a charter and running what was built, as [CORE-FR-222](#core-fr-222) divides them ([CORE-FR-222](#core-fr-222), [CORE-SC-064](#core-sc-064)).
2. **Given** anything a caller is answered, **When** it is read, **Then** it is made for the caller, and none of it the engine's own account of the charter ([CORE-FR-223](#core-fr-223)).
3. **Given** the change, **When** every `cw` command and the portal are exercised, **Then** each answers as before ([CORE-FR-214](#core-fr-214), [CORE-SC-064](#core-sc-064)).
4. **Given** what callers are answered changed, and what the adapters an integrator may replace are handed made part of the contract, **When** a release is prepared, **Then** the change is treated as the version policy says ([CORE-FR-223](#core-fr-223), [SDK-FR-015](spec-sdk.md#sdk-fr-015)).

---

### CORE Story 52 - Replace any store or runner, and find the workspace in three parts (Priority: P2)

**Status**: Done

Whoever composes the engine hands it the engine's adapters, one for every way it reaches the outside — what each agent reads of a charter and that agent's own command line, the one store that keeps the charter, every other store and runner — each the engine's own or written anew; each one handed replaces the default, and the engine itself is the same for every integrator, and holds none of them: the package composes the engine's own in for every one an integrator does not hand, and lets an integrator hand only the ones [SDK-FR-020](spec-sdk.md#sdk-fr-020) names. Keeping, testing and building a charter is one part of the engine; running what was built — its sensors, its mcp calls, its evaluations and the agents' sessions — is another, which asks the first for what it needs and is never asked. A repository's settings, which agents it chose among them, are kept apart from both. A developer opens the workspace and finds three parts: the charter — its primitives, tests, eval cases and vendors under one folder; the compiled output; and the log of what `cw` records, an evaluation's working copy among it. A repository, or a vendor source, laid out the old way is refused by every command, which points to the authoring skill; following it, the agent moves the repository to the new layout, and the build is what it was.

**Why this priority**: An integrator keeping a charter elsewhere, or running it another way, must not have to ship the engine's own way of keeping and running it; and a workspace should say which part is authored, which is built and which is recorded.

**Independent Test**: List what the published package holds, the engine and the adapters beside it, and what passes between the engine's two parts; compose the engine with an adapter of the test's own and exercise the use cases; exercise every `cw` command and the portal and confirm each answers as before; set a repository up and read its workspace; run every command in a repository laid out the old way, and add a vendor source laid out the old way; have the agent follow the authoring skill there, then build and compare with the build before the move; run an evaluation and read where its working copy and its run sit.

**Acceptance Scenarios**:

1. **Given** the engine, **When** what it does is listed, **Then** keeping, testing and building the charter is one part and running what was built another, each holding what [CORE-FR-222](#core-fr-222) gives it ([CORE-FR-222](#core-fr-222), [CORE-SC-064](#core-sc-064)).
2. **Given** running, **When** it needs anything of the charter, **Then** it asks authoring, in answers made for that, and authoring asks nothing of running ([CORE-FR-229](#core-fr-229), [CORE-SC-066](#core-sc-066)).
3. **Given** the published package, **When** what it exports is listed, **Then** the engine's two parts hold no store and no runner, and the stores and runners `cw` is composed of sit apart from them, composed in for every one an integrator does not replace, and each of them is exported for an integrator to extend ([CORE-FR-228](#core-fr-228), [SDK-FR-020](spec-sdk.md#sdk-fr-020)).
4. **Given** an engine composed with an adapter of an integrator's own for an agent, **When** a use case builds and evaluates a charter for that agent, **Then** it answers as it does with the adapter shipped ([CORE-FR-213](#core-fr-213), [CORE-FR-230](#core-fr-230)).
5. **Given** the eval cases, **When** a developer lists them, adds one, rewrites one or removes one, **Then** they are kept by the one store that keeps the charter, as the test cases are ([CORE-FR-228](#core-fr-228)).
6. **Given** the engine composed of its two parts and the adapters it is handed, **When** every `cw` command and the portal are exercised, **Then** each answers as before, but for where the workspace keeps things and the paths in the compiled output, each written from where its file lands ([CORE-FR-214](#core-fr-214), [CORE-FR-221](#core-fr-221), [CORE-SC-066](#core-sc-066)).
7. **Given** a repository with no charter, **When** the developer sets it up, **Then** its workspace holds the charter, with its primitives, tests, eval cases and vendors under it, the compiled output and the log, and its settings are kept apart, in `.cw/settings.json` ([CORE-FR-224](#core-fr-224)).
8. **Given** a repository laid out the old way, **When** any command runs, the health check included, **Then** it refuses, saying the layout is the old one and naming the authoring skill ([CORE-FR-226](#core-fr-226), [CORE-SC-065](#core-sc-065)).
9. **Given** a vendor source laid out the old way, **When** it is added or updated, **Then** it is refused, naming the source and the authoring skill, and nothing is installed ([CORE-FR-226](#core-fr-226)).
10. **Given** a repository laid out the old way, **When** the agent follows the authoring skill, **Then** every file is moved to the new layout with its contents kept, and the build is the same, byte for byte, as before the move ([CORE-FR-227](#core-fr-227), [CORE-SC-065](#core-sc-065)).
11. **Given** an evaluation run, **When** a case runs, **Then** its working copy and what the run leaves are under the log, which version control ignores ([CORE-FR-225](#core-fr-225), [EVAL-FR-021](spec-eval.md#eval-fr-021)).
12. **Given** a repository's settings, **When** a command runs, **Then** they are read from `.cw/settings.json` on their own, which agents the repository chose is handed on to the rest of the engine, and neither authoring nor running reads or writes them ([CORE-FR-231](#core-fr-231)).
13. **Given** the engine composed with a projection for each agent, **When** a charter is built, **Then** the engine names no agent and no place outside the compiled output, each projection lays its own files and links, and every agent's folders are the same, byte for byte, as a build wrote before ([CORE-FR-221](#core-fr-221), [CORE-SC-063](#core-sc-063)).

---

### CORE Story 53 - Keep the whole engine to its naming and fault guides (Priority: P2)

**Status**: Done

An integrator reads the driver ports the library exports and finds each operation named for what it does and what it does it to — listing the charter, building the charter, listing the kinds — never by a bare verb or a noun alone, settled before the first release under the contract so no integrator is broken by them. A contributor reads any file of the engine and finds it written as the architecture and naming guides say: each fault raised by its own name, never a bare error; a value's rules beside it; a name saying what it holds; a file named for its subject and role; and the guides naming only what the code holds.

**Why this priority**: After 1.0.0 every renamed operation is a major release; before it, renaming costs no integrator anything. The last review checked only the components it changed; a contributor copying any other file copies its breaches.

**Independent Test**: List every operation of every driver port the package exports and check each is named verb first for what it acts on; review the whole engine, the portal page included, against every guide that applies to it; then exercise every `cw` command, the portal, the package and every use case and confirm each answers as before.

**Acceptance Scenarios**:

1. **Given** the driver ports the package exports, **When** each operation's name is read, **Then** it begins with a verb and names what it acts on, and none is a bare verb or a noun alone ([CORE-FR-232](#core-fr-232)).
2. **Given** the whole engine and the guides that apply to it, **When** the architecture review runs, **Then** it finds no breach of the naming and fault guides, and the guides name nothing the code does not hold ([CORE-SC-067](#core-sc-067)).
3. **Given** every spec, **When** its terms are read, **Then** each names one thing — the agent a charter is built for, the set of adapters an integrator hands, the workspace's log and the developer's sessions, the charter and its primitives each told apart — and each thing has one term ([CORE-SC-069](#core-sc-069)).
4. **Given** the operations renamed and the engine brought to its guides, **When** every `cw` command, the portal, the package and every use case through its driver port are exercised, **Then** each answers as before, but an evaluation, as the next scenario says ([CORE-FR-232](#core-fr-232), [CORE-SC-058](#core-sc-058)).
5. **Given** a charter or its eval cases changed and not committed, **When** the charter is evaluated, **Then** each case's worktree of the last commit is built from the charter and cases as the store holds them now, and the repository's working tree is left as it was ([EVAL-FR-021](spec-eval.md#eval-fr-021)).
6. **Given** the library's contract recorded module by module, **When** a release compares the build with it, **Then** a declaration is matched by its name wherever it sits, one narrowed without a new major is refused naming it and the contract is left as it was, and a release records the contract anew ([SDK-FR-015](spec-sdk.md#sdk-fr-015)).
7. **Given** a charter built, **When** its compiled output is read, **Then** it is a list of items, each known by its path inside the output, in the order a build lays them, and an agent's projection finds the item it needs by what it is ([CORE-FR-220](#core-fr-220)).

---

### CORE Story 55 - Quality cross-check of SDK Story 8, CORE Story 53, SDK Story 10, CORE Story 56, EVAL Story 9 (Priority: P3)

**Status**: Done

The repairs of the engine's contract, code and evidence are checked together before later work builds on them, and what the check finds is repaired here, before the pass is run again.

**Why this priority**: It verifies the repairs against the whole product, not only the findings they answer.

**Independent Test**: Run the quality pass after the five named stories are Done.

**Acceptance Scenarios**:

1. **Given** [SDK Story 8](spec-sdk.md#sdk-story-8---compose-the-engine-anywhere-from-cws-own-adapters-and-ones-own-priority-p1), [CORE Story 53](#core-story-53---keep-the-whole-engine-to-its-naming-and-fault-guides-priority-p2), [SDK Story 10](spec-sdk.md#sdk-story-10---trust-the-evidence-of-every-rewritten-done-story-priority-p2), [CORE Story 56](#core-story-56---prove-by-running-what-no-test-runs-yet-priority-p3) and [EVAL Story 9](spec-eval.md#eval-story-9---measure-the-tokenizer-accuracy-again-after-the-workspace-moved-priority-p3) are Done, **When** the quality pass runs, **Then** it checks the code and every spec against the quality checklist, each reported violation is repaired within this story, not as a story of its own, and the pass is run again ([CORE-SC-026](#core-sc-026)).
2. **Given** an entry file holding the charter's section twice, **When** the charter is built, **Then** the file holds it once ([CORE-FR-035](#core-fr-035), [CORE-SC-070](#core-sc-070)).
3. **Given** a vendor installed beside the builtin layer, **When** vendors are listed and one is removed, **Then** the builtin layer is neither listed as a vendor nor touched ([CORE-FR-023](#core-fr-023), [CORE-SC-070](#core-sc-070)).
4. **Given** `cw` installed, and pinned as a repository's development dependency, **When** it is upgraded, and run in that repository, **Then** the newer one answers, and in the repository the pinned one answers ([CORE-FR-210](#core-fr-210), [CORE-SC-021](#core-sc-021)).
5. **Given** an mcp origin's address changed, **When** the charter is built, **Then** every primitive pointing at it follows, with no other primitive changed ([CORE-FR-143](#core-fr-143), [CORE-SC-038](#core-sc-038)).
6. **Given** a template's body changed, **When** the charter is built, **Then** the catalogue and every primitive referring to it are unchanged ([CORE-FR-164](#core-fr-164), [CORE-FR-161](#core-fr-161)).
7. **Given** a vendor laid out the old way, removed, **When** it is installed again, **Then** it is laid out the new way ([CORE-FR-050](#core-fr-050)).
8. **Given** every other scenario of a `Done` story a test holds in part, **When** its test runs, **Then** it asserts every outcome the scenario's Then names, an exit status included ([CORE-SC-070](#core-sc-070)).
9. **Given** a repository that has chosen no agent, **When** setup asks which agent at a terminal, **Then** every agent is offered and none is ticked ([CORE-FR-055](#core-fr-055)).
10. **Given** a repository at a `file:` address, **When** every `cw` command runs, an evaluation over an agent of a test's own included, **Then** each reads, writes and says what it did before ([CORE-SC-061](#core-sc-061), [SDK-FR-012](spec-sdk.md#sdk-fr-012)).
11. **Given** every test labelled with a scenario, **When** the label is read against what the test asserts, **Then** each holds the scenario it names, and every scenario the previous pass found held in part or unlabelled is named by the test holding it ([CORE-SC-057](#core-sc-057), [CORE-SC-070](#core-sc-070)).
12. **Given** a charter, **When** `cw list` runs, **Then** it answers as [CORE Story 3](#core-story-3---trust-the-charter-and-prove-it-in-ci-priority-p3) scenario 10 says, and a test holding that scenario fails when a file or its globs move onto the primitive's first line ([CORE-FR-028](#core-fr-028), [CORE-SC-070](#core-sc-070)).
13. **Given** a guide whose body names an mcp origin, **When** the charter is built, **Then** it answers as [CORE Story 17](#core-story-17---declare-where-knowledge-lives-once-and-point-any-primitive-at-it-priority-p1) scenario 2 says ([CORE-FR-147](#core-fr-147), [CORE-FR-145](#core-fr-145), [CORE-SC-070](#core-sc-070)).
14. **Given** a kind selected in the portal, **When** a new primitive is asked for, **Then** the form answers as [CORE Story 6](#core-story-6---author-edit-and-delete-a-primitive-without-looking-anything-up-priority-p2) scenario 1 says ([CORE-FR-117](#core-fr-117), [CORE-SC-070](#core-sc-070)).
15. **Given** a field that takes one kind naming an id of another, **When** the charter is read, **Then** it answers as [CORE Story 27](#core-story-27---name-every-primitive-by-its-id-alone-priority-p1) scenario 2 says ([CORE-FR-172](#core-fr-172), [CORE-SC-070](#core-sc-070)).
16. **Given** a charter built, **When** its output is read, **Then** it answers as [CORE Story 48](#core-story-48---decide-where-a-compiled-charter-lands-for-each-agent-priority-p2) scenario 1 and [CORE Story 53](#core-story-53---keep-the-whole-engine-to-its-naming-and-fault-guides-priority-p2) scenario 7 say, an agent's projection finding the item it needs ([CORE-FR-220](#core-fr-220), [CORE-SC-070](#core-sc-070)).
17. **Given** the whole engine, the portal page included, **When** the architecture review runs, **Then** it finds no name, function or model breaking the naming guides ([CORE-SC-067](#core-sc-067)).
18. **Given** a name that breaks a naming guide — one vague word, a yes-or-no with no `is` or `has`, a count named as a list, a bare verb as a function, a function of a model outside its class — **When** the checks run, **Then** they refuse it, naming the file, the line and the guide ([CORE-SC-067](#core-sc-067)).
19. **Given** the names changed, **When** every `cw` command, the portal and the package are exercised, **Then** each answers as before ([CORE-FR-216](#core-fr-216), [CORE-SC-058](#core-sc-058)).
20. **Given** every spec, **When** its terms are read, **Then** the engine, the workspace, the compiled output and the local output each carry one term, defined once, and each term names one thing ([CORE-SC-069](#core-sc-069)).
21. **Given** a term the specs have retired, **When** the checks run over the specs, **Then** they refuse it where it is used ([CORE-SC-069](#core-sc-069)).
22. **Given** every `Done` story whose scenarios or cited FR were reworded after its evidence, **When** its scenarios are run again, **Then** each passes and its evidence is dated from that run ([SDK-SC-007](spec-sdk.md#sdk-sc-007)).
23. **Given** the package installed, **When** what it exports is listed, **Then** it is the ports, the models they name, `cw`'s own adapters, what composes the engine, and the layout of `cw`'s store and of the output each as one value — and no constant or helper beside them ([SDK-FR-002](spec-sdk.md#sdk-fr-002), [SDK-FR-020](spec-sdk.md#sdk-fr-020), [CORE-SC-060](#core-sc-060)).
24. **Given** a store of a test's own keeping the charter outside `cw`'s layout, **When** the charter is built for each agent, **Then** what each agent is told to edit names where that store keeps it ([SDK-FR-020](spec-sdk.md#sdk-fr-020), [CORE-FR-213](#core-fr-213)).
25. **Given** the names exported changed, **When** a release compares the build with the contract, **Then** it is versioned as [SDK-FR-015](spec-sdk.md#sdk-fr-015) says, and with nothing yet published under the contract, the contract is recorded anew with no release to name the change in ([CORE-FR-216](#core-fr-216), [SDK-FR-015](spec-sdk.md#sdk-fr-015)).
26. **Given** in-memory file adapters handed and no sessions store, **When** the sessions kept where those adapters read are summed, **Then** they are read through the adapters handed, and the disk is never reached ([SDK-FR-020](spec-sdk.md#sdk-fr-020), [SDK-SC-005](spec-sdk.md#sdk-sc-005)).
27. **Given** the engine composed at an address of a scheme no adapter of `cw`'s reads, with no file adapter handed, **When** a use case reads the charter, **Then** it answers a fault the caller can correct, naming the adapter to hand, and records no internal failure ([SDK-FR-017](spec-sdk.md#sdk-fr-017), [SDK-FR-018](spec-sdk.md#sdk-fr-018)).
28. **Given** each adapter the engine is composed with handed as one of a test's own, **When** every use case that uses it runs, **Then** each answers through it ([SDK-SC-005](spec-sdk.md#sdk-sc-005)).
29. **Given** a case expecting the agent to read a file, **When** it runs, **Then** it passes where the agent's tools read that file and fails, naming it, where they did not ([EVAL-FR-039](spec-eval.md#eval-fr-039), [EVAL-FR-020](spec-eval.md#eval-fr-020)).
30. **Given** a case expecting a read of a path the requirement refuses — empty, absolute, outside the repository, with an empty or `.` segment, a backslash, a drive letter, a control character or braces — **When** the run starts, **Then** it is refused before any case runs, naming the path ([EVAL-FR-039](spec-eval.md#eval-fr-039)).
31. **Given** cases run, **When** the run ends, **Then** each case's result is kept under the log as it ran, and the run says where ([EVAL-FR-040](spec-eval.md#eval-fr-040)).
32. **Given** kept results and no agent installed, **When** the developer reads them by a path a run said, or the latest twenty, in words or as JSON, **Then** each answers what was kept, and no agent runs ([EVAL-FR-041](spec-eval.md#eval-fr-041)).
33. **Given** a sessions folder named inside this repository, **When** a session is kept, **Then** the folder is refused, the session kept in the default, and the refusal said; and the sessions are read from the default ([EVAL-FR-042](spec-eval.md#eval-fr-042), [EVAL-FR-009](spec-eval.md#eval-fr-009)).
34. **Given** the agent's own command line installed, **When** the developer runs `cw context --agent=<agent>`, **Then** each primitive is listed with its estimate and its exact count and how far apart they are, the totals too, and a warning is said when the totals differ by more than 15%, and none when they do not ([EVAL-FR-004](spec-eval.md#eval-fr-004), [EVAL-SC-002](spec-eval.md#eval-sc-002)).
35. **Given** no agent named, **When** the developer runs `cw context`, **Then** it estimates alone, and no agent's command line is run ([EVAL-FR-004](spec-eval.md#eval-fr-004)).
36. **Given** an agent named that cannot be counted through — no exact count for it yet, one the repository did not choose, or its command line not installed — **When** the developer runs `cw context --agent=<agent>`, **Then** it is refused, saying `cw context` with no agent named needs nothing, and nothing is counted ([EVAL-FR-004](spec-eval.md#eval-fr-004)).

---

### CORE Story 56 - Prove by running what no test runs yet (Priority: P3)

**Status**: Done

A maintainer finds every requirement of the charter's engine proved by a scenario that runs: the eight requirements no story carried are each carried by one, and the scenarios of the engine's restructuring — the two parts kept apart, the answers made for the caller, every command at a `file:` address, and no agent named by the engine — are proved by running them, not by reading the source for words.

**Why this priority**: A requirement no scenario proves can be broken with every test passing, and a test that reads the source for words passes when the behaviour breaks and fails when a name changes.

**Independent Test**: Run each scenario below, confirm each test fails when the behaviour it proves is broken, and count the CORE FR no story cites.

**Acceptance Scenarios**:

1. **Given** a repository primitive and the builtin layer, **When** the charter document is built, **Then** where it explains ids it names the builtin layer ([CORE-FR-022](#core-fr-022)).
2. **Given** `cw init` run with nobody to ask, **When** each prompt is reached, **Then** it takes its default or its flag, and where no agent is chosen, it stops naming the flag that answers it ([CORE-FR-056](#core-fr-056)).
3. **Given** an unknown command or flag, **When** `cw` is run with it, **Then** it is refused, and a near miss is answered with the command it most likely meant ([CORE-FR-095](#core-fr-095)).
4. **Given** the authoring skill, **When** it is read, **Then** its triggers bring it up for writing a rule, a standard, a skill or any other primitive, and its body says a refusal from `cw add` or `cw build` is answered and sends a refused build to `cw doctor` ([CORE-FR-100](#core-fr-100), [CORE-FR-102](#core-fr-102)).
5. **Given** the portal started in a repository, **When** it is used offline, **Then** it serves that repository alone, offers no way to point it at another, and everything but adding or updating a vendor source works ([CORE-FR-105](#core-fr-105), [CORE-FR-111](#core-fr-111)).
6. **Given** the README, **When** it is read, **Then** it gives the install from the registry as the way to get `cw`, and building from source as the contributor's way ([CORE-FR-138](#core-fr-138), [CORE-SC-057](#core-sc-057)).
7. **Given** a repository at a `file:` address, **When** every `cw` command runs, **Then** each reads, writes and says what it did before, as a run of each command shows ([SDK-FR-012](spec-sdk.md#sdk-fr-012), [CORE-SC-061](#core-sc-061), [CORE-SC-068](#core-sc-068)).
8. **Given** anything a caller is answered, **When** a use case is called through each driver port, **Then** the answer is made for the caller, and none of it is the engine's own account of the charter ([CORE-FR-223](#core-fr-223), [CORE-SC-068](#core-sc-068)).
9. **Given** the engine's two parts, **When** running needs anything of the charter, **Then** it asks authoring, as a call through running's port shows, and authoring asks nothing of running ([CORE-FR-222](#core-fr-222), [CORE-FR-229](#core-fr-229), [CORE-SC-068](#core-sc-068)).
10. **Given** an engine composed with a projection of a test's own for an agent `cw` does not know, **When** the charter is built and its sensors run for that agent, **Then** both answer for it, and the engine named no agent of its own ([CORE-FR-221](#core-fr-221), [CORE-FR-233](#core-fr-233), [CORE-SC-068](#core-sc-068)).

---

### Edge Cases

**The charter and its engine**

- A workspace holding any folder of the old layout, beside the new one or not, is laid out the old way, and refused ([CORE-FR-226](#core-fr-226)).
- A skill with `disable-user-invocation: true` that no playbook names — still built and still opened by the agent when its description matches; it is only not a command ([CORE-FR-174](#core-fr-174)).
- A primitive declares a kind that is not in the closed set — validation fails and names the file and the offending kind ([CORE-FR-001](#core-fr-001), [CORE-FR-003](#core-fr-003)).
- Two primitives share an id, wherever they were authored — validation fails as a collision and names both files ([CORE-FR-015](#core-fr-015)).
- A mixin tries to pull in another mixin — validation fails, because mixins are leaves ([CORE-FR-004](#core-fr-004), [CORE-FR-006](#core-fr-006)).
- A mixin and the primitive that pulls it in both name a field — no field is merged: a mixin lends its body, not fields. Where both name the files they apply to, one side's globs must cover the other's, or the pair is reported ([CORE-FR-006](#core-fr-006)).
- A primitive cites reasoning that does not exist — validation reports a dangling reference ([CORE-FR-211](#core-fr-211)).
- The vendor source is unreachable, or the pinned version does not exist — the command fails without touching what is already installed ([CORE-FR-049](#core-fr-049)).
- The vendor source holds no charter folder, no `charters/` folder and no skill under `skills/` at the version asked for — it is refused as no charter, saying to run `cw init` there, and nothing is installed ([CORE-FR-042](#core-fr-042), [CORE-FR-193](#core-fr-193)).
- A charter under a source's `charters/` holds vendors of its own — it is refused as a single-charter source holding them is ([CORE-FR-170](#core-fr-170)).
- A skill being injected names another skill in its body that is not injected with it — it is written as it was published; the name stays prose ([CORE-FR-198](#core-fr-198)).
- The vendor source installed vendors of its own — it is refused, saying to install those here directly, and nothing is installed ([CORE-FR-170](#core-fr-170)).
- A compiled file was hand-edited — the next build overwrites it, and the preview build reports it as an update ([CORE-FR-032](#core-fr-032), [CORE-FR-034](#core-fr-034)).
- A compiled file exists whose source primitive was deleted — the build deletes it ([CORE-FR-032](#core-fr-032)).
- The agent's entry file already carries the section — the build writes that section again and leaves the rest of the file, whoever wrote it, untouched ([CORE-FR-035](#core-fr-035)).
- The agent's entry file exists with no section, or does not exist at all — the build puts the section after what the file holds, or writes the file holding only the section ([CORE-FR-035](#core-fr-035)).
- Setup runs outside a git repository — it sets the folder up as in one; nothing records what changes there unless the developer brings version control ([CORE-FR-054](#core-fr-054)).
- Setup runs with nobody to ask in a repository that has chosen no agent yet — it stops and names the flag that answers it, since the agent has no default there, however many agents the engine compiles for ([CORE-FR-056](#core-fr-056), [CORE-FR-055](#core-fr-055)).
- The engine stops shipping a primitive it once shipped — the next build deletes the surface it compiled to, the way a build deletes the compiled output of any primitive that is gone ([CORE-FR-024](#core-fr-024)).
- A catalogue built before compiled documents existed — the next build names the compiled documents in it, and `cw build --preview` lists every one as added ([CORE-FR-140](#core-fr-140), [CORE-FR-034](#core-fr-034)).
- A repository set up before the engine brought any primitive of its own — its charter holds what the engine brings from the first read, with nothing to migrate ([CORE-FR-018](#core-fr-018)).

**The portal**

- The portal is started in a folder that was never set up — it stops before serving anything and says that `cw init` is how a repository is set up ([CORE-FR-107](#core-fr-107)).
- The address the portal would listen on is taken — it listens on another one and says which ([CORE-FR-104](#core-fr-104)).
- Two portals are started on one repository — each works; a save made through one is caught by the other's check for changes on disk ([CORE Story 6](#core-story-6---author-edit-and-delete-a-primitive-without-looking-anything-up-priority-p2), scenario 9) ([CORE-FR-078](#core-fr-078), [CORE-FR-110](#core-fr-110)).
- The charter holds an error when the portal opens — the portal shows the faults under their files; the developer fixes them in their editor, and the listing returns on the next view once the charter holds ([CORE-FR-115](#core-fr-115), [CORE-FR-110](#core-fr-110)).
- A file is changed on disk by an editor, an agent or a branch checkout while the portal is open — the next view the developer opens shows the charter as it now is; the portal keeps no copy of the charter between views ([CORE-FR-110](#core-fr-110)).
- The developer switches branch while the portal is open — the portal shows the newly checked-out charter on the next view, like any other change on disk ([CORE-FR-110](#core-fr-110)).
- A primitive's body is empty — it is saved as empty; whether that is acceptable is the kind's business, reported by validation ([CORE-FR-075](#core-fr-075), [CORE-FR-010](#core-fr-010)).
- A deleted primitive is still named by a mixin list, a rationale or a test case — validation reports the dangling reference; the portal does not rewrite the primitives or tests that name it ([CORE-FR-007](#core-fr-007), [CORE-FR-087](#core-fr-087)).
- No network is available — everything but adding or updating a vendor source works, the body editor included ([CORE-FR-111](#core-fr-111)).
- The repository has no test files — the test view says what a test is for and offers to create one; the health check warns about every guide and sensor that no case pins down ([CORE-FR-089](#core-fr-089), [CORE-FR-014](#core-fr-014)).

**Distribution**

- `cw` installed globally and another version installed as a repository's development dependency — the repository's scripts run the repository's version; `cw --version` says which one is running wherever it is asked ([CORE-FR-131](#core-fr-131)).
- Another program called `cw` already on the path — the developer is told, by the package name in the README, which package this is; `cw --version` on this one names Cherry Works ([CORE-FR-131](#core-fr-131)).
- A package published without the portal's page — cannot happen: the release installs what it would publish and runs it first ([CORE-FR-135](#core-fr-135)).
- A user upgrades `cw` in a repository whose compiled output an older `cw` wrote — the health check says the output is behind wherever the new version would write something different, as it does after any charter change ([CORE-FR-080](#core-fr-080)).

**Knowledge reached through MCP**

- Two `mcp` primitives at one address with different paths — two mcp origins, both signed in to by one sign-in to the address ([CORE-FR-145](#core-fr-145), [CORE-FR-148](#core-fr-148)).
- An mcp origin the build cannot reach, or an mcp origin that is not signed in to, or a command that is not installed, each stops the build, naming the mcp's file, and writes nothing ([EVAL-FR-031](spec-eval.md#eval-fr-031)).
- The same command declared with different arguments — two addresses, each signed in to on its own ([CORE-FR-142](#core-fr-142), [CORE-FR-148](#core-fr-148)).
- One id claimed by two `mcp` primitives at two addresses — the usual collision, naming both files ([CORE-FR-015](#core-fr-015)).
- A vendor opens a tool on an mcp origin the repository also declares — the tool is shown: tools are the union of what every id at an mcp origin declares ([CORE-FR-145](#core-fr-145)). Each id's own file says which tools it declared.
- An id longer than 40 characters — refused under its file, so a tool's name, once prefixed with its `mcp`'s id and by the agent, stays within what the agent accepts ([CORE-FR-157](#core-fr-157)).
- A credential expires while the server runs — it is renewed where the mcp origin allows; where it cannot be, the call answers to sign in again ([CORE-FR-151](#core-fr-151)).
- The developer runs `cw mcp auth` by asking their agent to — the agent has no terminal to be asked at, so nothing is asked and no token passes through the conversation ([CORE-FR-150](#core-fr-150)).
- The repository's MCP configuration already has entries of its own — they are kept; the build writes only the `cw` entry ([CORE-FR-146](#core-fr-146)).
- A charter that declares no `mcp` primitive — the build still writes the one `cw` entry, and leaves every other entry of the repository's MCP configuration as it was ([CORE-FR-146](#core-fr-146)).
- An id holding `/` — its folder sits in a folder named after the part before it, and every name an agent is given for it writes `/` as `-` ([CORE-FR-141](#core-fr-141)).

**Scripts and templates**

- A body holds `[[…]]` around something that is no id, such as `[[<id>]]` written as a placeholder — it is left as written and is not a reference; only a name shaped as an id ([CORE-FR-141](#core-fr-141)) is.
- A header value written `[[<id>]]` unquoted, such as `run: [[check]]` — YAML reads it as a list inside a list, and the header is refused as the wrong shape; quoted, `run: "[[check]] --strict"`, it is a reference ([CORE-FR-161](#core-fr-161), [CORE-FR-010](#core-fr-010)).
- A guide and the corpus explaining it share an id, as an earlier version allowed — the usual collision ([CORE-FR-015](#core-fr-015)); the corpus takes an id of its own, such as `why-<id>`.
- A script whose body is empty — its compiled document holds its headers alone, and the script runs as any other ([CORE-FR-139](#core-fr-139), [CORE-FR-165](#core-fr-165)).
- A script whose file has no first line naming how it runs — it is copied as written; the agent runs it the way the script's body says to, for instance `bash .cw/out/script/<id>/run.sh` ([CORE-FR-168](#core-fr-168), [CORE-FR-207](#core-fr-207)).
- A script and a template sharing one id, such as `release` — a collision like any other, naming both files: an id names one primitive whatever its kind ([CORE-FR-015](#core-fr-015)).
- A copied asset or a built template hand-edited — the next build writes it again, and the preview lists it as one the build would write, as for any compiled document ([CORE-FR-032](#core-fr-032), [CORE-FR-034](#core-fr-034)).
- A script's assets edited and not built — what runs is the last build's copy; nothing of the edit is run until a build ([CORE-FR-166](#core-fr-166)).
- A primitive's folder holding a markdown file, or a folder with an `index.md` of its own — it is one of its assets, copied like the rest, and never read as a primitive ([CORE-FR-168](#core-fr-168)).
- A primitive kept as `<kind>/<id>.md` by an earlier version — an error under that file saying to move it to `<kind>/<id>/index.md` ([CORE-FR-141](#core-fr-141)).
- A script names itself — it is a mention like any other; nothing loops, since a build never runs anything ([CORE-FR-161](#core-fr-161), [CORE-FR-163](#core-fr-163)).
- A name inside a fenced block or a longer code span — left as written: it is an example there, and a link inside it would be read as text ([CORE-FR-147](#core-fr-147)).
- A skill whose document in the agent's folder is only a pointer to its compiled document — the links are in the compiled document the pointer names ([CORE-FR-147](#core-fr-147), [CORE-FR-139](#core-fr-139)).

**Agent authoring**

- A `--header` value that itself contains `=` — everything after the first `=` is the value ([CORE-FR-068](#core-fr-068)).
- `--header` given with no `=` at all — nothing is written, and the flag is named ([CORE-FR-068](#core-fr-068)).
- The same single-valued header given twice — nothing is written, and the header is named; only a header that takes a list may be repeated ([CORE-FR-067](#core-fr-067)).
- No header flag given and no terminal to ask at — nothing is written, and the command says the headers it would have asked for, rather than waiting for an answer nobody will type ([CORE-FR-065](#core-fr-065)).
- A header value that is empty — it is refused where the kind refuses an empty value, in the kind's own words ([CORE-FR-073](#core-fr-073), [CORE-FR-062](#core-fr-062)).
- The agent asks for a kind it invented — answered with every kind there is, as an unknown kind is everywhere else ([CORE-FR-061](#core-fr-061)).
- The charter holds an error — `cw kinds` still answers, because what a kind requires is not read off the charter; `cw add` refuses as it always does ([CORE-FR-062](#core-fr-062), [CORE-FR-063](#core-fr-063)).
- One sensor of a signal runs long or never ends — the others still run to their end and answer; the agent's one time limit for that signal's command ends it, as it ended that sensor's own hook before ([CORE-FR-176](#core-fr-176)).
- Two sensors of a signal both exit 2 — the command exits 2 with the error output of both, in order of id ([CORE-FR-177](#core-fr-177)).
- An agent's settings hold the hooks an earlier build wrote one per sensor — the next build writes each signal's hooks over whole, so only `cw sensor run <signal> --agent <agent>` is left under it; one for a signal no sensor names any more stays ([CORE-FR-175](#core-fr-175), [CORE-FR-039](#core-fr-039)).
- One sensor answers in the agent's structured form and another in plain text — the two are combined the way the agent combines such answers from two hooks ([CORE-FR-178](#core-fr-178)).

- A skill taken whose id is already held by another layer or another source — it is installed, and the charter is refused as for any collision, naming both files, until one goes ([CORE-FR-015](#core-fr-015)).
- A skill whose body names another skill in prose, as `grill-me` names `grilling` — only the skills named with `--skill` are taken; the developer takes the other with a second `--skill` ([CORE-FR-184](#core-fr-184), [CORE-FR-188](#core-fr-188)).
- A `SKILL.md` header the charter has no field for (`license`, `allowed-tools`, `model`) — it is left out of the primitive, and the command names what it left out ([CORE-FR-186](#core-fr-186)).
- A `SKILL.md` declaring `user-invocable: false` — the primitive declares `disable-user-invocation: true` ([CORE-FR-186](#core-fr-186)).
- Two folders of one skills repository declaring the same `name` — the skill is refused naming both files, and nothing is installed ([CORE-FR-192](#core-fr-192)).
- A skills repository keeping copies of its skills for its own agents, under `.claude/skills/` or `.agents/skills/` — only those under `skills/` are skills to take, so the copies neither clash with them nor are installed ([CORE-FR-185](#core-fr-185)).

## Requirements *(mandatory)*

### Functional Requirements

**The charter format**

- <a id="core-fr-001"></a>**CORE-FR-001**: The system MUST recognise exactly these primitive kinds — guide, sensor, skill, playbook, agent, posture, corpus, mixin, mcp, script and template — and MUST treat any other kind as a validation error. The set is closed.
- <a id="core-fr-002"></a>**CORE-FR-002**: In the store `cw` keeps the charter in, every primitive MUST be a folder in the directory of its kind within the charter's primitives folder, holding its `index.md`, and its `index.md` MUST carry at minimum a kind, an id and a description ([CORE-FR-141](#core-fr-141)). The system MUST look for primitives in those directories and nowhere else, so that no generated file is ever read as a primitive ([CORE-FR-213](#core-fr-213)).
- <a id="core-fr-003"></a>**CORE-FR-003**: Every primitive MUST declare its own kind, and the system MUST read it as that kind. A file that declares no kind, or one outside the set, MUST be reported, and, in the store `cw` keeps the charter in, so MUST an `index.md` whose folder is not `<kind>/<id>` of the kind and id it declares ([CORE-FR-141](#core-fr-141), [CORE-FR-213](#core-fr-213)).
- <a id="core-fr-004"></a>**CORE-FR-004**: The system MUST enforce, per kind, the additional fields that kind requires: a triggering signal and the command it runs, for a sensor; activation triggers for a skill and for a playbook; a tool list for an agent; permission lists for a posture; an address, the ways to sign in, and a tool list for an mcp ([CORE-FR-142](#core-fr-142)); and the file it runs, for a script ([CORE-FR-165](#core-fr-165)). A mixin MUST NOT pull in mixins of its own.
- <a id="core-fr-005"></a>**CORE-FR-005**: The system MUST let any primitive cite the reasoning behind it, and MUST treat that reasoning as loaded only on demand rather than always present.
- <a id="core-fr-006"></a>**CORE-FR-006**: The system MUST let a primitive pull in one or more mixins, each lending its body to the primitive that pulls it in at compile time. No field is merged: a mixin lends text, not fields. Where both the primitive that pulls it in and the mixin name the files they apply to, one side's globs MUST cover the other's, in either direction, and a pair that covers neither way MUST be reported. A mixin MUST NOT itself pull in another mixin.
- <a id="core-fr-007"></a>**CORE-FR-007**: A primitive that names a mixin no layer holds MUST be reported.
- <a id="core-fr-008"></a>**CORE-FR-008**: The system MUST support an orthogonal tagging taxonomy across all kinds, independent of kind and directory.

**Reading and validating the charter**

- <a id="core-fr-009"></a>**CORE-FR-009**: The system MUST read the charter through a single shared entry point used by every command that needs it, and a command MUST read each primitive's file at most once, whatever it goes on to do with the charter.
- <a id="core-fr-010"></a>**CORE-FR-010**: The system MUST validate the charter against the closed kind set, per-kind required fields, id shape, tag shape, and id collisions, and MUST report each failure with its file and the specific problem.
- <a id="core-fr-011"></a>**CORE-FR-011**: Validation MUST write nothing and MUST signal failure through its exit status so an automated pipeline can gate on it.
- <a id="core-fr-012"></a>**CORE-FR-012**: Every fault the system reports MUST say, beside what is wrong, the next move that fixes it, wherever there is one.
- <a id="core-fr-013"></a>**CORE-FR-013**: Validation MUST NOT be a command of its own. What is wrong with the charter MUST be reported, in full, by the health check ([CORE-FR-080](#core-fr-080)), so that no two commands read one charter and answer differently.
- <a id="core-fr-014"></a>**CORE-FR-014**: Validation MUST raise a warning for each corpus no primitive cites, each mixin no primitive lends from, each mcp no primitive names ([CORE-FR-144](#core-fr-144)), each script and template no primitive names ([CORE-FR-163](#core-fr-163)), and each guide and sensor that no test case names. A posture is not warned about: a case asking whether a file is allowed names no posture, and a posture's `deny` may name commands no case can touch. The health check MUST leave out every warning raised under an installed vendor's files, count none of them, and still say each of their errors: a vendor is tested and checked in its own repository. None of them MUST stop a build or a listing ([CORE-FR-010](#core-fr-010)). The command line and the portal both show them, because both read validation.
- <a id="core-fr-211"></a>**CORE-FR-211**: Validation MUST warn, under the citing file, of a `rationale` that names no corpus any layer holds; the warning MUST NOT fail the charter.

**Id and layers**

- <a id="core-fr-015"></a>**CORE-FR-015**: An id MUST name one primitive in the whole charter, whatever its kind and whichever layer authored it — the repository, a vendor source, or the engine itself. Two files claiming one id, in any two layers or in one, MUST be reported as a collision naming both, never resolved by precedence.
- <a id="core-fr-016"></a>**CORE-FR-016**: A repository MUST therefore take what it vendors, and what the engine brings, as it stands: to differ from such a primitive it authors one under its own id, rather than shadowing it.
- <a id="core-fr-017"></a>**CORE-FR-017**: The charter MUST have a third layer, beside what the repository authored and what it installed, holding what the running engine itself brings.
- <a id="core-fr-018"></a>**CORE-FR-018**: This layer MUST be supplied by the engine on every read of the charter, and MUST NOT be written into the repository: no command may add, refresh or remove a file for it.
- <a id="core-fr-019"></a>**CORE-FR-019**: This layer MUST be read as part of the charter everywhere a charter is read: listed, searched, explained, compiled, counted, validated, and shown by the portal, each time saying which layer it came from.
- <a id="core-fr-020"></a>**CORE-FR-020**: Its primitives MUST be read the way every other primitive is read — against the same kind contracts, with the same faults — so nothing reaches the charter by a path that skips what a primitive's file is checked for.
- <a id="core-fr-021"></a>**CORE-FR-021**: When a repository's primitive claims an id this layer holds, the collision MUST be filed against the repository's file, and its fix MUST say that the engine brings that id, so it is the repository's own primitive that is renamed.
- <a id="core-fr-022"></a>**CORE-FR-022**: The generated charter document (`CHARTER.md` in the compiled output), where it explains ids, MUST name this third layer.
- <a id="core-fr-023"></a>**CORE-FR-023**: The vendor commands MUST NOT act on this layer: nothing installed it, and there is nothing under the workspace for them to act on.
- <a id="core-fr-024"></a>**CORE-FR-024**: What this layer compiles to MUST be compiled and deleted by the build exactly as any other primitive's compiled output is, so an engine that stops shipping one leaves nothing behind.

**Discovery**

- <a id="core-fr-025"></a>**CORE-FR-025**: The system MUST produce one catalogue of every primitive: its kind, its id, its description, the files it applies to where it names any, and its location. It is known by its id alone, and every other header is read from the file the catalogue names.
- <a id="core-fr-026"></a>**CORE-FR-026**: The system MUST NOT produce a reduced copy of the catalogue. The one catalogue ([CORE-FR-025](#core-fr-025)) is what an agent surveys before opening anything, and it names the file to open.
- <a id="core-fr-027"></a>**CORE-FR-027**: The catalogue MUST NOT contain primitive bodies. A body is opened only when its activation condition is met, by way of its recorded location.
- <a id="core-fr-028"></a>**CORE-FR-028**: The system MUST list the charter one primitive at a time, its id and description on its first line: the full listing by default — the file it was authored in and the files it applies to each on a line of its own beneath — id and description alone, one line each, on request, and narrowed to one kind on request. A charter with an error MUST list nothing and send the reader to the health check.

**Explaining a primitive**

- <a id="core-fr-029"></a>**CORE-FR-029**: The system MUST be able to say, for any id, which file declares it — or, for a primitive the engine brings, that it is the engine's own — and the layer that file was authored in. The explanation MUST also say when it comes up, the mixins and corpus it pulls in with each marked where it does not resolve, the primitives that lend from it, cite it or mention it ([CORE-FR-163](#core-fr-163)), and the test cases that name it. The command line and the portal MUST say the same. A collision is not answered there: both files that claim the id are named by the health check, where every other fault is.

**Applying the charter**

- <a id="core-fr-030"></a>**CORE-FR-030**: The system MUST compile the charter into the instruction surface the agent actually reads, including an agent-neutral instruction file and, when an agent is chosen, that agent's own role, capability and permission surfaces.
- <a id="core-fr-031"></a>**CORE-FR-031**: An agent-neutral target MUST always exist, so that applying the charter is possible even when the repository chose no agent.
- <a id="core-fr-032"></a>**CORE-FR-032**: Compiled output MUST be treated as generated: regenerated wholesale on every build, never hand-edited, and deleted when the primitive it came from is removed.
- <a id="core-fr-033"></a>**CORE-FR-033**: The system MUST regenerate the catalogue and the compiled output together from one reading of the charter, so the two cannot fall out of step. There MUST NOT be a way to produce one without the other.
- <a id="core-fr-034"></a>**CORE-FR-034**: The system MUST offer a preview that writes nothing and instead lists every target as create, update, delete or unchanged with a count, and signals through its exit status whether anything would change.
- <a id="core-fr-035"></a>**CORE-FR-035**: The build MUST put the charter in front of each agent the repository chose where that agent reads instructions unasked — for claude, `CLAUDE.md` at the repository root — as one section, opened by `<!-- CHERRYWORKS START -->` and closed by `<!-- CHERRYWORKS END -->`, that sends the reader to the agent-neutral orientation and carries nothing else. That file is the repository's own and not generated output: everything outside the section MUST be left exactly as it was, a section already there MUST be written in place, one that is not there MUST be put after what the file holds, and the file MUST never be deleted by a build.
- <a id="core-fr-036"></a>**CORE-FR-036**: The agent-neutral orientation MUST say what governs the repository, send its reader to the catalogue first, and say for each kind when it applies. It MUST carry no primitive body, so it does not grow with the charter.
- <a id="core-fr-037"></a>**CORE-FR-037**: Each primitive compiled for an agent MUST carry its body, preceded by the bodies of the mixins it pulls in.
- <a id="core-fr-038"></a>**CORE-FR-038**: The build MUST compile for the agents the repository chose at setup, so a charter builds the same files wherever it is checked out.
- <a id="core-fr-039"></a>**CORE-FR-039**: An agent's settings file MUST be written into rather than over: every posture of the charter, and one command for each signal its sensors name ([CORE-FR-175](#core-fr-175)), lands in it beside whatever the repository set there for itself, and a build MUST NOT delete it. The hooks under a signal its sensors name are the charter's whole, and a build MUST write them over what is there.
- <a id="core-fr-040"></a>**CORE-FR-040**: A charter with an error MUST make the build write nothing at all.

**Vendor sources**

- <a id="core-fr-041"></a>**CORE-FR-041**: The system MUST install vendored charter content from a git source identified by a short form carrying optional host name, owner, repository and version, pinned to that version.
- <a id="core-fr-042"></a>**CORE-FR-042**: Installing a charter source MUST install the source repository's charter folder — the one `cw init` sets up in it — and nothing else of it, so a source is authored and tested as any governed repository is and pushed as it stands. A source holding no charter folder at the version asked for is looked up for its skills instead ([CORE-FR-184](#core-fr-184)), and one holding neither MUST be refused as holding no charter and no skill, installing nothing.
- <a id="core-fr-170"></a>**CORE-FR-170**: Vendoring MUST be one level deep: a source that holds vendored content of its own at the version asked for MUST be refused, installing nothing, since its charter may lean on primitives that would not be installed with it.
- <a id="core-fr-171"></a>**CORE-FR-171**: Every name an agent is given for a primitive — a skill's folder, a rule's file, a subagent's name — MUST be its id, `/` written as `-`, without its kind, so a skill `sdd-plan` is invoked as `/sdd-plan`. A file a build wrote under the name an earlier version gave MUST be deleted by the next build.
- <a id="core-fr-172"></a>**CORE-FR-172**: A primitive MUST be named by its id alone, wherever it is named. Where a field holds nothing but names — `rationale`, `mixins`, a test case's expectation, a command's argument — the name MUST be the bare id. Where it sits among other text — a body, a sensor's `run`, an agent's `tools` — it MUST be written `[[<id>]]`, and only a name so written is a reference. Which kind a name refers to MUST be read off the primitive it names; where a field takes one kind, an id of another MUST be read as one nothing of that kind answers to.
- <a id="core-fr-173"></a>**CORE-FR-173**: A `skill` and a `playbook` MAY declare `disable-user-invocation`, `true` or `false`; one that does not is `false`. Any other value MUST be an error under its file, and nothing is built.
- <a id="core-fr-174"></a>**CORE-FR-174**: A build for an agent MUST keep every skill and playbook declaring `disable-user-invocation: true` out of the commands that agent offers its user, and MUST still give it to the agent as know-how it opens when its description matches what is asked. Every other skill and playbook MUST be offered as a command, as before. Changing the header changes what the agent is given at the next build.
- <a id="core-fr-175"></a>**CORE-FR-175**: A build for an agent MUST give that agent, for each signal at least one sensor names, exactly one command, `cw sensor run <signal> --agent <agent>` naming that agent ([CORE-FR-234](#core-fr-234)), and write none for a signal no sensor names; one an earlier build wrote for such a signal is left as it is. A sensor's own command MUST NOT be written into the agent's settings.
- <a id="core-fr-176"></a>**CORE-FR-176**: `cw sensor run <signal>` MUST run the command of every sensor of that signal that [CORE-FR-234](#core-fr-234) says runs, all at once, each given the standard input the command was given; one that fails or runs long MUST NOT stop the others. Given a signal no sensor names, it MUST run nothing, write nothing, and exit 0.
- <a id="core-fr-177"></a>**CORE-FR-177**: `cw sensor run <signal>` MUST exit 2 when any of its sensors exited 2, writing the error output of each that did, in order of id; otherwise with the first other non-zero status in order of id; otherwise 0.
- <a id="core-fr-178"></a>**CORE-FR-178**: What the sensors of one signal answer on their standard output MUST reach the agent as one answer, combined the way that agent combines the answers of several hooks on one event, read in order of id. One sensor's answer MUST NOT make another's unreadable.
- <a id="core-fr-179"></a>**CORE-FR-179**: `cw sensor run` MUST read the sensors and their commands from the last compiled output, never from the charter: a sensor changed in the charter MUST NOT run as changed before the next build, and a build that fails MUST leave what it runs as it was.
- <a id="core-fr-043"></a>**CORE-FR-043**: The system MUST attach no meaning to a vendored directory's name. Any grouping such a name implies belongs to the people using it, not to the system.
- <a id="core-fr-044"></a>**CORE-FR-044**: The system MUST install vendored content only under the charter's vendor directory, apart from its kind directories, so no vendor source can land on a kind directory or on what this repository authored ([CORE-FR-224](#core-fr-224)).
- <a id="core-fr-045"></a>**CORE-FR-045**: The system MUST allow more than one vendor source per repository.
- <a id="core-fr-046"></a>**CORE-FR-046**: Vendored content MUST be kept in the repository it is installed into, so a checkout that holds it carries the whole charter it is governed by with nothing left to fetch. The system MUST NOT exclude that content from version control, and MUST NOT keep a record beside it.
- <a id="core-fr-047"></a>**CORE-FR-047**: The system MUST support bringing an installed source up to date and removing it. Bringing one up to date MUST be the same thing as installing it, so there is one command rather than two.
- <a id="core-fr-048"></a>**CORE-FR-048**: Installing vendored content MUST NOT depend on any central service beyond the git source itself.
- <a id="core-fr-049"></a>**CORE-FR-049**: Installing MUST accept a source address as it was typed, so that every transport git supports works. A source that cannot be reached, or a version that is not there, MUST be refused in git's own words, installing nothing.
- <a id="core-fr-050"></a>**CORE-FR-050**: An installed source MUST land under the vendor directory in `<owner>/<repository>/<name>/primitive/`, its owner and repository read off its address, the repository without a trailing `.git`, and `<name>` the charter picked from it, or `root` for its own charter and the skills taken from it: `mattpocock/skills/root`. Every vendor is named by those three folders.
- <a id="core-fr-052"></a>**CORE-FR-052**: Installing a vendor source MUST compile nothing: the build is the one command that writes what an agent reads.
- <a id="core-fr-053"></a>**CORE-FR-053**: The engine MUST be able to list every installed vendor folder. It MUST NOT record where a folder came from or at which version. Bringing a source up to date is installing it again with its source, as it was first typed.

**Setup**

- <a id="core-fr-054"></a>**CORE-FR-054**: Setup MUST NOT depend on version control: it MUST work the same in a folder with none as in a git repository.
- <a id="core-fr-055"></a>**CORE-FR-055**: Setup MUST ask which agents the repository chooses, offering the agents this engine compiles for and defaulting to the ones the repository already chose, and MUST refuse to finish until at least one is chosen: a charter is authored to instruct an agent. A repository that has chosen none yet MUST be asked, with no agent offered already ticked, however many agents the engine compiles for. It MUST NOT detect what is installed on the machine: choosing an agent compiles everything that agent reads, and the build creates the directory it reads from whether it was there or not.
- <a id="core-fr-056"></a>**CORE-FR-056**: Every setup prompt MUST have a default acceptable without typing and an equivalent that can be supplied non-interactively, so the whole run is scriptable. The one exception is the agent in a repository that has chosen none yet: it has no default, so a run with nobody to ask MUST stop and name the flag that answers it.
- <a id="core-fr-057"></a>**CORE-FR-057**: Setup MUST create the charter's primitives folder with a directory per kind and record the agents the repository chose, and then build the charter, as `cw build` does, so the skill the engine brings ([CORE-FR-096](#core-fr-096)) is in the agent's hands before anything is authored. A charter that does not hold is not built, and setup MUST say so as the build does, keeping what it configured. It MUST NOT commit the result: what it wrote is left in the working tree for whoever ran it to read over and commit themselves.
- <a id="core-fr-058"></a>**CORE-FR-058**: Re-running setup in an initialized repository MUST reconfigure it — offering current answers as defaults — and MUST NOT discard authored content.

**Asking a kind what it requires**

- <a id="core-fr-059"></a>**CORE-FR-059**: `cw kinds <kind>` MUST answer with that kind's required headers, the shape each takes, and the kind's sample.
- <a id="core-fr-060"></a>**CORE-FR-060**: `cw kinds` with no argument MUST answer with one line per kind, saying when a primitive of that kind comes up.
- <a id="core-fr-061"></a>**CORE-FR-061**: A word that is no kind MUST be answered with every kind there is, as an unknown kind is answered elsewhere.
- <a id="core-fr-062"></a>**CORE-FR-062**: What this answers MUST be the kind's one declaration of what it requires — the same one the prompts ask from and the same one a refusal is worded from. No surface may restate it.
- <a id="core-fr-063"></a>**CORE-FR-063**: Asking a kind MUST add no capability of its own to the engine: it is another way of asking what the engine already answers when it prompts and when it refuses.

**Creating a primitive**

- <a id="core-fr-064"></a>**CORE-FR-064**: The system MUST create a new primitive of a named kind and id, holding the answers given for the headers that kind takes and nothing else.
- <a id="core-fr-065"></a>**CORE-FR-065**: With someone at the terminal and no header given as a flag, creating a primitive MUST ask for each header its kind requires, and an answer the kind refuses MUST be said before anything is written. With no header flag and nobody at the terminal, it MUST write nothing and MUST say which headers it would have asked for, rather than waiting or writing a file the next build refuses.
- <a id="core-fr-066"></a>**CORE-FR-066**: `cw add <kind> <id>` MUST accept `--header <name>=<value>`, given once per header.
- <a id="core-fr-067"></a>**CORE-FR-067**: A header that takes a list MUST accept the flag repeated, keeping every value in the order given. A header that takes one value MUST refuse a second.
- <a id="core-fr-068"></a>**CORE-FR-068**: A value MUST be everything after the first `=`. A flag with no `=` MUST be refused, naming the flag.
- <a id="core-fr-069"></a>**CORE-FR-069**: A header a kind takes without requiring it MUST be accepted as a flag, shaped as the kind takes it (a guide's globs, as in [CORE Story 10](#core-story-10---write-a-primitive-with-no-terminal-to-answer-at-priority-p1), scenario 1). The prompt path MUST still ask only for the headers the kind refuses a file without.
- <a id="core-fr-070"></a>**CORE-FR-070**: When any header flag is given, the command MUST ask nothing at a prompt.
- <a id="core-fr-071"></a>**CORE-FR-071**: A run missing a required header MUST write nothing and MUST name every missing header with what it takes.
- <a id="core-fr-072"></a>**CORE-FR-072**: A header the kind does not take MUST write nothing and MUST be named.
- <a id="core-fr-073"></a>**CORE-FR-073**: Every refusal MUST be worded as the engine words it: the flag path and the prompt path MUST refuse the same answers with the same words.
- <a id="core-fr-074"></a>**CORE-FR-074**: A successful run MUST write exactly the file the prompt path writes for the same answers, with an empty body, and MUST compile nothing and commit nothing: the body is what its author has yet to write.

**Changing and deleting a primitive**

- <a id="core-fr-075"></a>**CORE-FR-075**: The engine MUST be able to rewrite an existing repository primitive's headers and body, keeping its kind and id, and MUST refuse it with the same faults creating one gives for answers the kind refuses. The portal MUST show an existing primitive's kind and id without letting them be changed.
- <a id="core-fr-076"></a>**CORE-FR-076**: The engine MUST be able to delete an existing repository primitive's `index.md` and its assets ([CORE-FR-167](#core-fr-167)), and nothing else.
- <a id="core-fr-077"></a>**CORE-FR-077**: The engine MUST refuse to rewrite or delete a vendored primitive, naming the vendor folder it belongs to.
- <a id="core-fr-078"></a>**CORE-FR-078**: Rewriting a primitive MUST be refused, with the file named, when the file changed on disk after the author opened it.
- <a id="core-fr-079"></a>**CORE-FR-079**: Neither creating, rewriting nor deleting a primitive MUST compile or commit anything: what it writes is left in the working tree, and a build is the command that compiles ([CORE-FR-032](#core-fr-032)).

**Health**

- <a id="core-fr-080"></a>**CORE-FR-080**: The system MUST report, in one command, which agents the repository chose, whether validation passes, and whether compiled output is out of date — determining the last by running the preview rather than tracking staleness independently.
- <a id="core-fr-081"></a>**CORE-FR-081**: The health check MUST say so rather than fail when the repository chose no agent, and MUST ask every one of its questions whatever the one before it answered, since one command is one report.

**Self-regression tests**

- <a id="core-fr-082"></a>**CORE-FR-082**: A self-regression test MUST describe one or more cases, each putting one situation — a file touched, or an event raised — and asserting the one thing expected of the charter in it: that a named primitive comes up, or that the path is allowed or refused. A test is not a primitive: it is kept beside the charter's primitives and is none of them, nothing compiles it, and no agent is instructed by it, so it is kept with the charter's other tests, apart from its primitives ([CORE-FR-224](#core-fr-224)), and is written in a machine format rather than as a document with a body.
- <a id="core-fr-083"></a>**CORE-FR-083**: Running the tests MUST resolve each described situation against the current charter and report pass or fail per case, naming every expectation that was not met.
- <a id="core-fr-084"></a>**CORE-FR-084**: Running the tests MUST NOT require an execution environment, a network, or an agent. Resolution alone decides the result, so the outcome is deterministic and the command stays a reader.
- <a id="core-fr-085"></a>**CORE-FR-085**: Running the tests MUST signal failure through its exit status so an automated pipeline can gate on it.
- <a id="core-fr-086"></a>**CORE-FR-086**: A test file that does not read — not in the machine format, a case putting no situation or two, an expectation that does not go with the situation put before it, a field nothing reads — MUST be reported as that file's own fault and answered with a sample of a file that does read.
- <a id="core-fr-087"></a>**CORE-FR-087**: An expectation naming an id the charter holds nothing of, or one of a kind the case's situation cannot bring up, MUST be reported unmet rather than passed over.
- <a id="core-fr-088"></a>**CORE-FR-088**: A test file that does not read MUST stop the run, reported as the fault it is, since the cases beside it would report a pass that does not cover what it was written to cover.
- <a id="core-fr-089"></a>**CORE-FR-089**: A repository with no test MUST be told so, and the run MUST pass: writing none is not a failure.
- <a id="core-fr-090"></a>**CORE-FR-090**: The engine MUST be able to rewrite one existing test file with new text, and MUST refuse text that does not read as a suite with the same refusal and sample `cw test` gives.
- <a id="core-fr-091"></a>**CORE-FR-091**: The engine MUST be able to create a test file under a name no other test file has, holding one sample case that reads as a suite.
- <a id="core-fr-092"></a>**CORE-FR-092**: The engine MUST be able to delete one test file, and nothing else.

**The command line**

- <a id="core-fr-093"></a>**CORE-FR-093**: The command surface MUST be divided by side effect: commands that only read MUST write nothing, and every write MUST come from one command whose purpose is to write.
- <a id="core-fr-094"></a>**CORE-FR-094**: Asked for help, the command line MUST print its usage and exit successfully.
- <a id="core-fr-095"></a>**CORE-FR-095**: The command line MUST refuse an unknown command or flag, and MUST answer a near miss with the command it most likely meant.

**The authoring skill the engine ships**

- <a id="core-fr-096"></a>**CORE-FR-096**: `cw` MUST ship a primitive of kind `skill`, in the layer the engine owns, whose subject is authoring a primitive in this repository.
- <a id="core-fr-097"></a>**CORE-FR-097**: Its body MUST name no kind's headers and MUST restate no kind's requirements. It MUST say to ask the engine instead.
- <a id="core-fr-098"></a>**CORE-FR-098**: Its body MUST say the procedure: ask the kind what it requires, write the primitive with one flag per header, write the body, build.
- <a id="core-fr-099"></a>**CORE-FR-099**: Its body MUST say that it is the engine's own and is not authored in this repository, and that a repository wanting something else authors its own primitive.
- <a id="core-fr-100"></a>**CORE-FR-100**: Its triggers MUST bring it up when what is being asked is to write a rule, a standard, a skill or any other primitive of this charter.
- <a id="core-fr-101"></a>**CORE-FR-101**: It MUST say that changing or removing a primitive that already exists is not what it covers.
- <a id="core-fr-102"></a>**CORE-FR-102**: Its body MUST say that a refusal from `cw add` or `cw build` is read and answered, and MUST send a refused build to `cw doctor`.
- <a id="core-fr-103"></a>**CORE-FR-103**: Every `cw` command its body names MUST be a command `cw` has, so it describes nothing that does not answer.

**The portal: starting it**

- <a id="core-fr-104"></a>**CORE-FR-104**: The system MUST offer a command that starts the portal for the repository it is run in, and MUST print the address the portal can be reached at.
- <a id="core-fr-105"></a>**CORE-FR-105**: The portal MUST serve one repository for as long as it runs: the one it was started in. It MUST NOT offer a way to point it at another.
- <a id="core-fr-106"></a>**CORE-FR-106**: The portal MUST be reachable only from the machine it runs on. It MUST NOT ask anyone to sign in.
- <a id="core-fr-107"></a>**CORE-FR-107**: The command MUST stop before serving anything in a repository that was never set up, and MUST say so and how to set one up. It MUST NOT depend on version control.

**The portal: reaching the engine**

- <a id="core-fr-108"></a>**CORE-FR-108**: The portal MUST reach the engine only the way the command line does, and MUST hold no rule about the charter of its own: every validation, listing, explanation, build, preview, test result and health answer it shows MUST be what the engine returned.
- <a id="core-fr-109"></a>**CORE-FR-109**: Everything the portal shows or does MUST also be available from the command line. Each capability the portal needs from the engine MUST be added to the engine and given a command-line equivalent in the same change, so the two surfaces cannot drift apart.
- <a id="core-fr-110"></a>**CORE-FR-110**: The portal MUST read the charter afresh whenever it shows a view, and MUST NOT keep a copy of the charter between views, so a change made on disk by anyone is what the next view shows.
- <a id="core-fr-111"></a>**CORE-FR-111**: The portal MUST work without a network connection for everything except adding or updating a vendor source.

**The portal: reading the charter**

- <a id="core-fr-112"></a>**CORE-FR-112**: The portal MUST show the repository layer and the vendor layer separately, and within each MUST let the developer narrow to one kind, showing beside every kind how many primitives of it the layer holds.
- <a id="core-fr-113"></a>**CORE-FR-113**: Every listed primitive MUST show its id, description, file path, and the headers its kind is activated by, as described in [CORE Story 5](#core-story-5---see-what-the-charter-holds-and-why-each-rule-comes-up-priority-p1), scenario 2; and each listing MUST say, once per kind rather than once per primitive, when that kind comes up, read off that kind's own contract. Which kinds there are, and when each comes up, MUST be answered by the engine rather than known by whichever surface is listing.
- <a id="core-fr-114"></a>**CORE-FR-114**: The portal MUST search every primitive in every layer by id, kind, description, its folder and file under its kind, its layer, the vendor it came from and header value, never by where the machine keeps it, and MUST show only the primitives that match.
- <a id="core-fr-115"></a>**CORE-FR-115**: When the charter holds an error, the portal MUST say the engine will not read the charter and show every fault under the file that has to change, in the words the engine gives it, instead of a listing.
- <a id="core-fr-116"></a>**CORE-FR-116**: The portal MUST offer the explanation ([CORE-FR-029](#core-fr-029)) from every listed primitive, and each id in it MUST open that primitive's own explanation.

**The portal: authoring**

- <a id="core-fr-117"></a>**CORE-FR-117**: Creating a primitive from the portal MUST ask the headers the engine says the kind requires ([CORE-FR-064](#core-fr-064)), in the shape each takes, plus the description, the rationale, the mixins and the body, and MUST write the primitive the way `cw add` writes it, with the body the author typed.
- <a id="core-fr-118"></a>**CORE-FR-118**: A header drawn from a closed set, such as a sensor's signal or a new primitive's kind, MUST be chosen from that set rather than typed. A rationale MUST offer the corpus the charter holds.
- <a id="core-fr-119"></a>**CORE-FR-119**: The body editor MUST offer a source view with markdown highlighting and a rendered preview, and MUST work offline ([CORE-FR-111](#core-fr-111)).

**The portal: building and health**

- <a id="core-fr-120"></a>**CORE-FR-120**: The portal MUST offer a preview of the build, listing every target as create, update, delete or unchanged with a count, and a real build, listing what it wrote and deleted — both as the engine returns them.
- <a id="core-fr-121"></a>**CORE-FR-121**: The portal MUST offer the health check, showing the same answers `cw doctor` reports ([CORE-FR-080](#core-fr-080)), the same main-context line for each chosen agent ([EVAL-FR-006](spec-eval.md#eval-fr-006)), and the same faults, and MUST offer a build from it when the compiled output is behind.

**The portal: vendor sources**

- <a id="core-fr-122"></a>**CORE-FR-122**: The portal MUST list every installed vendor source with the folder it landed in and its primitives counted by kind.
- <a id="core-fr-123"></a>**CORE-FR-123**: The portal MUST offer adding a source by its short git form and an optional version, and removing an installed one by its folder, through the engine's vendoring, and MUST show the engine's refusal whenever one is refused.

**Distribution**

- <a id="core-fr-126"></a>**CORE-FR-126**: The engine MUST be published to the public npm registry as one package named `cherry-works`, whose install puts one command, `cw`, on the path.
- <a id="core-fr-127"></a>**CORE-FR-127**: The installed package MUST run every command, the portal and its page included, with no build step, no source checkout, and no compiler, native toolchain or browser download on the user's machine.
- <a id="core-fr-209"></a>**CORE-FR-209**: The installed `cw` MUST run every command with no network, as it does from a source build, except adding or updating a vendor source and what reaches an mcp origin or runs an agent: building a charter that declares an `mcp`, signing in, a tool call, an evaluation.
- <a id="core-fr-128"></a>**CORE-FR-128**: The package MUST declare the oldest runtime version it supports, and `cw` run on an older one MUST name the version it needs and exit with a failure status before doing anything else.
- <a id="core-fr-129"></a>**CORE-FR-129**: Installing the package MUST install only what `cw` and the library it exports ([SDK-FR-001](spec-sdk.md#sdk-fr-001)) need at run time. What exists only to build, bundle or test it — including everything the portal's page was built from — MUST NOT be installed.
- <a id="core-fr-130"></a>**CORE-FR-130**: The package MUST hold only what a user needs: the runnable program, the portal's page, the library an integrator imports, the README and the license. The specs, the tests, the sources, the repository's own charter and anything else of the development repository MUST NOT be in it.
- <a id="core-fr-131"></a>**CORE-FR-131**: `cw --version` MUST print the version the package was published as, and nothing else, and exit successfully.
- <a id="core-fr-210"></a>**CORE-FR-210**: The package MUST expose `cw` as its executable, so that a repository's own scripts run the version it declares as a development dependency, whatever version is installed globally.
- <a id="core-fr-132"></a>**CORE-FR-132**: The health check MUST name the version of `cw` that produced it, on the command line and in the portal alike ([CORE-FR-121](#core-fr-121)).
- <a id="core-fr-133"></a>**CORE-FR-133**: The repository MUST carry the MIT license, declared in the package and shipped in it.
- <a id="core-fr-134"></a>**CORE-FR-134**: A release MUST be refused, publishing nothing, unless the working tree holds no uncommitted change, every test passes, and the version has never been published.
- <a id="core-fr-135"></a>**CORE-FR-135**: Before a release publishes, the exact package it would publish MUST be installed apart from the repository and used to set a fresh repository up and build it; the release MUST be refused if either fails.
- <a id="core-fr-136"></a>**CORE-FR-136**: Every published version MUST be traceable to the commit it was built from, recorded in the repository as a tag named after the version.
- <a id="core-fr-137"></a>**CORE-FR-137**: A release MUST be started by the maintainer running one command on their own machine, and every check of [CORE-FR-134](#core-fr-134) and [CORE-FR-135](#core-fr-135) MUST run on that path.
- <a id="core-fr-138"></a>**CORE-FR-138**: The README MUST give the install from the registry as the way to get `cw`, and building from source as the contributor's way.

**The compiled charter**

- <a id="core-fr-139"></a>**CORE-FR-139**: A build MUST write every primitive of every layer as one compiled document at `<kind>/<id>/index.md` inside the compiled output, with its assets beside it ([CORE-FR-168](#core-fr-168)): its headers, and below them the bodies of the mixins it pulls in, in the order it names them, before its own. A compiled document MUST carry the mark of generated output, and MUST be deleted by the build that no longer compiles it.
- <a id="core-fr-140"></a>**CORE-FR-140**: The catalogue MUST name, as each primitive's file, its compiled document. A listing of the charter — on the command line and in the portal — MUST name the file each primitive was authored in, read off the charter rather than off the catalogue.

**Knowledge reached through MCP**

- <a id="core-fr-141"></a>**CORE-FR-141**: An id MUST be one or more segments joined by `/`, each segment lowercase letters, digits and inner hyphens, so that ids can be grouped (`mfbs/billing`). In the store `cw` keeps the charter in, a primitive MUST be kept as `<kind>/<id>/index.md` under its layer, each segment of its id a folder, and compiled under the same path inside the compiled output ([CORE-FR-139](#core-fr-139)). Going down from a kind's folder, the first `index.md` found is a primitive, and everything else under its folder is its own. An `index.md` kept anywhere else than its kind and id say, and a markdown file kept as `<kind>/<id>.md`, MUST be an error under that file saying where to move it, and nothing is built. Every name an agent is given for a primitive — an agent's component, a tool's prefix — MUST write `/` as `-`.
- <a id="core-fr-142"></a>**CORE-FR-142**: An `mcp` primitive MUST declare one MCP server, in exactly one of two ways: an endpoint reached over HTTP, or a command with its arguments, started as a local process. Its address is the endpoint, or the command with its arguments. It MUST declare the tools of that server the agent may use. For an endpoint it MUST declare the ways a developer may sign in — `oauth`, `token`, or both. For a command, `token` is the only way, and a primitive declaring it MUST name the environment variable the process reads its token from; a command declaring no way needs no sign-in. It MAY declare a path: the mcp origin inside that server it is about, such as one repository of a code forge, told to the agent beside each of its tools. Its body, where it has one, says what is kept there and when to look.
- <a id="core-fr-143"></a>**CORE-FR-143**: A primitive of any kind MUST name an mcp origin it uses in its body, as `[[<id>]]`, in the author's own words; there is no header for it. A name no layer holds MUST be an error under the file whose body names it ([CORE-FR-162](#core-fr-162)).
- <a id="core-fr-144"></a>**CORE-FR-144**: An `mcp` primitive no primitive names MUST be a warning under its own file, stopping nothing ([CORE-FR-014](#core-fr-014)).
- <a id="core-fr-145"></a>**CORE-FR-145**: The build MUST write the list of mcp origins, `mcp-origins.json` in the compiled output: one entry per address and path, holding every id declaring it, from every layer, the name each id is served under, and the union of the ways each allows signing in — where the mcp origin is, how it is signed in to and what its tools are served under, and nothing an mcp's own file and the catalogue already say. An mcp origin's tools are the union of what its ids declare, each id's served under its own prefix: the first segment of its id and four hex characters hashed from its id, `mfbs_xxxx` for `mfbs/billing`, short whatever the id's length and the same on every build whatever other mcps come and go; two that hash alike are told apart by `_2` onward, in the order the ids sort in. Two ids at one mcp origin are two prefixes, never one chosen between them.
- <a id="core-fr-146"></a>**CORE-FR-146**: The build MUST write, into each chosen agent's MCP configuration, one entry starting `cw mcp serve`, whether or not the charter declares an `mcp` primitive yet, and MUST leave every other entry of that configuration as it was.
- <a id="core-fr-147"></a>**CORE-FR-147**: A primitive's compiled document ([CORE-FR-139](#core-fr-139)) MUST write each `[[<id>]]` its body names, of a primitive the charter holds, as a markdown link: the id as its text, and as its target the file the catalogue names for that id ([CORE-FR-140](#core-fr-140), [CORE-FR-164](#core-fr-164)), written as the path from the document holding the link, so it opens where it is read. A name written alone inside a code span keeps that span as the link's text; a name inside a longer code span or a fenced block MUST be left as written. A name no layer holds never reaches a build: the charter refuses it ([CORE-FR-162](#core-fr-162)). The charter itself knows no agent's names and holds no path.
- <a id="core-fr-148"></a>**CORE-FR-148**: `cw mcp auth` MUST sign the developer in, as themselves, to every address the charter holds that they are not signed in to, one address at a time, offering every way any `mcp` primitive at that address allows, whichever layer declared it. One sign-in MUST serve every primitive at that address. No credential MUST be shared between developers, or held for them.
- <a id="core-fr-149"></a>**CORE-FR-149**: A credential MUST be kept in the operating system's own credential store, under its address, and MUST NOT be written to any file under the repository, to the compiled output, or to anything `cw` prints. A token typed at a prompt MUST NOT be shown.
- <a id="core-fr-150"></a>**CORE-FR-150**: `cw mcp auth` MUST ask only at a terminal. With none, it MUST ask nothing, name each address not signed in to, and exit with a failure status. `cw mcp auth --status` MUST list each address, the ids at it, and whether the developer is signed in there, and change nothing. `cw mcp auth <mcp id>` MUST sign in again to that primitive's address alone.
- <a id="core-fr-151"></a>**CORE-FR-151**: A credential that expires MUST be renewed without asking, where the mcp origin allows it. Where it cannot be, a call to that mcp origin MUST answer that the developer must sign in again, naming the command.
- <a id="core-fr-152"></a>**CORE-FR-152**: `cw mcp serve` MUST be one MCP server, spoken to over standard input and output, serving the list of mcp origins the last build wrote. With no list, it MUST stop, saying the charter must be built. An mcp origin declared by a command MUST be started for a call, its token — where it takes one — given in the variable its primitive names and in no other way, and MUST be stopped once the call has been answered.
- <a id="core-fr-153"></a>**CORE-FR-153**: The server MUST list, for each mcp origin, exactly the tools the build kept that its ids declare, each named `<prefix>__<tool>` under the prefix of the id declaring it, and MUST refuse a call to any tool it did not list, reaching no mcp origin. A declared tool the list the build wrote does not hold MUST be said when the tools are listed, naming the primitive and the tool, and left out, reaching no mcp origin ([EVAL-FR-031](spec-eval.md#eval-fr-031)).
- <a id="core-fr-154"></a>**CORE-FR-154**: A call MUST reach its mcp origin under the credential of the developer running the server, and its answer MUST be returned as the mcp origin gave it. An mcp origin that cannot be reached, or is not signed in to, MUST affect only its own calls: a call to one answers why and the next move ([EVAL-FR-031](spec-eval.md#eval-fr-031)).
- <a id="core-fr-156"></a>**CORE-FR-156**: An `agent` primitive MAY hold an mcp origin by listing it under `tools` in the charter's own words: `[[<id>]]` for every tool that mcp declares, `[[<id>]]:<tool>` for one of them. Its compiled tool list MUST hold each as the name the agent is given that tool by, beside the tools it lists otherwise, and no tool of an mcp origin it does not list — whatever its body mentions. A listed mcp no layer holds, a tool that mcp does not declare, or a `[[…]]` entry written neither way MUST be an error under the agent primitive's file. An agent primitive listing an mcp names it ([CORE-FR-144](#core-fr-144)).
- <a id="core-fr-157"></a>**CORE-FR-157**: An `id` MUST be at most 40 characters, refused under its file like any header that does not hold, so that every name an agent is given for it — an mcp's tools as `mcp__cw__<id>__<tool>` among them — stays within what the agent accepts without a check of its own.

**Scripts and templates**

- <a id="core-fr-158"></a>**CORE-FR-158**: A `template` MUST declare nothing beyond the headers every kind takes. Its body is the file the agent fills or copies, and the agent reads what kind of file it is off the body.
- <a id="core-fr-159"></a>**CORE-FR-159**: A build MUST compile each template of every layer as it does every other kind ([CORE-FR-139](#core-fr-139)), at `template/<id>/index.md` inside the compiled output.
- <a id="core-fr-160"></a>**CORE-FR-160**: Of a built script, the file it runs MUST be executable by the developer who built it, and no other file of it. A built template MUST NOT be made executable.
- <a id="core-fr-161"></a>**CORE-FR-161**: A primitive of any kind names a script or a template in its body by id, `[[<id>]]`, and a sensor MAY name a script in its `run` the same way. Only a name shaped as an id is a reference. The charter itself holds ids, never paths; what each is written as where it is read is [CORE-FR-147](#core-fr-147) and [CORE-FR-169](#core-fr-169).
- <a id="core-fr-162"></a>**CORE-FR-162**: A body naming `[[<id>]]` that no layer holds, and a sensor's `run` naming such a `[[<id>]]`, MUST be an error under the file that names it, naming the id, in one wording for every kind; the charter is not built while it stands, and `cw build` MUST exit with a failure status, as for any other error. A warning would not do: an agent sent to an mcp origin or a script that is not there may invent one, or use another it takes for it.
- <a id="core-fr-163"></a>**CORE-FR-163**: A script or a template no primitive names MUST be a warning under its own file, stopping nothing ([CORE-FR-014](#core-fr-014)). A primitive naming a script or a template in its body, and a sensor naming a script in its `run`, names it, for this warning and for the explanation ([CORE-FR-029](#core-fr-029)).
- <a id="core-fr-164"></a>**CORE-FR-164**: The catalogue MUST name, as each template's and each script's file, its compiled document, a script's saying the file it runs ([CORE-FR-140](#core-fr-140), [CORE-FR-166](#core-fr-166)).
- <a id="core-fr-165"></a>**CORE-FR-165**: A `script` MUST declare `executionPath`: the path from its `index.md` to the one asset that is run, written `./<path>` in letters, digits, `.`, `_` and `-`, since it is written into commands a shell reads ([CORE-FR-169](#core-fr-169)). Its author types it; nothing is guessed. An `executionPath` not written so, leaving its folder, or naming no asset of the script MUST be an error under its `index.md`, and nothing is built. Its body says how the script is called — its arguments, and when to run it — and MAY be empty.
- <a id="core-fr-166"></a>**CORE-FR-166**: What runs is the copy of a script's assets in `script/<id>/` of the compiled output ([CORE-FR-168](#core-fr-168)): every command and every path written for a script names it, so a change to a script's assets reaches what runs at the next build and not before.
- <a id="core-fr-167"></a>**CORE-FR-167**: Creating a primitive, from `cw add` and from the portal, MUST be refused, naming the primitive in the way and writing nothing, where its folder would sit inside another primitive's folder of its layer, or hold one. Creating a script MUST also write an empty asset at the `executionPath` answered, and both MUST say it was written, so its author knows where the script goes. Deleting a primitive ([CORE-FR-076](#core-fr-076)) MUST take every asset of it with it.
- <a id="core-fr-168"></a>**CORE-FR-168**: Every file in a primitive's folder but its `index.md`, at any depth, MUST be one of its assets, a file named `index.md` deeper in it included, and MUST NOT be read as a primitive. A build MUST copy every asset of every primitive, of every layer, beside its compiled document, at the path it has in the folder, byte for byte: no name rewritten. The build that no longer copies a file, because the primitive or the file is gone, MUST delete it.
- <a id="core-fr-169"></a>**CORE-FR-169**: A sensor's `run` naming `[[<id>]]` of a script the charter holds MUST be written, in the command built for that sensor, which is what runs when its signal fires ([CORE-FR-176](#core-fr-176)), as that script's built file's path from the repository's root, with the rest of the command as written.

**The portal: tests**

- <a id="core-fr-124"></a>**CORE-FR-124**: The portal MUST list every test file with its name, description and case count, and each case's situation and expectation.
- <a id="core-fr-125"></a>**CORE-FR-125**: The portal MUST run every test through the engine and show each case's outcome, the count passing out of the total, and for a failing case what came up instead.

**Skills repositories**

- <a id="core-fr-180"></a>**CORE-FR-180**: A vendor folder laid out any other way than [CORE-FR-050](#core-fr-050) says, as an earlier version installed one, MUST be refused naming it, with the fix to delete it and install its source again; nothing of it is read as a vendor.
- <a id="core-fr-181"></a>**CORE-FR-181**: A `skill` and a `playbook` MAY declare `disable-model-invocation`, `true` or `false`; one that does not is `false`. Any other value MUST be an error under its file, and nothing is built.
- <a id="core-fr-182"></a>**CORE-FR-182**: A build for an agent MUST give every skill and playbook declaring `disable-model-invocation: true` to that agent as a command the user types, under that agent's own header, which keeps it from opening the skill by itself.
- <a id="core-fr-183"></a>**CORE-FR-183**: A skill or a playbook declaring both `disable-model-invocation: true` and `disable-user-invocation: true` MUST be an error under its file, and nothing is built.
- <a id="core-fr-184"></a>**CORE-FR-184**: `cw vendor add <source> --skill=<name>` MUST take, from the `skills/` folder of a source at the version asked for ([CORE-FR-193](#core-fr-193)) given in the short form a vendor source is given in ([CORE-FR-041](#core-fr-041), [CORE-FR-049](#core-fr-049)), each skill named, `--skill` repeated for more than one, and install each as a skill primitive in that source's vendor folder ([CORE-FR-050](#core-fr-050)), read-only as any vendored primitive ([CORE-FR-077](#core-fr-077)).
- <a id="core-fr-185"></a>**CORE-FR-185**: The system MUST find a skill in a skills repository as a folder under its `skills/` folder, at most three folders deep, holding a `SKILL.md`, known by the `name` its headers declare. Nothing below a skill's folder, nothing under `node_modules`, and no `SKILL.md` outside `skills/` MUST be read as a skill.
- <a id="core-fr-186"></a>**CORE-FR-186**: Converting a `SKILL.md` MUST make its `name` the id, keep its `description`, make its `name` the one trigger, keep `disable-model-invocation`, declare `disable-user-invocation: true` where it declares `user-invocable: false`, and keep its body as written. Every other header MUST be left out, and the command MUST name what it left out.
- <a id="core-fr-187"></a>**CORE-FR-187**: Every file beside a `SKILL.md` in its folder, at any depth, MUST arrive as an asset of the primitive, at the same path.
- <a id="core-fr-188"></a>**CORE-FR-188**: Given a source whose skills are taken ([CORE-FR-193](#core-fr-193)) and no `--skill`, the command MUST take every skill the source holds, asking nothing. Given a `--skill` the source does not hold, it MUST install nothing, naming the skills the source holds.
- <a id="core-fr-189"></a>**CORE-FR-189**: Taking a skill into a source folder MUST leave every other skill in it as it was, and taking one the folder already holds MUST replace it whole, as installing a vendor source again brings it up to date ([CORE-FR-047](#core-fr-047)).
- <a id="core-fr-190"></a>**CORE-FR-190**: Taking skills MUST leave what it installs unstaged and uncommitted for the developer to read, as installing a charter source does, whatever other work is in hand; refuse a source that cannot be reached in git's own words; and compile nothing ([CORE-FR-052](#core-fr-052)).
- <a id="core-fr-191"></a>**CORE-FR-191**: Installing into `root` again MUST write over what it held: a source's own charter replaces every primitive `root` held, and each skill taken replaces the one of its name, leaving the others as they were.
- <a id="core-fr-192"></a>**CORE-FR-192**: A `SKILL.md` with no `name` or no `description`, a `name` that is not a valid id, or a `name` two folders of the source declare, MUST be refused naming the files, and nothing is installed.
- <a id="core-fr-193"></a>**CORE-FR-193**: `cw vendor add` and `cw vendor inject` MUST tell a source's shape from what it holds at the version asked for, with no flag naming it. With neither `--charter` nor `--skill`, they MUST take the first shape it holds in this order: its one charter folder, else every charter under `charters/`, else every skill under `skills/`. `--charter` MUST read `charters/` alone and `--skill` `skills/` alone, whatever else the source holds, and both MAY be given together. A flag for a shape the source does not hold MUST be refused, taking nothing, saying which shapes it holds.
- <a id="core-fr-194"></a>**CORE-FR-194**: Injecting MUST be refused whole, naming both files and writing nothing, when a primitive it would write claims an id the charter already holds — the repository's own, a vendor's or the engine's ([CORE-FR-015](#core-fr-015)). A primitive injected before is the repository's own, so injecting it again MUST be refused the same way.
- <a id="core-fr-195"></a>**CORE-FR-195**: A source MAY hold many charters, each under its `charters/` folder in a folder named by it and laid out there as a single-charter source holds its one. `--charter=<name>`, typed once per charter, MUST pick the charters taken from it by those names.
- <a id="core-fr-196"></a>**CORE-FR-196**: `cw vendor add` MUST install each charter picked from a source of many charters in a vendor folder of its own, `<owner>/<repository>/<name>`, beside the source's own under `root`, brought up to date and removed on its own as any vendor folder is ([CORE-FR-050](#core-fr-050)).
- <a id="core-fr-197"></a>**CORE-FR-197**: A `--charter` naming a charter the source does not hold MUST install nothing, naming the charters it holds. A folder under `charters/` named as a kind is, named `root`, or holding no charter folder, MUST be refused when picked, naming the folder, installing nothing.
- <a id="core-fr-198"></a>**CORE-FR-198**: `cw vendor inject <source>` MUST take from a source, at the version asked for and with the same flags, what `cw vendor add` takes ([CORE-FR-193](#core-fr-193)) — a skill converted as [CORE-FR-186](#core-fr-186) and [CORE-FR-187](#core-fr-187) say — and write each primitive taken, with its files, into the repository's own charter where its kind is authored, as if authored there. It MUST refuse, writing nothing, wherever `cw vendor add` would refuse to install.
- <a id="core-fr-199"></a>**CORE-FR-199**: Injecting MUST leave what it writes unstaged, whatever else is in hand, and MUST NOT build ([CORE-FR-190](#core-fr-190)).
- <a id="core-fr-200"></a>**CORE-FR-200**: An injected primitive MUST be the repository's own in every way: nothing records the source it came from, it is never read-only, and no vendor command lists, brings up to date or removes it.

**Standing without git**

- <a id="core-fr-204"></a>**CORE-FR-204**: Removing a vendor source MUST delete its folder, and each folder above it that leaves empty up to and including the vendor directory, and nothing else, leaving that in the working tree uncommitted, whatever other work is in hand. A name no vendor folder answers to MUST be refused, changing nothing.
- <a id="core-fr-205"></a>**CORE-FR-205**: Installing and injecting a source MUST NOT need the folder installed into to be a repository. A machine without git MUST be told so, and nothing is installed. Where the folder is in a repository, a source MUST be reached under that repository's own version control settings.
- <a id="core-fr-206"></a>**CORE-FR-206**: Evaluating MUST still run on worktrees ([EVAL-FR-021](spec-eval.md#eval-fr-021)), and is the one use case needing a git repository; outside one, a run with a case to evaluate MUST be refused in git's words, and a run with no case answers that there is none, as in a repository. What it asks of version control MUST be apart from what fetching a source asks, so neither use case holds the other's questions.

**Binary assets**

- <a id="core-fr-207"></a>**CORE-FR-207**: Every file under a primitive's folder MUST reach where it is built, installed or injected identical to its source, byte for byte, whatever it holds; and the preview MUST compare it as such.
- <a id="core-fr-208"></a>**CORE-FR-208**: The ports a file is read and written through MUST carry bytes as well as text, so no adapter need decode a file the engine only copies.
- <a id="core-fr-213"></a>**CORE-FR-213**: A store of an integrator's own MUST be able to keep a repository's state in any place and any layout, handing the engine each primitive, test suite, eval suite and vendor already read and known by its layer and kind, and being handed back what the engine writes; the engine MUST NOT read a layer, a kind, a vendor or a suite's name off where a file sits.
- <a id="core-fr-214"></a>**CORE-FR-214**: How a repository's state is kept MUST NOT change what the command line or the portal answer; the published package MUST say where something is kept as the address its store gives, and that change MUST be released as a major one ([SDK-FR-015](spec-sdk.md#sdk-fr-015)).
- <a id="core-fr-215"></a>**CORE-FR-215**: Every value the engine works with MUST be written one way, holding its data and the rules that belong to it, with nothing exported beside the values — the layout of the store `cw` keeps and the layout of the output each one value — so that a contributor finds each rule beside the value it is about.
- <a id="core-fr-216"></a>**CORE-FR-216**: How the engine's values are written MUST NOT change what the command line, the portal or the published package answer; a name the published package exports MUST change only as [SDK-FR-015](spec-sdk.md#sdk-fr-015) versions it.
- <a id="core-fr-217"></a>**CORE-FR-217**: Setting the engine up, and what it asks of its stores, MUST NOT carry a repository's address, nor where in the repository the workspace or an agent's folders keep anything; the repository's address MUST be given only to the store that keeps its files, once, when that store is set up.
- <a id="core-fr-218"></a>**CORE-FR-218**: Setting the engine up MUST NOT carry the developer's home: the store of the sessions MUST find a repository's sessions from that repository's address and the home, and MUST name where it read them for the review to say.
- <a id="core-fr-219"></a>**CORE-FR-219**: Every step of the engine MUST speak of a charter in the same terms, so that whatever one step finds reaches the next, and an integrator's store or projection, as the engine holds it, never as a second shape made for one step.
- <a id="core-fr-220"></a>**CORE-FR-220**: A build MUST compile a charter into one output that names no place it lands: each item of the output — the listing, CHARTER.md, a compiled primitive, the mcp origins, the sensors — known by its path inside the output and found by what it is, with its text and its assets; a link from one entry to another MUST be written from the output's root, for the projection to write from where its file lands ([CORE-FR-221](#core-fr-221)); an entry for one agent alone MUST name that agent in its path.
- <a id="core-fr-221"></a>**CORE-FR-221**: Where each entry of a build lands — in the compiled output and in each agent's own folders — which files an agent reads, and the links in them MUST be decided by that agent's projection, which an integrator MAY replace, so that adding an agent changes nothing else; every path a build writes MUST read from where its file lands — a document's from its own folder, any other file's from the repository's root — and no placeholder MUST be left on disk; laid by `cw`'s own projections, each agent's folders MUST be what a build wrote before, byte for byte.
- <a id="core-fr-222"></a>**CORE-FR-222**: The engine MUST hold two parts of work apart: keeping, testing and building a charter — authoring its primitives, vendors, test cases and eval cases, signing in to its mcp origins, testing it, and building it onto each agent the repository chose, with its preview, its health check, the estimated main context and the tools its mcp origins serve; and running what was built — its sensors, the calls forwarded to its mcp origins, its evaluations, the exact count of the main context, and the agents' sessions and the log. What running needs of the charter — its mcp origins, the sensors of a signal, a build into a working copy — MUST be asked of the first part.
- <a id="core-fr-223"></a>**CORE-FR-223**: What the engine answers a caller — the command line, the portal or an integrator's code — MUST be made for that caller, never the engine's own account of the charter; what the engine hands an adapter an integrator may replace ([SDK-FR-020](spec-sdk.md#sdk-fr-020)) MUST be part of the published contract, and changing it MUST be a major release.
- <a id="core-fr-224"></a>**CORE-FR-224**: In the store `cw` keeps, a repository's workspace MUST hold three parts: the charter, with its primitives, by kind, its tests, its eval cases and its vendors under it, in `.cw/charter/`; the compiled output, in `.cw/out/`; and the log, in `.cw/log/`. The settings MUST be kept apart from all three, in `.cw/settings.json`.
- <a id="core-fr-225"></a>**CORE-FR-225**: The log MUST hold what `cw` writes beside the compiled output — each evaluation's working copy and what an evaluation run leaves — and version control MUST ignore it.
- <a id="core-fr-226"></a>**CORE-FR-226**: Over the store `cw` keeps, every command, the health check included, MUST refuse a repository laid out the old way, and adding or updating a vendor source laid out the old way MUST be refused, installing nothing; each refusal MUST say the layout is the old one and name the authoring skill.
- <a id="core-fr-227"></a>**CORE-FR-227**: The authoring skill MUST lead the agent to move a repository laid out the old way to the new layout, keeping every file's contents, after which the build MUST be what it was before the move.
- <a id="core-fr-228"></a>**CORE-FR-228**: The charter's primitives, vendors, test cases and eval cases MUST be kept by one store; the log and the agents' sessions by stores of running's own; every store and every runner MUST be apart from the engine's two parts, which MUST hold none; the package MUST compose the engine's own stores and runners in for every one an integrator does not hand, and MUST export them for an integrator to extend ([CORE-FR-230](#core-fr-230), [SDK-FR-020](spec-sdk.md#sdk-fr-020)).
- <a id="core-fr-229"></a>**CORE-FR-229**: Running MUST reach authoring only through what that part offers its callers, in answers made for that, never authoring's own account of the charter; authoring MUST ask nothing of running.
- <a id="core-fr-230"></a>**CORE-FR-230**: Where the engine is composed, every adapter — each agent's projection and command line, the store that keeps the charter, every other store and runner — MUST be handed as one set, the engine's adapters, each the engine's own or written anew, and an adapter not handed MUST be the engine's own; the engine itself MUST NOT be replaced. Through the package, an integrator MAY hand any of them ([SDK-FR-020](spec-sdk.md#sdk-fr-020)).
- <a id="core-fr-231"></a>**CORE-FR-231**: Which agents a repository chose, and its other settings, MUST be kept apart — by the settings store `cw` keeps, in `.cw/settings.json` — and read, and a repository set up, apart from authoring and from running, which MUST neither read nor write them; whoever composes the engine MUST hand them on.
- <a id="core-fr-232"></a>**CORE-FR-232**: Every operation a driver port offers MUST be named verb first, for what it acts on; no operation MUST be named by a bare verb or by a noun alone.
- <a id="core-fr-233"></a>**CORE-FR-233**: Running a signal's sensors MUST be told the agent they run for, or that none is named; the engine MUST NOT assume one, and runs for none named as [CORE-FR-234](#core-fr-234) says.
- <a id="core-fr-234"></a>**CORE-FR-234**: `cw sensor run <signal>` with an agent named with `--agent` MUST run the sensors of that signal kept for no agent and those kept for that agent; with no agent named, it MUST run only those kept for no agent, and MUST NOT take any agent by default.

### Key Entities

- **Primitive**: In the store `cw` keeps, a folder `<kind>/<id>` whose `index.md` holds its headers and its body, and whose every other file is an asset, the unit everything else operates on.
- **Kind**: One of a closed set of categories, deciding the required fields, the activation rule and, in the store `cw` keeps, the directory.
- **Kind requirement**: What a kind says it requires — a header, and the shape that header takes. Declared once, where the kind's contract is, and answerable to whoever asks.
- **Header answer**: One name and one value, given at a prompt by a person or as a flag by an agent. The same answer either way.
- **Mixin**: A primitive whose purpose is to be pulled into others, written once and reused.
- **Charter**: The charter of a repository: its primitives, by kind, of every layer; and kept beside them under its folder, its tests, its eval cases and its vendors, none of which is a primitive of it ([CORE-FR-224](#core-fr-224)). What is measured or compiled of the charter is its primitives alone.
- **Agent**: The coding agent a charter is built for, such as Claude Code or Codex: what reads the compiled output, offers the user commands, runs the hooks and calls the tools. Each agent has its projection, the adapter that lays the compiled output where that agent reads it. A primitive of the `agent` kind is an agent primitive, and the agent's subagent once built.
- **Log**: What `cw` writes beside the compiled output, in `.cw/log/`, which version control ignores: each evaluation's working copy and what its run leaves ([CORE-FR-225](#core-fr-225)). The sessions are never part of it.
- **Layer**: Where a primitive came from — this repository, one vendor source it installed, or the running engine itself.
- **Builtin layer**: The part of the charter the running engine itself brings. It is supplied on every read rather than kept anywhere in the repository, and is read, checked and compiled exactly as the other two layers are. Installed from nothing, removable by nothing, and never out of date.
- **`cw-author`**: The primitive the builtin layer brings: what a coding agent reads when it is about to author a primitive here.
- **Vendor source**: Charter content installed whole from a pinned git source.
- **Catalogue**: The one listing of every primitive: its kind, id, description, the files it applies to, and the file it is opened at.
- **Compiled output**: The instruction surfaces generated from the charter for the agent to read.
- **Engine**: What compiles a charter and applies it, the one the command line, the portal and the package are surfaces of.
- **Workspace**: Where a repository keeps what the engine reads and writes: the charter, the compiled output and the log, with the settings apart.
- **Local output**: The store that lays the compiled output, and each agent's files written from it, onto a checkout of the repository, and plans what laying it would change.
- **Compiled primitive**: One primitive as an agent opens it: its headers and the whole of its body, its mixins' included, written into the compiled output whichever layer it came from.
- **Explanation**: What the engine says about one id: its file and layer, when it comes up, what it pulls in, what names it, and which cases pin it down.
- **Warning**: A fault that is worth saying and not worth stopping on. Validation raises five of them ([CORE-FR-014](#core-fr-014)).
- **Portal**: The graphical interface over one repository's charter, served on the developer's own machine for as long as its command runs. Holds no state about the charter of its own.
- **View**: One of the portal's pages — the repository layer, the vendor layer, the tests, a search, an explanation, a health report, a build result. Each is read from the engine when it is shown.
- **Draft**: The answers and body an author has typed for a primitive not yet saved. The only thing the portal holds that the engine has not been told, and gone when it is saved or cancelled.
- **Package**: What one release publishes to the registry: the runnable program, the library an integrator composes the engine from, the portal's page, the README and the license, under one version.
- **Release**: One version of the package, published once, never replaced, and tagged at the commit it was built from.
- **MCP primitive**: One mcp origin, where knowledge is kept outside the repository — an MCP server's address, the path inside it, the ways to sign in and the tools the agent may use — under an id that does not change when the address does.
- **MCP origin**: One address and path, as the list of mcp origins holds it: every id declaring it, from every layer, and the ways it is signed in to; its tools are what those ids declare between them.
- **Credential**: What one developer signed in to one address with. Theirs alone, kept by their operating system, never in the repository.
- **Script**: Files the agent or a sensor runs, kept in the charter as a primitive whose assets they are; its `index.md` says which one runs and how it is called.
- **Template**: A file the agent fills or copies, kept in the charter as a primitive and compiled like one: its body is the file.
- **Asset**: A file kept in a primitive's folder beside its `index.md`, at any depth, reached from its body as `./<file>`, and copied beside its compiled document by a build.
- **Built file**: What a build writes for each asset of a primitive: a copy beside its compiled document, in the compiled output, where everything that names it points.
- **Flow**: One branch holding one charter. A convention of the product and of a later application; carries no meaning inside the engine, the command line or the portal.
- **Skills repository**: A git repository publishing skills the way `npx skills add` reads them — each a folder holding a `SKILL.md` — rather than as a charter.
- **Taken skill**: A skill converted from a skills repository into a skill primitive, kept read-only in that source's vendor folder.
- **Source of many charters**: A source gathering charters under `charters/`, one folder each named by the charter, each picked on its own.
- **Injected primitive**: A primitive taken from a source into the repository's own charter; from then on the repository's, with nothing recording where it came from.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- <a id="core-sc-001"></a>**CORE-SC-001**: A developer with an existing repository goes from no charter to a governed repository — set up, first rule authored, agent reading it — in under five minutes.
- <a id="core-sc-002"></a>**CORE-SC-002**: Creating a correctly-shaped primitive of any kind takes one command and requires no reference to documentation for which fields are mandatory.
- <a id="core-sc-003"></a>**CORE-SC-003**: 100% of validation failures name the offending file and the specific problem; none report only that something is wrong.
- <a id="core-sc-004"></a>**CORE-SC-004**: The catalogue and the compiled output cannot disagree: no sequence of supported commands produces one without the other.
- <a id="core-sc-005"></a>**CORE-SC-005**: An agent surveying what the charter contains reads one listing holding 0 primitive bodies before opening anything: the listing grows with the number of primitives, never with what they say.
- <a id="core-sc-006"></a>**CORE-SC-006**: Any id can be traced in one command to the single file that declares it, and any collision names both files that claim it.
- <a id="core-sc-007"></a>**CORE-SC-007**: In 100% of pipeline runs, the health check fails when committed compiled output differs from the authored charter by one file or more, and the build's line of the health check passes when it differs by none.
- <a id="core-sc-009"></a>**CORE-SC-009**: Adopting a team's shared governance in a new repository takes one command.
- <a id="core-sc-010"></a>**CORE-SC-010**: A command reads each primitive's file once, however many of validation, compilation and testing it performs.
- <a id="core-sc-011"></a>**CORE-SC-011**: The entire setup runs unattended from supplied values, with no interactive prompt required.
- <a id="core-sc-012"></a>**CORE-SC-012**: A developer goes from running the portal command to reading their charter in under ten seconds, for a charter of two hundred primitives.
- <a id="core-sc-013"></a>**CORE-SC-013**: A developer who has never read the charter format creates a valid primitive of any kind from the portal on the first attempt, without opening documentation.
- <a id="core-sc-014"></a>**CORE-SC-014**: For every repository state, the portal's health report and `cw doctor` name the same faults, and the portal's build preview and `cw build --preview` list the same targets.
- <a id="core-sc-015"></a>**CORE-SC-015**: 100% of what the portal can do can also be done from the command line.
- <a id="core-sc-016"></a>**CORE-SC-016**: No save from the portal overwrites a change made on disk after the file was opened.
- <a id="core-sc-017"></a>**CORE-SC-017**: With the network disconnected, every portal capability but vendor installation works, the body editor included.
- <a id="core-sc-018"></a>**CORE-SC-018**: Any primitive can be traced from the portal, in one step, to its file, its layer, what makes it come up and every test case that pins it down.
- <a id="core-sc-019"></a>**CORE-SC-019**: A coding agent with no terminal attached authors a valid primitive of any kind, on the first attempt, having read nothing but what the engine answered it.
- <a id="core-sc-020"></a>**CORE-SC-020**: The shipped skill's body names zero header names and zero kinds' requirements, and stays correct when a kind's requirements change without it being edited.
- <a id="core-sc-021"></a>**CORE-SC-021**: Upgrading `cw` changes what an agent is told about a kind with 0 rebuilds, 0 migrations and 0 files to refresh.
- <a id="core-sc-022"></a>**CORE-SC-022**: For every answer a kind refuses, the flag path and the prompt path refuse it in the same words.
- <a id="core-sc-023"></a>**CORE-SC-023**: For every set of answers, the flag path and the prompt path write the same file.
- <a id="core-sc-024"></a>**CORE-SC-024**: A repository set up and built from scratch has the authoring skill on its agent's surface with no command run beyond set-up and build, and with nothing added under its workspace to put it there.
- <a id="core-sc-025"></a>**CORE-SC-025**: 100% of what the agent can do here can also be done from the command line by a person, and the reverse: the flags answer exactly the prompts.
- <a id="core-sc-026"></a>**CORE-SC-026**: Every user story is delivered as one reviewable change, leaving the repository building and passing its tests. No cap is set on how many lines that change touches.
- <a id="core-sc-027"></a>**CORE-SC-027**: A developer with only the supported runtime and git goes from nothing installed to `cw --help` with one command, in under one minute on an ordinary connection.
- <a id="core-sc-028"></a>**CORE-SC-028**: For the same repository, 100% of commands answer the same from the published package as from a source build.
- <a id="core-sc-029"></a>**CORE-SC-029**: Installing `cw` adds under 20 MB to the machine.
- <a id="core-sc-030"></a>**CORE-SC-030**: No version is ever published whose tests failed, or whose package failed to set a fresh repository up and build it.
- <a id="core-sc-031"></a>**CORE-SC-031**: Any published version is traced to the one commit it was built from in one step, and any running `cw` names its version in one command.
- <a id="core-sc-032"></a>**CORE-SC-032**: A maintainer publishes a release with one action, and a refused release leaves the registry and the repository as they were.
- <a id="core-sc-033"></a>**CORE-SC-033**: Every file the catalogue names opens, and holds everything its primitive says with its mixins, for 100% of primitives, the engine's own included.
- <a id="core-sc-034"></a>**CORE-SC-034**: A developer cloning a repository whose charter declares mcp origins at N addresses reaches all of them from their agent after one command and at most N sign-ins, with one MCP entry in their agent's configuration.
- <a id="core-sc-035"></a>**CORE-SC-035**: 100% of calls reaching an mcp origin are made under the credential of the developer whose agent made them; none is made under a credential shared between developers.
- <a id="core-sc-036"></a>**CORE-SC-036**: No credential appears in any file under the repository, in the compiled output, or in anything `cw` prints.
- <a id="core-sc-037"></a>**CORE-SC-037**: An agent is shown zero tools its charter did not declare, and a subagent zero tools of an mcp origin its `tools` does not list.
- <a id="core-sc-038"></a>**CORE-SC-038**: Moving an mcp origin to a new address changes one file of the charter; no primitive naming the mcp origin changes.
- <a id="core-sc-039"></a>**CORE-SC-039**: An mcp origin that is down or not signed in to leaves 100% of other mcp origins' tools listed and answering.
- <a id="core-sc-040"></a>**CORE-SC-040**: No author writes a path to a script or a template in a primitive: it is named by id, and every link and command the compiled output holds for it is written by the build, for 100% of them.
- <a id="core-sc-041"></a>**CORE-SC-041**: Every link a compiled document holds to another primitive opens from that document, and every command written for a script runs from the repository's root, for 100% of them, after any rename and one build.
- <a id="core-sc-042"></a>**CORE-SC-042**: A change to a script's files never runs before a build: 100% of commands and paths written for a script name its copy in the compiled output.
- <a id="core-sc-043"></a>**CORE-SC-043**: In the store `cw` keeps the charter in, every primitive of every layer is a folder holding its `index.md` at `<kind>/<id>/`, and every `./<file>` its body names opens from its compiled document as it does from its `index.md`, for 100% of them.
- <a id="core-sc-044"></a>**CORE-SC-044**: A user invokes 100% of a charter's skills and playbooks by the id their author wrote, with no kind in front.
- <a id="core-sc-045"></a>**CORE-SC-045**: An author writes no kind in front of any name: 100% of the references a charter holds are an id, bare or as `[[<id>]]`.
- <a id="core-sc-046"></a>**CORE-SC-046**: A user is offered as commands 0 of the skills and playbooks marked `disable-user-invocation: true`, and the agent opens 100% of them as it did before they were marked.
- <a id="core-sc-047"></a>**CORE-SC-047**: A developer reads, in an agent's settings file, 1 command for each signal the charter's sensors name, and 0 sensor commands written out there.
- <a id="core-sc-048"></a>**CORE-SC-048**: In 100% of the cases where a charter's sensors were built one hook each, the agent blocks, shows and adds to its context the same when they are built one command per signal.
- <a id="core-sc-049"></a>**CORE-SC-049**: A developer takes a skill from a skills repository into the charter with 1 command and 0 files written by hand.
- <a id="core-sc-050"></a>**CORE-SC-050**: Of the skills and playbooks marked `disable-model-invocation: true`, the agent opens 0 by itself, and the user is offered 100% as commands.
- <a id="core-sc-051"></a>**CORE-SC-051**: 100% of the sources whose repositories share a name under different owners install side by side.
- <a id="core-sc-052"></a>**CORE-SC-052**: A developer installs 1 of the charters a source gathers with 1 command, and 0 of the others arrive.
- <a id="core-sc-053"></a>**CORE-SC-053**: A developer starts a primitive of their own from someone else's skill or charter with 1 command and 0 files copied or ids renamed by hand.
- <a id="core-sc-054"></a>**CORE-SC-054**: In a folder with no version control, a developer sets up, authors, builds, installs a vendor and removes it with 100% of the commands they use in a git repository, and 0 others.
- <a id="core-sc-056"></a>**CORE-SC-056**: 0 bytes of a binary asset differ between a primitive's folder and any copy the engine makes of it.
- <a id="core-sc-057"></a>**CORE-SC-057**: Every acceptance scenario and edge case in the spec set cites at least one requirement that answers it, and 100% of functional requirements are cited by a story proving their behaviour.
- <a id="core-sc-058"></a>**CORE-SC-058**: The architecture review finds 0 conflicts between applicable architecture guides and 0 violations in the components changed to align them, with 100% of existing use-case behaviour tests passing.
- <a id="core-sc-059"></a>**CORE-SC-059**: Through a store of an integrator's own, 0 layers, kinds, vendors or suite names are read off where a file sits, with 100% of existing behaviour tests passing.
- <a id="core-sc-060"></a>**CORE-SC-060**: The architecture review finds 100% of the rules about a value of the engine written with that value, and 0 functions or constants exported beside the values, with 100% of existing behaviour tests passing and the published package's exports changed only as [SDK-FR-015](spec-sdk.md#sdk-fr-015) versions them.
- <a id="core-sc-061"></a>**CORE-SC-061**: The architecture review finds 0 repository or home addresses in what the engine is set up with or asks its stores, with 100% of existing behaviour tests passing and every `cw` command answering at a `file:` address as before.
- <a id="core-sc-062"></a>**CORE-SC-062**: Through a store of a test's own that keeps no path, 100% of the use cases answer as they do over the files, and 100% of existing behaviour tests pass.
- <a id="core-sc-063"></a>**CORE-SC-063**: A build laid onto a repository leaves every agent's folders the same, byte for byte, as before, and the compiled output the same but for its paths, written from where each file lands, in 100% of the existing build tests.
- <a id="core-sc-064"></a>**CORE-SC-064**: 100% of the command-line and portal behaviour tests pass with the engine's work held in its two parts, and 0 of what a caller is answered is the engine's own account of the charter.
- <a id="core-sc-065"></a>**CORE-SC-065**: In a repository laid out the old way, 100% of commands refuse naming the authoring skill; after the agent follows it, the build is the same, byte for byte, as before the move.
- <a id="core-sc-066"></a>**CORE-SC-066**: The architecture review finds 0 stores or runners in the engine's two parts, 1 store keeping the charter's primitives, vendors, test cases and eval cases, 0 of authoring's own account reaching running, and 0 parts but the settings' own reading the settings, with 100% of the command-line and portal behaviour tests passing as before.
- <a id="core-sc-067"></a>**CORE-SC-067**: The architecture review of the whole engine, the portal page included, finds 0 breaches of the naming and fault guides, and the guides name 0 types or operations the code does not hold.
- <a id="core-sc-068"></a>**CORE-SC-068**: 0 scenarios of `Done` stories whose behaviour can be run are proven only by matching the source's text.
- <a id="core-sc-069"></a>**CORE-SC-069**: Across every spec, 0 terms name two things and 0 things carry two terms.
- <a id="core-sc-070"></a>**CORE-SC-070**: 0 scenarios of `Done` stories are held by no test and by no run their evidence names, and 0 tests assert the opposite of the scenario they are labelled with.

## Assumptions

- **Setting the engine up with no address changes the published contract.** The release carrying it is a major one ([SDK-FR-015](spec-sdk.md#sdk-fr-015)).
- **Work is delivered one story at a time.** Each user story is built and reviewed as one change ([CORE-SC-026](#core-sc-026)): the story is the unit a reviewer can test on its own, so it is also the unit that is reviewed and merged. Its steps are not reviewed apart. The change must leave the repository working — it builds, its tests pass.
- **From [CORE Story 55](#core-story-55---quality-cross-check-of-sdk-story-8-core-story-53-sdk-story-10-core-story-56-eval-story-9-priority-p3) on, what a quality pass finds is repaired, never handed on as new stories.** Before it, each violation became a story of its own, as [CORE Story 39](#core-story-39---quality-cross-check-of-core-story-35-core-story-37-core-story-38-sdk-story-1-priority-p3) and [CORE Story 43](#core-story-43---quality-cross-check-of-core-story-40-core-story-41-sdk-story-5-core-story-42-sdk-story-6-priority-p3) did. Since, a cross-check story repairs what its own pass finds within itself and runs the pass again, as [CORE Story 55](#core-story-55---quality-cross-check-of-sdk-story-8-core-story-53-sdk-story-10-core-story-56-eval-story-9-priority-p3) did; a pass run on request is repaired by a fix of its own, run again until it passes.
- **Users are developers.** The command line is the product surface, not an implementation detail. The portal drives these same commands and adds no behaviour of its own.
- **Implementation is a standalone runtime with no compiled or native dependency**, distributed so that a single install command makes `cw` available. Chosen so the portal and the engine ship as one artifact.
- **The portal is a page served on the developer's machine by a `cw` command**, not a separate desktop application. The engine and the interface are one artifact, installed with one command; a local page keeps that, and needs nothing but a browser.
- **The portal is a second way into the engine beside the command line.** That is why every engine capability it needs is added to the engine first, and why the command line gets it in the same change.
- **One developer, one machine.** The portal is not shared over a network and has no accounts, as the product has none.
- **The reference design is keystone** (github.com/tacoda/keystone) for the primitive kinds, their field contracts and the vendored-content installation flow, and *Harness Engineering* by Ian Johnson for the concentric layers and the reliability levers. Neither is a runtime or build dependency; this is an independent implementation. Where keystone splits catalogue generation and compilation into two commands that repeat the same work, this product deliberately merges them.
- **Three kinds in the reference design are deliberately not adopted**: the external-callable declaration, the governed-output-document kind, and the reusable-documentation-pattern kind. The reference's own charter never exercises the document graph — no primitive in it declares a producing or consuming relationship — so nothing proven is lost. For this product specifically, the lifecycle of a work item (its state, its gates, its board) belongs to a later application, and expressing it a second time in the charter would duplicate it. The producing and consuming relationships on a unit of work are dropped alongside the document kind, since their referent is gone, and so are the lifecycle phase and the explicit done-condition: the reference declares neither, and a skill reaches an agent through the one line it describes itself with, which is all that agent reads before loading it — a phase it has no field for is a header nothing carries.
- **The five warnings are validation warnings, not portal features.** A primitive no case pins down is limited to guides and sensors because those are the only kinds a case names ([CORE-FR-082](#core-fr-082)); a posture is asserted only through whether a file is allowed, which names none. All five are warnings and never errors.
- **Self-regression tests assert activation, not behaviour.** A test pins which rules apply to a described situation, which is what catches the common failure of a rule quietly going dead after a glob or cascade change. It deliberately does not run a check's command or ask an agent for a judgement: the first needs a live environment and would break the reader/writer split, and the second is non-deterministic, so a suite built on it becomes flaky and then gets ignored. Both may be added later once there are real checks to exercise.
- **Sensors are fired by the agent, and run by `cw`.** A check that runs a command and a check that asks an agent for a judgement are both declared in the charter and compiled into the agent's activation surface. Deciding when a signal fires is the agent's; it hands the event to `cw sensor run <signal> --agent <agent>`, which runs that signal's sensors and hands one answer back ([CORE-FR-176](#core-fr-176)). Outside evaluation, this system does not execute agent work ([EVAL-FR-021](spec-eval.md#eval-fr-021)).
- **Two files defining the same id are reported as a collision**, in whichever layers they sit, rather than resolved by an implicit rule, because any silent winner would be arbitrary.
- **Reasoning citations that do not resolve are reported but do not block the build**, so a charter under construction stays usable.
- **The first agent supported in full is Claude Code**, with the agent-neutral target always available alongside it. Other agents are additive and do not change the charter format.
- **There is no machine-local layer.** The reference design puts a personal scope inside the repository scope, but compiled output is committed, so merging a developer's machine-local rules into it would make one repository behave differently for each developer — the exact failure the layered model exists to prevent. No part of the charter resolves from a developer's home directory; what is read there is the developer's own — their sessions and credentials ([CORE-FR-218](#core-fr-218)).
- **Flows are never represented in this system.** Their branches, their work-item prefixes, their merge behaviour and their session handling all belong to a later application.
- **Kind and id are fixed once a primitive exists.** Renaming is creating a primitive under the new id and deleting the old one. A rename that rewrote everything naming the old id would be the portal changing primitives and tests nobody asked it to touch.
- **A new test file is named for the author to rename.** The engine picks a free name and writes one sample case; the author renames the file by hand if the name matters. A name chosen at creation would be one more question for a file whose content is the point.
- **Flags mean no prompting, for the whole run.** A run that answers some headers as flags and is asked for the rest would hang wherever there is nobody to ask, which is every run agent authoring is for. One header flag makes the run a non-interactive one, and a missing header is a refusal rather than a question.
- **The builtin layer is the engine's, and is not a folder.** It is supplied on every read and kept nowhere in the repository. A folder would be a copy: something to refresh, to go stale, to be hand-edited, to report drift about, and to restore. What makes it visible instead is that everything already showing the charter shows it — `cw list`, `cw explain`, the catalogue and the portal all name the layer it came from — and that it compiles to the same surface every other skill compiles to.
- **What the builtin layer is checked against is what every primitive's file is checked against.** It reaches the charter by the one reading every primitive goes through, so a kind's contract holds over it, a collision over it is the usual collision, and no fault a primitive's file would raise is skipped because the engine happened to supply it.
- **A builtin primitive has no file to point at.** Everything that names a primitive's file names this one as the engine's own rather than as a path in the repository, because there is no path to open. The name still says which layer it came from, which is what a path says everywhere else.
- **A repository that wants to differ authors its own primitive.** As with a vendored primitive ([CORE Story 6](#core-story-6---author-edit-and-delete-a-primitive-without-looking-anything-up-priority-p2)): it does not edit what it does not own, it writes something under an id of its own.
- **The id `cw-author` is spoken for**, in every repository, the way any installed id is. A repository that had authored a primitive under it will see the collision the engine always reports, and renames its own.
- **Only creating is covered for the agent.** Changing a primitive that exists, and deleting one, are left to the person and the portal. An agent that rewrites a rule it did not author is a larger question than the shape of a file.
- **Versions follow semantic versioning, starting at 0.1.0.** A version below 1.0 says the charter format and the commands may still change between minor versions. A published version is never replaced or taken back; a fix is a new version.
- **The command is `cw` whatever the package is called.** An unrelated package already holds the name `cw` on the registry, so users install this one by its package name, and the command it puts on the path is still `cw`.
- **Any package manager that reads the public registry installs it.** npm, pnpm and yarn all read the same registry, so no manager is favoured and none is required; the README shows npm, which every runtime install brings.
- **The supported runtime is the one the engine already requires**, and the supported platforms are macOS and Linux, where the engine is built and tested. Windows is not promised until it is tested.
- **The browser the portal's tests drive is a contributor's dependency.** A user needs only their own browser to open the portal; nothing downloads one for them.
- **The maintainer's registry account, its second factor and the rights to the package name are held outside the product.** A release uses them; it does not create or manage them.
- **A rationale is where the knowledge model stops.** A guide says the rule, a corpus says why in the repository, and an `mcp` primitive says where the rest of why is kept. No concept layer — labels, synonyms, broader and related terms — is added until a pilot shows an agent looking in the wrong mcp origin without one.
- **An mcp origin is a server on the network or a process on the developer's machine.** A server on the network is signed in to the way the protocol says, by OAuth or a bearer token. A local process has no such way: each reads its token from an environment variable of its own naming, so the primitive names it, and `token` is the only way to sign in. The process runs as the developer, with the command installed by them.
- **Signing in is to an address, not to an id.** One address is one account at one service, so one sign-in serves every mcp origin declared there. Which of that service's repositories or pages the agent reaches is decided by the service, under the developer's own access; a path narrows what the agent is told to look at, not what the service lets it read.
- **Signing in to an mcp origin is not an account of `cw`.** `cw` still has no accounts and no sign-in of its own; it keeps what the developer signed in to someone else's service with, on their machine, for their agent.
- **A credential is the developer's machine's, and is not a layer.** It is kept outside the repository in the operating system's store, so no file of the repository differs between developers — the reason there is no machine-local layer still holds.
- **The server forwards; it does not run an agent.** `cw mcp serve` is started by the agent and answers its calls. Deciding what to call stays the agent's.
- **A job run with nobody watching signs in as itself.** A scheduled run uses an account made for it at each mcp origin — a bot or an app — signed in once on the machine that runs it, so the mcp origin still records who called.
- **The engine already knows what a kind requires.** Asking a kind and answering with flags add no capability to the engine: what a kind requires is answered at `cw add`'s prompts, and `cw add` writes the file. Agent authoring is two new ways of asking and one primitive.
- **A script or a template is a primitive, not a file inside a skill.** Giving each an id puts it under everything the charter already does — listing, search, explanation, collisions, vendoring, warnings — and lets two skills share one. A skill is still a folder of its own assets ([CORE-FR-168](#core-fr-168)); a script it runs is a primitive it names.
- **In the store `cw` keeps, a primitive is a folder whose `index.md` holds its headers.** Every primitive is read by one reading ([CORE-FR-009](#core-fr-009)) against its kind's contract, so a script keeps its id, description and the file it runs in that `index.md` like any other. What runs is kept as files of their own language beside it, which every editor, linter and shell already knows how to read; a template's body is the file to fill, compiled like any body. A binary file among those assets is copied whole ([CORE-FR-207](#core-fr-207)).
- **A command is written from the repository's root, a link from the document holding it.** An agent runs commands from the root, so a path there reads one way everywhere. A link is followed by whoever is reading the document, and only a path from that document opens for them.
- **A name nothing holds stops the build, for an mcp origin as for a script or a template.** An agent sent to a file that does not exist may write the script itself, or find one with a similar name and assume it is the one meant, then run it; sent to an mcp origin that does not exist, it looks for the knowledge somewhere else. Nobody reviewed what it runs, and nothing in the output says it guessed. Refusing the build at the name that does not resolve is the only point where the mistake is caught before anything runs.
- **`cw` runs a script only as a sensor's command.** Running one any other way is the agent's, when its skill says to ([CORE-FR-030](#core-fr-030)); `cw sensor run` runs a sensor's built command, and the scripts it names with it ([CORE-FR-176](#core-fr-176)).
- **`cw` is found where the agent runs its hooks**, as it is where the agent starts `cw mcp serve`.
- **What runs is a copy.** A script's files are copied into the compiled output by a build, and every command names the copy. An edit in progress in the charter is therefore never what a sensor fires, and what runs is what the last preview showed.
- **In the store `cw` keeps, a primitive is a folder.** What a primitive says lives in its `index.md`, and what it needs beside it — a checklist, a sample, the files a script runs — lives beside it, reached as `./<file>` from the charter and from the output alike. Stopping at the first `index.md` going down keeps one reading of any folder.
- **A skill is taken as it is published.** Its body is not rewritten: a name it gives another skill in prose stays prose, not a reference, and the build does not check that the other skill is there.
- Git available on the machine, to reach a vendor source; and a git repository with a commit, to evaluate the charter. A git repository is recommended everywhere else, for reviewing what changes and for undoing it, and required nowhere else.
- A network path to the vendor source's git server when installing or updating vendored content. Everything else works offline, but what reaches an mcp origin or runs an agent ([CORE-FR-209](#core-fr-209)).
- An installed coding agent for the compiled output to be consumed. Authoring, validation, cataloguing and the agent-neutral compilation all work without one.
- A web browser on the developer's machine, for the portal.
- The public npm registry, reachable when `cw` is installed or upgraded, and a maintainer account holding publish rights for the package name, for a release.
- For knowledge reached through MCP: each mcp origin's MCP server reachable over the network, or its command installed on the developer's machine; an account of the developer's own at each; and the operating system's credential store — the macOS keychain, or a Secret Service store on Linux.

## Out of Scope

- A dependency injection framework: the adapters are handed to the engine where it is composed.
- A later application beyond the portal that runs or shows agent sessions, a terminal or a work-item board, and anything such an application stores for itself.
- Flows in any form: any representation of them inside the system, a view per flow, a flow per branch, colours or grouping by flow. A flow is a branch holding a charter; the system never learns the mapping.
- Any account system, sign-in, licensing or payment of `cw`'s own. There is no login to `cw` and no cost; users bring their own agent subscription, and sign in to other services with their own accounts ([CORE-FR-148](#core-fr-148)).
- Installing one directory of a charter source rather than the whole of it. A skills repository is taken skill by skill, and a source of many charters charter by charter.
- Running agent sessions, managing worktrees, or executing the work loop, outside evaluation ([EVAL-FR-021](spec-eval.md#eval-fr-021), [CORE-FR-206](#core-fr-206)). The product declares and compiles the standards; the agent applies them.
- More than one repository in one portal, and reaching the portal from another machine.
- Setting a repository up from the portal. `cw init` does that.
- Renaming a primitive, or changing its kind, in place. Renaming a test file.
- A standing build status outside the health check.
- Committing, branching or any other version-control operation beyond what reaching a source and evaluating ask.
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
- Publishing from CI, and the registry provenance that only a CI publish can attach.
- A gateway: a server holding one credential that many developers' agents reach mcp origins through.
- Forwarding anything of an MCP server but its tools: its resources, prompts and requests back to the agent.
- Installing a local server's command for the developer, or handing a local process anything but its one token variable beyond the environment `cw` runs in.
- A concept layer over the charter: labels, synonyms, broader and related terms, and a tool to look them up.
- Changing which tools are shown while the server runs, as a session moves from one primitive to another.
- A posture deciding which tools exist. A posture still decides whether a call needs approval.
- Signing in from the portal, or showing who is signed in there.
- Injecting from the portal. `cw vendor inject` does it.
- Bringing an injected primitive up to date from its source, or telling it has drifted from it.
- Picking single primitives out of a charter, to install or to inject. A charter is taken whole.
- Replacing a script or a template with a loose file inside a skill. A skill is a folder of its `index.md` and its assets; a script or a template it uses is a primitive of its own, named by id.
- Running a script, or filling a template, on the agent's behalf, other than a sensor's command run by `cw sensor run`. No placeholder in a template is filled by the build.
- A template whose body is not text. A binary file kept as an asset of a primitive, a script's files included, is copied whole.
- Copying a script or a template into an agent's own skill folder. There is one built copy, in the compiled output, and every name of it points there.
- Keeping any kind but a skill or a playbook from the agent. A skill or a playbook is kept from the agent with `disable-model-invocation: true`; `disable-user-invocation` only decides whether the user is offered it as a command.
- Marking a vendor's skills as steps from this repository: a vendor marks its own.
- Highlighting a template's body in the portal by its language, and editing the files of a script's folder in the portal: they are written in an editor.
- A time limit of a sensor's own: the sensors of a signal run within the one the agent gives that signal's command.
- Firing a sensor on anything narrower than its signal, such as one tool: a sensor still names only its signal.
- Removing one taken skill from its source folder; the whole folder is removed as any vendor source is.
- Taking anything of a skills repository but its skills: agents, rules or hooks written for another agent.
- Writing a charter skill back out as a `SKILL.md`.
- Searching or browsing skills repositories.
- Asking which skills to take, at the terminal or in the portal: `--skill` names them, and the portal takes every one.
- Recording the sensors' runs or the sessions' analyses in the log.
- Reading a repository or a vendor source laid out the old way, and moving it without the agent.
- Changing a primitive's headers, its body or the rules it is validated by while a repository laid out the old way is moved.
