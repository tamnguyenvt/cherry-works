<!-- CHERRYWORKS START -->
## Charter

Read and follow [.cw/out/CHARTER.md](./.cw/out/CHARTER.md) before working here. Edit the primitives under `.cw/charter/`, then run `cw build`; generated files are not edited by hand.

Find primitives in [catalogue.json](./.cw/out/catalogue.json) and [catalogue.codex.json](./.cw/out/catalogue.codex.json).

### Guides

- When touching a file matching "src/**": Read and follow .cw/out/guide/architecture-map/index.md.

#### name-like-the-files-before-it — every turn

Source: [.cw/out/guide/name-like-the-files-before-it/index.md](./.cw/out/guide/name-like-the-files-before-it/index.md).

Before writing a file that does what other files here already do — a command,
a route, a migration, an adapter, a test — open two or three of them and
follow them: the same file name pattern, the same exported names, the same
constant and option names, the same order. A name that is the same job in
every file is the same word in every file.

For example, if every command declares its options in a constant named
`OPTIONS`, a new command does too — never `BUILDING`, `LISTING` or
`SESSIONS_COMMAND_OPTIONS`, and no type alias of its own:

```ts
const OPTIONS = {
  since: { type: "string", describe: "…" },
} as const satisfies OptionSpec;

export class SessionsCommand implements Command<typeof OPTIONS> {
  readonly options = OPTIONS;
}
```

Where the files before it disagree, follow the most recent ones and say so.
Rename the others only when asked.

**Why:** the file already says whose things they are; a name invented per file
says nothing more, and makes every file read differently, so a reader can no
longer move from one to the next by the same names.

#### no-arbitrary-function-split — every turn

Source: [.cw/out/guide/no-arbitrary-function-split/index.md](./.cw/out/guide/no-arbitrary-function-split/index.md).

Don't name a function with just a verb or the past tense of a verb. When you
want to, most of the time the code belongs inline in the parent function.

Never split a function into many smaller ones that nothing else reuses. It is
the big function that gets reused; the smaller pieces are only the logic inside
it.

A function's name must be tied to a piece of business logic. If it is not,
write the code inline or use a library, and where a helper is unavoidable, put
it in the closest `helper.ts`.

#### no-single-word-naming — every turn

Source: [.cw/out/guide/no-single-word-naming/index.md](./.cw/out/guide/no-single-word-naming/index.md).

A variable's name is **context + type**: the type of the value it holds, as
the last word, led by what that value is in this place.

| Holds | Name | Not |
|---|---|---|
| a `PlanSummary` from `previewPlan()` | `planSummary` | `done`, `result` |
| a `Primitive` known to be an mcp | `mcpPrimitive` | `named`, `mcp` |
| a `Primitive` an `[[<id>]]` points to | `referencedPrimitive` | `mentioned`, `found` |
| the id written in `rationale` | `rationaleId` | `cited` |
| a `Map` of primitives keyed by id | `primitiveById` | `byIdentity`, `map` |
| a `Set` of ids | `referencedIds` | `ids2`, `seen` |
| one id while looping over `mixins` | `mixinId` | `namedMixin`, `usedMixins` |
| a yes/no | `isStale`, `hasGlobs` | `stale`, `check` |

- **Type, last.** The noun of the type in camelCase: `Primitive` is
  `…Primitive`, a string id is `…Id`, a list or set is the plural of its
  element, a map is `<value>By<key>`.
- **Context, first.** Add the word that says what this value is *here* —
  which kind, which header, which side — whenever the type alone could mean
  more than one thing in the function. Leave it off when the type is
  unambiguous: `const primitive = …` in a loop over primitives.
- **One element, singular.** A loop variable names one element, never the
  collection.
- **Never** a single vague word (`it`, `one`, `data`, `item`, `result`,
  `known`), or a past participle on its own (`named`, `mentioned`, `cited`,
  `found`, `written`, `merged`, `done`): those say how the value was reached,
  not what it is.
- **Functions** follow the same rule for what they return:
  `primitiveIdOf()` returns a primitive's id, `catalogueOf()` a `Catalogue`.

