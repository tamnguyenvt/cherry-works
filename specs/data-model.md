# Data Model: Cherry Works

Derived from [spec.md](./spec.md) and its Key Entities. This file says what each
piece of data holds and how the pieces relate. Where each lives in the code, how
it is read, built and written, and why it is shaped this way is
[plan.md](./plan.md)'s.

Everything here is a domain type or a DTO: it carries no path of the machine it
runs on, no exit code and no adapter. Where a shape is a zod schema in the code,
the type is inferred off the schema, so what the type says and what is accepted
are one declaration.

## 1. Primitive and kind

### 1.1 The file

One markdown file: YAML frontmatter (the headers) and a body (the content).

```md
---
kind: guide
id: no-any
description: Reject the any type in application code.
globs: ["src/**/*.ts"]
tags: [typescript, types]
rationale: corpus:type-safety
mixins: [ts-defaults]
---

Body. Loaded only when the primitive activates.
```

A repository's primitive lives at `.cw/charter/<kind>/<id>.md`, a vendored one
at `.cw/vendor/<name>/<kind>/<id>.md`. An `id` holding `/` sits in the folders it
names: `mcp:mfbs/billing` is `.cw/charter/mcp/mfbs/billing.md` ([FR-141](spec.md#fr-141)). Where a file sits decides only that it is
looked at; what it is is what it declares ([FR-002](spec.md#fr-002), [FR-003](spec.md#fr-003)).

### 1.2 Common headers (FR-002, FR-005, FR-006, FR-008)

Every kind's headers extend these.

| Header | Type | Required | Notes |
|---|---|---|---|
| `kind` | one of the kinds of [§1.3](#13-kinds-and-what-each-requires-fr-001-fr-004) | yes | Declared by the file ([FR-003](spec.md#fr-003)). |
| `id` | slugs `[a-z0-9]([a-z0-9-]*[a-z0-9])?` joined by `/` ([FR-141](spec.md#fr-141)) | yes | Identity is `kind:id`, unique across the whole charter ([§3.1](#31-identity-fr-015-fr-016)). |
| `description` | one line with something on it | yes | The only body-free text in the compact catalogue. |
| `tags` | list of lines | no | Orthogonal to kind and directory ([FR-008](spec.md#fr-008)). |
| `globs` | list of lines | no | The files it speaks about. A guide's are what bring it up; a mixin may name them so its reach can be compared with its host's ([FR-006](spec.md#fr-006)). |
| `rationale` | `corpus:<id>` | no | Loaded on demand; one that does not resolve is a warning, not an error ([FR-005](spec.md#fr-005)). |
| `mixins` | list of mixin ids | no | Each lends its body and no header ([§1.5](#15-mixin)). |
| `mcps` | list of `mcp:<id>` | no | Where the primitive's reasons are kept outside the repository ([FR-143](spec.md#fr-143)). One that does not resolve is an error, not a warning: the server would reach nothing for it. |

A list is refused when it holds an empty line. A list a kind *requires* is
refused when it is empty too.

### 1.3 Kinds and what each requires (FR-001, FR-004)

A closed set of ten. Any other value is a fault naming the file and the
offending kind.

| Kind | Requires beyond `description` | Takes | Activates when |
|---|---|---|---|
| `guide` | — | the common headers | a touched file matches one of its `globs`, or every turn where globs are not specified |
| `sensor` | `signal`, `run` (lines) | `signal` is one of `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `Notification`, `Stop`, `SubagentStop`, `PreCompact`, `SessionStart`, `SessionEnd` | the `signal` it names is raised, and the harness runs what it says to `run` |
| `command` | — | the common headers | it is asked for by name, or a request matches what it describes itself as being for |
| `skill` | `triggers` (list) | the common headers | one of its `triggers` matches what is being asked |
| `playbook` | `triggers` (list) | the common headers | one of its `triggers` matches; the body is a sequence of commands |
| `agent` | `tools` (list) | the common headers | it is spawned by identity, holding the `tools` it lists and nothing else |
| `posture` | `allow`, `deny` (lists) | the common headers | always, wherever the host can be told what to `allow` and what to `deny` |
| `corpus` | — | the common headers | a primitive's `rationale` cites it — the reasoning, read when someone asks why |
| `mcp` | `tools` (list), and `endpoint` or `command` (line) | `args`, `auth` (lists), `tokenEnv`, `path` (lines); `auth` is from `oauth`, `token` | a primitive's `mcps` names it — where the rest of the reasoning is kept, reached through `cw mcp serve` ([§17](#17-knowledge-reached-through-mcp-fr-141--fr-157)) |
| `mixin` | — | the common headers but `mixins`, which it must not declare | never on its own: its body is lent to the primitives that pull it in |

The "Activates when" column is each kind's `activatesWhen`, as its class declares it.

A guide is the one kind whose body an agent is handed rather than looks up: it is
loaded whole when a file it names is touched, or on every turn where it names
none. Every other body is looked up through the catalogues when its activation
condition is met.

### 1.4 The kind's contract

Each kind is one class, and the class is the whole of its contract:

| Member | Holds |
|---|---|
| `kind` | the kind's name, a literal |
| `schema` | the zod schema its headers are read by: every header it takes, and the shape of each |
| `requires` | the headers beyond the common ones a file of this kind is refused without, each `line` or `list` |
| `activatesWhen` | one line saying when a primitive of this kind comes up |
| `sample` | one primitive of this kind as an author writes one: what a refusal shows as its fix |

`description` is required of every kind, beside what each kind's own `requires`
names. `id` is not asked for: a primitive is named where it is asked for.

A `Primitive` is an instance of one of these classes, discriminated on `kind`:
its `headers`, typed by that kind's schema, and its `body`. One cannot exist
missing a header its kind requires.

### 1.5 Mixin

A primitive whose purpose is to be pulled into others: a shared section of body,
written once and reused. It lends text and no header ([FR-006](spec.md#fr-006)). It is extracted
when the same material has already been repeated, not designed up front. A leaf:
it cannot itself pull in another mixin, so its schema refuses a `mixins` header
([FR-006](spec.md#fr-006)).

**Relation with its host**: a host names mixins by id in its `mixins` header, in
the order their bodies are written before its own. Where both name `globs`, one
side's must cover the other's, in either direction; a side naming none is left
alone.

## 2. What a kind requires, asked

### 2.1 Primitive requirements (FR-059, FR-062)

What a kind answers to whoever asks what it takes.

```ts
PrimitiveHeader = {
  field:          string,
  shape:          "line" | "list",
  required:       boolean,
  allowedValues?: string[],     // only where the kind reads it from a closed set
}

PrimitiveRequirements = {
  headers: PrimitiveHeader[],   // every header the kind takes, in the order they are asked
  sample:  string,              // the kind's sample, one `field: value` line per header, `kind` first
}
```

`headers` holds every header the kind's schema takes, not only the ones it
requires, each with the shape it is read as and whether the kind refuses a file
without it ([FR-069](spec.md#fr-069)). `kind` and `id` are not among them: the first is what is
being asked about, the second what the primitive is to be called. `sample` is the
same text a refusal quotes as its fix.

A header drawn from a closed set — a sensor's `signal` — also carries its
**allowed values**, and a header whose set is open carries none ([FR-118](spec.md#fr-118)).

**Rule**: no surface restates what a kind requires. The prompts of `cw add`, the
answer of `cw kinds <kind>`, the portal's form and the fix line of a refusal are
one declaration read four times ([FR-062](spec.md#fr-062)).

### 2.2 Primitive kinds (FR-060, FR-113)

What `kinds()` answers: every kind there is, under the line saying when a
primitive of it comes up.

```ts
PrimitiveKinds = Record<Kind, string>   // the kind's activatesWhen
```

The same declarations are what `CHARTER.md` builds its "When each kind applies"
section from. The answer is the same in every repository, one that has authored
nothing included.

### 2.3 Header answers (FR-064 – FR-074)

```ts
UnparsedHeaders = Record<string, string | string[]>   // a line, or the entries of a list
```

What an author answered, under the header each answer fills in. A prompt and a
`--header` flag produce the same record, so the engine cannot tell which was used
and refuses both the same way ([FR-073](spec.md#fr-073)).

## 3. Layer, scope and identity

### 3.1 Identity (FR-015, FR-016)

```ts
PrimitiveIdentity = `${kind}:${id}`     // guide:no-any, mcp:mfbs/billing
```

An identity names one primitive in the whole charter, whichever layer authored
it. A layer says who maintains a file and who may write to it, not who wins: two
files claiming one identity are a collision naming both. A mixin is named by its
`id`, and a corpus and an mcp by their identity, `corpus:<id>` and `mcp:<id>`,
whichever layer published them.

### 3.2 Scope (FR-017 – FR-024)

```ts
Scope = "repo" | "vendor" | "builtin"
```

A scope says whose layer a primitive came from, and answers three questions about
it: where it is kept, who may change it, and what takes it away.

| Scope | Authored by | Kept where | Edited by | Removed by |
|---|---|---|---|---|
| `repo` | the repository | `.cw/charter/<kind>/<id>.md` | the repository | deleting the file |
| `vendor` | someone else | `.cw/vendor/<name>/<kind>/<id>.md` | nobody; an edit is drift | `cw vendor remove` |
| `builtin` | the running engine | nowhere — supplied on every read | nobody; there is nothing to open | upgrading the engine |

There is no fourth scope. A machine-local scope exists in the reference design
and is deliberately excluded, so that the same repository reads identically for
every developer (spec Assumptions).

### 3.3 Scoped primitive

One primitive as the whole charter sees it.

```ts
ScopedPrimitive = {
  identity:  PrimitiveIdentity,
  scope:     Scope,
  file:      string,      // the path it was authored at, from the repository
  primitive: Primitive,
}
```

`file` is always a plain string. A builtin primitive's is
`(built into cw)/<kind>/<id>.md`: a name, not a location, which says which layer
it came from the way `.cw/vendor/<name>/…` does.

## 4. The charter, read

### 4.1 Charter root (FR-009, FR-010)

```ts
CharterRoot = {
  primitives:    ScopedPrimitive[],   // every layer, in read order
  faultsByFiles: FaultsByFile,        // the files that could not be read as a primitive, and why
}
```

Asked of it, and derived rather than held: `allFaultsByFiles`, every fault under
the file that has to change — the faults of reading, and `compositeFaultsByFiles`,
what is wrong only once the files are read together (a second claim on an
identity, a mixin nothing answers to, a mixin that does not reach its host, a
rationale no corpus answers to, an `mcps` entry no mcp answers to, the warnings
of [§6.1](#61-the-four-warnings-fr-014)). Also `primitiveById`,
`mixins`, `corpora`, and the relations `mixinsOf`, `rationaleOf`, `hostsOf` and
`citersOf` ([§13](#13-explanation-fr-029)). The first claim on an identity is the one `primitiveById`
keeps; the second is the file a collision is filed under.

### 4.2 The files a charter is read from

```ts
AuthoredFile = { path: string, contents: string }
VendoredFile = AuthoredFile & { vendor: string }    // the folder it was installed as

charterRootOf({
  repo:    AuthoredFile[],
  vendor:  VendoredFile[],
  builtin: AuthoredFile[],
}): CharterRoot
```

The three layers arrive apart; which layer a file belongs to is never worked out
from its path. The read order is builtin, then repo, then vendor, each layer in
the order its paths sort in.

`builtin` is `AuthoredFile[]` and not `VendoredFile[]`: there is one owner, so
there is nothing to name. It is not `Primitive[]` either: every primitive of the
charter comes from a file read the one way. A builtin file holds:

```
path:     (built into cw)/<kind>/<id>.md
contents: the primitive's toMarkdown()
```

### 4.3 Faults (FR-010 – FR-012)

```ts
Fault = {
  message:  string,             // what is wrong
  fix:      string,             // the next move
  severity: "error" | "warn",   // whether it stops a build
}

FaultsByFile = Record<file, Fault[]>   // a file nothing is wrong with is not in it
Faults       = Fault[]                 // an author's answers refused, under no file yet
```

A fault is one of `CharterRootFault`, `CharterPrimitiveFault`, `SettingsFault`,
`TestSuiteFault` or `TestCaseFault`, named for what has to change. An `error`
stops a build, a listing, an explanation and a test run; a `warn` is said and
stops nothing. A rationale that does not resolve is a `warn`; an `mcps` entry
that does not resolve is an `error`.

## 5. What the engine brings (FR-096 – FR-103)

```ts
BUILTIN_PRIMITIVES: Primitive[]    // today one: CwAuthorSkill

CwAuthorSkill extends SkillPrimitive
  id:          cw-author
  description: Author a new primitive of this repository's charter, asking cw what its kind requires.
  triggers:    write a rule; add a standard; write a skill; add a command;
               author a primitive of the charter
  body:        the procedure: cw kinds, cw kinds <kind>, cw add … --header, write the body, cw build
```

One class per primitive, each built through its kind's own class and typed by
that kind's own headers, and one list of them. Nothing of it is kept on disk
([§3.2](#32-scope-fr-017--fr-024)).

**Invariant**: the body names no header of any kind and restates no kind's
requirements ([FR-097](spec.md#fr-097)). What it says instead is which command to ask.

## 6. Validation warnings

### 6.1 The four warnings (FR-014)

Four faults of severity `warn`, each filed under a file of the charter:

| Warning | Filed under |
|---|---|
| a corpus no primitive cites | the corpus |
| a mixin no primitive names | the mixin |
| an mcp no primitive names in its `mcps` | the mcp |
| a guide or sensor no test case names | that primitive |

## 7. Catalogues (FR-025 – FR-028)

```ts
CatalogueCompact = { identity, kind, id, description }
CatalogueFull    = CatalogueCompact & {
  file:       string,        // the compiled primitive, .cw/out/<kind>/<id>.md (§8.1)
  tags?:      string[],
  globs?:     string[],
  rationale?: string,
  mixins?:    string[],
  mcps?:      string[],
}
```

- `.cw/out/catalog.json` — one `CatalogueFull` per primitive, ordered by
  identity. A header nobody wrote is left out rather than recorded as nothing.
- `.cw/out/catalog.min.json` — one `CatalogueCompact` per primitive. At least
  ten times smaller than the charter it describes ([SC-005](spec.md#sc-005)).

Neither carries a body ([FR-027](spec.md#fr-027)); the `file` each full entry records is where the
body is: the compiled primitive, whichever layer the primitive came from
([FR-140](spec.md#fr-140)). The catalogue is output, so it says nothing of layers.

A listing of the charter — what `cw list` and the portal show — has the same
fields, read off the charter root rather than off the catalogue: its `file` is
the one the primitive was authored in, `ScopedPrimitive.file`, from which its
layer is read.

## 8. Compiled output (FR-030 – FR-040)

```ts
CharterOutput = {
  catalogue:          Catalogue,          // both catalogues of §7
  charterMd:          CharterMd,          // .cw/out/CHARTER.md
  compiledPrimitives: CompiledPrimitive[],// §8.1, one per primitive of every layer
  mcpOrigins:         McpOrigin[],        // .cw/out/mcp-origins.json (§17.2)
  providerComponents: ClaudeComponent[],  // one host's files, for each agent chosen
}

ClaudeComponent = rule | command | agent | skill | settings

Projection = {
  path:             string,
  contents:         string,
  projectionPolicy: "replace" | "mergeJSON" | "upsertWithMarker",
}
```

The catalogue, `CHARTER.md` and the compiled primitives are what every reader of the charter gets,
whichever agent it is ([FR-031](spec.md#fr-031)). Each agent the repository chose adds components
of its own, one per primitive that host has a kind for. Charter kinds and host
kinds are not one for one:

| Charter kind | Claude component | Lands at |
|---|---|---|
| guide | rule, its `paths` its `globs` | `.claude/rules/<name>.md` |
| command | command | `.claude/commands/<id>.md` |
| agent | agent, with its `tools` and the served tools of its `mcps` ([FR-156](spec.md#fr-156)) | `.claude/agents/<name>.md` |
| skill, playbook | skill | `.claude/skills/<name>/SKILL.md` |
| posture, sensor | settings: permissions and hooks | `.claude/settings.json`, one for all of them |
| mcp, all of them | one MCP server entry, `cw`, starting `cw mcp serve` ([FR-146](spec.md#fr-146)) | `.mcp.json`, merged |
| corpus, mixin | — | — |

`<name>` is the identity with its separators — `:` and `/` — replaced, so
`skill:cw-author` is `skill-cw-author` and `agent:mfbs/fraud` is
`agent-mfbs-fraud`. Beside the components, each agent chosen gets one section of
its entry file, `CLAUDE.md` for claude, between `<!-- CHERRYWORKS START -->` and
`<!-- CHERRYWORKS END -->`.

| Policy | Used for | Deleted by a build |
|---|---|---|
| `replace` | a file the charter owns, written whole and stamped as generated | yes, when its primitive is gone |
| `mergeJSON` | a host's settings, and its MCP configuration, shared with the repository | never |
| `upsertWithMarker` | the host's entry file, the repository's own | never |

Compiled output is generated, never authored ([FR-032](spec.md#fr-032)).

### 8.1 Compiled primitive (FR-139)

```ts
CompiledPrimitive = {
  identity: PrimitiveIdentity,   // what its catalogue entry is found by
  document: string,              // the headers as authored, then charterRoot.bodyOf(it): mixins' bodies, then its own
}
```

Lands at the `file` its catalogue entry names, `.cw/out/<kind>/<id>.md`, `replace`, stamped as generated. One per
primitive of every layer, mixins and corpora included, so every entry of the
catalogue names a file that is there. The headers are the author's, `mixins`
among them, so a reader sees which bodies were lent above the primitive's own.

**Plan summary.** What a build did, or a preview would do, to each file:

```ts
PlanSummary = { added: string[], edited: string[], deleted: string[], unchanged: string[] }
```

## 9. Workspace settings (FR-055 – FR-058)

`.cw/settings.json`, what the repository answered at setup:

```ts
WorkspaceSettings = { agents: AgentProvider[] }   // AgentProvider: "claude"
```

Empty is a repository that compiles for no agent and still gets the neutral
surface. The settings are the repository's own, not part of the charter.

## 10. Vendor sources

### 10.1 Vendor source (FR-041 – FR-052)

```ts
VendorSource = {
  source:   string,   // the address as typed, handed to git as it is (FR-049)
  name:     string,   // the end of the address without a trailing `.git` (FR-050)
  version?: string,   // the tag, branch or commit to pin to
}
```

A vendor source's content is committed under `.cw/vendor/<name>/`, and the
repository's history is its only record ([FR-046](spec.md#fr-046)). The primitives in it are the
`vendor` layer, each `VendoredFile` carrying `name` as its `vendor`.

### 10.2 Vendor folders (FR-053, FR-122)

What `installed()` answers: every folder under `.cw/vendor/`, named as it sits
under the repository (`.cw/vendor/<name>`), sorted. Nothing else is known of
one: `git subtree` records neither the address nor the version, and nothing is
kept beside it ([FR-053](spec.md#fr-053)). The primitives a source brought, counted by kind, are
the vendor layer of the catalogue under that folder.

## 11. Self-regression tests (FR-082 – FR-092)

### 11.1 The test file

A test is not a primitive and no kind of the charter's: nothing compiles it, no
agent is instructed by it, and it has no body. It is one JSON file,
`.cw/test/<name>.json`, holding one `TestSuite`.

```json
{
  "description": "Type guides must be active when application code is touched.",
  "cases": [
    { "do": { "touchFile": "src/one.ts" }, "expect": { "activate": "guide:no-any" } },
    { "do": { "touchFile": ".env" },       "expect": { "allow": false } },
    { "when": "PreToolUse",                "expect": { "run": "sensor:no-secrets" } }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `description` | non-empty string | no | What these cases pin down. |
| `cases` | case[] | yes | At least one; a file asserting nothing is a fault. |

A case is exactly one of three shapes, and no fourth:

| Shape | Situation | Expectation | About |
|---|---|---|---|
| touch, activate | `do: { touchFile: string }` | `expect: { activate: kind:id }` | a guide |
| touch, allow | `do: { touchFile: string }` | `expect: { allow: true \| false }` | a posture |
| event, run | `when: <signal>` | `expect: { run: kind:id }` | a sensor |

`<signal>` is one of the sensor signals of [§1.3](#13-kinds-and-what-each-requires-fr-001-fr-004). Every object is strict: a case
holding both a `do` and a `when` is none of the three, and neither is a raised
event expecting a permission. A case carries no name: it is the situation it puts
and the one thing it expects. The identity a case activates is its `activate` or
its `run`.

### 11.2 Test suites, listed

What `suites()` answers: one entry per file under `.cw/test/`, run or not, in
the order their names sort in.

| Field | Holds |
|---|---|
| name | the file's path under `.cw/test/`, as in `untitled-1.json` |
| text | the body of a file that reads, as the editor shows it; none for one that does not |
| description | the suite's description, where it has one |
| cases | each case's situation (`touching src/one.ts`, `firing event Stop`), expectation (`activates guide:no-any`, `is denied`, `runs sensor:test`) and the identity it names, where it names one |
| fault | for a file that does not read, why — in place of the description and cases |

A new test file is named `untitled-<n>.json` for the first free `n`, and holds
the description and the first case of the sample `TestSuite` refuses with.

### 11.3 Test run

```ts
TestCaseReport = {
  suiteName: string,    // the name of the file the case is in, as §11.2 names it
  situation: string,    // the case as a sentence: "touching src/one.ts activates guide:no-any"
  passed:    boolean,
  unmet?:    Fault,     // why the charter did not answer it as expected
}
TestRunReport = { testCaseReports: TestCaseReport[] }
```

## 12. What crosses a driver port

### 12.1 The DTO envelope

Every answer a driver port gives is a DTO: plain JSON of the shape

| Field | Holds |
|---|---|
| `type` | the model's name exactly as the DTOs are keyed, such as `"Catalogue"` |
| `data` | what the model says: a nested model as its own DTO, a path named from the repository, no `URL` and no class |

A port method's answer is a union of DTOs told apart by `type`; `list`, for
example, answers `DataDTOs.Catalogue | DataDTOs.FaultsByFile`.

### 12.2 The two sets

The DTOs fall into two sets, told apart by name. No name is in both, and each set
is keyed by each schema's own `type`, so a DTO read untyped is parsed by looking
its schema up by its `type`.

| Set | Holds |
|---|---|
| `OutcomeDTOs` | the DTOs named `…Outcome`: what came of a use case doing something — `DoctorOutcome` ([§14](#14-doctor-outcome-fr-080-fr-081)), `ExplanationOutcome` ([§13](#13-explanation-fr-029)) |
| `DataDTOs` | every other DTO: what one model says, whether a use case answers with it on its own or another DTO holds it — `Catalogue`, `CatalogueEntry`, `Fault`, `Faults`, `FaultsByFile`, `PlanSummary`, `PrimitiveHeader`, `PrimitiveKinds`, `PrimitiveRequirements`, `PrimitiveSnapshot`, `ScopedPrimitive`, `TestCaseReport`, `TestCasesByFile`, `TestRunReport`, `TestSuite`, `WorkspaceSettings` |

Each set holds every schema under its model's name, keys in alphabetical order,
beside a namespace of the same name holding the type inferred from it, so
`DataDTOs.Catalogue` is the schema where a value is wanted and the type where a
type is.

`ScopedPrimitive` as a DTO carries `identity`, `kind`, `description`, `file`,
`scope` and every header the primitive declared; `scope` is one of the three of
[§3.2](#32-scope-fr-017--fr-024).

### 12.3 What each port method answers

| Port method | Answers |
|---|---|
| `doctor` | `DoctorOutcome` |
| `list` | `Catalogue`, or `FaultsByFile` when the charter does not hold |
| `explain` | `ExplanationOutcome`, or `FaultsByFile` |
| `build`, `preview` | `PlanSummary`, or `FaultsByFile` |
| `test` | `TestRunReport`, or `FaultsByFile` |
| `listPrimitiveRequirements` | `PrimitiveRequirements` |
| `kinds` | `PrimitiveKinds` |
| `add` | the `ScopedPrimitive` it wrote, or the `Faults` its answers were refused for |
| `open` | `PrimitiveSnapshot` ([§15.1](#151-primitive-snapshot-fr-075-fr-078)) |
| `rewrite` | the `ScopedPrimitive` it wrote, or the `Faults` its answers were refused for |
| `remove` | the `ScopedPrimitive` it removed |
| `suites` | every test suite as [§11.2](#112-test-suites-listed) says it |
| `addSuite` | the new file's name |
| `settings` | `WorkspaceSettings` |
| `ensureRepoReady` | nothing, or a raised fault |
| `init` | `true`: it compiles nothing |
| `ForVendoringCharters.add`, `remove` | the folder the vendor landed in or left, a string: a name is already plain JSON and no model stands behind it |
| `ForVendoringCharters.installed` | every vendor folder, a list of strings ([§10.2](#102-vendor-folders-fr-053-fr-122)) |

`suites`, `addSuite`, `writeSuite`, `removeSuite` and `installed` have not
landed; the DTO each answers beyond what this table
names is declared when it does, in the sets of [§12.2](#122-the-two-sets).

A `Fault` raised because a use case cannot run is not an answer; its DTO is
`DataDTOs.Fault`.

### 12.4 Answers that are collections

An answer that is a collection is a model of its own, so that it carries a
`type`:

| Model | Holds |
|---|---|
| `FaultsByFile` | the faults of a charter under each file that has to change, each file named from the repository |
| `Faults` | what an author's answers were refused for, under no file yet |
| `TestRunReport` | the outcome of every case |
| `PrimitiveRequirements` | the headers a kind takes, and its sample |
| `PrimitiveKinds` | every kind and when it comes up |
| `TestCasesByFile` | the situations of the cases naming one identity, under the test file each was written in |

### 12.5 Not models

Left as they are, with no DTO: the ports' interfaces, the closed sets a charter
is made of (`Kind`, `Scope`, `AgentProvider`, `ProjectionPolicy`), type-level
helpers (`NoHeaders`, `RequiredHeaders`, the `Omit<…>` aliases), and the
application services themselves. A model no use case answers with stays an
interface or a type until one does.

## 13. Explanation (FR-029)

What the engine says about one identity: `OutcomeDTOs.ExplanationOutcome`.

| Field | Holds |
|---|---|
| `scopedPrimitive` | the primitive, with its file and its layer |
| `useMixins` | each mixin it names that resolves |
| `rationale` | the corpus it cites, where one resolves; one that does not is read off the primitive's own `rationale` header and marked unresolved |
| `hosts` | the primitives that lend from it, where it is a mixin |
| `citers` | the primitives that cite it, where it is a corpus |
| `testCasesByFile` | every case naming the identity, by its situation, under its test file |
| activates when | when it comes up: its kind's `activatesWhen` |

A mixin named and not resolved is likewise read off the primitive's own `mixins`
header. Every identity in an explanation is itself explainable ([FR-116](spec.md#fr-116)). The last
outcome of each case ([Story 5](spec.md#user-story-5---see-what-the-charter-holds-and-why-each-rule-comes-up-priority-p1), scenario 4) is the page's own last test run, not a
field of the explanation.

## 14. Doctor outcome (FR-080, FR-081)

`OutcomeDTOs.DoctorOutcome`: what checking a repository found, counted and
judged, so no driver counts or judges it again.

| Field | Holds |
|---|---|
| `agents` | the agents the repository chose |
| `faultsByFile` | every fault of the charter, errors and warnings, as `FaultsByFile` |
| `errorCount`, `warnCount` | the faults, counted by severity |
| `pendingCount` | how many files a build would still change, or `null` where the charter does not hold and nothing was previewed |
| `driftedVendors` | the vendor folders whose content differs from what was committed, each once |
| `problemCount` | how many of the four answers — agents, charter, vendors, compiled output — are unwell |

The `CharterRoot` and the settings are not part of it.

## 15. Authoring in the portal

### 15.1 Primitive snapshot (FR-075, FR-078)

What `open(identity)` answers about one primitive, as `PrimitiveSnapshot`.

| Field | Holds |
|---|---|
| scopedPrimitive | the primitive as the whole charter sees it ([§12.2](#122-the-two-sets)): its headers as authored, the file that declares it, and its layer ([§3.2](#32-scope-fr-017--fr-024)) |
| body | its markdown body |
| revision | the content hash (SHA-256, hex) of the primitive written out by `toMarkdown()`, the text a save writes |

A save is refused when the primitive, read again, no longer hashes to the
revision it was opened at. The revision is what crosses HTTP as an `ETag`.

### 15.2 Draft

The answers and body an author has typed for a primitive not yet saved. It lives
only in the page and is gone when saved or cancelled.

| Field | Holds |
|---|---|
| kind, id | chosen on a new primitive; fixed on an existing one ([FR-075](spec.md#fr-075)) |
| description | one line |
| headers | one answer per header the kind takes ([§2.1](#21-primitive-requirements-fr-059-fr-062)) |
| mixins | the mixins it lends from |
| rationale | the corpus it cites, chosen from the charter's corpus |
| body | markdown, possibly empty |
| revision | for an existing primitive, the revision it was opened at ([§15.1](#151-primitive-snapshot-fr-075-fr-078)) |

## 16. Distribution (FR-126 – FR-138)

### 16.1 Package

What one release publishes to the registry. Its fields are `package.json`'s.

| Field | Holds |
|---|---|
| name | `cherry-works` ([FR-126](spec.md#fr-126)) |
| version | semantic, from `0.1.0`; one published version is never replaced |
| bin | `cw`, the one command it puts on the path |
| engines | the oldest Node it runs on, `>=22` ([FR-128](spec.md#fr-128)) |
| dependencies | exactly what the engine imports at run time ([FR-129](spec.md#fr-129)) |
| files | the engine's bundle, the portal's page, the README, the license ([FR-130](spec.md#fr-130)) |
| license | `MIT` ([FR-133](spec.md#fr-133)) |

### 16.2 Release

One version, published once.

| Field | Holds |
|---|---|
| version | the package's version it published |
| tag | `v<version>`, at the commit it was built from ([FR-136](spec.md#fr-136)) |
| tarball | the one file installed by the install check and then published, unchanged ([FR-135](spec.md#fr-135)) |


## 17. Knowledge reached through MCP (FR-141 – FR-157)

### 17.1 MCP primitive (FR-142)

```md
---
kind: mcp
id: mfbs/billing
description: Billing service code and pull requests.
endpoint: https://api.githubcopilot.com/mcp/
path: moneyforward/billing-service
auth: [oauth, token]
tools: [get_file_contents, search_code, list_pull_requests]
---

The service that computes invoices. Look here for how tax is rounded today.
```

The same place, as a local process:

```md
---
kind: mcp
id: mfbs/billing
description: Billing service code and pull requests.
command: npx
args: [-y, "@modelcontextprotocol/server-github"]
tokenEnv: GITHUB_PERSONAL_ACCESS_TOKEN
auth: [token]
path: moneyforward/billing-service
tools: [get_file_contents, search_code, list_pull_requests]
---
```

| Header | Type | Required | Notes |
|---|---|---|---|
| `endpoint` | an `https://` URL | one of `endpoint`, `command` | One MCP server reached over HTTP. |
| `command` | line | one of `endpoint`, `command` | One MCP server started as a local process, spoken to over its standard input and output. |
| `args` | list | no; with `command` only | The command's arguments, in order. |
| `auth` | list from `oauth`, `token` | with `endpoint` | The ways a developer may sign in. With `command`, only `token`, and left out for a process that takes none. |
| `tokenEnv` | an environment variable's name | with `command` and `auth: [token]` | Where the process reads its token from. |
| `path` | line | no | The place inside that server: a repository, a database, a channel. Told to the agent beside each tool; it narrows what the agent is told to look at, not what the server lets it read. |
| `tools` | list | yes | The server's tools the agent may use there, by the server's own names. |

**Address**: `endpoint`, or `command` followed by each of `args`, joined by
spaces. It is what a developer signs in to ([§17.3](#173-credential-fr-148--fr-151)).

Its body, where it has one, says what is kept there and when to look. The
common headers hold as for every kind; `mcps` on an mcp names other places,
which nothing forbids and nothing needs.

### 17.2 Place (FR-145)

One entry of `.cw/out/mcp-origins.json`, `McpOrigin` in code: one place — one
address and `path` — once, however many mcps declare it. Where it is and how it
is signed in to, and nothing else: what each mcp lets the agent use there is in
its own file, and the catalogue lists every mcp.

```ts
McpOrigin = {
  identities: PrimitiveIdentity[],   // every mcp at this address and path, sorted
  address:    string,                // §17.1
  endpoint?:  string,                // one of these two
  command?:   { command: string, args: string[], tokenEnv?: string },
  path?:      string,
  auth:       ("oauth" | "token")[], // the union of what each identity here allows
}

McpOriginsJson = { origins: McpOrigin[] }       // ordered by address, then path
```

- **Key**: address and `path` together. Two identities with the same pair are
  one place; one identity is one file, so an identity is never in two places
  ([FR-015](spec.md#fr-015)).
- **Prefix**, not held here: the `id` of the identity at a place the `repo`
  scope declared, else the first `id` in sorted order, with `/` replaced by
  `-`. Served tool names are `<prefix>__<tool>`, the tools being the union of
  what the place's identities declare ([FR-153](spec.md#fr-153)).
- **`auth`** is the union of what every identity here allows, from every
  layer: one identity's narrower list takes no way away. Two
  identities of one local command naming two `tokenEnv`s are
  an error too: one process takes its token one way.

### 17.3 Credential (FR-148 – FR-151)

Kept in the operating system's credential store, never in the repository.

```ts
Credential = {
  address:       string,             // the key: one per address, for every place at it
  method:        "oauth" | "token",   // "token" alone for a local command
  accessToken:   string,
  refreshToken?: string,             // oauth only
  expiresAt?:    string,             // ISO 8601, oauth only
  client?:       { clientId: string, clientSecret?: string },   // oauth: what the server registered cw as
}
```

Stored under service `cherry-works`, account `<address>`, as one JSON value. It
is not a domain type: no port carries it into the hexagon, and no DTO holds it.

### 17.4 Sign-in status (FR-150)

What `cw mcp auth --status` answers, one row per address that takes a sign-in:

```ts
SignInStatus = {
  address:    string,
  identities: PrimitiveIdentity[],   // every mcp at this address, whatever its path
  signedIn:   boolean,
  method?:    "oauth" | "token",
}
```

### 17.5 What a run serves (FR-152 – FR-155)

```ts
Enable = PrimitiveIdentity | ServedToolName   // repeatable
ServedToolName = `${prefix}__${tool}`

ServedTool = {
  name:        ServedToolName,
  place:       Place,
  upstream:    string,               // the tool's name at its place
  description: string,               // the place's own, after `[<identity> — <path>]`
}
```

With no `Enable`, every tool of every place is served. With some, what is served
is the union of what each reaches: a primitive's `mcps` places, an mcp's place,
or one served tool.
