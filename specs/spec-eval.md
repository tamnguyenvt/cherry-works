# Spec: Eval — what a charter costs and whether it works

**Created**: 2026-10-04

**Updated**: 2026-10-04

**Input**: User description: "Phase 008, after Uber's efficient software factory: predict how many tokens the charter loads into the agent's main context; give the tokens a session used when it stops; let `cw mcp serve` search its tools rather than load them all; evaluate the charter against a real model with promptfoo and deepeval."

Then: "The summary of the sessions kept spans 31 days at most, the last 31 when none is named, and reads only the files that span needs."

## Overview

A charter is paid for in tokens every turn an agent works under it, and it is only worth that price if the agent does what it says. This part lets the people who write and use a charter see both sides. An author learns, before anyone runs an agent, how much of the agent's main context the charter takes and which primitives take the most. A developer is told, when their agent stops, how many tokens the session has used. The places a charter reaches stop costing context for every tool they declare, by being searched rather than listed. And an author can put the charter in front of the real agent and a real model, and learn whether the right skill is invoked and a guide is followed, and what each case cost.

## Clarifications

### Session 2026-10-02

- Q: How is the charter evaluated against a real model? → A: By a command of its own, apart from the self-regression tests, which stay deterministic and offline ([CORE-FR-084](spec-core.md#core-fr-084)).
- Q: promptfoo, deepeval, or both? → A: Both.
- Q: What does an evaluation check? → A: That the right skill is invoked for a prompt, that a guide is followed, and what each case cost in tokens.
- Q: Claude Code already defers MCP tool schemas on its own; still give `cw mcp serve` a tool search? → A: Yes, so a host without one gains it too.

### Session 2026-10-03

- Q: How is the main-context prediction counted, with no offline Claude tokenizer? → A: Estimated offline by default, said to be an estimate; counted exactly through the model provider's token count when asked to and a key is at hand.
- Q: Where is the prediction said, and is there a ceiling? → A: A command of its own lists it per primitive, largest first; a build says the total; the portal shows it; the health check warns above a ceiling the repository sets, 20,000 tokens when it sets none.
- Q: How is a session's token use said when the agent stops, and is it kept? → A: Said to the developer only when the session crosses a mark, every 100,000 tokens by default, in one line the model is not sent; every stop is also kept as one line of a log on the developer's machine, never committed. Subagents are counted in.
- Q: When does `cw mcp serve` search its tools rather than list them, and how does a found tool appear? → A: On its own once the declared tools' schemas pass a ceiling, 5,000 tokens by default; below it every tool is listed as before; the repository can hold it always on or always off. A found tool joins the list under the name it always had, so a subagent's hold on its tools ([CORE-FR-156](spec-core.md#core-fr-156)) still means what it says.
- Q: What does an evaluation run against? → A: The real agent, run headless in a copy of the repository with its charter built; one case file runs by the engine alone, or under promptfoo or deepeval when one is named, on the developer's own key; a model judges what is said in words.

### Session 2026-10-04

- Q: What does the main-context prediction count? → A: What the agent loads when a session opens, before anything is asked: the charter's always-loaded instructions, every guide that names no files in full, the name and description of each skill, playbook and subagent, and the tools `cw mcp serve` lists. A guide that names files is listed apart, as loaded when a file it names is touched, and is neither added to the total nor held to the ceiling.
- Q: Where do evaluation cases live, and who writes them? → A: The repository writes them, in a folder of their own beside its tests, one file of cases each; a case puts a prompt to the agent and expects a skill invoked, a guide followed (judged by a model), and at most a number of tokens where it names one. They are not primitives, and a vendor's are not installed with it: a vendor evaluates itself in its own repository.
- Q: When does an evaluation run fail? → A: Each case runs once, and a case that does not meet what it expects fails the run through its exit status; the report says each case's outcome and the tokens it used, and the run's total.
- Q: How does a developer read the sessions kept? → A: A command sums the log up by day and by session, in tokens, the largest first, narrowed to a span of time when asked; a session is counted once, at the last stop it was kept at.
- Q: Where do the prices a cost is reckoned at come from? → A: The engine counts tokens only and prices nothing. What tokens cost is a skill's to work out: a skill the engine brings analyses the kept log, at prices the developer types in or that it fetches, at the time, from the model provider's published price list.
- Q: Does an evaluation need a framework to run? → A: No: the engine runs the cases itself ([EVAL Story 6](#eval-story-6---evaluate-the-charter-against-the-real-agent-priority-p3)); promptfoo or deepeval, named when the command is run, runs the same cases there too ([EVAL-FR-027](#eval-fr-027)).
- Q: Is an exact count made through a model provider key? → A: No: through the agent's own command line, run headless, which needs no key of its own; without that command line installed, an exact count is refused, saying the estimate needs nothing.
- Q: How is the estimate made offline? → A: By a tokenizer that runs offline, said to be an estimate, rather than by text length.
- Q: Does the main-context prediction count the tools the one server lists? → A: Not until the server lists its search tool ([EVAL Story 5](#eval-story-5---search-tools-rather-than-load-them-all-into-context-priority-p2)); from then on, that tool is counted ([EVAL-FR-029](#eval-fr-029)).
- Q: How far back does the summary of the sessions kept reach? → A: At most 31 days: the last 31, today among them, when no span is named; 31 from the day named, or up to it, when only one end is; a longer span is refused. Only the sessions kept within the span are read, however long the log has grown ([EVAL-FR-030](#eval-fr-030), [EVAL-SC-007](#eval-sc-007)).

## User Scenarios & Testing *(mandatory)*

### EVAL Story 1 - See what the charter loads into the agent's context (Priority: P1)

**Status**: Done

An author adds a guide with no files named, and three skills with long descriptions. Before this, nothing said what that cost: the agent paid for it every turn and nobody saw it. After this, one command lists, before any agent runs, how many tokens each primitive puts into the agent's main context when a session opens, the largest first, and the total, said to be an estimate. A guide that names files is listed apart, as loaded only when a file it names is touched. A build says the total in one line, the portal shows the same list, and the health check warns once the total passes the repository's ceiling.

**Why this priority**: Every other saving in this part is measured against this number. It costs nothing to run, needs no key, and an author acts on it the same day.

**Independent Test**: In a repository whose charter holds an always-on guide, a guide naming files, a skill and a subagent, run the command; confirm each is listed with its tokens, the largest first, the guide naming files apart and outside the total, and the total said to be an estimate. Set the ceiling below the total and confirm the health check warns, naming the total and the ceiling.

**Acceptance Scenarios**:

1. **Given** a charter, **When** the developer asks for the prediction, **Then** every primitive that puts anything into the main context when a session opens is listed with its tokens, the largest first, with the total, said to be an estimate ([EVAL-FR-001](#eval-fr-001), [EVAL-FR-002](#eval-fr-002)).
2. **Given** a guide that names files, **When** the prediction is listed, **Then** it is listed apart, as loaded when a file it names is touched, and is not in the total ([EVAL-FR-003](#eval-fr-003)).
3. **Given** the agent's own command line installed and the developer asking for an exact count, **When** the prediction is listed, **Then** each number is counted through it and said to be exact ([EVAL-FR-004](#eval-fr-004)).
4. **Given** a build, **When** it finishes, **Then** it says the predicted total in one line ([EVAL-FR-005](#eval-fr-005)).
5. **Given** a total above the repository's ceiling, or above 20,000 tokens where it set none, **When** the developer runs the health check, **Then** it warns, naming the total and the ceiling ([EVAL-FR-006](#eval-fr-006)).
6. **Given** the portal, **When** the developer opens the charter, **Then** it shows the same list and total the command gives ([EVAL-FR-007](#eval-fr-007)).

---

### EVAL Story 2 - Be told what a session has used when the agent stops (Priority: P1)

**Status**: Done

A developer works with their agent for an afternoon. Before this, how many tokens the session had used was something they found out at the end of the month. After this, each time the agent stops the session's tokens are counted, its subagents' included, and kept as one line of a log on the developer's machine. When the session crosses a mark — every 100,000 tokens unless the repository sets another — the developer reads one line saying so; the model is never sent it, so being told costs nothing.

**Why this priority**: It is the number a developer acts on while they work: start a new session, hand work to a subagent, stop reading a large file whole. It needs no key and no network.

**Independent Test**: Build a charter for the agent, run a session past 100,000 tokens, and confirm one line was shown when it crossed the mark and none before; confirm the log holds one line per stop, with the subagents' tokens counted in, and that nothing under the repository changed.

**Acceptance Scenarios**:

1. **Given** a built charter, **When** the agent stops, **Then** the session's tokens so far, by kind and with its subagents', are kept as one line of a log on the developer's machine, outside the repository ([EVAL-FR-008](#eval-fr-008), [EVAL-FR-009](#eval-fr-009)).
2. **Given** a session crossing a mark, **When** the agent stops, **Then** the developer is shown one line with the session's tokens, and the model is sent nothing ([EVAL-FR-010](#eval-fr-010)).
3. **Given** a session below its next mark, **When** the agent stops, **Then** nothing is shown ([EVAL-FR-010](#eval-fr-010)).
4. **Given** a session the agent's own record of cannot be read, **When** the agent stops, **Then** nothing is shown or kept and the agent stops as it would have ([EVAL-FR-011](#eval-fr-011)).

---

### EVAL Story 3 - Read back the sessions kept (Priority: P2)

**Status**: Done

A developer wants to know where last week went. One command sums the log up by day and by session, in tokens, the largest first, over a span of at most 31 days: the last 31 unless they name another. A session is counted once, at the last stop it was kept at, and only the sessions kept within the span are read, however long the log has grown.

**Why this priority**: The log is only worth keeping if it is read; this is the one way to read it that needs no reading of the file.

**Independent Test**: With a log holding several stops of three sessions over two days, run the command; confirm each session appears once, at its last stop, under its day, the largest first, and that a span leaves out what falls outside it, unread. Name a span longer than 31 days and confirm it is refused.

**Acceptance Scenarios**:

1. **Given** a log of several sessions, **When** the developer asks for the summary, **Then** each day and each session in it is listed with its tokens, the largest first, each session counted once at its last stop ([EVAL-FR-012](#eval-fr-012)).
2. **Given** a span of time, **When** the developer asks for the summary, **Then** only the sessions within it are counted, and none outside it is read ([EVAL-FR-012](#eval-fr-012), [EVAL-SC-007](#eval-sc-007)).
3. **Given** no log yet, **When** the developer asks for the summary, **Then** it says none was kept and how one starts ([EVAL-FR-013](#eval-fr-013)).
4. **Given** no span named, **When** the developer asks for the summary, **Then** the last 31 days are summed up, today among them ([EVAL-FR-030](#eval-fr-030)).
5. **Given** a span longer than 31 days, **When** the developer asks for the summary, **Then** it is refused before anything is read, saying how long a span may be ([EVAL-FR-030](#eval-fr-030)).

---

### EVAL Story 4 - Ask what the sessions cost (Priority: P2)

**Status**: Todo

The developer asks their agent what last week cost. A skill the engine brings reads the kept sessions through the summary, asks whether to use prices they type in or the model provider's published prices as they stand today, fetches those when asked, and answers what each session and each day cost, saying which prices it used and when they were read.

**Why this priority**: Money is what a team decides on, but prices change and differ by agreement; keeping them out of the engine keeps every number it gives true, and leaves the reckoning to a skill that can ask.

**Independent Test**: With a log of two sessions, invoke the skill; give it prices, and confirm each session's cost is those prices times its tokens, and that the answer names the prices used. Invoke it again asking for published prices, and confirm it says where it read them and when.

**Acceptance Scenarios**:

1. **Given** a log and prices the developer types in, **When** they invoke the skill, **Then** it answers each session's and each day's cost at those prices, naming them ([EVAL-FR-014](#eval-fr-014)).
2. **Given** a log and a request for published prices, **When** they invoke the skill, **Then** it reads the model provider's price list, says where and when, and answers at those prices ([EVAL-FR-014](#eval-fr-014)).
3. **Given** a session of a model no price is known for, **When** costs are answered, **Then** its tokens are given and its cost is said to be unknown, never guessed ([EVAL-FR-015](#eval-fr-015)).

---

### EVAL Story 5 - Search tools rather than load them all into context (Priority: P2)

**Status**: Todo

A charter declares four places with sixty tools between them. Before this, the agent was sent every tool's schema at the start of each session, used or not. After this, once those schemas pass a ceiling — 5,000 tokens unless the repository sets another — the one server lists a single tool that searches the others, and a tool found joins the list under the name it always had. Below the ceiling, every tool is listed as before. A repository can hold searching always on or always off.

**Why this priority**: It is the largest share of the main context in a charter that reaches many places, and a host that does not defer schemas itself gains it too.

**Independent Test**: Declare places whose tools pass the ceiling; start the server, and confirm only the search tool is listed, that a search names matching tools, and that one found is then listed and answers under its usual name. Declare fewer and confirm every tool is listed. Hold searching off and confirm every tool is listed past the ceiling.

**Acceptance Scenarios**:

1. **Given** declared tools whose schemas pass the ceiling, **When** the server starts, **Then** it lists the search tool alone ([EVAL-FR-016](#eval-fr-016)).
2. **Given** a search, **When** it is answered, **Then** the matching tools are named with what each does, and each one found is listed from then on under the name it always had ([EVAL-FR-017](#eval-fr-017)).
3. **Given** declared tools below the ceiling, **When** the server starts, **Then** every tool is listed, as before ([EVAL-FR-016](#eval-fr-016)).
4. **Given** the repository holding searching always on, or always off, **When** the server starts, **Then** it searches, or lists every tool, whatever the schemas weigh ([EVAL-FR-018](#eval-fr-018)).
5. **Given** a subagent holding only some of a place's tools, **When** it searches, **Then** it finds only those ([EVAL-FR-019](#eval-fr-019), [CORE-FR-156](spec-core.md#core-fr-156)).
6. **Given** the server listing its search tool, **When** the developer asks for the main-context prediction, **Then** the search tool is listed with its tokens and counted in the total ([EVAL-FR-029](#eval-fr-029)).

---

### EVAL Story 6 - Evaluate the charter against the real agent (Priority: P3)

**Status**: Todo

An author wants to know that asking the agent to "plan this feature" invokes the planning skill, and that the agent follows the naming guide when it writes code. They write cases — a prompt, the skill expected, the guide expected followed — in a file of their own beside their tests, and run one command on their own key. Each case puts its prompt to the real agent, run headless in a copy of the repository with its charter built; whether a skill was invoked is read off what the agent did, and whether a guide was followed is judged by a model. The report says each case's outcome and the tokens it used, and the run's total; a case that does not meet what it expects fails the run.

**Why this priority**: It is the one way to show a charter changes what the agent does, but it costs a key and real tokens, so it comes after what saves them.

**Independent Test**: Write two cases, one whose skill the charter invokes and one whose skill it does not; run the command; confirm the first passes, the second fails naming what the agent did instead, the run fails, each case's tokens are given, and the repository itself was not changed.

**Acceptance Scenarios**:

1. **Given** a case expecting a skill, **When** the run puts its prompt to the agent, **Then** it passes when the agent invoked that skill and fails otherwise, saying which it invoked ([EVAL-FR-020](#eval-fr-020), [EVAL-FR-022](#eval-fr-022)).
2. **Given** a case expecting a guide followed, **When** the run puts its prompt, **Then** a model judges what the agent did against that guide, and the case passes or fails with the judge's reason ([EVAL-FR-023](#eval-fr-023)).
3. **Given** a case naming a number of tokens, **When** the agent uses more, **Then** the case fails, saying how many it used ([EVAL-FR-024](#eval-fr-024)).
4. **Given** any run, **When** it ends, **Then** each case's outcome and tokens and the run's total are reported, and a failed case fails the run through its exit status ([EVAL-FR-025](#eval-fr-025)).
5. **Given** a run, **When** it ends, **Then** the repository it ran from holds nothing it did not hold before ([EVAL-FR-021](#eval-fr-021)).
6. **Given** no key at hand, **When** the developer runs it, **Then** it is refused before any case runs, saying what it needs ([EVAL-FR-026](#eval-fr-026)).

---

### EVAL Story 7 - Run the evaluation under an evaluation framework (Priority: P3)

**Status**: Todo

The engine runs the cases itself ([EVAL Story 6](#eval-story-6---evaluate-the-charter-against-the-real-agent-priority-p3)). A team that already reads its evaluations through an evaluation framework — its dashboards, its history, its comparisons between runs — wants this charter's cases there too. The same case file runs under either of two frameworks, named when the command is run; each case comes out as the engine's own run says, and is reported in the same shape.

**Why this priority**: The engine's own run already answers whether the charter works; a framework adds where the answer is kept and compared, and must not make an author write a case twice.

**Independent Test**: Run one case file by the engine alone and under each framework against the same charter, and confirm each case comes out the same and is reported the same way.

**Acceptance Scenarios**:

1. **Given** one case file, **When** the developer runs it naming either framework, **Then** it runs unchanged, and each case is reported in the shape the engine's own run reports it ([EVAL-FR-027](#eval-fr-027)).
2. **Given** a framework not installed, **When** the developer names it, **Then** the run is refused before any case runs, saying how to install it ([EVAL-FR-028](#eval-fr-028)).

---

### Edge Cases

- A charter holding nothing loaded when a session opens — the prediction says the total is none, and the health check is quiet.
- A guide naming files that every file in the repository matches — it is still listed apart: what is predicted is what the host loads, not what it is likely to.
- An exact count asked for with the agent's command line not installed — the prediction is refused, saying the estimate needs nothing ([EVAL-FR-004](#eval-fr-004)).
- The agent's own record of a session changes shape between versions of the agent — the stop is let through untouched, and nothing is kept for it ([EVAL-FR-011](#eval-fr-011)).
- A span named by one end only — 31 days from the day named, or up to it ([EVAL-FR-030](#eval-fr-030)).
- A session the developer closes without the agent stopping — what was kept at its last stop is what the summary counts.
- Two sessions stopping at once — each is kept as its own line, and neither is lost ([EVAL-FR-009](#eval-fr-009)).
- A place that is down when the server starts — its tools are weighed and searched as declared; calling one says the place is down, as before.
- A case whose prompt leads the agent to ask a question back — the case fails, saying the agent asked rather than acted ([EVAL-FR-022](#eval-fr-022)).
- A case naming a skill or a guide the charter does not hold — the run is refused before any case runs, naming it.

## Requirements *(mandatory)*

### Functional Requirements

**The main context**

- <a id="eval-fr-001"></a>**EVAL-FR-001**: The engine MUST predict, without running an agent, the tokens each primitive puts into the agent's main context when a session opens: the charter's always-loaded instructions, every guide that names no files in full, and the name and description of each skill, playbook and subagent.
- <a id="eval-fr-002"></a>**EVAL-FR-002**: The prediction MUST be listed per primitive, the largest first, with the total, and MUST say it is an estimate unless it was counted exactly.
- <a id="eval-fr-003"></a>**EVAL-FR-003**: A guide that names files MUST be listed apart, as loaded when a file it names is touched, and MUST NOT be added to the total or held to the ceiling.
- <a id="eval-fr-004"></a>**EVAL-FR-004**: Asked to, and with the agent's own command line installed, the engine MUST count the prediction exactly through it, run headless, and say so; asked to without it, it MUST refuse, saying the estimate needs nothing.
- <a id="eval-fr-005"></a>**EVAL-FR-005**: A build MUST say the predicted total in one line.
- <a id="eval-fr-006"></a>**EVAL-FR-006**: The health check MUST warn when the predicted total passes the ceiling the repository sets, or 20,000 tokens where it sets none, naming both.
- <a id="eval-fr-007"></a>**EVAL-FR-007**: The portal MUST show the prediction the command lists, as the command lists it.

**A session's tokens**

- <a id="eval-fr-008"></a>**EVAL-FR-008**: A built charter MUST count, each time the agent stops, the session's tokens so far by kind — input, output, written to and read from the cache — its subagents' included, read off the agent's own record of the session.
- <a id="eval-fr-009"></a>**EVAL-FR-009**: Each stop MUST be kept as one line of a log on the developer's machine, outside every repository, naming the session, the repository, the model and the time; it MUST never be committed or sent anywhere.
- <a id="eval-fr-010"></a>**EVAL-FR-010**: When a session crosses a mark, every 100,000 tokens unless the repository sets another, the developer MUST be shown one line with its tokens; the model MUST NOT be sent it, and below the next mark nothing MUST be shown.
- <a id="eval-fr-011"></a>**EVAL-FR-011**: A session whose record cannot be read MUST be let stop as it would have, with nothing shown and nothing kept.
- <a id="eval-fr-012"></a>**EVAL-FR-012**: The engine MUST sum the log up by day and by session, in tokens, the largest first, each session counted once at the last stop it was kept at, over a span of time of at most 31 days, reading only the sessions kept within it.
- <a id="eval-fr-030"></a>**EVAL-FR-030**: The summary's span MUST be the last 31 days, today among them, when none is named, and 31 days from or up to the one end named; a span longer than 31 days MUST be refused, saying how long one may be.
- <a id="eval-fr-013"></a>**EVAL-FR-013**: With no log kept, the summary MUST say so and how one starts.

**What a session costs**

- <a id="eval-fr-014"></a>**EVAL-FR-014**: The engine MUST bring a skill that answers what the kept sessions cost, per session and per day, at prices the developer types in or at the model provider's published prices read when asked, naming the prices used and where and when they were read. The engine itself MUST price nothing.
- <a id="eval-fr-015"></a>**EVAL-FR-015**: A session of a model no price is known for MUST be answered with its tokens and its cost said to be unknown.

**A place's tools**

- <a id="eval-fr-016"></a>**EVAL-FR-016**: The one server MUST list a single tool that searches the declared tools when their schemas pass a ceiling, 5,000 tokens unless the repository sets another, and every tool otherwise.
- <a id="eval-fr-017"></a>**EVAL-FR-017**: A search MUST name each matching tool with what it does, and a tool found MUST be listed from then on under the name it always had.
- <a id="eval-fr-018"></a>**EVAL-FR-018**: A repository MUST be able to hold searching always on or always off, whatever the schemas weigh.
- <a id="eval-fr-019"></a>**EVAL-FR-019**: A search MUST find only the tools the one searching may call ([CORE-FR-156](spec-core.md#core-fr-156)).
- <a id="eval-fr-029"></a>**EVAL-FR-029**: Once the one server lists its search tool, the main-context prediction MUST count that tool ([EVAL-FR-001](#eval-fr-001)).

**Evaluating the charter**

- <a id="eval-fr-020"></a>**EVAL-FR-020**: The engine MUST run the evaluation cases a repository writes, in a folder of their own beside its tests, one file of cases each, by a command apart from the self-regression tests ([CORE-FR-084](spec-core.md#core-fr-084)). Evaluation cases are not primitives, and a vendor's are not installed with it.
- <a id="eval-fr-021"></a>**EVAL-FR-021**: Each case MUST put its prompt to the real agent, run headless in a copy of the repository with its charter built, once; the repository run from MUST be left as it was.
- <a id="eval-fr-022"></a>**EVAL-FR-022**: A case expecting a skill MUST pass when the agent invoked it and fail otherwise, saying what was invoked instead, or that the agent asked a question rather than acted.
- <a id="eval-fr-023"></a>**EVAL-FR-023**: A case expecting a guide followed MUST be judged by a model against that guide, passing or failing with the judge's reason.
- <a id="eval-fr-024"></a>**EVAL-FR-024**: A case naming a number of tokens MUST fail when the agent used more, saying how many.
- <a id="eval-fr-025"></a>**EVAL-FR-025**: A run MUST report each case's outcome and tokens and the run's total, and MUST fail through its exit status when any case fails.
- <a id="eval-fr-026"></a>**EVAL-FR-026**: A run MUST be refused before any case runs when no key is at hand, or when a case names a skill or a guide the charter does not hold, saying which.
- <a id="eval-fr-027"></a>**EVAL-FR-027**: One case file MUST also run unchanged under either of two evaluation frameworks, named when the command is run, each case reported in the shape the engine's own run reports it.
- <a id="eval-fr-028"></a>**EVAL-FR-028**: Naming a framework that is not installed MUST be refused before any case runs, saying how to install it.

### Key Entities

- **Prediction**: what each primitive puts into the main context when a session opens, in tokens, estimated or exact, and their total.
- **Session line**: one stop of one session — when, which repository and model, and its tokens by kind so far, its subagents' included.
- **Evaluation case**: a prompt, and what is expected of the agent given it: a skill invoked, a guide followed, at most a number of tokens.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- <a id="eval-sc-001"></a>**EVAL-SC-001**: An author learns the main-context total of their charter, and its five largest primitives, in one command and under 5 seconds, with no key and no network.
- <a id="eval-sc-002"></a>**EVAL-SC-002**: An exact count and the estimate of one charter differ by no more than 15%.
- <a id="eval-sc-003"></a>**EVAL-SC-003**: Being told a session's tokens adds zero tokens to what the model is sent.
- <a id="eval-sc-004"></a>**EVAL-SC-004**: Counting a session at a stop adds less than half a second to that stop.
- <a id="eval-sc-005"></a>**EVAL-SC-005**: A charter whose places declare tools past the ceiling sends the agent at least 80% fewer tokens of tool schemas when a session opens.
- <a id="eval-sc-006"></a>**EVAL-SC-006**: An author writes each evaluation case once, and it runs by the engine alone and under either framework with the same outcome.
- <a id="eval-sc-007"></a>**EVAL-SC-007**: Summing up the sessions reads none kept outside the span, so it takes no longer after a year of sessions than after a month.

## Assumptions

- **Claude Code is the agent counted and evaluated.** It is the one host the engine builds for; another host is counted the day it is built for.
- **The estimate is offline.** No tokenizer for the model is at hand offline, so a tokenizer that runs offline stands in for it, and says it does.
- **A developer's log is theirs.** It lives on their machine, where the engine already keeps their credentials, and is never read by anyone else.
- **An evaluation spends the developer's own key.** Nothing in the engine pays for it or holds a key of its own.

## Out of Scope

- A view of many developers' sessions together, or sending a session's tokens anywhere.
- Stopping or slowing a session that passes a mark.
- Pricing anything inside the engine.
- Running evaluations in a pipeline on anyone's behalf, or more than once per case.
- Evaluating a host other than Claude Code.