Only rename code you are already touching.

- When touching a file matching "CHANGELOG.md": Read and follow .cw/out/guide/write-changelog/index.md.

#### write-changelog

Applies only to repository paths matching: "CHANGELOG.md".

Source: [.cw/out/guide/write-changelog/index.md](./.cw/out/guide/write-changelog/index.md).

Write each entry of `CHANGELOG.md` as one short plain sentence that a user of
what this repository ships understands. No spec ids, no internals, no long
upgrade essays.

Mark an entry **Breaking:** only when a user must edit something they wrote —
their config, their code, their content — and say the fix in the same line. A
change that a rebuild, a reinstall or a migration applies on its own is not
breaking: write it as a plain entry that says what to run.

- When touching a file matching "src/hexagon/port/zdriven/**": Read and follow .cw/out/guide/driven-port-speaks-its-adapter/index.md.

- When touching a file matching "src/**", "main.ts", "main.js": Read and follow .cw/out/guide/hexagonal-architecture/index.md.

#### hexagonal-architecture

Applies only to repository paths matching: "src/**", "main.ts", "main.js".

Source: [.cw/out/guide/hexagonal-architecture/index.md](./.cw/out/guide/hexagonal-architecture/index.md).

This codebase is hexagonal (ports and adapters). Before writing a new class,
file or function, find its place below and extend what is already there.
`<pm> run lint:deps` (dependency-cruiser, `.dependency-cruiser.cjs`) enforces
the import rules; run it after any change that adds an import.

## Layers

- `src/driver/` calls in: one folder per entry point (`cli/`, `http/`,
  `mcp/`, a UI). It parses input, calls a driver port, renders the answer. It
  decides nothing.
- `src/hexagon/` decides. It imports nothing outside itself — no `node:*`, no
  adapter, no SDK — except the value libraries named in `HEXAGON_LIBRARIES` of
  `.dependency-cruiser.cjs`.
- `src/zdriven/` is called out to: one adapter per driven port (disk, DB, HTTP
  API, clock, queue), each with an `InMemory*` twin used by tests.
- `main.ts` / `main.js` is the composition root, the one place that names
  concrete classes. Each binding is declared as its port type, not as the class.

## Inside `src/hexagon/`

- `port/driver/` — use-case interfaces, `For<Doing>` (`ForManagingOrders`),
  and `dtos/`, the zod schemas of what crosses them (`DataDTOs`, `OutcomeDTOs`,
  each DTO `{ type, data }` — see [hexagonal-naming](./.cw/out/guide/hexagonal-naming/index.md)). A driver port answers DTOs, never
  a model; it re-exports every type a driver needs, so a driver imports
  nothing else of the hexagon.
- `port/zdriven/` — driven ports, `For<Doing>` (`ForReadingFiles`,
  `ForSendingMail`), named in the adapter's own words — see
  [`driven-port-speaks-its-adapter`](./.cw/out/guide/driven-port-speaks-its-adapter/index.md). Faults and types an adapter needs
  are exported here; the adapters' faults live in `AdapterFault.ts`.
- `application/` — one class per driver port implementing it. A use case
  orchestrates: it reads through services or driven ports, asks the domain to
  decide, turns the result — a fault included — into DTOs with the makers in
  `application/dtos.ts`. It stays light: a
  rule found here belongs in the domain, and logic that grows belongs in a
  service.
- `service/` — the logic a use case follows when it is more than a few
  calls: reading and writing through driven ports, turning what an adapter
  speaks into domain values, stringing several models together. One service
  is reused by every use case that follows the same logic. It is an object
  of functions, holding no state and never constructed: a use case hands it
  the ports a call needs, so only ports are wired in the composition root.
- `domain/models/` — pure values and rules. No port, no service, no DTO, no
  I/O: whatever a rule needs, it is handed. `DomainFault.ts` here is the base
  of every fault.
- `domain/services/` — pure logic over several models.

## Ports in JavaScript

TypeScript ports are `interface`s. In JavaScript a port is a JSDoc
`@typedef` in its own file under `port/`, which exports nothing at runtime
(`export {};`); an implementation says `@implements {ForSomething}`, and a
binding in `main.js` is typed `/** @type {import("…").ForSomething} */`.
`checkJs` in `jsconfig.json` makes `<pm> run typecheck` hold every
implementation to its port, and `detectJSDocImports` makes dependency-cruiser
count those `import("…")` types as imports — so the rules below bind them too.
Never turn `checkJs` off to make a change pass.

## What may import what

| from | may import |
|---|---|
| `driver/**` | `hexagon/port/driver/**`, `hexagon/application/**`, its own folder |
| `zdriven/**` | `hexagon/port/zdriven/**`, its own folder |
| `hexagon/**` | `hexagon/**` and `HEXAGON_LIBRARIES` only |
| `hexagon/domain/**` | `hexagon/domain/**` only |
| `hexagon/domain/**`, `hexagon/service/**` | never `hexagon/port/driver/**` |
| `hexagon/port/driver/dtos/**` | other DTOs and the schema library |
| `main.ts` / `main.js` | everything |

A driving adapter and a driven adapter never import each other; no cycles.

## Extend, don't add

- **New use case:** a method on the driver port that already holds the
  conversation, or a new `For<Doing>` port when it is a different one; its
  implementation in the matching `application/` class; its rules in `domain/`.
- **New outside thing** (a table, an API, a file, the time): a driven port in
  `port/zdriven/`, the real adapter and an `InMemory*` one in `zdriven/`, wired
  in the composition root. Never call it straight from the hexagon.
- **New entry point:** `driver/<name>/` calling existing driver ports, wired
  in the composition root. Anything one driver can do, another reaches through the same
  port.
- **New rule:** in `domain/`, tested with plain values.

## Rules

- Never loosen `.dependency-cruiser.cjs` to make a change pass. A violation
  means the code is in the wrong layer; move it, or add the export to the port.
- Adding a library to `HEXAGON_LIBRARIES` is a decision for the user, not a fix.
- Tests drive the real use case through its driver port over `InMemory*`
  adapters. No mock of anything inside the hexagon.
- A use case that only reads holds no writing port.
- Name every part as [hexagonal-naming](./.cw/out/guide/hexagonal-naming/index.md) says, and raise a `…Fault` from
  its layer's fault file, never an `Error`.

- When touching a file matching "src/**", "main.ts", "main.js": Read and follow .cw/out/guide/hexagonal-naming/index.md.

#### hexagonal-naming

Applies only to repository paths matching: "src/**", "main.ts", "main.js".

Source: [.cw/out/guide/hexagonal-naming/index.md](./.cw/out/guide/hexagonal-naming/index.md).

Every part of a hexagon is named by the role it plays, so a name says which
layer a file is in before it is opened. Where it lives is
[hexagonal-architecture](./.cw/out/guide/hexagonal-architecture/index.md)'s to say; what it is called is said here.

## Names by part

| Part | Where | Named | Example |
|---|---|---|---|
| Driver port | `port/driver/` | `For<Doing>`, the conversation it holds | `ForSigningIn` |
| Use case | `application/` | its driver port as a noun, without `For` | `SigningIn.ts` implements `ForSigningIn` |
| Service | `service/` | verb first, `Service` last | `FindSignedInPersonService` |
| Model | `domain/models/` | what it is in the business | `SignInMethod` |
| Domain service | `domain/services/` | what it works out, over several models | `RateCalculator` |
| DTO | `port/driver/dtos/data.ts` | `dto("<Model>", …)`, read as `DataDTOs.<Model>` | `DataDTOs.Session`, `DataDTOs.Fault` |
| Outcome DTO | `port/driver/dtos/outcome.ts` | `dto("<Doing>Outcome", …)`, read as `OutcomeDTOs.<Doing>Outcome` | `OutcomeDTOs.DoctorOutcome` |
| DTO maker | `application/dtos.ts` | the DTO it makes | `sessionDTO()`, `faultDTO()` |
| Driven port | `port/zdriven/` | `For<Doing>`, in the adapter's words — see [driven-port-speaks-its-adapter](./.cw/out/guide/driven-port-speaks-its-adapter/index.md) | `ForVerifyingSessionTokens` |
| Driven adapter | `zdriven/` | the technology it speaks, then what it holds; its twin `InMemory<Port noun>` | `ClerkSessionTokens`, `InMemorySessionTokens` |
| Driving adapter | `driver/<entry point>/` | what it serves, in that entry point's words | `GreetCommand`, `cloudApi` |
| Fault | beside its base, below | `<What is wrong>Fault`, never `Error` | `IdentityServiceUnreachableFault` |

## A use case, and the service behind it

A use case reads like the story it serves: a few calls, a decision asked of
the domain, a DTO handed back. When the logic behind it grows — strings
several models together, or is followed by more than one use case — it moves
into a service, named for what it does (`FindSignedInPersonService`,
`TransferMoneyService`), and every use case that needs it calls the same
service. A use case stays light enough to read in one go; a service is where
logic is reused.

A service is logic and nothing else: an object of functions, holding no
state, never constructed and never wired in the composition root. A use case
holds the ports it was given and hands a service the ones a call needs —
`LogService.logFault(this.#logs, fault)` — so only ports are injected, and a
service is read as plainly as a domain function.

## Functions

- **Named for what it returns** — `signInMethodOf()`, `rateOf()` — only in
  `domain/models/`, where a function is a fact about a value, and in
  `application/dtos.ts`, where a function is the DTO it makes:
  `sessionDTO()`, `faultDTO()`.
- **Verb first everywhere else** — use cases, services, adapters, drivers:
  `findSessionTokenHolder()`, `getBearerToken()`, `loadOrder()`. Never a
  bare verb (`run`, `execute`, `handle`): the verb says what, the noun says
  what of.

## DTOs

What crosses a driver port is a DTO, written as cherry-works writes them, in
`port/driver/dtos/`:

- `dto.ts` — `dto(type, data)`, the one way a DTO is made: a zod schema of
  `{ type, data }`, `type` the model's name as a literal; and `byType()`,
  which keys a set of schemas by the `type` each carries.
- `data.ts` — one `<Model>Schema = dto("<Model>", z.object({ … }))` per
  model, each with a line saying what it holds; a DTO inside another is its
  schema (`person: PersonSchema.nullable()`). They are gathered as
  `export const DataDTOs = byType(…)`, in alphabetical order, with
  `export namespace DataDTOs { export type <Model> = z.infer<…> }` beside it:
  `DataDTOs.Session` is the schema where a value is wanted and the type where
  a type is.
- `outcome.ts` — the same for what came of a use case doing something,
  `…Outcome`, gathered as `OutcomeDTOs`, made of the data DTOs.
- `index.ts` — re-exports all three.

In JavaScript there is no namespace to hold the types: each is a typedef
`<Model>DTO` beside the schemas (`@typedef {z.infer<typeof DataDTOs.Fault>}
FaultDTO`), and `dto()` and `byType()` are typed with `@type`.

The DTO files import zod and nothing else, so a client may import them and
parse what it is sent by them: `DataDTOs.Session.or(DataDTOs.Fault).parse(…)`.
A driver port answers DTOs alone — `Promise<DataDTOs.Session |
DataDTOs.Fault>` — and re-exports `DataDTOs`; the use case makes each one
with its maker in `application/dtos.ts`, never inline.

## Faults

Every error a hexagon raises is a `…Fault`, and every fault owes two
things, asked for by its base constructor so neither is left out:

- `message` — what is wrong, never only that something is;
- `fix` — the next move.

A fault is either the person's — a request they can change — or the
system's own: a key set wrong, a service misconfigured, a bug. It is the
system's own, `internal`, unless it is raised with `{ internal: false }`:
what is not marked as the person's is never shown to them. A fault adds no
constructor of its own. Each part keeps its faults in one
file, beside the base they extend:

| File | Base | Holds |
|---|---|---|
| `domain/models/DomainFault.ts` | `DomainFault extends Error` | the base of every fault, and the domain's faults |
| `port/driver/ApplicationFault.ts` | `ApplicationFault extends DomainFault` | what a use case refuses |
| `port/zdriven/AdapterFault.ts` | `AdapterFault extends DomainFault` | what stands behind a driven port refusing or out of reach |

- A driven port re-exports the faults its adapters raise.
- A fault never crosses a driver port as a class: the use case turns it into
  a `DataDTOs.Fault` — `{ type: "Fault", data: { name, message, fix } }` —
  with `faultDTO()` in `application/dtos.ts`. A driver port re-exports no
  fault, so what calls in knows DTOs alone.
- `faultDTO()` sends the person's fault as it is, and cooks an internal one
  into the system's own words — `{ name: "InternalFault", message: "Something
  went wrong on our side.", fix: "Try again in a moment…" }` — so nothing of
  how the system is set up reaches a client.
- Before it does, the use case hands the fault to `LogService.logFault(logs, fault)`,
  which writes an internal one — its message, its fix and its cause — through
  the `ForWritingLogs` port (`StderrLogs`, `InMemoryLogs` in tests). What the
  client is not told, whoever runs the system can still read; the person's
  own faults are not logged.

## Logs

One service writes the log for every use case and whatever it logs:
`LogService` in `service/` — `logInfo()`, `logWarning()`, `logError()` and
`logFault()`, each handed the `ForWritingLogs` port the use case holds. A use case says what happened
and never builds a log entry itself, and a new kind of thing to log is a
method on `LogService`, never a second log service. A log entry never
carries a secret.

#### sdd-learnings-go-to-the-inbox — every turn

Source: [.cw/out/guide/sdd-learnings-go-to-the-inbox/index.md](./.cw/out/guide/sdd-learnings-go-to-the-inbox/index.md).

Never write to the agent's own memory (for Claude Code, the files under
`~/.claude/projects/<project>/memory/` and their `MEMORY.md`). When something is
worth keeping — a correction, a preference, a constraint — write it into a note
under `learning/inbox/`, named `<yyyy-mm-dd>-<slug>.md`, as /sdd-learn does.

- When touching a file matching "**/spec.md", "**/spec-*.md", "**/plan.json", "**/manifest.md", "**/ADR.md", "**/quality.md": Read and follow .cw/out/guide/sdd-spec-format/index.md.

#### sdd-spec-format

Applies only to repository paths matching: "**/spec.md", "**/spec-*.md", "**/plan.json", "**/manifest.md", "**/ADR.md", "**/quality.md".

Source: [.cw/out/guide/sdd-spec-format/index.md](./.cw/out/guide/sdd-spec-format/index.md).

A repository's specs live in one folder, the one `.sdd/settings.json` names
(`{ "specFolder": "specs" }`); /sdd-init creates both. The folder holds:

| File | What it is |
|---|---|
| `spec.md` | the index: one row per spec — its file, its prefix, what part of the product it covers. No stories. |
| `spec-<key>.md` | one part of the product: what it must do and why. Its ids carry the prefix its key makes, upper-cased without hyphens: `spec-core.md` is `CORE`. |
| `plan.json` | every story of every spec, once, and the stories it depends on: the roadmap; a `Done` story's entry also holds the evidence that proved it. |
| `manifest.md` | how work is carried out and finished here, as the user chose it (/sdd-init). |
| `ADR.md` | the decisions that change how every later story is built or written. |
| `quality.md` | the checklist a quality pass (/sdd-quality) checks the code and the specs against, from [sdd-quality-doc](./.cw/out/template/sdd-quality-doc/index.md): written by /sdd-init, kept and edited by the project; under `## Last pass` at its end, the report of the last pass, rewritten by each. |
| `report.html` | the roadmap drawn from `plan.json` and the statuses (/sdd-report); generated, never edited, and ignored by the folder's `.gitignore`. |
| `handoff/` | one note per story `In Progress`, `<prefix>-<n>.md`, and per bug fix not yet landed, `fix-<slug>.md`, from [sdd-handoff](./.cw/out/template/sdd-handoff/index.md): what is done, what remains, the decisions taken, what blocks it — nothing the spec says. Kept once the story is `Done` or the fix lands; committed or ignored as `manifest.md` says. Never linked or checked as a spec. |
| `mockup/` | designs, when there are any. |

A part grows in its own spec, extended in place; a new part gets a new
`spec-<key>.md` from [sdd-spec](./.cw/out/template/sdd-spec/index.md) and a row in `spec.md`. Split a spec when it
holds two parts a reader would look for separately.

## A spec

Title, `**Created**`, `**Updated**`, `**Input**` (each request appended as
`Then: "…"`); `## Overview`; `## Clarifications` (`### Session yyyy-mm-dd`,
`- Q: … → A: …`); `## User Scenarios & Testing` with its stories, then
`### Edge Cases`; `## Requirements` with `### Functional Requirements` and
`### Key Entities`; `## Success Criteria`; `## Assumptions`; `## Out of Scope`.

```markdown
### CORE Story 7 - Export a report as PDF (Priority: P2)

**Status**: Todo

<the journey in plain language>

**Why this priority**: …

**Independent Test**: …

**Acceptance Scenarios**:

1. **Given** …, **When** …, **Then** … (CORE-FR-031).

---
```

- **Status** sits on its own line right under the heading: `Todo`,
  `In Progress` or `Done`, and nothing else. Never in the heading, so its
  anchor never changes. Only /sdd-implement moves it.
- One story is one reviewable change; a bigger one is split.
- `- **CORE-FR-012**: The system MUST …` — one testable behaviour.
  `- **CORE-SC-004**: …` — a measurable, technology-agnostic outcome.
- Story, FR and SC numbers run once within a spec and are never reused or
  renumbered. A dropped requirement is deleted and every citation fixed.

## plan.json

```json
{
  "stories": [
    { "id": "CORE Story 3", "title": "Sign in", "dependsOn": [],
      "evidence": { "summary": "npm test: 41 pass, 0 fail; signed in by hand as a new user", "date": "2026-10-27" } },
    { "id": "CORE Story 4", "title": "Reset a password", "dependsOn": ["CORE Story 3"] },
    { "id": "BILLING Story 1", "title": "Pay an invoice", "dependsOn": ["CORE Story 3"] }
  ]
}
```

Every story of every spec, once, in the order it is to be built; `title` as
its heading says it; `dependsOn` the stories that must be `Done` first, in any
spec. No status here — the spec's status line is the one. `evidence` is set
by /sdd-implement when it sets the story `Done`: one line of what /sdd-verify
ran and what it showed, and the date it was produced. A story set back from
`Done` loses its evidence. Stories whose dependencies are all `Done` can be
built side by side: `ready` of [sdd-specs](./.cw/out/script/sdd-specs/index.md) lists them.

## Citing

Cite by id, as plain text: CORE-FR-012, CORE-SC-004, CORE Story 3 scenario 2,
from any file of the folder. Never restate a requirement elsewhere.
[sdd-specs](./.cw/out/script/sdd-specs/index.md) links each id to where it is defined, across files, when the
agent stops ([sdd-specs-on-stop](./.cw/out/sensor/sdd-specs-on-stop/index.md)). Never hand-edit a generated link or
`<a id>` anchor.

## ADR.md

One `## ADR-<nnn>: <decision>` per decision that changes how every later story
is built or written — a model dropped, a naming rule, a breaking format —
numbered once, with **Decision**, **Why** (short, plain) and
**Consequences**, and a line citing the story and FR it came from. A decision
one story alone needs stays in the code. An ADR is never rewritten; a reversal
is a new one that says which it replaces.

## Never in a spec

File names, class names, libraries, endpoints, schemas, task lists. How a
story is built is decided when it is implemented and lives in the code. At
most three `[NEEDS CLARIFICATION: …]` markers at a time; the clarify step of /sdd-plan resolves
them before the story they block is implemented.

#### sdd-voice — every turn

Source: [.cw/out/guide/sdd-voice/index.md](./.cw/out/guide/sdd-voice/index.md).

## How to talk to the user

Report in the language of the user's own words, however much code, ids or
commands they mix in — the words passed after a slash command included: every
answer, report, gate, question and hand-over, never in the language of the
code, the specs, the charter or a tool's output. A line said while working,
between tool calls, may be in any language. Talk in full sentences: compress
what is said, never the grammar it is said in.

- **The answer first** — then why, then what comes next. Never open by
  announcing what you are about to do, never close with a recap or an offer
  of more help.
- **No chatter** — no text between routine tool calls; how much a step says
  is set below.
- **Verbatim** — commands, paths, ids, code and errors are quoted exactly; an
  error by its shortest decisive line. A line a playbook gives word for word,
  the hand-over's closing line among them, is written as it is given.
- **Every negation kept** — never drop a not, never, no, only or except to
  save a word: a lost negation costs more than any word saved.
- **A question carries its case** — each question, and each `nit` or `q`
  put to the user, says first what you were doing, then what you met there:
  the problem; then the fix you propose — where there are several ways on,
  the one you propose; only then what you ask.
- **One reading** — a sentence that could be read two ways is written again
  until it cannot.
- **As long as `manifest.md` says** — where its **Conversation** is short, the
  default, a step that passes says nothing: only a failure, a warning or a
  question is said; a gate says only what it asks of the user, with its case;
  and what changed is never listed: the user reads the code and asks. Where it
  is detailed, each step reports what it did and what it showed.

- sdd-analyze: Check the spec set for gaps, contradictions and format faults, and report each by id with its fix; changes nothing. Use when: analyze the spec; check the spec; review the spec. Open .cw/out/skill/sdd-analyze/index.md when its triggers match or another primitive calls it; do not offer it as a user command.

- sdd-cleanup: List the story and phase branches whose work has already landed, and delete the ones the user confirms, with their worktrees. Use when: sdd cleanup; clean up branches; delete merged branches; prune branches. Open .cw/out/skill/sdd-cleanup/index.md when its triggers match or another primitive calls it; do not offer it as a user command.

- sdd-finish: Finish the story, bug fix or phase you stand on exactly as manifest.md says — merge, squash-merge or pull request, into the branch it names — then clean its worktree up. Use when: finish the story; finish the task; merge branch; finish the phase. Open .cw/out/skill/sdd-finish/index.md when its triggers match or another primitive calls it; do not offer it as a user command.

- sdd-learn: Write what this conversation taught — a correction, a preference, a constraint — as a note in learning/inbox. Use when: learn from the conversation. Open .cw/out/skill/sdd-learn/index.md when its triggers match or another primitive calls it; do not offer it as a user command.

- sdd-review: Verify the change, then have an agent that did not write it review it, with what verify showed, against the story's scenarios, FR and SC — nothing missing, nothing beyond them — and for security issues. Use when: review implementation. Open .cw/out/skill/sdd-review/index.md when its triggers match or another primitive calls it; do not offer it as a user command.

- sdd-verify: Prove the change works with evidence produced this turn — tests, static checks, and a manual run of what the story describes. Use when: verify changes. Open .cw/out/skill/sdd-verify/index.md when its triggers match or another primitive calls it; do not offer it as a user command.

### Host support

Skills and playbooks are invoked as `$<name>` or selected through `/skills`. Directory guides are embedded in nested AGENTS.md files, discovered along the root-to-cwd chain; when working from the root, follow the glob instructions above. Supported hooks call `cw sensor run <signal> --agent codex`; review and trust hooks with `/hooks`. Filesystem permissions use profile `cw` where generated; command prefixes use `.codex/rules/cw.rules` outside the sandbox. Unsupported permissions remain guidance. Subagent feature flags disable unsupported capability groups, while remaining tools and MCP servers inherit the parent scope. Session token logging and `cw eval` currently require Claude Code.
<!-- CHERRYWORKS END -->
