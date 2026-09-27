# Implementation Plan: Cherry Works

**Spec**: [spec.md](./spec.md) · **Data model**: [data-model.md](./data-model.md) · **Tasks**: [001](./tasks/001-charter-engine.md), [002](./tasks/002-charter-portal.md), [003](./tasks/003-npm-publish.md), [004](./tasks/004-compiled-charter.md), [005](./tasks/005-mcp-knowledge.md) · **Mockup**: [mockup/portal.html](./mockup/portal.html) · **Status**: Draft

This file says how the product is built: the design, the modules each part lives
in, and why it is built this way. What the product must do is the spec's, cited
by its ids; the shape of each piece of data is the data model's, cited by its §.

## 1. Technical context

| Decision | Choice | Why |
|---|---|---|
| Runtime | Node.js ≥ 22, ESM only | A standalone runtime with no compiled or native dependency (spec Assumptions). 22 rather than 20: Node 20 reached its end of life on 2026-04-30, so the oldest line still receiving fixes is the oldest one promised ([§18.2](#182-the-runtime-it-needs-fr-128)). |
| Language | TypeScript, strict | The per-kind header contracts are the core of the format; the type system carries them. |
| Package manager | pnpm | Strict by default: a dependency this package does not declare is not importable from it. |
| Distribution | npm registry package `cherry-works`, `bin: { cw }`, MIT | A single install command makes the tool available. Node on the machine is a prerequisite, stated up front. Installed globally, so the user's own repository gains no dependency and no `package.json` of its own — it may be written in any language; a repository that has one may pin a version as a development dependency. What the package holds, depends on and how a release is made is [§18](#18-distribution-fr-126--fr-138). |
| Bundler | `tsup` (esbuild), two entries into `dist/` | One entry is the `cw` binary; the other is the portal's page, `platform: "browser"`, into `dist/portal/`. The page ships inside the same package, so the engine and the interface are one artifact, and it is served from `dist`, so nothing is fetched at run time ([FR-111](spec.md#fr-111)). Nothing is published as a library. |
| Test runner | `node:test` + `tsx`; `playwright` for the page | No framework: the engine is filesystem-heavy, not framework-heavy. Test files are named for the behaviour they describe, in kebab-case, flat under `test/` — `ls test/` reads as what the system does, not as a mirror of the source tree. The page is tested in a real browser. `pnpm test` runs the dependency rules first ([§2.2](#22-dependency-rules)), then the build, then the tests. |
| Frontmatter | `yaml` (pure JS), behind `ForParsingYaml` | The only non-trivial parse in the system. The domain splits the block off the body and the port hands back the fields; the YAML adapter is the only module that knows the notation. |
| Schemas | `zod` | Every kind's headers, the settings, the test format and every DTO are one zod schema each, and the type is inferred off it, so what the type says and what is accepted cannot differ. |
| Globs | `picomatch` (pure JS) | A guide's `globs` matched against a path, and one glob asked whether it covers another ([§5.2](#52-mixins-fr-006-fr-007)). |
| Git | shell out to `git` | No central service beyond the git source ([FR-048](spec.md#fr-048)). |
| Argument parsing | `yargs` | Nested command groups (`cw vendor add`), per-command help with examples, strict rejection of unknown flags, and a "Did you mean" suggestion ([FR-094](spec.md#fr-094), [FR-095](spec.md#fr-095)). |
| Interactive input | `prompts` | The setup questions and `cw add`'s questions. Lives in the command that asks rather than behind a port: a use case is called with its answers, so whoever drove it is the one that put the questions ([§8](#8-setup-fr-054--fr-058), [§9.3](#93-cw-add-kind-id-prompts-and-header-flags-fr-064--fr-074)). |
| Server | Hono on `node:http` through `@hono/node-server` | One user, one repository, a dozen routes. The routes are chained into one typed app, so the page calls them through `hc` with every answer typed, and nothing is written twice between the server and the page. |
| Routes | `@hono/zod-openapi`: each route a `createRoute` — path, params, query, request headers, request body and every response under its status, inline, with the `DataDTOs` schemas | A route's request body and answers are declared once, as OpenAPI declares them; a request of the wrong shape is refused with `400` before the engine is asked, and `hc` types the page's calls off the same declaration, request and answer alike. |
| Page calls | `hc` from `hono/client`, typed by `typeof api` from `routes.ts` | The page imports the routes' types only ([§2.2](#22-dependency-rules)); a route renamed or an answer changed is a type error in the page. |
| Address | `127.0.0.1`, port 9927 by default, the next free one when it is taken | [FR-106](spec.md#fr-106) and the spec's edge case where the port is taken. Never `0.0.0.0`. |
| Page | React, with hooks and JSX; no router, no store | Components rather than the mockup's string templates, so a view re-renders from what the server answered instead of being rebuilt by hand. React rather than Preact because the components below are written for it, and Radix under them does not hold up under `preact/compat`; the size it adds is small beside CodeMirror's. Rather than a server framework, whose own server, bundler and tsconfig would fight the composition root and the dependency rules. Seven views and no shared state worth a store: `useState` in the component that owns it. |
| Page components | shadcn/ui — Radix primitives styled with Tailwind v4, their source copied into `src/driver/portal/page/components/ui/` — with lucide icons and sonner toasts | The form, the tabs, the dialog, the menu, the select, the table and the toast are components with their keyboard and focus behaviour already right, rather than written by hand. The mockup gives the layout; the look is shadcn's own. Tailwind's CLI builds `dist/portal/styles.css` after `tsup`, from the page's sources alone. |
| Page data | TanStack Query: one hook per route in `page/queries.ts` | A view asks a hook for what it shows rather than fetching in an effect. What a route answered is kept under its key and asked again whenever a view showing it is mounted ([FR-110](spec.md#fr-110)); a write marks what it changed as stale, so every listing asks again at once. |
| Page type-checking | `src/driver/portal/page/tsconfig.json` with `lib: ["ES2023", "DOM"]`, `jsx: "react-jsx"`, `jsxImportSource: "react"`, excluded from the root one | The root config is Node-only (`types: ["node"]`) and stays so: a DOM global in engine code is a mistake the compiler should catch. `typecheck` runs both configs. The page entry in `tsup` sets the same JSX options. |
| Body editor | CodeMirror 6 (`@codemirror/view`, `state`, `lang-markdown`, `language` for the highlighting, `commands` for the keymap and undo), bundled | Markdown highlighting offline ([FR-119](spec.md#fr-119)). The mockup loads Monaco from a CDN, which breaks [FR-111](spec.md#fr-111), and Monaco bundled is several megabytes with web workers; CodeMirror is a fraction of that and needs no worker. |
| Markdown preview | `marked`, bundled | The preview view of [FR-119](spec.md#fr-119). A body is any markdown an author writes, which a hand-written renderer would not cover. |
| MCP | `@modelcontextprotocol/sdk`: its `Server` over stdio for `cw mcp serve`, its `Client` over Streamable HTTP for each place, and its OAuth client for signing in | The protocol, its transports and its authorization flow — discovery, dynamic client registration, PKCE, refresh — are the SDK's, kept current with the specification by its maintainers. Written by hand they would be the largest part of phase 005 and the part most likely to be wrong ([§19](#19-knowledge-reached-through-mcp-fr-141--fr-157)). |
| Credential store | shell out to `security` on macOS and `secret-tool` on Linux | The operating system's own store, with no native module, the way git is reached ([§19.5](#195-signing-in-fr-148--fr-151)). |
| What the engine brings | `src/hexagon/domain/models/charter/builtin/`: one module per primitive, each a class extending its kind's own class, and an `index.ts` exporting the list | A kind that grows, renames or drops a header breaks these modules when the package is type-checked. Anything read at run time — JSON, markdown, a file shipped beside `dist/` — moves that failure to somebody else's `cw` run ([§5.4](#54-what-the-engine-brings-fr-096--fr-103)). |

Explicitly avoided: native modules, a daemon, a lockfile format of our own, any
network call other than `git` and, for [§19](#19-knowledge-reached-through-mcp-fr-141--fr-157), the MCP places a developer signs in to and
serves; a client-side router or store, a websocket or a
file watcher ([FR-110](spec.md#fr-110) is met by reading on every view), any request the page
makes to a host other than the one serving it, opening a browser on the user's
behalf ([FR-104](spec.md#fr-104) asks for the address to be printed); a second use case for
authoring, a `--json` output mode, a template format read at run time, any
folder, cache or copy of what the engine brings, a way to turn the builtin layer
off, and any path into the charter that does not go through the one reading
([§4.1](#41-the-one-read-path-fr-009-sc-010)).

## 2. Architecture — ports and adapters

The charter is the domain. It knows primitives, kinds, layers, validation and
what the compiled output must contain. It does not know where a file comes from,
what a terminal or a browser is, or that git exists.

Everything else reaches it through a port: an interface the hexagon declares and
something outside implements. The filesystem is infrastructure. The command line
is one driving adapter and the portal is another; neither is the engine.

```
src/
  hexagon/                         the engine. Imports nothing outside itself but lodash, picomatch and zod.
    domain/
      models/                      Fault, FaultsByFile, Settings, AgentProvider, TestSuite
        charter/                   CharterRoot, ScopedPrimitive, the three scopes
          primitive/               Primitive.ts (PRIMITIVE_CLASSES, primitiveOf), one <Kind>Primitive.ts per kind
          builtin/                 what the engine brings: index.ts, CwAuthorSkill.ts
        output/                    CharterOutput (Catalogue, CharterMd), ProjectionPolicy, StampedDocument
          providers/claude/        one component class per claude kind
      services/                    compileService, projectionService, testService: one model turned into another
      path.ts                      where everything lives in a repository
    service/                       charterRepo, settingsRepo, testSuitesRepo, vendorRepo, buildService:
                                   the domain read from and written to the driven ports
    application/                   CharterAuthoring, CharterVendoring, TestAuthoring, McpReaching, dtos.ts
    port/
      driver/                      ForManagingCharter, ForVendoringCharters, ForAuthoringTests, ForReachingMcps
        dtos/                      dto.ts, data.ts, outcome.ts, index.ts: every DTO
      zdriven/                     ForReadingFiles, ForWritingFiles, ForVCS, ForParsingYaml, ForReportingProgress,
                                   ForKeepingSecrets, ForCallingMcpServers, ForAuthorizing
    utils/globs.ts                 covers and matches, over picomatch
  driver/
    cli/                           Commander (yargs), Command, one class per command
    portal/
      routes.ts                    the Hono routes under /api, one per use case; the app hc is typed by
      server.ts                    startPortal: the routes and the page on node:http, behind the guards of §12.4
      page/                        runs in the browser; imports the DTOs and the type of routes.ts, nothing else of ours
    mcp/server.ts                  startMcpServer: the SDK's Server over stdio, answering through ForReachingMcps
  zdriven/                         files, git, YAML, the terminal, the credential store, MCP clients, OAuth,
                                   and in-memory adapters for tests
main.ts                            composition root: which adapter fills which port
test/                              named after the behaviour, kebab-case, flat
```

### 2.1 Domain (`src/hexagon/domain/`)

The kinds, primitives and identity, mixin lending, validation, the layers,
compilation and test resolution. It may import nothing but itself and three
libraries — no `node:*`, no adapter, no driver.

`lodash`, `picomatch` and `zod` are exceptions because of what they are: one
answers questions about lists and objects, one about whether a glob matches a
string, and one about the shape of a value, and none of them knows where what it
is handed came from. So none of them carries a notion of a disk, a network or a
format into the domain. A library that does — YAML, git — is still a port.

A `Primitive` cannot exist missing a header its kind requires: the kind's class
reads its headers through its zod schema and hands back an instance or every
fault the file has, and nothing else builds one ([§4.2](#42-reading-one-primitive-fr-001--fr-004)). The type is
discriminated on `kind`, so `headers.globs` compiles on a guide and a type error
is what reading a header another kind holds costs.

Failures are faults, collected: a run names every bad file rather than the
first. Every fault carries the next move beside what is wrong ([FR-012](spec.md#fr-012)).

Consequence worth stating: every domain test is a function call on data. No
temporary directory, no repository to set up, no cleanup.

### 2.2 Dependency rules

`dependency-cruiser` holds the architecture in place, run as the first step of
the test suite over the real dependency graph, so transitive edges, `require`
and dynamic `import()` all count. The rules live in `.dependency-cruiser.cjs`:

| Rule | Says |
|---|---|
| `hexagon-is-sealed` | `src/hexagon` imports nothing outside itself but `lodash-es`, `picomatch` and `zod` |
| `driver-enters-through-its-port` | a driver reaches the hexagon through `port/driver/` or the application behind it, and nothing else; what it needs from inside is exported by the port |
| `driven-answers-only-its-port` | a driven adapter knows nothing of the hexagon but the driven port it implements |
| `dtos-are-zod-only` | `port/driver/dtos/` imports `zod` and nothing else, so nothing more of the hexagon is bundled into the page |
| `models-know-no-dto` | `domain/` and `service/` import no driver port, so a model knows nothing of what a driver reads; the application makes the DTOs ([§2.5](#25-models-are-classes-and-a-driver-reads-their-dtos)) |
| `page-is-browser-code` | `src/driver/portal/page` imports only itself, `port/driver/dtos/`, `routes.ts`, `react`, shadcn's own (`radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`), `@tanstack/react-query`, `@codemirror/*`, `marked`, `zod` and `hono` |
| `page-knows-routes-only-as-types` | what the page imports from `routes.ts` is types, for `hc`, and nothing that runs |
| `adapters-do-not-know-each-other` | a driver and a driven adapter meet only at `main.ts` |
| `no-circular` | a cycle means two modules are one wearing two names |
| `no-orphans` | a module nothing imports is dead or wired up wrong |

The page cannot reach the hexagon, the filesystem or Node: what it knows is the
JSON the server answers with. That is [FR-108](spec.md#fr-108) as a build failure rather than a
promise.

A runtime wrapper would be weaker than these rules — importing the real module
bypasses it — and a regular expression over import lines weaker again, seeing
only direct and statically written imports.

### 2.3 Ports (`src/hexagon/port/`)

Named `For…ing` the thing they do, never for the technology behind them:
`ForReadingFiles`, not `FsReader`. A port says what the hexagon needs done, so
reading a charter out of a git object database later is a new adapter and no
change inside. A port stays at the width of what it does: reading files is one
job whichever use case asks for it, so there is no separate port per caller.

**Driver** — what the hexagon offers. The command line and the portal call the
same ones.

| Port | Use cases |
|---|---|
| `ForManagingCharter` | `doctor`, `list`, `explain`, `build`, `preview`, `test`, `listPrimitiveRequirements`, `kinds`, `add`, `settings`, `ensureRepoReady`, `init`; and, for the portal, `open`, `rewrite`, `remove` ([§9.4](#94-opening-rewriting-and-deleting-a-primitive-fr-075--fr-079)) |
| `ForVendoringCharters` | `add`, `remove`, `installed` ([§7](#7-vendor-sources)) |
| `ForAuthoringTests` | `suites`, `addSuite`, `writeSuite`, `removeSuite` ([§11.3](#113-managing-test-files)) |
| `ForReachingMcps` | `signInStatus`, `signInWithToken`, `signInWithOAuth`, `served`, `call` ([§19](#19-knowledge-reached-through-mcp-fr-141--fr-157)) |

Managing a charter is one conversation — authoring and reading one repository's
charter — so it is one port rather than one per caller. Vendoring is apart
because it is a different conversation: nothing on it reads a charter, and
nothing on the other installs anything.

Which repository a port speaks for is what it was constructed with, never what
each call passes, so no use case can be pointed at another repository halfway
through.

**Driven** — what the hexagon needs.

| Port | What it promises | Adapter |
|---|---|---|
| `ForReadingFiles` | the files under a folder, the folders one level under one, and one file's text if it is there | `FileReaders`, `InMemoryFileReaders` |
| `ForWritingFiles` | write a file, delete one | `FileOutput`, `InMemoryFileOutput` |
| `ForVCS` | is this a repository, is it clean, what changed under a folder, add or update a subtree, remove a folder as a commit | `Git`, `InMemoryVCS` |
| `ForParsingYaml` | one frontmatter block as named fields | `YamlParser` |
| `ForReportingProgress` | results, and problems with the next move | `ConsoleReporter` |
| `ForKeepingSecrets` | one secret under a key: read, write, remove | `OsSecrets` (`security`, `secret-tool`), `InMemorySecrets` |
| `ForCallingMcpServers` | the tools one server lists, and one call to one of them: a server reached over HTTP under a bearer credential, or a local process started with its token in its environment and stopped on close | `McpClients` (the SDK's Streamable HTTP and stdio clients), `InMemoryMcpServers` |
| `ForAuthorizing` | an OAuth sign-in to one server, and a renewal: the credential it ends with | `OAuthFlow` (the SDK's OAuth client, a callback on `127.0.0.1`), `InMemoryAuthorizing` |

Reporting is a driven port like any other, which is why the command line has no
output type of its own: the terminal is one adapter for it, and a test binds
another. A port earns its place by having a second plausible implementation or
by being what a use case must be denied; anything else is called directly.

### 2.4 Application (`src/hexagon/application/`)

One class per driver port — `CharterAuthoring`, `CharterVendoring` and
`TestAuthoring` — taking
its driven ports through the constructor and holding them under the port's type,
so the compiler refuses a reach past the interface. It orchestrates and holds no
rule of its own: rules live in the domain, on the models or in a domain service
beside them. Between the two sit the `service/` modules, which read the domain
off the driven ports and write it back: `loadCharterRoot`, `loadSettings`,
`loadTestRoot`, `driftedVendors`, and the build's plan ([§6](#6-compiling-and-building)).

The reader/writer split ([FR-093](spec.md#fr-093)) is what each use case is, not what it is
grouped under. A reading use case — `doctor`, `list`, `explain`, `preview`,
`test`, `listPrimitiveRequirements`, `kinds`, `settings`, `open`, `suites` —
calls no writing port, and the hexagon has no filesystem to reach for behind the
ports ([§2.2](#22-dependency-rules)). Every write comes from a use case whose purpose is to write:
`build`, `init`, `add`, `rewrite`, `remove`, `addSuite`, `writeSuite`,
`removeSuite`, and the two vendoring commands.

### 2.5 Models are classes, and a driver reads their DTOs

The hexagon's models and what crosses its driver ports are settled the way the
hexagon sample settles them with `Task` and `toSnapshot()`. The shapes — the DTO
envelope, the two sets, what each port method answers — are data-model [§12](data-model.md#12-what-crosses-a-driver-port).

- **Every model a use case answers with is a class.** The catalogue, a scoped
  primitive, a plan summary, a test run, the settings, the faults under each
  file: the service that makes one hands back an instance. A model no use case
  answers with stays an interface or a type until one does (data-model [§12.5](data-model.md#125-not-models)).
- **The application turns each model into its DTO**, with one function per DTO
  in `application/dtos.ts`. A model knows nothing of DTOs — the sample's
  `toSnapshot()` is made here rather than on the entity — and the rule
  `models-know-no-dto` keeps the domain and its services from importing one.
- **The application answers DTOs.** A use case calls the services, takes the
  classes they hand back, and returns the DTO of what it answers with.
- **A driver knows DTOs and nothing else of the hexagon's**, beside the
  constants a charter is made of, which the driver port re-exports. The command
  line switches on `type`, the server sends a DTO as it is, and the page parses
  it with its schema.

Every DTO is declared once, in `src/hexagon/port/driver/dtos/`: `outcome.ts`
holds `OutcomeDTOs`, `data.ts` holds `DataDTOs`, and what every DTO is written
with — `dto`, `byType`, the list of strings — is written once, in `dto.ts`.
`index.ts` exports them. Since a DTO's `type` is its key, whatever reads one
untyped — the page, most of all — parses it by looking its schema up by that
`type`; each set is built by reading each schema's own `type` for its key, so the
two cannot drift apart. The folder imports `zod` and nothing else, since the
page bundles it ([§2.2](#22-dependency-rules)).

`DoctorOutcome` is an outcome so that no driver counts or judges what checking a
repository found again ([§10.1](#101-doctor-fr-013-fr-014-fr-080-fr-081)). An answer that is a collection is made a model
of its own so that it carries a `type` (data-model [§12.4](data-model.md#124-answers-that-are-collections)).

A use case that cannot run raises a `Fault`: a raise is not an answer, and the
command line reads it as the usage error it is, while the portal sends it as
`DataDTOs.Fault` ([§12.2](#122-the-route-table)). What a charter is wrong with is an answer,
`DataDTOs.FaultsByFile`, given back rather than raised.

### 2.6 Adapters and the composition root

`src/driver/` holds what calls in: the command line under `cli/`, the portal
under `portal/`. `src/zdriven/` holds everything the hexagon is driven by — files,
git, YAML, the terminal — and an in-memory adapter for each port a test needs to
bind. A port gets an in-memory implementation when a test needs one, not before.

The two are named differently because they play opposite roles: a driver calls
in, a driven adapter is called out to. Splitting them by that, rather than by
technology, is what makes "this module may not be imported by the hexagon" a
rule with a single meaning.

An agent's format is modelled in the domain, under
`domain/models/output/providers/<host>/`: one class per kind that host has, each
answering for how its own file is written. Which primitives become which of them
is one arm per host in `compileService`, and where each lands is one arm per
kind in `projectionService`. Supporting another agent is a folder beside
`claude/`, an arm in each of the two services, and a member of
`AGENT_PROVIDERS` — the charter format does not change ([FR-030](spec.md#fr-030), [FR-031](spec.md#fr-031)).

`main.ts` is the composition root — the only module that names a concrete class.
Each binding is declared as its port, so the compiler confirms that swapping an
adapter needs no change inside. The command line is the one entry: `cw portal`
starts the server with the ports its `Context` already holds ([§12.1](#121-shape)).

## 3. On-disk layout

```
.cw/
  settings.json          what this repository answered at setup (the agents it compiles for)
  charter/
    guide/ sensor/ command/ skill/ playbook/ agent/ posture/ corpus/ mixin/
  test/<name>.json       self-regression tests, read by cw test (authored)
  vendor/<name>/         vendored charter content, committed by git subtree
                         (the same kind folders, one layer per vendor)
  out/
    catalog.json         full catalogue                (generated)
    catalog.min.json     reduced catalogue             (generated)
    CHARTER.md           agent-neutral orientation     (generated)
CLAUDE.md                the repository's own file, one generated section in it
.claude/                 claude projection             (generated, beside the repository's own files there)
```

One directory holds all three: what the repository configured, what it
authored, and what that compiles to. `settings.json` is the repository's own —
it is not part of the charter, and no primitive says anything about it — so it
sits beside the charter rather than inside it. Everything under `out/` is
generated, which is what makes a build's deleting there safe ([FR-032](spec.md#fr-032)). The
paths are named once, in `src/hexagon/domain/path.ts`.

The kind directory names are reserved. A vendor installs into a folder of its
own under `.cw/vendor/`, beside the charter rather than inside it, so no vendor
source can land on top of what this repository authored ([FR-044](spec.md#fr-044)). `.cw/vendor/`
is committed ([FR-046](spec.md#fr-046)), and so is everything under `.cw/out/` and every
projection, which is what CI gates on ([SC-007](spec.md#sc-007)).

The builtin layer has no place here at all. It is supplied on every read and
kept nowhere in the repository ([§5.3](#53-the-builtin-layer-supplied-rather-than-stored-fr-017--fr-024)).

## 4. Reading and validating the charter

### 4.1 The one read path (FR-009, SC-010)

`loadCharterRoot(repo, fileReaders, yamlParser)` in `service/charterRepo.ts` is the
one way a charter is read. It reads the markdown files in the kind folders of
`.cw/charter/`, the same under each folder of `.cw/vendor/`, and the builtin
layer written out in memory ([§5.3](#53-the-builtin-layer-supplied-rather-than-stored-fr-017--fr-024)), and hands the three layers apart to
`charterRootOf` in `domain/models/charter/CharterRoot.ts`, which reads each file
into a primitive and holds every fault under the file it came from
(data-model [§4](data-model.md#4-the-charter-read)). Only a kind folder is looked in, and only a markdown file there
is read, so the catalogues, a README and whatever git keeps beside them are
never read as primitives ([FR-002](spec.md#fr-002)).

Which layer a file belongs to is settled where the folders are, in the service.
The charter is handed its layers apart and works nothing out from a path.

Reading each file once is a matter of passing the `CharterRoot` on rather than
of caching: `doctor` validates, previews and answers from one loaded value. A
cache across runs would have to live on disk, where it can go stale and answer
for a charter that has since changed. Each `cw` run is a process that loads,
works and exits; the read is milliseconds.

### 4.2 Reading one primitive (FR-001 – FR-004)

`primitiveOf` in `domain/models/charter/primitive/Primitive.ts` takes either the
text of a file plus the YAML parser, or headers and a body a caller already
holds (what `cw add` and the portal gather). From text it splits the frontmatter
block off the body, parses the block through `ForParsingYaml`, takes the `kind`
the headers declare, and hands them to that kind's class. A file that declares
no kind, or one outside the set, is refused naming the kinds there are ([FR-003](spec.md#fr-003)).

Each kind is one class under `primitive/`, extending `BasePrimitive`, and the
class is the kind's whole contract (data-model [§1.4](data-model.md#14-the-kinds-contract)): its zod schema, what it
requires, when it activates and its sample. `headersOf` parses the headers with
the schema and, when they do not hold, gives one fault showing the kind's own
sample rather than a list of what is wrong header by header — an author holding
the two side by side sees the difference. `PRIMITIVE_CLASSES` lists the classes;
`KINDS` and the `Primitive` union are read back off it. Adding a kind is a class
beside the others and a line in that list.

`toMarkdown()` on a primitive is the other direction of the reading: its
headers between the delimiters, `kind` first, and its body under them. A file
written by it reads back as the same primitive, which is what `cw add`, the
portal and the builtin layer all rely on.

### 4.3 Validation across files (FR-010 – FR-013)

Reading refuses a file whose own headers do not hold, and says so under that
file. What is left are the questions no single file answers, asked by
`compositeFaultsByFiles` on `CharterRoot` over every layer at once:

- a second file claiming an identity already claimed ([§5.1](#51-one-identity-one-primitive-fr-015-fr-016));
- a mixin named that no layer holds ([FR-007](spec.md#fr-007));
- a mixin whose files neither cover nor are covered by its host's ([§5.2](#52-mixins-fr-006-fr-007));
- a `rationale` citing no corpus the charter holds, as a `warn` ([FR-005](spec.md#fr-005));
- an `mcps` entry naming no `mcp` the charter holds, as an `error` ([FR-143](spec.md#fr-143));
- a local command declared with two `tokenEnv`s, and the served tool names too
  long for a host, each an `error` ([§19.3](#193-the-list-of-places-fr-145-fr-157));
- the four warnings of [§4.4](#44-the-four-validation-warnings-fr-014).

`allFaultsByFiles` is the two together, the faults of reading and of reading
together, under the file that has to change. A fault of severity `error` stops
a build, a listing, an explanation and a test run, each of which hands the
errors back rather than acting on a charter that does not hold ([FR-040](spec.md#fr-040)). A
`warn` is said and stops nothing.

Validation is no command of its own ([FR-013](spec.md#fr-013)). It is a private step of
`CharterAuthoring`, and `doctor` is where its whole report is read ([§10.1](#101-doctor-fr-013-fr-014-fr-080-fr-081)).

### 4.4 The four validation warnings (FR-014)

The four warnings and the file each is filed under are data-model [§6.1](data-model.md#61-the-four-warnings-fr-014). The
first three — a corpus nobody cites, a mixin nobody lends from, an mcp nobody
names — are raised in `compositeFaultsByFiles`, each a `warn`.

The fourth, a guide or sensor that no test case names, needs the tests.
So validation reads `.cw/test/` beside the charter and the settings, and a
function beside `runSuite` in `testService` answers it. A test file that does
not read is skipped for this question — `cw test` is where it is named — so a
broken test file does not also flood validation.

## 5. Identity and layers

### 5.1 One identity, one primitive (FR-015, FR-016)

Identity is `kind:id`, read from the headers, never from a file's basename.

It names one primitive in the whole charter, whichever layer authored it. The
layer says where a file came from and who maintains it; it is no part of what
the primitive is called. What this repository authored and what a vendor
published are both `guide:no-any`, and two files claiming that are reported as a
collision naming both — a vendor claiming an id this repository authored
included.

The alternative was to prefix a vendor's name onto its identities, which would
make the two never collide. It was not taken: a reader would then have to know
which layer a primitive came from before they could name it, and the same rule
would have to be carried into `mixins`, `rationale` and every listing. A
collision is rare, says exactly what is wrong, and is fixed by whoever authored
the second file.

There is no cascade, no precedence and nothing to mark absolute. A repository
takes what it vendors, and what the engine brings, as it stands; to differ from
such a primitive it authors one under its own identity. This is how a package
registry works, and it is what the reference design's live path already did
([§16](#16-read-of-the-reference-design)).

A mixin is named the same way, by its id, and a corpus by `corpus:<id>`,
whichever layer published it — so a host names a vendored mixin the way it names
one of its own.

### 5.2 Mixins (FR-006, FR-007)

A mixin lends its body, and nothing else. The host's own headers are the whole
of its headers, and the mixin's text is written before the host's own body by
`bodyOf` on `CharterRoot`, the one place a mixin is applied — so there is no
merge step, no resolution order to hold in mind, and a primitive on disk reads
as the primitive that compiles ([FR-037](spec.md#fr-037)).

What ties the two together is the files they speak about. A guide's body is
loaded when a touched file matches its globs, so a mixin lent to it must speak
about those same files: one side's globs cover the other's, in either
direction, and neither covering the other is reported. A side naming no files
at all — a skill, a command, a mixin of plain prose — is asking about nothing in
particular, and is left alone. Coverage is glob algebra, decided by `covers` in
`hexagon/utils/globs.ts` over `picomatch`: it knows about glob strings and
nothing about charters, so it sits beside the domain's vocabulary rather than in
it.

A mixin is a leaf: its schema takes no `mixins`, so a mixin naming one is
refused where its headers are read (data-model [§1.5](data-model.md#15-mixin)).

The kind is named for the familiar composition idea rather than the reference
design's term, `concern`, which was chosen when the kind still meant a
cross-cutting review lens and no longer describes what it became.

### 5.3 The builtin layer, supplied rather than stored (FR-017 – FR-024)

`CharterRoot.ts` holds three scopes, `repo`, `vendor` and `builtin`
(data-model [§3.2](data-model.md#32-scope-fr-017--fr-024)), and `charterRootOf` takes `{ repo, vendor, builtin }`.

`loadCharterRoot` turns each primitive of `BUILTIN_PRIMITIVES` ([§5.4](#54-what-the-engine-brings-fr-096--fr-103)) into an
in-memory file — a path and the text `toMarkdown()` gives — and hands those in
as the third layer. It reads nothing from disk for them and writes nothing. They
are then read by `primitiveOf` like every other file: the same zod headers, the
same collision check, the same mixin and rationale checks. **There is no second
way into the charter.** A ready-made `Primitive` handed straight to
`CharterRoot` would be the one primitive nothing validated, which is why the
third layer is files and not primitives ([FR-020](spec.md#fr-020), data-model [§4.2](data-model.md#42-the-files-a-charter-is-read-from)). Serialising
and reading back costs one `toMarkdown()` and one parse per shipped primitive,
per read, and there is one.

**Read order is builtin, then repo, then vendor**, each layer in the order its
paths sort in. The first claim on an identity is the one `primitiveById` keeps,
and the second is the file a collision is filed under. Reading the engine's
layer first means a repository that authors `skill:cw-author` reads the fault
against its *own* file, with a fix it can act on: the collision's fix says that
an id the engine claims is the engine's own and the one to rename is yours
([FR-021](spec.md#fr-021)). The other order would file the fault against something the author
cannot open.

**The path is a name, not a location.** `BUILTIN_PATH_PREFIX` is
`(built into cw)`, so a primitive of this layer names its file
`(built into cw)/skill/cw-author.md` wherever a file is named — in a fault's
key, in the catalogue, in `cw explain`, in the portal. It stays a plain string,
so no reader of a file path grows a branch or an optional, and it says which
layer the primitive came from the way `.cw/vendor/<name>/…` does, so the
catalogue needs no new field. The generated `CHARTER.md`, where it explains
identities, names the third layer ([FR-022](spec.md#fr-022)).

Nothing else learns the layer exists. `path.ts`, `init`, `doctor`, the vendor
commands, `tsup.config.ts` and `package.json` are untouched by it: a layer that
is never written needs no directory named, no command taught to refresh it, no
health check asking whether it is current, and nothing added to what the
package ships ([FR-018](spec.md#fr-018), [FR-023](spec.md#fr-023)). The portal shows a builtin primitive through the
catalogue like any other, its file naming its layer ([FR-019](spec.md#fr-019)).

### 5.4 What the engine brings (FR-096 – FR-103)

`CwAuthorSkill` in `domain/models/charter/builtin/CwAuthorSkill.ts` extends
`SkillPrimitive`: its headers typed by the kind's own `SkillHeaders`, its body a
template literal. `builtin/index.ts` exports `BUILTIN_PRIMITIVES`, one entry
today, and a list because `loadCharterRoot` iterates, not because a second is
planned (data-model [§5](data-model.md#5-what-the-engine-brings-fr-096--fr-103)).

A class rather than data read at run time: a kind that grows, renames or drops
a header stops this module compiling, so the failure lands on whoever changed
the kind, in `pnpm run typecheck`, rather than on a user's `cw build`.

Its triggers bring it up when what is asked is to write a rule, a standard, a
skill, a command or any other primitive of the charter ([FR-100](spec.md#fr-100)). Its body names
no header of any kind ([FR-097](spec.md#fr-097)) and says the procedure ([FR-098](spec.md#fr-098)):

1. `cw kinds` — which kind this belongs to, if it is not already known.
2. `cw kinds <kind>` — what that kind requires.
3. `cw add <kind> <id> --header <name>=<value> …` — one flag per header,
   repeated for a list.
4. Write the body into the file the command named.
5. `cw build`, and `cw doctor` when a build refuses.

It also says that it is cw's own and not authored in this repository, that a
repository wanting something else authors its own primitive ([FR-099](spec.md#fr-099)), that
changing or removing a primitive is not what it covers ([FR-101](spec.md#fr-101)), and how a
refusal is read and answered ([FR-102](spec.md#fr-102)). Every command it names is one `cw` has
([FR-103](spec.md#fr-103)).

## 6. Compiling and building

### 6.1 One pass produces everything (FR-030 – FR-034, SC-004)

`compile(charter, agents)` in `domain/services/compileService.ts` returns a
`CharterOutput` (data-model [§8](data-model.md#8-compiled-output-fr-030--fr-040)): the catalogue, `CHARTER.md`, every compiled
primitive, and each agent's components. The catalogue, `CHARTER.md` and the
compiled primitives are compiled whether an agent is chosen or not ([FR-031](spec.md#fr-031)); each agent the repository chose adds its own components,
one per primitive that host has a kind for. There is no exported path that
produces the catalogues without the projections, which is the whole of [SC-004](spec.md#sc-004).

`charterOutputProjection` in `projectionService.ts` turns that output into
projections — a path, the contents and how the file goes down — which is the
one place an output becomes a file. The build's `plan` in
`service/buildService.ts` puts two halves side by side: the projection plan,
what this reading of the charter puts down, each file read with what it holds
now; and the cleanup plan, everything the last build left that the engine owns —
everything under `.cw/out/`, and every stamped document under a host's
directory. `executePlan` writes the first and deletes whatever of the second the
first does not write again; `previewPlan` compares them and writes nothing
([§6.4](#64-preview-fr-034)). Both answer the same `PlanSummary`.

The stamp is what makes deleting under a host's directory safe: that directory is
also where someone may keep a command or a skill of their own, and a path cannot
tell the two apart. Every compiled document carries one; a hand-written file
does not, and is left alone. Which agents are compiled for is read from
`.cw/settings.json`, what the repository answered at setup, never from what is
installed on the machine ([FR-038](spec.md#fr-038)).

What the charter compiles to for claude: a guide is a rule under
`.claude/rules/`, its `paths` its globs; a command a command; an agent an agent
with its tools; a skill and a playbook both a skill, because that host has one
mechanism for a body loaded when the request calls for it; a posture's
permissions and a sensor's hooks one settings file; every mcp together one entry
of `.mcp.json` ([§19.4](#194-what-the-agents-host-is-given-fr-146-fr-147-fr-156)). A corpus and a mixin compile to nothing of their own. Each document carries its body with the bodies of the
mixins it pulls in before it ([FR-037](spec.md#fr-037)). A claude file is named by the identity
with its separators replaced, so `guide:no-any` and `skill:no-any` stay two
files.

Every primitive of every layer is also written as it compiles, to
`.cw/out/<kind>/<id>.md`: its headers, then `bodyOf` — its mixins' bodies before
its own ([FR-139](spec.md#fr-139)). That is the file the catalogue names ([FR-140](spec.md#fr-140)), so an agent that
opens an entry reads the whole primitive, from one folder, whichever layer
brought it, the engine's own included. The path is said once, by `compile`, as
the catalogue entry's `file`; the projection walks the catalogue and puts each
compiled primitive at the file its entry names, found by identity, so the two
cannot name different files. Nothing new is needed to delete one: the cleanup plan
already reads everything under `.cw/out/`.

The catalogue is output for an agent, and says nothing of layers. `cw list` and
the portal list the charter, not the catalogue: `list` reads the charter root's
scoped primitives, whose `file` is where each was authored, so a person is still
shown the file to edit and the layer it came from.

A charter with an error compiles nothing and writes nothing ([FR-040](spec.md#fr-040)): the build
hands the errors back.

### 6.2 How each file goes down

How one file goes down over what is there is the output's own to say, as its
`ProjectionPolicy`, and there are three answers:

- `replace`, for a file the charter owns, written whole;
- `mergeJSON`, for a file the charter shares with the repository — a host's
  settings — written into by field, every posture and sensor landing beside what
  the repository set there for itself ([FR-039](spec.md#fr-039)). It carries no stamp and is never
  deleted;
- `upsertWithMarker`, for a file that is the repository's, of which the charter
  has one section ([§6.3](#63-the-hosts-entry-file-fr-035-fr-036)).

### 6.3 The host's entry file (FR-035, FR-036)

A host reads its own entry file unasked, and reads nothing under `.cw/out/`
until something has sent it there. So each agent the repository compiles for
gets one more projection: a section of its entry file — `CLAUDE.md` at the root
for claude — that says where `CHARTER.md` is and carries no charter content. It
stays the same size for a charter of four hundred guides as for one of four
([SC-005](spec.md#sc-005)). A repository compiling for no agent has none of it.

The section says where it starts and ends in its own first and last line,
`<!-- CHERRYWORKS START -->` and `<!-- CHERRYWORKS END -->`. The build reads
those two lines off the contents it was handed: where the file already carries
them the section is written between them, once however many times it appeared;
where it does not the section goes after what is there; and everything else in
the file is left exactly as it was. So nothing in the build knows what this
engine's marker looks like, and a second output written this way brings its own.

The file is not generated output: a build never deletes it, and it carries no
stamp, since the file is somebody else's with a section of the charter's inside
it. The cleanup plan never sees it, since it looks under `.cw/out/` and a host's
own directory and this sits at the root.

`CHARTER.md` itself says what governs the repository, sends its reader to
`catalog.min.json` first, says for each kind when it applies — each line read off
that kind's own class — and explains identities ([FR-036](spec.md#fr-036), [FR-022](spec.md#fr-022)). It carries no
primitive body, so it does not grow with the charter.

### 6.4 Preview (FR-034)

`preview` works out the same plan a build acts on and stops short of disk: every
target is listed as added, edited, deleted or unchanged, a file both halves name
being one the build writes again rather than deletes. A file already holding
byte for byte what the build compiles to is unchanged, which is the whole of the
question a preview asks: a repository where every file is unchanged is one that
is fully built ([SC-007](spec.md#sc-007)). `cw build --preview` exits with a failure status when
anything would change.

### 6.5 The builtin layer needs no case of its own (FR-024)

The charter `compile` is given already holds `skill:cw-author`, because
`loadCharterRoot` supplied it; the projection already knows where a skill compiles
to for each agent the repository chose; the build already writes what the plan
lists and deletes the stamped projection of a primitive that is gone. So:

- **`build`** compiles it to `.claude/skills/skill-cw-author/SKILL.md` with no
  case for it, and an engine that stops bringing it leaves nothing behind.
- **`preview`** lists that surface like any other target.
- **`doctor`** gains no line. Nothing is on disk to be stale, hand-edited or
  behind — the question it would have answered cannot be asked.
- **`init`** writes what it writes anyway. A repository is governed by this
  primitive from its first read, not from a file setup left behind.
- **The vendor commands** do not touch it, because there is nothing under the
  workspace for them to touch ([FR-023](spec.md#fr-023)).

## 7. Vendor sources

### 7.1 Installing, updating and removing (FR-041 – FR-052)

`CharterVendoring` in `application/` is the use case; `ForVCS` and the `Git`
adapter behind it are the mechanism. Two questions come first — is this a
repository, and is there work in hand — since what is installed lands as a
commit on the branch checked out ([FR-051](spec.md#fr-051)).

The source is handed to `git subtree` as it was typed, whatever transport it
names, so every transport git supports works and what git says when it refuses
is what the user reads ([FR-049](spec.md#fr-049)). What lands is committed under
`.cw/vendor/<name>/`, `<name>` being the end of the address without a trailing
`.git` ([FR-050](spec.md#fr-050)). `add` is `git subtree add` where the folder is not there and
`git subtree pull` where it is, so installing and updating are one command
([FR-047](spec.md#fr-047)). `--squash`, because what is installed is content to read and not a
history to keep. Any number of sources, each its own folder ([FR-045](spec.md#fr-045)). Nothing is
compiled ([FR-052](spec.md#fr-052)).

`remove` takes the folder away and commits that it is gone, the way installing
committed it, named by the folder it was installed as.

The repository's history is the only record of what was installed ([FR-046](spec.md#fr-046)).
Drift is version control's answer too: `driftedVendors` in `service/vendorRepo.ts`
asks git what differs under `.cw/vendor/`, and names each vendor folder once
however many of its files differ ([FR-081](spec.md#fr-081), [§10.1](#101-doctor-fr-013-fr-014-fr-080-fr-081)). A hand-edit to vendored content
is undone with git, as any other change is.

### 7.2 Listing what is installed (FR-053, FR-122)

`installed()` on `ForVendoringCharters` answers every folder under
`.cw/vendor/`, as data-model [§10.2](data-model.md#102-vendor-folders-fr-053-fr-122) says it, and `cw vendor list` prints it.
The folders are read with `ForReadingFiles.listFolders`, the way the charter
finds its vendor layers, so what is listed is what the charter reads.

Nothing more is said of a folder. `git subtree --squash` records the folder and
the upstream commit, not the address or the version asked for; git itself
keeps no record of a subtree beyond those lines in a commit message. Writing
them into the commit ourselves, or into a lock file beside the vendor folder,
was weighed and dropped: either is a record the engine keeps and has to keep
true ([FR-046](spec.md#fr-046)), for an answer the person who installed a source already has.
A submodule would have git answer the address, and was not taken either: its
content is not committed, so a checkout would not carry the whole charter.

## 8. Setup (FR-054 – FR-058)

`cw init` asks, and the use case acts. The command gathers every answer — from
the flag, from what the repository already chose, or from whoever is at the
terminal — and only then calls `init`, which is handed a decided set of answers
and puts no question of its own. Every question has a default and a matching
flag, so the whole run is scriptable ([FR-056](spec.md#fr-056), [SC-011](spec.md#sc-011)); the one without a default
is the agent in a repository that has chosen none, and a run with nobody to ask
stops naming `--agent`.

`init` refuses outside a git repository ([FR-054](spec.md#fr-054)), creates the charter root with
a directory per kind, and writes `.cw/settings.json`. It compiles nothing —
compiling is the build's, run once there is a charter to compile — and commits
nothing ([FR-057](spec.md#fr-057)).

The agent is chosen from the list this engine compiles for,
`AGENT_PROVIDERS`, never from what is installed here: claude chosen is claude
compiled for, and the build makes `.claude/` if it is missing ([FR-055](spec.md#fr-055)). A second
run reads the settings and offers what the repository already chose as the
selected answer, so a return keeps what is there, and nothing authored is
touched ([FR-058](spec.md#fr-058)).

## 9. Kinds and authoring

### 9.1 What a kind requires (FR-059, FR-062, FR-063)

`listPrimitiveRequirements(kind)` answers `PrimitiveRequirements`
(data-model [§2.1](data-model.md#21-primitive-requirements-fr-059-fr-062)): every header the kind takes, each with its shape and whether
the kind refuses a file without it, and the kind's sample written out as a file's
frontmatter holds it. `primitiveHeadersOf` reads the headers off the kind's zod
schema — so a header the kind takes without requiring, such as a guide's
`globs`, has the shape it is read as — and marks as required what the kind's
`requires` and the common `requires` name. `primitiveSampleOf` writes the
class's own `sample` out, `kind` first, the same text a refusal quotes as its
fix.

This is the one declaration of what a kind requires. The prompts of `cw add`,
the answer of `cw kinds <kind>`, the refusal's fix line and the portal's form
are it read four times, so no surface restates it ([FR-062](spec.md#fr-062)). No charter is read
to answer it: what a kind demands is the kind's own contract, the same in a
repository that has authored nothing.

A header drawn from a closed set — a sensor's `signal` — also carries its
allowed values, read off the kind's schema, so the portal offers them as a
choice ([FR-118](spec.md#fr-118), data-model [§2.1](data-model.md#21-primitive-requirements-fr-059-fr-062)). The kind of a new primitive is a closed set
too: `kinds()`.

`kinds()` answers every kind under the line saying when a primitive of it comes
up (data-model [§2.2](data-model.md#22-primitive-kinds-fr-060-fr-113)), read off each class's own `activatesWhen` — the same
declarations `CHARTER.md` compiles its "When each kind applies" section from, so
a listing and the agent's own orientation cannot come to say different things
([FR-113](spec.md#fr-113)). It sits beside `listPrimitiveRequirements`: both answer what a kind is,
and neither reads a charter.

### 9.2 `cw kinds [kind]` (FR-059 – FR-061)

One optional positional. With none, `kinds()`: one line per kind and when it
comes up. With one, `listPrimitiveRequirements`: that kind's headers, the shape
of each and whether it is required, and its sample, printed as a primitive's
headers are written — so what the agent reads is the shape of the file it is
about to ask for. A word that is no kind raises the fault every unknown kind
raises, naming every kind there is ([FR-061](spec.md#fr-061)). No use case is added: this is a
driver surface for what the engine already answers behind its port ([FR-063](spec.md#fr-063)).

### 9.3 `cw add <kind> <id>`: prompts and header flags (FR-064 – FR-074)

`cw add` writes `.cw/charter/<kind>/<id>.md`, the convention, since where a file
sits decides only that it is looked at ([FR-002](spec.md#fr-002)). `writeCharter` in
`service/charterRepo.ts` is the other direction of `loadCharterRoot`: it refuses a
file already there rather than write over it, and writes `toMarkdown()` of the
primitive `primitiveOf` read from the answers — the same reading a file gets, so
there is no second reading of a kind's contract to keep in step with the first.
An identity claimed anywhere in the charter is refused naming the file claiming
it ([Story 10](spec.md#user-story-10---write-a-primitive-with-no-terminal-to-answer-at-priority-p1), scenario 5). Nothing is compiled and nothing committed ([FR-074](spec.md#fr-074),
[FR-079](spec.md#fr-079)). `add` takes a body, empty from the command line, typed from the portal
([FR-117](spec.md#fr-117)).

The asking is the command's, as `cw init`'s is. It asks
`listPrimitiveRequirements`, and then one of three things happens:

- **Header flags given.** `--header` is a repeatable string option.
  `parseKVParams` in `driver/cli/commands/helper.ts` reads each into a name and a
  value, splitting on the first `=`; a flag with no `=` is a fault naming the
  flag ([FR-068](spec.md#fr-068)). The values are grouped by the shape the kind gives each header:
  a list header keeps every value in the order given, a line header given twice
  is a fault naming it ([FR-067](spec.md#fr-067)). Nothing is prompted, whether or not a terminal is
  attached ([FR-070](spec.md#fr-070)). A required header nobody answered is left out of the record,
  where the engine's `add` refuses it with the kind's sample ([FR-071](spec.md#fr-071)); a header no
  kind takes is refused by the engine naming it rather than dropped by the schema
  ([FR-072](spec.md#fr-072)).
- **No flag, a terminal.** One question per header the kind requires, in the
  order the engine named them, each asked as a line or a list ([FR-065](spec.md#fr-065)). A header
  the kind takes without requiring is not asked ([FR-069](spec.md#fr-069)).
- **No flag, no terminal.** The command writes nothing and prints the headers it
  would have asked for, rather than waiting for an answer nobody will type
  ([FR-065](spec.md#fr-065)).

`k=v` is a command-line shape, and the engine already takes headers as a
record, so nothing behind the port learns that a flag exists. A prompt and a flag
produce the same record (data-model [§2.3](data-model.md#23-header-answers-fr-064--fr-074)), so the engine cannot tell which was
used and refuses both in the same words ([FR-073](spec.md#fr-073), [SC-022](spec.md#sc-022)), and the file written
from flags is byte for byte the file written from answers ([FR-074](spec.md#fr-074), [SC-023](spec.md#sc-023)).

### 9.4 Opening, rewriting and deleting a primitive (FR-075 – FR-079)

Three use cases on `ForManagingCharter`:

- **`open(identity)`** — the primitive snapshot of data-model [§15.1](data-model.md#151-primitive-snapshot-fr-075-fr-078), its revision
  the content hash of the primitive written out by `toMarkdown()`. It works whenever that primitive's own file reads,
  whatever else in the charter is wrong: it is asked of the primitives
  `charterRootOf` read, not of validation.
- **`rewrite(identity, headers, body, revision)`** — refuses a vendored
  primitive naming its vendor folder ([FR-077](spec.md#fr-077)); refuses when the primitive, read again,
  no longer hashes to `revision` ([FR-078](spec.md#fr-078)); refuses answers the kind will not take with the
  faults `add` gives ([FR-075](spec.md#fr-075)). Kind and identity are taken from the identity,
  never from the headers, so an edit cannot move a file.
- **`remove(identity)`** — deletes the repository primitive's file and nothing
  else; refuses a vendored one ([FR-076](spec.md#fr-076), [FR-077](spec.md#fr-077)). Primitives and tests still
  naming it are reported by the next validation as dangling, not rewritten.

All four that name one primitive — `explain`, `open`, `rewrite`, `remove` —
take the identity as text, as a route has it in its path and the command line
has it typed, and read it with `identityOf` inside the application, the one
place an identity is written and read: text that is not `<kind>:<id>` is
refused there. Nothing outside the hexagon spells or splits one.

A revision is the content hash — SHA-256, in hex — of the primitive written
out by `toMarkdown()`, the text a save writes, rather than of the file as
read: the charter's one reading is all `open` and `rewrite` need, and a change
on disk that only reformats the file is not one a save is refused for.
`contentHashOf` in `application/helper.ts` computes it, with Web Crypto, a
global of the runtime, so the hexagon imports no `node:crypto`. The same short
string is what crosses HTTP ([§12.2](#122-the-route-table)). A builtin primitive has no
file for `rewrite` or `remove` to act on, and is refused as a vendored one is
([Story 12](spec.md#user-story-12---the-instructions-arrive-with-the-engine-not-with-the-repository-priority-p3), scenario 7).

## 10. Health and explanation

### 10.1 `doctor` (FR-013, FR-014, FR-080, FR-081)

`doctor()` asks the four questions in one go — which agents the repository
chose, what validating its charter finds, which vendors drifted, and how many
files a build would still change — and answers `OutcomeDTOs.DoctorOutcome`
(data-model [§14](data-model.md#14-doctor-outcome-fr-080-fr-081)). How many of the four are unwell is worked out behind the port,
so `cw doctor` and the portal report one repository the same way ([SC-014](spec.md#sc-014)). Each
question is asked whatever the one before it answered ([FR-081](spec.md#fr-081)): the preview is
run where the charter holds and left `null` where it does not.

The agents are what the repository chose, never what is installed on this
machine. Drift is `driftedVendors` ([§7.1](#71-installing-updating-and-removing-fr-041--fr-052)). What validating finds is every fault,
errors and warnings, under the file that has to change, named from the
repository. `cw doctor` prints each, errors before warnings, and exits with a
failure status on any error.

### 10.2 `explain` (FR-029, FR-116)

`explain(identity)` answers `OutcomeDTOs.ExplanationOutcome` (data-model [§13](data-model.md#13-explanation-fr-029)):
the scoped primitive with its file and layer, the mixins it uses and the corpus
it cites, the primitives that lend from it or cite it, and the test cases that
name it. The relations are asked of `CharterRoot` — `mixinsOf`, `rationaleOf`,
`hostsOf`, `citersOf` — beside `mixins` and `corpora`. The test cases are read by
`loadTestRoot` and matched by each case's own `activatedIdentity`, each named by
the situation `cw test` reports it under; a test file that does not read names
nothing here. When the primitive comes up is read off its kind's
`activatesWhen`.
`cw explain` prints every relation; the portal opens each identity in it as its
own explanation.

An identity the charter holds nothing of is raised, not answered. A charter with
an error explains nothing and hands the errors back, and the collision [SC-006](spec.md#sc-006)
asks about is among them, naming both files.

## 11. Self-regression tests (FR-082 – FR-092)

### 11.1 The format

A test lives beside the charter rather than in it, at `.cw/test/<name>.json`,
and is read only when tests run: the charter is what an agent is instructed by,
and a test is what says the charter still does what it did. It is JSON and not a
document with frontmatter because a primitive is a document for the sake of the
body an agent opens, and a test has no body; its one reader is the engine.

`TestSuite.ts` in `domain/models/test/` holds the format and its reader,
`testSuiteOf`; `TestCase.ts` beside it holds the three shapes a case takes and
`TestCase`. The three shapes of data-model [§11.1](data-model.md#111-the-test-file) are the whole of what a
charter decides without an agent: a glob matched, an event named, a path
refused. Which skill a request wants and which agent is delegated to is the
agent reading words, and a test that guessed at it by matching substrings would
be testing the guess ([FR-084](spec.md#fr-084)).

The shape is a zod union of strict objects, and the type is inferred off it.
Strictness is what closes the set, so the shapes nothing could ever answer do
not exist to be handled. A file the schema refuses is shown a sample suite
rather than told which field of which case went wrong ([FR-086](spec.md#fr-086)): a case is three
shapes and a handful of fields, so the sample is the correction, and there is no
second description of the format written down beside the schema. The file is
read with `JSON.parse`, so the hexagon reads it without a library and without a
port.

### 11.2 Running them

`loadTestRoot` in `service/testSuitesRepo.ts` reads `.cw/test/` beside
`loadCharterRoot`, never with the charter: a test is not a primitive, so nothing
reading a kind's folder goes near it. It finds the files —
each a `TestSuiteFile`, its path and contents, as a charter file is an
`AuthoredFile` — and `testRootOf` in `domain/models/test/TestRoot.ts` reads
them, as `charterRootOf` reads a charter's: a `TestRoot` holds `suitesByFile`,
every suite that reads under its path — each `TestSuite` keeping the body it was
read from — and `faultsByFiles`, why each one that does not read does not.
Whether a name is taken and which name a
new file takes are asked of it; a file's name is its path under `.cw/test/`
(`testSuiteNameOf`). The use case is the two steps every other one is — read
the charter, then ask it — with resolving in place of compiling. `runSuite` and
`runCase` in `domain/services/testService.ts` resolve each case: nothing is run,
nothing fetched and no agent asked, so the result is deterministic and the
command stays a reader ([FR-084](spec.md#fr-084)).

What each of the three answers when it fails is the point of the report, and it
answers with a fault like any other: the globs the guide does have and to widen
them, the event the sensor does name and to raise that one, that no posture
denies this path and where to add it. Nothing is wrong with the file the case
was written in, so it is a `TestCaseFault` and not a `TestSuiteFault`: what has
to change is the charter, or the expectation about it. An expectation naming an
identity the charter does not hold is unmet ([FR-087](spec.md#fr-087)). A file that does not read
stops the run ([FR-088](spec.md#fr-088)), and a repository with no test passes, told so ([FR-089](spec.md#fr-089)).
`cw test` exits with a failure status on any unmet case ([FR-085](spec.md#fr-085)).

### 11.3 Managing test files

Four use cases on `ForAuthoringTests`, which `TestAuthoring` answers. A port of
their own rather than more of `ForManagingCharter`: listing, writing and
removing a test file reads no charter, as installing a vendor reads none.
Resolving the cases against the charter stays `ForManagingCharter.test()`:

- **`suites()`** — every test file as data-model [§11.2](data-model.md#112-test-suites-listed) says it, without running
  anything. What the test view shows before a run.
- **`addSuite()`** — writes a new test file, named and filled as data-model [§11.2](data-model.md#112-test-suites-listed)
  says, and returns its name ([FR-091](spec.md#fr-091)).
- **`writeSuite(name, text)`** — refuses text `testSuiteOf` refuses, with its
  sample ([FR-090](spec.md#fr-090)).
- **`removeSuite(name)`** — deletes one file under `.cw/test/`, and refuses a name
  that is not one ([FR-092](spec.md#fr-092)).

## 12. The portal (FR-104 – FR-125)

### 12.1 Shape

The portal is a second driving adapter beside the command line. It calls the
same driver ports the command line calls, and every capability it needs that the
engine lacks is added to a port first, with its command-line equivalent in the
same change ([FR-108](spec.md#fr-108), [FR-109](spec.md#fr-109)).

`PortalCommand` calls `ensureRepoReady()`, which stops before anything is served
outside a git repository or in one never set up, saying which and naming
`cw init` ([FR-107](spec.md#fr-107)). It then calls `startPortal` of `server.ts` with the ports
its `Context` holds, prints the address, and waits until interrupted ([FR-104](spec.md#fr-104)).
Both are drivers, so `adapters-do-not-know-each-other` allows it, and `main.ts`
stays the one composition root. `startPortal` fails at start naming
`pnpm build` when the page is not built, rather than serving a blank page.

### 12.2 The route table

The routes are chained on one `OpenAPIHono` app in `routes.ts`, each declared
with `createRoute`: a method and a path, what it takes, the use case it calls,
and every answer it sends under its status. Routes are resources
under `/api`, JSON in and out; the page itself is served from `/`. No route holds
a rule — each reads its arguments, calls one port method, and sends the answer
on as the port gave it ([§2.5](#25-models-are-classes-and-a-driver-reads-their-dtos)).

The verb says what a route does to the repository: every `GET` only reads, so
the reader/writer split ([FR-093](spec.md#fr-093)) is visible in the table and [§12.4](#124-security-fr-106) has to guard
only the other three verbs. A primitive is addressed by its identity, one path
segment, `guide:no-any`: a colon is allowed in a segment, and the route passes
it on as it came; one not written `<kind>:<id>` is refused by the engine, a
`422` and a `DataDTOs.Fault`.

| Method and path | Port call | Spec |
|---|---|---|
| `GET /api/charter/root/faults` | `ForManagingCharter.doctor()`, its `faultsByFile` | [FR-115](spec.md#fr-115) |
| `GET /api/charter/root/primitives` | `fullList(matching?)` | [FR-112](spec.md#fr-112) – [FR-114](spec.md#fr-114) |
| `POST /api/charter/root/primitives` | `add(kind, id, headers, body)` | [FR-117](spec.md#fr-117) |
| `GET /api/charter/root/primitives/:identity` | `open(identity)` | [FR-075](spec.md#fr-075), [FR-078](spec.md#fr-078) |
| `PUT /api/charter/root/primitives/:identity` | `rewrite(identity, headers, body, revision)` | [FR-075](spec.md#fr-075), [FR-078](spec.md#fr-078) |
| `DELETE /api/charter/root/primitives/:identity` | `remove(identity)` | [FR-076](spec.md#fr-076) |
| `GET /api/charter/root/primitives/:identity/explanation` | `explain(identity)` | [FR-029](spec.md#fr-029), [FR-116](spec.md#fr-116) |
| `GET /api/definitions/kinds` | `kinds()` | [FR-112](spec.md#fr-112), [FR-113](spec.md#fr-113) |
| `GET /api/definitions/kinds/:kind/requirements` | `listPrimitiveRequirements(kind)` | [FR-117](spec.md#fr-117), [FR-118](spec.md#fr-118) |
| `GET /api/charter/root/build` | `preview()` | [FR-120](spec.md#fr-120) |
| `POST /api/charter/root/build` | `build()` | [FR-120](spec.md#fr-120) |
| `GET /api/charter/root/health` | `doctor()` | [FR-121](spec.md#fr-121) |
| `GET /api/test-suites` | `ForAuthoringTests.suites()` | [FR-124](spec.md#fr-124) |
| `POST /api/test-suites` | `ForAuthoringTests.addSuite()` | [FR-091](spec.md#fr-091) |
| `PUT /api/test-suites/:name` | `ForAuthoringTests.writeSuite(name, text)` | [FR-090](spec.md#fr-090) |
| `DELETE /api/test-suites/:name` | `ForAuthoringTests.removeSuite(name)` | [FR-092](spec.md#fr-092) |
| `GET /api/test-suites/outcome` | `test()` | [FR-125](spec.md#fr-125) |
| `GET /api/vendors` | `ForVendoringCharters.installed()` | [FR-122](spec.md#fr-122) |
| `POST /api/vendors` | `ForVendoringCharters.add(source, version?)` | [FR-123](spec.md#fr-123) |
| `DELETE /api/vendors/:name` | `ForVendoringCharters.remove(name)` | [FR-123](spec.md#fr-123) |

The kinds and what each requires sit under `/definitions`, not under
`/charter`: what a kind is and what it demands is the kind's own contract, the
same answer in every repository, and reading it reaches no charter. Test suites
and vendors sit beside `/charter` rather than in it: a test file is no primitive
and nothing compiles it ([FR-082](spec.md#fr-082)), and a vendor is installed through a port of its
own that reads no charter. Running the tests is a `GET`, since resolving a case
writes nothing ([FR-084](spec.md#fr-084)). It shares a path segment with a suite's name and does
not collide: no route `GET`s one suite — the list carries every suite's text — so
`outcome` under `GET` can only mean the run, and `PUT` or `DELETE` of a suite
named `outcome` still reaches that file. The listing is always the whole
charter, never one kind of it: whoever shows it by kind is counting every kind
too.

**Revisions over HTTP.** `GET` of a primitive answers with an `ETag`, the
revision `open` returned — already a content hash ([§9.4](#94-opening-rewriting-and-deleting-a-primitive-fr-075--fr-079)) — in quotes; `PUT`
sends it back as `If-Match`. The server opens the primitive again and answers
`412 Precondition Failed` naming the file when the two differ — otherwise it
passes the revision it just opened on to `rewrite`, which checks it once more.
Nothing is hashed here.

**Statuses.** `200` with the answer; `201` for a `POST` that created something,
with the new resource's path; `204` for a `DELETE`. Faults given back — a charter
that does not hold, answers a kind refuses — are `422` with the port's
`DataDTOs.FaultsByFile` or `DataDTOs.Faults`. A raised `Fault` is `422` with its
`DataDTOs.Fault`, so the page parses it with the schema it parses every other
DTO with. `412` is the adapter's own, above. Anything else is a `500` and the
message, logged to the terminal the portal was started from.

### 12.3 No state on the server (FR-110)

The server holds the port objects, the address and the token ([§12.4](#124-security-fr-106)), and
nothing about the charter. Every route reads the repository afresh, which is
[FR-110](spec.md#fr-110) with nothing to invalidate: a change made on disk by an editor, an agent
or a branch checkout is what the next view shows. The page holds the view it is
showing, a draft being typed (data-model [§15.2](data-model.md#152-draft)) and the last test outcomes;
switching views re-asks the server. Two portals on one repository both work,
and a save through one is caught by the other's revision check.

### 12.4 Security (FR-106)

A page on `127.0.0.1` can still be reached by any other page open in the same
browser, and this server writes into a repository. So:

- **A token per run.** 32 random bytes, in the printed address
  (`http://127.0.0.1:9927/?t=…`), required on that address and on every call to
  `/api`; the page carries it as `Authorization: Bearer` on each call. The
  bundle the page loads asks for none: its own markup fetches it, and cannot
  carry one.
- **The `Host` header is checked** against `127.0.0.1:<port>` and
  `localhost:<port>`, which is what stops DNS rebinding.
- **Only `GET` reads, and every other verb writes with
  `Content-Type: application/json`.** `PUT` and `DELETE` always need a CORS
  preflight, and a `POST` with that content type does too; the server sends no
  CORS headers, so a cross-origin page fails every one. A `GET` it can still make
  changes nothing and is refused without the token anyway.

None of this is a sign-in: the token is what the person who ran the command was
handed, and it dies with the process.

### 12.5 The page

One document, the layout of [mockup/portal.html](./mockup/portal.html): the
header (repository, search, Build, Doctor), three tabs
(Repo Charter, Vendor, Test), a modal for explain, doctor, build and a test
file's text, and a toast for what was just done.

Each view is a React component that asks a hook of `queries.ts` for what it
shows when it is mounted, and renders what comes back; none fetches in an
effect. Every dialog is declared once in `components/Dialogs.tsx`, under the
name it is opened by, with its title, whether it holds a draft and what it
renders from its params; a view opens one with `useDialog().open(name,
params)`, typed by that dialog's params. The body editor is CodeMirror mounted by a `ref` callback of one small
component that owns it, which takes it down again; React never renders inside
it. What the mockup computes
in the browser — the faults, a case's outcome, the doctor report, the build plan,
the explain relations — is exactly what the engine answers, and the page shows
what comes back. The mockup's seed data is test data for the views, not a model
of the charter, and the rules it computes by are placeholders: when a primitive
comes up is its kind's `activatesWhen`, and what a kind requires is its contract
([FR-113](spec.md#fr-113)). Where the two differ the engine is right — a guide declaring no
`globs` is valid and comes up every turn, though the mockup reports it as an
error.

The repository view lists every catalogue entry, a chip per kind from `kinds()`
with its count, so the page names no kind of its own and a kind nothing was
authored of still has a chip ([Story 5](spec.md#user-story-5---see-what-the-charter-holds-and-why-each-rule-comes-up-priority-p1), scenarios 1, 2 and 6). A builtin
primitive appears there like any other, its file `(built into cw)/…` naming its
layer.

The form for a primitive is built from `listPrimitiveRequirements`: one row per
header in its shape — a box per entry for a list, a choice for a closed set —
then the description, the mixins, and the rationale offering the charter's
corpus ([FR-117](spec.md#fr-117), [FR-118](spec.md#fr-118)). Kind and id are chosen on a new primitive, and shown and locked on an
existing one ([FR-075](spec.md#fr-075)).

## 13. The command line (FR-093 – FR-095, FR-109)

`Commander` is the driving adapter: it parses argv, calls one use case, and
renders what comes back through `ForReportingProgress`. It decides nothing —
yargs hands even its own help and error text to a callback rather than the
console, so everything a user sees leaves through the port. A command appears in
the list when it is built; there are no placeholders standing in for a surface
that does not exist yet. Commands sharing a first word (`vendor`, `suite`) are
registered under it as a group; a positional on a command that stands alone
(`explain <identity>`) is no group.

| Command | Port call | Spec |
|---|---|---|
| `cw init [--agent]` | `settings`, then `init` | [FR-054](spec.md#fr-054) – [FR-058](spec.md#fr-058) |
| `cw build [--preview]` | `build`, or `preview` | [FR-030](spec.md#fr-030) – [FR-040](spec.md#fr-040), [FR-024](spec.md#fr-024) |
| `cw list [--kind] [--min]` | `list` | [FR-025](spec.md#fr-025) – [FR-028](spec.md#fr-028) |
| `cw kinds [kind]` | `kinds`, or `listPrimitiveRequirements` | [FR-059](spec.md#fr-059) – [FR-063](spec.md#fr-063) |
| `cw add <kind> <id> [--header k=v …]` | `listPrimitiveRequirements`, then `add` | [FR-064](spec.md#fr-064) – [FR-074](spec.md#fr-074) |
| `cw edit <identity>` | `open`, then the author's editor on its file | [FR-075](spec.md#fr-075), [FR-109](spec.md#fr-109) |
| `cw remove <identity> [--yes]` | `open`, a yes-or-no question, then `remove` | [FR-076](spec.md#fr-076), [FR-077](spec.md#fr-077) |
| `cw explain <identity>` | `explain` | [FR-029](spec.md#fr-029) |
| `cw doctor` | `doctor` | [FR-013](spec.md#fr-013), [FR-014](spec.md#fr-014), [FR-080](spec.md#fr-080), [FR-081](spec.md#fr-081) |
| `cw test` | `test` | [FR-082](spec.md#fr-082) – [FR-089](spec.md#fr-089) |
| `cw suite add` | `ForAuthoringTests.addSuite` | [FR-091](spec.md#fr-091) |
| `cw suite edit <name>` | the author's editor on the test file | [FR-090](spec.md#fr-090), [FR-109](spec.md#fr-109) |
| `cw suite remove <name>` | `ForAuthoringTests.removeSuite` | [FR-092](spec.md#fr-092) |
| `cw vendor add <source> [--ref]` | `ForVendoringCharters.add` | [FR-041](spec.md#fr-041) – [FR-052](spec.md#fr-052) |
| `cw vendor remove <name>` | `ForVendoringCharters.remove` | [FR-047](spec.md#fr-047), [FR-051](spec.md#fr-051) |
| `cw vendor list` | `ForVendoringCharters.installed` | [FR-053](spec.md#fr-053), [FR-122](spec.md#fr-122) |
| `cw portal [--port]` | `ensureRepoReady`, then `startPortal` | [FR-104](spec.md#fr-104) – [FR-107](spec.md#fr-107) |
| `cw mcp auth [identity] [--status]` | `ForReachingMcps.signInStatus`, then `signIn` per address | [FR-148](spec.md#fr-148) – [FR-151](spec.md#fr-151) |
| `cw mcp serve [--enable …]` | `ForReachingMcps.served`, then `startMcpServer` | [FR-152](spec.md#fr-152) – [FR-155](spec.md#fr-155) |

For two capabilities the command line's way is not the port method. Rewriting a
primitive and rewriting a test file are done in the author's own editor, so
`rewrite` and `writeSuite` have the portal as their one caller. `cw edit` writes
nothing: it asks `open` which file declares the identity — refusing, as `open`
does, one the charter holds nothing of — and hands that file to `$VISUAL`, else
`$EDITOR`, waiting until the editor exits. Whoever saves in the editor is the one
who wrote the file; the command only found it. Where neither variable is set it
refuses and says to set one, rather than guessing an editor. A vendored
primitive opens like any other, and the next `cw doctor` names the edit as drift,
as it would any hand-edit there. `cw suite edit` does the same for one file under
`.cw/test/`.

A terminal has an editor, so the command line does not rebuild in prompts what
the editor already does: there is no `--body` on `cw add` and no revision to
check on `cw edit`. A body at the command line is written the way it always was:
`cw add`, then `cw edit`.

The test-file commands are `suite`, not `test add`: `cw test` already runs the
tests, and a group named `test` would take the plain command away. A test file
holds one `TestSuite`, which is what the domain already calls it.

## 14. Risks

- **Projection format churn.** A host's surface is not a stable contract.
  Mitigation: each host is a folder of component classes and an arm in two
  services ([§2.6](#26-adapters-and-the-composition-root)); the neutral target always exists ([FR-031](spec.md#fr-031)), so the engine is
  never blocked on an agent's format.
- **A vendored identity colliding with one this repository authored.**
  Mitigation: one identity names one primitive in the whole charter, so the
  collision is reported at once, naming both files ([§5.1](#51-one-identity-one-primitive-fr-015-fr-016)).
- **The vendor path never running on real content.** Mitigation: the vendoring
  use cases are covered end to end against a real git repository.
- **Ports multiplying into ceremony.** Mitigation: [§2.3](#23-ports-srchexagonport) is the whole list; a
  row needs a second plausible implementation or a use case that must be denied
  it.
- **`ForManagingCharter` growing wide.** It gains the portal's methods. They are
  one conversation, and splitting them by caller is what [§2.3](#23-ports-srchexagonport) rules out. Revisit
  if a use case appears that no one caller needs alongside the rest.
- **The page drifting into a second engine.** The mockup holds rules in the
  browser because it has no engine behind it. Mitigation: [§2.2](#22-dependency-rules) makes the page
  unable to import anything of ours but the DTOs and the routes' type, and every
  rule in the mockup is assigned to an engine use case before its view is built.
- **`cw portal` run from source needs a built page.** `pnpm cw portal` under
  `tsx` serves from `dist/portal/`. Mitigation: `startPortal` fails at start
  naming `pnpm build` ([§12.1](#121-shape)).
- **Validation reads the tests.** Every command that validates pays for reading
  `.cw/test/`. Mitigation: the tests are a handful of small JSON files, read once
  per run as the charter is ([SC-010](spec.md#sc-010)).
- **An agent that reads the compiled skill and never runs `cw kinds`.** The body
  is the only thing telling it to, and a body is instruction rather than
  enforcement. Mitigation: `cw add` refuses what the kind will not take, with the
  sample in the refusal — a wrong guess costs one command, not a bad file.
- **A repository that authored `skill:cw-author` before the builtin layer
  existed.** Its charter stops building until it renames, and the collision
  names a file it cannot open as the other claimant. Mitigation: the fix line
  says the engine brings that identity and the one to rename is the
  repository's ([§5.3](#53-the-builtin-layer-supplied-rather-than-stored-fr-017--fr-024)).
- **Three layers in every message that names one.** Every fault, catalogue entry
  and listing that says "repo" or "vendor" has a third word to say. Caught by the
  tests over listings and catalogues rather than by reading.
- **A release published from one maintainer's machine.** Its checks are only as good as that machine's state. Mitigation: the release refuses a dirty tree and runs the full suite, then installs the exact tarball it will publish somewhere else and uses it; what is published is that tarball, not a second pack ([§18.4](#184-releasing-fr-134--fr-137)).
- **A dependency the bundle expects but the package does not declare.** It works in this repository, where every development dependency is installed, and fails only in a user's install. Mitigation: a test compares the bare imports of `dist/main.js` with `dependencies`, both ways ([§18.1](#181-what-the-package-holds-fr-126-fr-127-fr-129-fr-130-fr-133)).
- **A published version cannot be taken back.** A broken one stays installable. Mitigation: nothing is published that failed the install check; a fix is the next patch version (spec Assumptions).
- **The MCP SDK's weight.** It brings an HTTP framework and a JSON Schema validator with it, against [SC-029](spec.md#sc-029)'s 20 MB. Mitigation: the install check measures the installed size on every release ([§18.4](#184-releasing-fr-134--fr-137)); measured before [T5.008](tasks/005-mcp-knowledge.md#t5.008) lands, and if it would pass the limit, only its client and stdio server entry points are imported and the rest is left to tree-shaking.
- **A place's own tools changing under a declared name.** A server that renames or drops a tool leaves the `mcp` primitive naming one it does not have. Mitigation: the server says so at start, naming the primitive and the tool, and serves the rest ([FR-153](spec.md#fr-153)).
- **OAuth servers that do not register clients dynamically.** Some places require an application registered by hand. Mitigation: `token` is always offered where the primitive allows it, and a place allowing only `oauth` that refuses registration answers with the fix of adding `token` to its `auth`.
- **A local process sees more than its token.** It runs as the developer and inherits the environment `cw` runs in, as it would under any host. Mitigation: `cw` adds the one variable its primitive names and nothing else; a place's command is reviewed with the charter like any other change.
- **A credential readable by the agent.** The agent runs as the developer, and the credential store answers the developer. This is the exposure of every MCP server configured on a machine, not one `cw` adds; `cw` writes no credential anywhere else ([FR-149](spec.md#fr-149)).
- **A path nobody can open.** `(built into cw)/…` reads as a path in a fault or a
  listing and is not one. The catalogue no longer names it: an agent is sent to
  the compiled primitive, which is on disk for every layer ([§6.1](#61-one-pass-produces-everything-fr-030--fr-034-sc-004)). Accepted over an optional file, which puts a
  branch into every reader for the one primitive that has none, and over a bare
  word, which would leave the catalogue no way to say which layer an entry came
  from.

## 15. Not built

Recorded so they are not built by accident:

- A server framework, a client-side router or a store ([§1](#1-technical-context)).
- A file watcher or a push from server to page; [FR-110](spec.md#fr-110) is met by reading on
  every view.
- Opening the browser from `cw portal`.
- Renaming a primitive or a test file, and changing a primitive's kind (spec
  Out of Scope).
- A standing build status outside the health check (spec Out of Scope).
- Editing or deleting a primitive from an agent, or from a header flag.
- A second builtin source, or a name level for one; a way to disable, remove or
  pin what the engine brings; any file, folder or cache of it under the
  workspace.
- A machine-readable output mode for `cw kinds` or `cw add`.
- Writing a primitive's body, or judging what it says.
- A machine-local layer (spec Assumptions).
- Bundling the runtime dependencies into `dist/main.js` ([§18.1](#181-what-the-package-holds-fr-126-fr-127-fr-129-fr-130-fr-133)).
- A release from CI, a changelog, and an update check inside `cw` (spec Out of Scope).
- A gateway holding one credential for many developers; resources, prompts and sampling through `cw mcp serve`; installing a local server's command; a concept layer and a tool to look it up; tools changing while the server runs (spec Out of Scope).
- Opening the browser for an OAuth sign-in: the address is printed, as `cw portal` prints its own.

## 16. Read of the reference design

keystone (github.com/tacoda/keystone, Go, about 21 thousand lines) was read at
`internal/framework/`. Three findings shaped the decisions above.

- **Its cascade resolver is a defined stub.** `loader/loader.go` resolves
  `port/name` to an `Origin{Policy, Path}`, but its own comment records that it
  is "a defined stub with in-memory fixture tests" not yet wired into the
  runtime. `keystone.json` in that repository carries `"policies": []` — the
  cascade has never run on its own content.
- **The live path treats an override as an error.** `primitive.Walk` scans the
  whole charter root, vendored policy content included, into one flat list;
  `Lint` then reports two primitives sharing `(kind, id)` as
  `duplicate (kind=…, id=…)` at error severity. That is what [§5.1](#51-one-identity-one-primitive-fr-015-fr-016) does
  deliberately.
- **Its provenance is a single derived string.** `derivProvenance` maps a path to
  `"project"` or `"policy/<name>"`, consumed at one call site to print a label
  beside a listing. With one primitive per identity that is all provenance has to
  be: here it is the scope a primitive carries, and the path it names.

`loader/cascade.go` is a verifier, not a resolver: it hashes vendored files
against the lockfile for drift and finds strict violations by matching file
basenames under a port directory. Neither is adopted: version control is the
record of what was vendored ([FR-046](spec.md#fr-046)).

Size check for [SC-005](spec.md#sc-005) on that repository: 161 primitive bodies total 395 KB,
`INDEX.lite.json` is 18 KB — 22 times smaller, so the tenfold target is
achievable. But `INDEX.json` is 44 KB, only 2.4 times smaller, so the saving is
lost if an agent reads the full catalogue first. That is why `CHARTER.md` sends
its reader to `catalog.min.json` first ([§6.3](#63-the-hosts-entry-file-fr-035-fr-036)).

## 17. Per-task design notes

What each task settled beyond the sections above: the modules it touched, how it
is tested, and how it landed. Keyed by task id. The task lists, with what each
task cites and depends on, are in `specs/tasks/`. Every change leaves the
repository building and green. In phase 001 a change was one task; from phase
002 it is one story, its tasks the steps inside it ([SC-026](spec.md#sc-026)).

### 17.1 Phase 001: the charter, its engine and agent authoring

Everything that has landed, listed in [tasks/001-charter-engine.md](./tasks/001-charter-engine.md):
the skeleton, the engine standing alone, vendor layers in one identity space,
explain, the preview gate, doctor and the tests, `cw add`, the groundwork the
portal stands on (models as classes behind ports answering DTOs, the page
toolchain, the server, `cw portal`), and agent authoring (`cw kinds <kind>`,
`cw add --header`, the builtin layer and `skill:cw-author`).

#### 17.1.1 T001 — Package skeleton

`package.json` (ESM, `bin: cw`, Node ≥ 20), a strict `tsconfig.json`,
`tsup.config.ts`, `.gitignore`, and an entry point that prints usage. A smoke
test asserts `cw --help` exits 0 ([FR-094](spec.md#fr-094)).

#### 17.1.2 T002 — The command-line adapter

The adapter on `yargs`: a command table, strict parsing, `recommendCommands` for
a near miss ([FR-095](spec.md#fr-095)), and output leaving through the reporting port rather than
the console ([§13](#13-the-command-line-fr-093--fr-095-fr-109)).

#### 17.1.3 T003 — Architecture rules

`.dependency-cruiser.cjs` and `lint:deps` as the first step of `pnpm test`
([§2.2](#22-dependency-rules)). The rules that keep the portal's page and the DTOs apart joined it with
[T037](tasks/001-charter-engine.md#t037) and [T035](tasks/001-charter-engine.md#t035).

#### 17.1.4 T004 — Driven ports

Each driven port is declared when a use case first needs it, never ahead of it
([§2.3](#23-ports-srchexagonport)).

#### 17.1.5 T005 — The closed set of kinds

`KINDS` is read off `PRIMITIVE_CLASSES` in `primitive/Primitive.ts`, one class
per kind ([§4.2](#42-reading-one-primitive-fr-001--fr-004)). A file is read as the kind it declares ([FR-003](spec.md#fr-003)), while where it
sits decides only that it is looked at ([FR-002](spec.md#fr-002)). When a kind activates is a line
of prose on the kind's own class, `activatesWhen`, read by `CHARTER.md` and by
`kinds()` ([§9.1](#91-what-a-kind-requires-fr-059-fr-062-fr-063)).

#### 17.1.6 T006 — Reading one primitive

`primitiveOf` reads frontmatter and body from text the port supplied, takes the
`kind` the file declares, and hands the headers to that kind's class, which
reads them through its zod schema. What comes back is a `Primitive`
discriminated on `kind`, or every fault the file has ([§4.2](#42-reading-one-primitive-fr-001--fr-004)). It takes text and
never a path it opens; the YAML itself is read through `ForParsingYaml`, since
the hexagon imports no YAML library.

#### 17.1.7 T007 — The one read path

`loadCharterRoot` over `ForReadingFiles` and `charterRootOf` over the files it hands
in are the one path a charter is read by ([§4.1](#41-the-one-read-path-fr-009-sc-010)). `path.ts` says where everything
lives, and loading looks only in the kind folders, so a catalogue beside the
primitives is never read as one ([FR-002](spec.md#fr-002)). Tested against the in-memory adapter:
one listing, one read per file. Reading once per run is then a matter of passing
the `CharterRoot` on; nothing caches.

#### 17.1.8 T008 — Mixins

No merge step: `mixins` is read at projection time, where the mixin's body is
written before the host's ([§5.2](#52-mixins-fr-006-fr-007), [T016](tasks/001-charter-engine.md#t016)). What is checked instead is reach, by
`covers` over `picomatch`, as part of validation. A mixin pulling in a mixin is
refused where a mixin's headers are read; one no layer holds is refused by
validation ([FR-007](spec.md#fr-007)).

#### 17.1.9 T009 — Validation across files

`compositeFaultsByFiles` on `CharterRoot` answers what no single file can: a
second claim on one `kind:id`, whether a named mixin is there, and whether it
reaches as far as its host ([§4.3](#43-validation-across-files-fr-010--fr-013)). Every layer is asked the same questions on one
walk. Faults arrive under the file they are about, each naming the specific
problem and the next move ([FR-012](spec.md#fr-012)).

#### 17.1.10 T010 — Per-kind headers

What each kind requires is declared and read in the kind's own class: its zod
schema extends the common headers, and `requires` names what a file of that kind
is refused without (data-model [§1.3](data-model.md#13-kinds-and-what-each-requires-fr-001-fr-004)). One place says what a guide requires and
reads it, so there is no table to drift from.

#### 17.1.11 T011 — The checking service

The application service behind `ForManagingCharter`, and the file adapter behind
`ForReadingFiles`. It reads a charter and validates it; the reading use cases
reach for no writing port ([§2.4](#24-application-srchexagonapplication)). Every command that reads a charter goes through
the same validation, and `cw doctor` is where its report is printed ([FR-013](spec.md#fr-013)).

#### 17.1.12 T012 — Rationale references

On the same walk as [T009](tasks/001-charter-engine.md#t009). A corpus is cited as `corpus:<id>`, whichever layer
published it ([§5.1](#51-one-identity-one-primitive-fr-015-fr-016)). A citation no corpus answers to is a warning, said and not
stopped on ([FR-005](spec.md#fr-005)).

#### 17.1.13 T013 — Catalogues

`Catalogue` in `domain/models/output/CharterOutput.ts` holds the full and the
compact entries, bodies excluded (data-model [§7](data-model.md#7-catalogues-fr-025--fr-028)). The compact one is what
`CHARTER.md` names and what an agent reads first. A test asserts it is at least
ten times smaller than the charter it describes ([SC-005](spec.md#sc-005)).

#### 17.1.14 T014 — One compile pass

`compile` returns everything one reading of the charter produces, as one
`CharterOutput` ([§6.1](#61-one-pass-produces-everything-fr-030--fr-034-sc-004), [SC-004](spec.md#sc-004)).

#### 17.1.15 T015 — The agent-neutral surface

`CharterMd.of(PRIMITIVE_CLASSES)` writes `CHARTER.md`: what governs the
repository, the compact catalogue first, one line per kind read off its class,
and identities ([§6.3](#63-the-hosts-entry-file-fr-035-fr-036)). No primitive body is in it. The pointer every agent opens
on its own is a section inside the entry file each host already reads ([T019](tasks/001-charter-engine.md#t019)), not
a file of its own, which nothing reads unasked. It follows the reference design,
whose neutral file carries no bodies either ([§16](#16-read-of-the-reference-design)).

#### 17.1.16 T016 — The claude surface

Command, agent, skill, rule and settings components, one per primitive for the
documents, each carrying the body with the mixins it pulls in written before it
([FR-037](spec.md#fr-037)). The body assembly is `bodyOf` on `CharterRoot`, where the mixins it
needs are already read ([§5.2](#52-mixins-fr-006-fr-007), [§6.1](#61-one-pass-produces-everything-fr-030--fr-034-sc-004)).

#### 17.1.17 T017 — The build

`FileOutput`, `build` on the application service, `buildService.ts` and the
`cw build` command. It is the first code that writes, through `ForWritingFiles`.
Which agents are compiled for is read from `.cw/settings.json` ([FR-038](spec.md#fr-038)). A host's
settings file is the one output written into rather than over ([FR-039](spec.md#fr-039)).
Everything the engine owns on disk and no longer compiles to is taken away
([§6.1](#61-one-pass-produces-everything-fr-030--fr-034-sc-004)).

#### 17.1.18 T018 — Listing

`list` on the application service, and `cw list [--kind] [--min]`: the catalogue
the charter already compiles to, said one primitive to a line ([FR-028](spec.md#fr-028)). It reads
and says.

#### 17.1.19 T019 — The charter's section in each host's entry file

The orientation was compiled and written, and nothing pointed an agent at it, so
a built repository read its charter only when somebody mentioned the file by
name. The section is one more projection per agent the repository compiles for,
said where every other projection is said, with the third `ProjectionPolicy`,
`upsertWithMarker` ([§6.2](#62-how-each-file-goes-down), [§6.3](#63-the-hosts-entry-file-fr-035-fr-036)). Tests cover [Story 1](spec.md#user-story-1---author-a-charter-and-put-the-agent-under-it-priority-p1) scenarios 6 and 7 and
[SC-007](spec.md#sc-007).

#### 17.1.20 T020 — Version control

`ForVCS` and the git adapter behind it; setup refuses to work outside a git
repository ([FR-054](spec.md#fr-054)). Nothing asks the machine what it has installed ([FR-055](spec.md#fr-055)).

#### 17.1.21 T021 — Asking the setup questions

The asking lives in `cw init` itself: the command gathers every answer and only
then calls the use case ([§8](#8-setup-fr-054--fr-058)).

#### 17.1.22 T022 — Setup

`cw init` makes the charter root with a directory per kind and writes
`.cw/settings.json`. Compiling is `cw build`'s, and setup commits nothing
([FR-057](spec.md#fr-057)).

#### 17.1.23 T023 — Re-running setup

The agent the repository already compiles for is read off its settings and
arrives as the selected choice, so a second run is rechoosing and a return keeps
what is there ([FR-058](spec.md#fr-058), [§8](#8-setup-fr-054--fr-058)).

#### 17.1.24 T024 — Installing through git subtree

`subtreeAdd` and `isClean` on `ForVCS`, and the git adapter behind them ([§7.1](#71-installing-updating-and-removing-fr-041--fr-052)).
The source is handed over as typed, and what lands is committed under
`.cw/vendor/<name>/` — `add` where the folder is not there and `pull` where it is,
so installing and updating are one call ([FR-047](spec.md#fr-047), [FR-049](spec.md#fr-049), [FR-050](spec.md#fr-050), [FR-051](spec.md#fr-051)).

#### 17.1.25 T025 — `cw vendor add`

`CharterVendoring.add` and `cw vendor add <source> [--ref]` ([§7.1](#71-installing-updating-and-removing-fr-041--fr-052)). Refused
outside a repository and with work in hand ([FR-051](spec.md#fr-051)); a source already installed
is brought up to date; nothing is compiled ([FR-052](spec.md#fr-052)).

#### 17.1.26 T026 — One identity space

The scope a primitive carries says which layer its file arrived in and is no
part of its name ([§5.1](#51-one-identity-one-primitive-fr-015-fr-016), [FR-015](spec.md#fr-015)).

#### 17.1.27 T027 — Naming mixins and corpora across layers

A mixin is named by its id and a corpus by `corpus:<id>`, whichever layer
published them ([§5.1](#51-one-identity-one-primitive-fr-015-fr-016)).

#### 17.1.28 T028 — `cw vendor remove`

`cw vendor remove <name>` takes the folder away and commits that it is gone,
named by the folder it was installed as ([FR-047](spec.md#fr-047), [FR-051](spec.md#fr-051)). The command line
learns command groups here ([§13](#13-the-command-line-fr-093--fr-095-fr-109)).

#### 17.1.29 T029 — `cw explain`

The command line learns a positional on a command that stands alone: `explain
<identity>` is one command and not a group ([FR-029](spec.md#fr-029), [§13](#13-the-command-line-fr-093--fr-095-fr-109)). What it names grew with
[T041](tasks/001-charter-engine.md#t041) and [T2.001](tasks/002-charter-portal.md#t2.001) ([§10.2](#102-explain-fr-029-fr-116)).

#### 17.1.30 T030 — `build --preview`

The preview reuses what a build acts on rather than a second reading of it: the
projection plan and the cleanup plan, compared and not written ([§6.4](#64-preview-fr-034), [FR-034](spec.md#fr-034)).

#### 17.1.31 T031 — `cw doctor`

The agents reported are those the repository chose ([FR-055](spec.md#fr-055)). Drift is version
control's answer: `changedUnder` asks git what differs under `.cw/vendor/`
([§7.1](#71-installing-updating-and-removing-fr-041--fr-052)). It is where every fault is read ([FR-013](spec.md#fr-013), [FR-081](spec.md#fr-081)). The four questions
moved behind the port with [T2.019](tasks/002-charter-portal.md#t2.019) ([§10.1](#101-doctor-fr-013-fr-014-fr-080-fr-081)).

#### 17.1.32 T032 — The test format

`TestSuite.ts` holds the format and `testSuiteOf` ([§11.1](#111-the-format)). A case carries no
name, because the situation it puts and the one thing it expects is what a
report has to say about it anyway, so there is no title to write and none to keep
unique.

#### 17.1.33 T033 — `cw test`

`loadTestSuites`, `runSuite` and `runCase`, and the command ([§11.2](#112-running-them)). Resolution
is three matches and lives in `testService.ts` beside the comparing it feeds:
there is one caller, and a file of its own for it would be a split before
anything asked for one. A test file that will not read comes back as the fault it
is rather than raised: the loader hands over one entry per file, and whoever
asked for the run is the one who reports it ([FR-086](spec.md#fr-086), [FR-088](spec.md#fr-088)).

#### 17.1.34 T034 — `cw add`

`cw add <kind> <id>` writes `<kind>/<id>.md` through `writeCharter` ([§9.3](#93-cw-add-kind-id-prompts-and-header-flags-fr-064--fr-074)). What
a kind requires is asked of the driver port, the command puts one question per
header, and the answers go back as they were typed; reading them as the
primitive they claim to be is the service's, through `primitiveOf`, so there is
no second reading of a kind's contract. What is written is `toMarkdown()` of the
primitive itself. The command line knows the questions and none of the answers
([FR-064](spec.md#fr-064), [FR-065](spec.md#fr-065)). Header flags joined it with [T042](tasks/001-charter-engine.md#t042) – [T044](tasks/001-charter-engine.md#t044).

#### 17.1.35 T035 — Models are classes, and a driver reads their DTOs

Added `port/driver/dtos/`, `application/dtos.ts`, and the rules
`dtos-are-zod-only` and `models-know-no-dto` ([§2.2](#22-dependency-rules), [§2.5](#25-models-are-classes-and-a-driver-reads-their-dtos)). `FaultsByFile` became
a class, its DTO naming each file from the repository. `doctor` answers
`OutcomeDTOs.DoctorOutcome` (data-model [§14](data-model.md#14-doctor-outcome-fr-080-fr-081)): the `CharterRoot` and the settings
are not in its answer, and the use cases behind it read them through a private
method instead, validating being one of those. `toText` reads the DTO;
`DoctorCommand` reads it and counts nothing itself. Every other port method
answers DTOs too (data-model [§12.3](data-model.md#123-what-each-port-method-answers)), and each command switches on `type`.

#### 17.1.36 T036 — The page toolchain

`preact`, `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-markdown`
and `marked` became dependencies. `src/driver/portal/page/tsconfig.json` was
added, the root one excluding `page/**`; a second `tsup` entry builds into
`dist/portal/`; `typecheck` runs both configs ([§1](#1-technical-context)). A `main.tsx` renders the
brand and nothing else.

#### 17.1.37 T037 — The page kept browser code

The rule `page-is-browser-code` ([§2.2](#22-dependency-rules)). It is proved by a test importing
`node:fs` from `page/`, which fails `lint:deps`.

#### 17.1.38 T038 — The server

`startPortal` in `server.ts`: Hono at `127.0.0.1`, the default port and the next
free one when it is taken, the index and `dist/portal/` served from `/`.
`routes.ts` exports the app under `/api` with no route yet, and the page is
allowed its type alone, for `hc`. It refuses to start, naming `pnpm build`, when
the page is not built ([§12.1](#121-shape)).

#### 17.1.39 T039 — The token and the host check

The token, the host check, the `Content-Type` requirement on every verb but
`GET`, and no CORS headers ([§12.4](#124-security-fr-106)). Tested against the server in-process.

#### 17.1.40 T040 — `cw portal`

`PortalCommand` builds the server from its `Context`, prints the address, and
waits until interrupted. It stops before serving outside a git repository or in
one never set up, saying which and naming `cw init` ([§12.1](#121-shape), [FR-107](spec.md#fr-107)).

#### 17.1.41 T041 — What a primitive pulls in and what names it

The relations the charter answers ([§10.2](#102-explain-fr-029-fr-116)): `mixinsOf`, `rationaleOf`, `hostsOf`
and `citersOf` on `CharterRoot`, beside `mixins` and `corpora`, and
`ExplanationOutcome` carrying them.

#### 17.1.42 T042 — `--header` on `cw add`

A repeatable string option in `AddCommand.ts`, read into a record by
`parseKVParams` in `helper.ts`: the value is everything after the first `=`, and
a flag with no `=` is a fault naming the flag. The record is passed to the
engine's `add` as the answers a prompt would have given ([§9.3](#93-cw-add-kind-id-prompts-and-header-flags-fr-064--fr-074)).

#### 17.1.43 T043 — The shapes

`AddCommand` groups the flags by what `listPrimitiveRequirements` says each header
takes: a list header keeps every value in the order given, a line header given
twice is a fault naming it. The adapter holds no list of its own of which headers
those are ([§9.3](#93-cw-add-kind-id-prompts-and-header-flags-fr-064--fr-074)).

It landed wider than written. The requirements named only the headers a kind
requires, so a header it takes without requiring — a guide's `globs` — had no
shape to be typed by, and [Story 10](spec.md#user-story-10---write-a-primitive-with-no-terminal-to-answer-at-priority-p1) scenario 1 could not run. The shape now comes
off the kind's own zod schema, and each header carries `required`, so the prompt
path still asks only what the kind refuses a file without ([FR-069](spec.md#fr-069),
data-model [§2.1](data-model.md#21-primitive-requirements-fr-059-fr-062)).

#### 17.1.44 T044 — The flag path refuses what the prompt path refuses

No prompting when a header flag is given, whether or not a terminal is attached;
with no flag and no terminal, the command writes nothing and prints the headers it
would have asked for; a header no kind takes is refused by the engine naming it,
rather than dropped by the kind's schema. Every other refusal is the engine's,
unchanged ([§9.3](#93-cw-add-kind-id-prompts-and-header-flags-fr-064--fr-074)). The refusal of an unknown header ([FR-072](spec.md#fr-072)) was found unmet while
doing [T043](tasks/001-charter-engine.md#t043); whatever refuses it is the engine's, and belongs here, which is why
the refusal and the tests over it are one change.

**Tests.** `test/scaffolding-a-primitive.test.ts`: the file written from flags is
byte for byte the file written from answers; a missing required header, an unknown
header, a repeated line header and a malformed flag each write nothing and name
what is wrong.

#### 17.1.45 T045 — The kind answers in full, from the model to the terminal

`PrimitiveRequirements` gains `sample` in `primitive/Primitive.ts`, read off the
kind's class beside its headers; `primitiveRequirementsDTO` carries it in
`application/dtos.ts`; the DTO schema takes it in `port/driver/dtos/data.ts`
([§9.1](#91-what-a-kind-requires-fr-059-fr-062-fr-063), data-model [§2.1](data-model.md#21-primitive-requirements-fr-059-fr-062)). Then the optional positional of `cw kinds` ([§9.2](#92-cw-kinds-kind-fr-059--fr-061)). No
use case is added.

**Tests.** `test/the-kinds.test.ts`: for every kind, what `cw kinds <kind>` names
is what that kind's contract requires and no more, and the same headers `cw add`
asks for.

#### 17.1.46 T046 — A third layer, read and named

The charter reads three layers, and the third is handed in by the engine on every
read, never found on disk. This task laid the layer down with nothing in it.

- `BUILTIN_SCOPE` joins `Scope` in `CharterRoot.ts`, and the DTO's `scope` enum
  takes it (data-model [§3.2](data-model.md#32-scope-fr-017--fr-024)).
- `charterRootOf` takes `{ repo, vendor, builtin }` and reads builtin, then repo,
  then vendor, each in the order its paths sort in ([§5.3](#53-the-builtin-layer-supplied-rather-than-stored-fr-017--fr-024), data-model [§4.2](data-model.md#42-the-files-a-charter-is-read-from)).
- `BUILTIN_PRIMITIVES` is exported from `builtin/index.ts`. `loadCharterRoot` turns
  each into an in-memory file at `(built into cw)/<kind>/<id>.md` holding
  `toMarkdown()`, reads nothing more from disk and writes nothing for it.
- A builtin file is read by `primitiveOf` like every other: one the kind refuses
  has its faults filed under its `(built into cw)/…` path ([FR-020](spec.md#fr-020)).
- The collision's fix line says that an id the engine claims is the engine's own,
  so the one to rename is the repository's ([FR-021](spec.md#fr-021)).
- `cw explain` names the layer of a builtin primitive as built into cw, and
  `CHARTER.md` names the third layer where it explains identities ([FR-019](spec.md#fr-019),
  [FR-022](spec.md#fr-022)).
- The portal is left alone: its repository view lists every catalogue entry with
  its file, so a builtin primitive already shows as `(built into cw)/…`, which
  names its layer.

**Tests.** Tests over `charterRootOf` prove the read order, that a refused builtin
file is filed under its own path, and the collision against the repository's
file; a test over `loadCharterRoot` proves the layer adds no read from disk.

#### 17.1.47 T047 — What the engine brings, and the build needing no case for it

`CwAuthorSkill` extends `SkillPrimitive`, its headers typed `SkillHeaders`: id
`cw-author`, a description saying it is for authoring a new primitive of this
charter, and the triggers of [FR-100](spec.md#fr-100). `BUILTIN_PRIMITIVES` holds one of it
([§5.4](#54-what-the-engine-brings-fr-096--fr-103)). A fresh repository's charter holds `skill:cw-author` under
`BUILTIN_SCOPE` with no fault. Nothing in `compile`, `build`, `preview`,
`doctor`, `init` or the vendor commands changed ([§6.5](#65-the-builtin-layer-needs-no-case-of-its-own-fr-024)). This repository's own
`.claude/skills/skill-cw-author/` was rebuilt.

**Tests.** A build of a fresh repository compiling for claude writes the skill to
`.claude/skills/skill-cw-author/SKILL.md` and nothing under `.cw/` beyond
`.cw/out/` ([FR-024](spec.md#fr-024), [Story 12](spec.md#user-story-12---the-instructions-arrive-with-the-engine-not-with-the-repository-priority-p3) scenario 2). A primitive no longer shipped is proved
deleted by seeding the stamped `SKILL.md` a previous engine would have left under
another id, then building: the build deletes it ([FR-024](spec.md#fr-024)). `cw init` writes
nothing under `.cw/charter/` or `.cw/vendor/` for the layer ([FR-018](spec.md#fr-018)). Every test
that lists what a build, a catalogue, a listing or a preview holds includes
`skill:cw-author`.

#### 17.1.48 T048 — The body, written against the commands that answer it

The body is the procedure of [§5.4](#54-what-the-engine-brings-fr-096--fr-103), told in terms of what `cw` answers rather than
of what any kind holds, so it stays right when a kind changes. It is held in
`CwAuthorSkill.ts`, and nothing else in the class changed. Not in it: teaching
how to write a good body, and editing or deleting.

**Tests.** `test/the-authoring-skill.test.ts` takes every key of every kind's
schema and asserts none appears in the body as a header is written — followed by
`:` or `=`, or alone in backticks ([FR-097](spec.md#fr-097), [SC-020](spec.md#sc-020)); that every command the body
names is one `cw` has ([FR-103](spec.md#fr-103)); that the procedure comes in order ([FR-098](spec.md#fr-098)); and
that it says whose it is and what it does not cover ([FR-099](spec.md#fr-099), [FR-101](spec.md#fr-101)).

### 17.2 Phase 002: the charter portal

The list is [tasks/002-charter-portal.md](./tasks/002-charter-portal.md). The
stories go in spec order: [Story 5](spec.md#user-story-5---see-what-the-charter-holds-and-why-each-rule-comes-up-priority-p1), [Story 6](spec.md#user-story-6---author-edit-and-delete-a-primitive-without-looking-anything-up-priority-p2), [Story 7](spec.md#user-story-7---build-preview-and-check-the-repositorys-health-priority-p3), [Story 8](spec.md#user-story-8---install-see-and-remove-vendor-sources-priority-p4) and [Story 9](spec.md#user-story-9---write-run-and-correct-the-self-regression-tests-priority-p5). Within
a story the engine half lands before the page half, so every change that touches
the page has a port answer to show. Each story lands as one change ([SC-026](spec.md#sc-026)).

#### 17.2.1 T2.001 — The test cases naming an identity

The cases naming the identity, matched by each case's `activatedIdentity` and
named by its situation; `ExplainCommand` prints every relation ([§10.2](#102-explain-fr-029-fr-116)).

What was already there when the task opened: `explain` reads the test files and
answers `testCasesByFile`, and `cw explain` prints each case as `pinned down by
<file>: <situation>`. What [FR-029](spec.md#fr-029) still asks of the explanation, and this task
adds on both surfaces — the port's `ExplanationOutcome`, which the portal will
read in [T2.008](tasks/002-charter-portal.md#t2.008), and `cw explain`:

- **When it comes up.** `ExplanationOutcome` carries `activatesWhen`, the
  primitive's kind's own `activatesWhen`; `cw explain` prints it as `comes up
  when <activatesWhen>`.
- **A rationale that does not resolve, marked.** A corpus the charter does not
  hold stays out of `rationale` and is read off the primitive's own `rationale`
  header, which `scopedPrimitive` already carries (data-model [§13](data-model.md#13-explanation-fr-029)). `cw explain`
  prints it as `rationale <identity> (does not resolve)`, the mockup's words,
  rather than leaving it out.

Acceptance:
- Every kind's explanation prints `comes up when` followed by that kind's
  `activatesWhen`, the same text `cw kinds` prints.
- A primitive citing a corpus the charter does not hold still explains, exit 0,
  and prints its rationale marked `(does not resolve)`.
- `ExplanationOutcome` parses with its schema carrying `activatesWhen`.
- The test-case lines stay as they are.

Not in this task: the explanation route and the modal ([T2.008](tasks/002-charter-portal.md#t2.008)), and a mixin that does not resolve — that is
an error, so a charter holding one explains nothing and is sent to `cw doctor`.

#### 17.2.2 T2.002 — The first routes

`GET /api/charter/root/faults`, sending the `faultsByFile` of
`OutcomeDTOs.DoctorOutcome`, and `GET /api/charter/root/primitives`, sending
`DataDTOs.Catalogue` as it is, with the statuses of [§12.2](#122-the-route-table).

What was already there when the task opened: both routes are chained in
`routes.ts`, beside `GET /api/definitions/kinds`, and
`reading-the-charter-over-http.test.ts` asks each through the app's own
`request`. The task holds them against [§12.2](#122-the-route-table) and adds nothing the table does not ask
for.

Acceptance:
- `GET /api/charter/root/primitives` over a charter that holds answers `200`
  and a `DataDTOs.Catalogue` that parses with its schema, every layer's entries
  in it, the builtin one included.
- The same route over a charter holding an error answers `422` and a
  `DataDTOs.FaultsByFile` naming the file that has to change ([FR-115](spec.md#fr-115)).
- `GET /api/charter/root/faults` answers `200` and a `DataDTOs.FaultsByFile`
  whether the charter holds or not: what is wrong is the answer this route is
  for, not a refusal. Over a charter that holds, `files` is empty.
- A raised `Fault` is `422` with its `DataDTOs.Fault`; anything else is `500`
  and its message, logged to the terminal.
- Every route reads the repository afresh; nothing of the charter is held
  between calls ([FR-110](spec.md#fr-110)).

Not in this task: the page that reads these routes ([T2.003](tasks/002-charter-portal.md#t2.003) –
[T2.005](tasks/002-charter-portal.md#t2.005)), the vendor layer shown on its own ([T2.006](tasks/002-charter-portal.md#t2.006)), and the
primitive routes by `:identity` ([T2.015](tasks/002-charter-portal.md#t2.015)).

#### 17.2.3 T2.003 — The page shell

The page shell from the mockup ([§12.5](#125-the-page)) — the header with the repository, the
search, Build and Doctor; the three tabs; the modal and the toast — as components
with no data. Tested in a real browser.

What was already there when the task opened: `main.tsx` renders `Portal`, with
the header, the Build menu, the three tabs, the sheet, `Modal` and `Toast`, and
`index.html` carries the mockup's shell styles. `opening-the-portal-page.test.ts`
opens the page in Chromium through `in-the-browser.ts`. The repository view is
already mounted in the sheet; it is held against [T2.004](tasks/002-charter-portal.md#t2.004), not here. The task
holds the shell against the mockup and [§12.5](#125-the-page), and adds nothing that needs a
route.

Acceptance:
- The header carries the brand, a slot for the repository, the search box, Build
  with its menu of Preview and Build, and Doctor, in the mockup's order.
- The Build menu opens from its caret, and closes on the next click anywhere,
  the click that chose from it included.
- The three tabs are Repo Charter, Vendor and Test, in that order; Repo Charter
  is on when the page opens, and the one clicked is the one on.
- The Test sheet is empty: nothing there calls a route yet. (The Vendor sheet was empty too until [T2.006](tasks/002-charter-portal.md#t2.006) mounted its listing there.)
- Neither the modal nor the toast is drawn until a view opens it.
- Every citation in `main.tsx` names this plan's [§12.5](#125-the-page) and [FR-110](spec.md#fr-110), where
  the shell's reasons are, rather than numbers that point elsewhere.

Not in this task: the repository's name in the header, which no route answers
yet; what Search, Build, Preview and Doctor do ([T2.007](tasks/002-charter-portal.md#t2.007), [T2.022](tasks/002-charter-portal.md#t2.022), [T2.023](tasks/002-charter-portal.md#t2.023));
anything that opens the modal or raises the toast ([T2.008](tasks/002-charter-portal.md#t2.008) onward); the
mockup's logo image, an asset the package does not hold.

#### 17.2.4 T2.004 — The repository view

Kind chips with counts, the line saying when that kind comes up, the table of
identity, description, path, and the headers the kind is pinned down by, and the
empty state per kind. `kinds()`, `GET /api/definitions/kinds` and `cw kinds`
answer every kind under its `activatesWhen`, so the page names no kind of its own
([§9.1](#91-what-a-kind-requires-fr-059-fr-062-fr-063), [§12.5](#125-the-page)). The view asks afresh each time the tab is shown. There is no
layer filter or label of its own: every catalogue entry is listed with its file,
and the file names its layer ([§5.3](#53-the-builtin-layer-supplied-rather-than-stored-fr-017--fr-024)).

[Story 5](spec.md#user-story-5---see-what-the-charter-holds-and-why-each-rule-comes-up-priority-p1) lands as one change, [T2.004](tasks/002-charter-portal.md#t2.004) – [T2.008](tasks/002-charter-portal.md#t2.008) its steps ([SC-026](spec.md#sc-026)). What
was already there when it opened: `RepoCharter.tsx` in the Repo Charter sheet,
asking `GET /api/definitions/kinds` and `GET /api/charter/root/primitives` each
time it is shown, with its chips, `activatesWhen` line, table and empty state
held by `reading-the-repository-charter.test.ts`; `cw kinds`, `cw list` and
`cw explain` on the command line.

**The portal lists the charter, not the catalogue.** `list` answers the
catalogue, which records no layer and only the headers an agent surveys by, so
neither the vendor layer ([FR-112](spec.md#fr-112)) nor a search over every header ([FR-114](spec.md#fr-114)) can be
answered from it. `list` and `cw list` stay as they are. Beside `list`,
`ForManagingCharter` gains `fullList(matching?)`, answering off the charter it
loaded: `DataDTOs.ScopedPrimitives`, each primitive as the
`DataDTOs.ScopedPrimitive` `explain` already answers with — its file, its
`scope` and every header it declared — or `DataDTOs.FaultsByFile` over a
charter holding an error. `GET /api/charter/root/primitives` answers it in
place of `list`.

**Search is the engine's.** Given a word, `fullList` keeps a primitive whose
identity, kind, description, kind's `activatesWhen`, file or any header value
holds it, ignoring case. `GET /api/charter/root/primitives?matching=<word>`
asks it; the page filters nothing itself.

Acceptance, the repository view ([T2.004](tasks/002-charter-portal.md#t2.004)):
- Every kind `kinds()` answers has a chip, in the engine's order, carrying how
  many primitives of it the tab's layers hold; a kind with none still has its
  chip and shows its empty state ([Story 5](spec.md#user-story-5---see-what-the-charter-holds-and-why-each-rule-comes-up-priority-p1), scenarios 1, 6).
- The line above the table is the shown kind's `activatesWhen`, the text
  `cw kinds` prints.
- Each row names the id, the description and the file; a guide's row also its
  globs and its rationale, and every kind that may name mixins a column for
  them ([Story 5](spec.md#user-story-5---see-what-the-charter-holds-and-why-each-rule-comes-up-priority-p1), scenario 2).
- The Repo Charter tab lists the `repo` and `builtin` scopes; a builtin
  primitive's file reads `(built into cw)/…`.
- The view asks again each time its tab is shown ([FR-110](spec.md#fr-110)).
- `GET /api/charter/root/primitives` answers `200` and a
  `DataDTOs.ScopedPrimitives` that parses with its schema, every layer in it;
  `cw list` prints what it printed before.

Acceptance, the faults view ([T2.005](tasks/002-charter-portal.md#t2.005)):
- Over a charter holding an error, the tab says the engine will not read the
  charter and shows every file with its faults under it, each fault's message
  and fix, in place of chips and table ([Story 5](spec.md#user-story-5---see-what-the-charter-holds-and-why-each-rule-comes-up-priority-p1), scenario 5).
- The faults are the `DataDTOs.FaultsByFile` the listing route answers `422`
  with, the ones `cw doctor` prints.

Acceptance, the vendor layer ([T2.006](tasks/002-charter-portal.md#t2.006)):
- The Vendor tab lists the `vendor` scope with the repository view's chips,
  line and table, and nothing on it writes.
- A repository with no vendor shows the empty state of each kind.

Acceptance, search ([T2.007](tasks/002-charter-portal.md#t2.007)):
- A word typed in the header lists, in a dropdown under the box, every
  primitive of every layer the engine keeps for it, each with its kind, id,
  description and layer, and nothing else; the tab under it is left as it was
  ([Story 5](spec.md#user-story-5---see-what-the-charter-holds-and-why-each-rule-comes-up-priority-p1), scenario 3).
- A header value only `ScopedPrimitive` carries, such as a sensor's `signal`,
  is found.
- Choosing a result shows its layer's tab with its kind selected and opens it;
  Escape clears the box and closes the list ([Story 5](spec.md#user-story-5---see-what-the-charter-holds-and-why-each-rule-comes-up-priority-p1), scenario 7).

Acceptance, the explanation ([T2.008](tasks/002-charter-portal.md#t2.008)):
- `GET /api/charter/root/primitives/:identity/explanation` answers `200` and
  an `OutcomeDTOs.ExplanationOutcome`; `422` and a `DataDTOs.FaultsByFile` over
  a charter holding an error; `422` and a `DataDTOs.Fault` for an identity the
  charter does not hold ([§12.2](#122-the-route-table)).
- Every row, in every tab, has an Explain button opening the
  modal on that primitive.
- The modal shows its kind and description, when it comes up, every header it
  declared but its id and description — a sensor's `signal` and `run` among
  them, so what it answers to and runs is read beside its kind's line — the
  mixins and
  the rationale it pulls in — a rationale that does not resolve marked
  `(does not resolve)` — the primitives that lend from or cite it, every test
  case naming it by its situation under its file, under "Tested by", and its
  file and layer
  ([Story 5](spec.md#user-story-5---see-what-the-charter-holds-and-why-each-rule-comes-up-priority-p1), scenario 4).
- Every identity in the modal opens that primitive's own explanation ([FR-116](spec.md#fr-116)).
- `cw explain` prints the same declared headers, one `declares <header>: <value>`
  line each ([FR-109](spec.md#fr-109)).
- A guide declaring no globs reads `all patterns` in the listing's globs column.
- The modal closes by its ×, the overlay and Escape.

Not in this story: each test case's last outcome in the modal, which the page
holds only once the test view runs the tests ([T2.030](tasks/002-charter-portal.md#t2.030)); the vendor sources
panel ([T2.026](tasks/002-charter-portal.md#t2.026)); editing from a row ([T2.016](tasks/002-charter-portal.md#t2.016)).

#### 17.2.5 T2.005 — The faults view

Shown in place of the listing when the charter holds an error ([FR-115](spec.md#fr-115)).

#### 17.2.6 T2.006 — The vendor layer's primitives

The Vendor tab lists the vendor layer's primitives read-only, with the
repository view's table. The sources panel waits for [T2.026](tasks/002-charter-portal.md#t2.026).

#### 17.2.7 T2.007 — Search

The search box in the header lists the matching primitives of every layer in a
dropdown under it; choosing one opens it where it is listed ([FR-114](spec.md#fr-114)).

#### 17.2.8 T2.008 — The explanation route and modal

`GET …/:identity/explanation` and the Explain modal, each identity in it opening
its own explanation ([FR-116](spec.md#fr-116)).

#### 17.2.9 T2.009 — Adding carries a body

`add(kind, id, headers, body = "")`, the body written by `toMarkdown` ([§9.3](#93-cw-add-kind-id-prompts-and-header-flags-fr-064--fr-074)).
`primitiveOf` already takes an `UnparsedPrimitive` with a body.

[Story 6](spec.md#user-story-6---author-edit-and-delete-a-primitive-without-looking-anything-up-priority-p2) lands as one change, [T2.009](tasks/002-charter-portal.md#t2.009) – [T2.018](tasks/002-charter-portal.md#t2.018) its steps ([SC-026](spec.md#sc-026)). What
was already there when it opened: `add(kind, id, headers)` writing an empty
body through `writeCharter`, which refuses only a file already at
`<kind>/<id>.md`; `cw add` and `cw kinds`; `listPrimitiveRequirements` with no
allowed values; the Repo Charter and Vendor listings with an Explain button per
row and no way to open a primitive; `@codemirror/*` and `marked` declared and
not yet imported.

**An identity is refused wherever it is claimed.** `add` reads the charter's
files with `loadCharterRoot` — not `#read`, so a charter holding an error elsewhere
can still be added to — and refuses an identity `primitiveById` already holds,
raised naming the file claiming it, whichever layer that is ([Story 6](spec.md#user-story-6---author-edit-and-delete-a-primitive-without-looking-anything-up-priority-p2)
scenario 3, [Story 10](spec.md#user-story-10---write-a-primitive-with-no-terminal-to-answer-at-priority-p1) scenario 5). `writeCharter` keeps its own refusal for a
file standing at the path under another identity.

**Open, rewrite and remove read the files, not the validation.** All three ask
`loadCharterRoot` which file declares the identity, so each works on a charter
holding an error — which is when an author most needs to open a file and fix
it. `open` answers the primitive as that reading holds it, with the content
hash of its `toMarkdown()` as the revision; `rewrite` reads the charter again
and refuses when the primitive no longer hashes to that revision. Nothing reads a
file twice. It answers `DataDTOs.PrimitiveSnapshot`: `{ scopedPrimitive, body, revision }`.

`rewrite(identity, headers, body, revision)` and `remove(identity)` raise a
`Fault` for an identity the charter holds nothing of, and for one the
`RepoScopedPrimitive` specification is not satisfied by — a vendored or builtin
primitive — naming its file, which names the vendor folder ([FR-077](spec.md#fr-077)). `rewrite` raises when the primitive no longer hashes to `revision`, naming
the file ([FR-078](spec.md#fr-078)), and answers the `Faults` `add` gives for answers the kind
will not take — both go through one private reading of kind, id, headers and
body into a primitive, so they cannot refuse in different words ([FR-075](spec.md#fr-075)).
It writes `toMarkdown()` over the file the primitive was read from, wherever
that is, and answers the `ScopedPrimitive` it wrote. `remove` deletes that file
and answers the `ScopedPrimitive` it removed. Neither builds nor commits ([FR-079](spec.md#fr-079)).

**Allowed values.** `PrimitiveHeader` gains `allowedValues`, read off the
schema the way `shape` is — a `z.enum` answers its options, anything else none.
`cw kinds <kind>` prints them beside the shape, `line, one of …` ([FR-109](spec.md#fr-109)).

**The command line.** `cw remove <identity>` asks `open` which file it is,
asks whoever is at the terminal whether to remove it, and on a yes calls
`remove` and prints the file it removed. `--yes` answers ahead; with nobody at
the terminal and no `--yes` it removes nothing and says to pass it. A vendored
or builtin primitive is refused before anything is asked. `cw edit <identity>` calls `open`, refuses a builtin primitive,
and runs `$VISUAL`, else `$EDITOR`, on the file with the terminal handed over,
waiting for it to exit; neither set is refused naming both ([§13](#13-the-command-line-fr-093--fr-095-fr-109)).

**The routes** are the rows of [§12.2](#122-the-route-table) marked for this story. `POST` takes
`{ kind, id, headers, body }` and answers `201` with a `Location`; `GET` of one
primitive answers the `PrimitiveSnapshot` with an `ETag`, its revision in
quotes; `PUT` takes `{ headers, body }` and `If-Match`, opens the primitive
again and answers `412` with a `DataDTOs.Fault` naming the file when the
revision differs or `If-Match` is missing, and otherwise passes the revision it
opened to `rewrite`; `DELETE` answers `204`.

**The page.** A **New <kind>** button on the Repo Charter view's header opens the
form in the modal for the kind shown, and each row's id opens that primitive.
The form's rows are the requirements' headers in the engine's order — a box per
entry with Add and × for a list, a `<select>` for a header with allowed values,
a line otherwise, and the rationale offering every `corpus:` identity of the
listing — under the kind (a `<select>` of `kinds()` on a new primitive) and the
id. On an existing primitive both are shown as text, with the line "the
identity is the file — rename by creating a new primitive and deleting this
one". Blank lines and blank list entries are not sent. A vendored or builtin
primitive opens as a read-only view of its headers, file and body, saying that
to differ from it an author writes a primitive under an identity of their own.

The body is a Source/Preview switch: Source is CodeMirror with
`lang-markdown`, mounted by a `ref` callback and never re-rendered by React; Preview
is `marked`, with raw HTML in the body escaped rather than rendered, since a
vendor's body is text someone else wrote and this page holds a token that
writes.

Acceptance, the engine ([T2.009](tasks/002-charter-portal.md#t2.009) – [T2.014](tasks/002-charter-portal.md#t2.014)):
- `add` with a body writes the file `cw add` writes for the same answers with
  that body under the frontmatter; with none, the file it wrote before.
- `add` under an identity a vendored or builtin primitive holds writes nothing
  and raises naming that primitive's file.
- `open` answers the headers, body, file, scope and the content hash of the
  primitive's `toMarkdown()` as its revision, for a repository, a vendored and a builtin primitive, and still
  answers over a charter where another file holds an error.
- `rewrite` with the revision `open` gave replaces the file with the new
  headers and body, keeping its kind, id and path; nothing else on disk changes.
- `rewrite` after the file changed on disk raises naming the file and writes
  nothing; of a vendored primitive raises naming its vendor folder; with answers
  the kind refuses answers the `Faults` `add` gives for the same answers.
- `remove` deletes the repository primitive's file and nothing else; a
  primitive still naming it is reported dangling by the next `cw doctor`;
  `remove` of a vendored or builtin one raises and deletes nothing.
- `cw remove <identity>` asks before removing and removes nothing on a no, or
  with nobody at the terminal and no `--yes`; on a yes, or with `--yes`, it
  prints the file it removed; `cw edit <identity>` runs
  the editor `$VISUAL` names on the primitive's file, refuses when neither
  variable is set and when the primitive is builtin.
- `listPrimitiveRequirements("sensor")` names `signal`'s allowed values, the
  `SIGNALS` list; no other header of any kind has any. `cw kinds sensor` prints
  them.

Acceptance, the routes ([T2.015](tasks/002-charter-portal.md#t2.015)):
- `POST /api/charter/root/primitives` answers `201` and the `ScopedPrimitive`,
  `422` and `Faults` for answers the kind refuses, `422` and a `Fault` for an
  identity already claimed.
- `GET …/:identity` answers `200`, a `PrimitiveSnapshot` and an `ETag`; `PUT`
  with that `ETag` as `If-Match` answers `200`; with another, or none, `412`
  and a `Fault` naming the file, and the file is unchanged.
- `DELETE …/:identity` answers `204` and the file is gone; of a vendored one,
  `422` and a `Fault`.
- `GET /api/definitions/kinds/:kind/requirements` answers `200` and the
  `PrimitiveRequirements`; a word that is no kind, `422` and a `Fault`.

Acceptance, the page ([T2.016](tasks/002-charter-portal.md#t2.016) – [T2.018](tasks/002-charter-portal.md#t2.018)), in a real browser:
- New asks the kind, the id and every header the kind takes, a guide's globs a
  box each and a sensor's signal a choice of its allowed values, with the body
  editor ([Story 6](spec.md#user-story-6---author-edit-and-delete-a-primitive-without-looking-anything-up-priority-p2) scenario 1).
- Creating writes the file `cw add` writes for the same answers, with the body
  typed; the listing shows it without a reload.
- Answers the kind refuses, and an identity already claimed, write nothing and
  are shown in the engine's words in the form (scenarios 2, 3).
- An existing repository primitive opens with its kind and id locked and the
  rename line; saving rewrites its file; deleting removes it (scenarios 4 – 6).
- A vendored primitive opens read-only, with its file under `.cw/vendor/`, and
  nothing on it saves or deletes (scenario 7).
- After any save or delete nothing under `.cw/out/` changed (scenario 8).
- Saving after the file changed on disk is refused as "the file changed on
  disk", naming it, and the other change stays (scenario 9).
- Source shows the body with markdown highlighting; Preview renders it, a
  `<script>` in the body shown as text.

Not in this story: Build, Preview and Doctor from the header ([Story 7](spec.md#user-story-7---build-preview-and-check-the-repositorys-health-priority-p3)); the
vendor sources panel ([T2.026](tasks/002-charter-portal.md#t2.026)); `cw suite edit` ([T2.029](tasks/002-charter-portal.md#t2.029)); opening a primitive
from the Explain modal or from search; a body on `cw add` ([§13](#13-the-command-line-fr-093--fr-095-fr-109)).

#### 17.2.10 T2.010 — Opening a primitive

`open(identity)` with its revision ([§9.4](#94-opening-rewriting-and-deleting-a-primitive-fr-075--fr-079), data-model [§15.1](data-model.md#151-primitive-snapshot-fr-075-fr-078)).

#### 17.2.11 T2.011 — Rewriting a primitive

`rewrite`, refused for a vendored primitive, a stale revision, or answers the
kind will not take ([§9.4](#94-opening-rewriting-and-deleting-a-primitive-fr-075--fr-079)).

#### 17.2.12 T2.012 — Deleting a primitive

`remove`, and `cw remove <identity>` with it ([§9.4](#94-opening-rewriting-and-deleting-a-primitive-fr-075--fr-079), [§13](#13-the-command-line-fr-093--fr-095-fr-109)).

#### 17.2.13 T2.013 — `cw edit`

As [§13](#13-the-command-line-fr-093--fr-095-fr-109) says: `open`, then `$VISUAL` or `$EDITOR` on the file, writing nothing
itself.

#### 17.2.14 T2.014 — A closed header's allowed values

A header's allowed values are read off the kind's class and carried by the
requirements ([§9.1](#91-what-a-kind-requires-fr-059-fr-062-fr-063), data-model [§2.1](data-model.md#21-primitive-requirements-fr-059-fr-062)).

#### 17.2.15 T2.015 — The primitive routes

The primitive routes of [§12.2](#122-the-route-table), with the `ETag`, `If-Match` and `412` of its
"Revisions over HTTP", and the requirements route under `/definitions`.

#### 17.2.16 T2.016 — The form

The form of [§12.5](#125-the-page), built from the requirements; kind and id chosen on a new
primitive and locked on an existing one (data-model [§15.2](data-model.md#152-draft)).

#### 17.2.17 T2.017 — The body editor

CodeMirror mounted into a `ref` with markdown highlighting, and a Preview view
rendered by `marked` ([§1](#1-technical-context), [FR-119](spec.md#fr-119)).

#### 17.2.18 T2.018 — Save, create and delete

Wired to the routes: refusals shown in the engine's words, and the `412` said as
"the file changed on disk" ([Story 6](spec.md#user-story-6---author-edit-and-delete-a-primitive-without-looking-anything-up-priority-p2), scenario 9).

#### 17.2.19 T2.019 — The health check behind the port

`doctor()` behind `ForManagingCharter`, asked once; `DoctorCommand` is its
reader, printing what it printed before. It landed with [T035](tasks/001-charter-engine.md#t035): how many of the
four answers are unwell is worked out behind the port, and vendor drift is asked
of `service/vendorRepo.ts` rather than of `ForVendoringCharters` ([§10.1](#101-doctor-fr-013-fr-014-fr-080-fr-081)).

[Story 7](spec.md#user-story-7---build-preview-and-check-the-repositorys-health-priority-p3) lands as one change, [T2.019](tasks/002-charter-portal.md#t2.019) – [T2.023](tasks/002-charter-portal.md#t2.023) its steps ([SC-026](spec.md#sc-026)). What
was already there when it opened: `doctor()`, `preview()` and `build()` behind
the port, `cw doctor` and `cw build [--preview]` their readers; one warning, a
rationale citing a corpus the charter does not hold; `GET
/api/charter/root/faults` reading `doctor()`; the header's Build button, its
Preview menu and the Doctor button, drawn and wired to nothing. So [T2.019](tasks/002-charter-portal.md#t2.019) adds
no code: it is checked by the acceptance below.

**The two warnings the charter alone answers.** `compositeFaultsByFiles` adds,
each a `CharterRootFault` of severity `warn`, filed under the primitive's own
file: a corpus `citersOf` finds nobody citing, and a mixin `hostsOf` finds
nobody lending from. Citers and hosts are counted across every layer, and a
primitive of any layer is warned about: a vendored one nobody uses is a reason
to remove that vendor, and the warning is how its author learns it.

**The warning for a primitive no case names.** `findUntestedPrimitives(charter,
suites)` beside `runSuite` in `testService`: each guide and sensor no case's
`activatedIdentity` names, of any layer, a `TestCaseFault` of severity `warn`
under that primitive's file. A posture is not warned about ([FR-014](spec.md#fr-014)): a case
asking whether a file is allowed names no posture, and a `deny` may name a
command no case can touch. `doctor()` reads the test files with
`loadTestSuites` and adds these to what the charter found; a test
file that does not read is skipped here, `cw test` names it. A primitive can be
warned about by both, so `FaultsByFile.with` joins the faults of a file both
sides name rather than keeping the other's alone. Nothing else
reads them: a warning stops nothing, and `build`, `list` and the rest only ask
for the errors.

**The routes** are the rows of [§12.2](#122-the-route-table) marked [FR-120](spec.md#fr-120) and [FR-121](spec.md#fr-121). `GET
/api/charter/root/build` answers `preview()`, `POST` answers `build()`, each
`200` with the `PlanSummary` and `422` with the `FaultsByFile`; `GET
/api/charter/root/health` answers `doctor()`, always `200`.

**The page.** Build opens the Build dialog with the plan, writing nothing:
every target under create, update, delete or unchanged, the count of each,
and a Build button, the only way the page builds from its header. A build's answer is shown in the
same dialog: what it wrote and what it deleted. A charter with an error shows
its faults under each file and nothing was written. Doctor opens the Doctor
dialog: the four answers in the words `cw doctor` prints them, then every
fault under its file, errors before warnings, and a Build button when the
compiled output is behind. After a build every query is asked again.

Acceptance:
- `GET /api/charter/root/build` lists the same targets `cw build --preview`
  prints for the same repository, and writes nothing ([SC-014](spec.md#sc-014), scenario 1).
- `POST /api/charter/root/build` writes; the answer lists what was written and
  deleted, and the health check then says the output is up to date (scenario 2).
- A charter with an error: `POST` answers `422` with its faults and nothing
  under `.cw/out/` changed (scenario 3).
- `GET /api/charter/root/health` answers what `doctor()` answers, the same
  faults `cw doctor` prints; the dialog offers Build when `pendingCount > 0`
  (scenario 4).
- An uncited corpus, a mixin nobody lends from, and a guide or sensor no case
  names are each a warning naming the primitive, under its file, in `cw doctor`
  and the health route; each still builds, and `cw doctor` still exits 0 for
  them alone (scenario 5).
- A vendored primitive is warned about the way a repository one is; a corpus
  cited only by a vendored primitive is cited.
- A posture no case touches raises no warning.
- A test file that does not read raises no warning of its own in `doctor`.
- A guide citing a corpus the charter does not hold, and named by no case,
  shows both warnings under its file.

Not in this story: a warning for more than four primitives whose long content
goes into the main agent's context — the story names it and [FR-014](spec.md#fr-014) and the
tasks do not; the vendor sources panel ([Story 8](spec.md#user-story-8---install-see-and-remove-vendor-sources-priority-p4)); running tests from the
portal ([Story 9](spec.md#user-story-9---write-run-and-correct-the-self-regression-tests-priority-p5)); naming the repository in the header.

#### 17.2.20 T2.020 — The two warnings the charter alone answers

The first two warnings of [§4.4](#44-the-four-validation-warnings-fr-014).

#### 17.2.21 T2.021 — The warning for a primitive no case names

The third warning of [§4.4](#44-the-four-validation-warnings-fr-014), with validation reading `.cw/test/`.

#### 17.2.22 T2.022 — Preview and build from the header

`GET` and `POST /api/charter/root/build`; the Build button opening the preview;
the modal listing the plan, and the build from the preview ([FR-120](spec.md#fr-120)).

#### 17.2.23 T2.023 — The health route and the Doctor modal

`GET /api/charter/root/health` and the Doctor modal: the four answers, errors
listed before warnings, and a build button when the output is behind ([FR-121](spec.md#fr-121)).

#### 17.2.24 T2.024 — Dropped: nothing is recorded of an install

Planned as the install commit carrying the source and version as trailers, read
back by the adapter. Dropped: git keeps no record of a subtree's address or
version, and the engine keeps none of its own ([FR-053](spec.md#fr-053), [§7.2](#72-listing-what-is-installed-fr-053-fr-122)).

[Story 8](spec.md#user-story-8---install-see-and-remove-vendor-sources-priority-p4) lands as one change, [T2.025](tasks/002-charter-portal.md#t2.025) – [T2.026](tasks/002-charter-portal.md#t2.026) its steps ([SC-026](spec.md#sc-026)). What
was already there when it opened: `CharterVendoring.add` and `remove` behind
`ForVendoringCharters`, `cw vendor add` and `cw vendor remove` their readers,
`Git.subtreeAdd` and `Git.removeSubFolder` tested against real repositories,
and the Vendor tab listing the vendor layer read-only ([T2.006](tasks/002-charter-portal.md#t2.006)). The portal
was handed `ForManagingCharter` alone.

**Listing.** `ForVendoringCharters.installed()` answers every folder under
`.cw/vendor/`, sorted, as `add` answers one (`.cw/vendor/<name>`): a list of
strings, as `add` and `remove` answer a string ([§7.2](#72-listing-what-is-installed-fr-053-fr-122)). `CharterVendoring` is
handed `ForReadingFiles` for `listFolders`; it still writes nothing itself.
`cw vendor list` prints one folder a line, or says none is installed and how
to install one.

**The routes** are the three vendor rows of [§12.2](#122-the-route-table). `GET /api/vendors` answers
`installed()`, `200`. `POST /api/vendors` takes `{ source, version? }` and
`DELETE /api/vendors/:name` a folder name; both answer `204`, and a refusal —
no repository, work in hand, git's own words — is the `Fault` raised, `422` by
the handler every route shares. `api()` and `startPortal()` take the vendoring
port beside the authoring one; `cw portal` passes the one its context holds.

**The page.** The Vendor tab shows the sources panel above the listing it
already had. No source installed: "No vendor source installed" and an "Add
vendor source" button. Sources installed: each with its folder name and path,
its primitives counted by kind — counted off the vendor layer of the listing
under that folder, as data-model [§10.2](data-model.md#102-vendor-folders-fr-053-fr-122) says — and a Remove button; an
"Add source" button below. The add dialog asks the source and an optional
version and lists the reserved directories at a source's root: the kind
folders, off `GET /api/definitions/kinds`. A refusal is shown in the dialog in
the engine's words, message and fix, and nothing closes; a removal refused is a
toast in the same words. After either, every query is asked again, so the
listing gains or loses the vendor's primitives.

Acceptance:
- `installed()` lists each folder under `.cw/vendor/`, sorted, and nothing for
  a repository with none; a folder git put there by hand is listed like any
  other (scenario 7).
- `cw vendor list` prints each folder, and "none installed" for none.
- `GET /api/vendors` answers `installed()`; `POST` installs as `cw vendor add`
  does and answers `204`; `DELETE` removes as `cw vendor remove` does; with
  work in hand or no repository both answer `422` in the engine's words and
  touch nothing (scenarios 2, 3, 5).
- The Vendor tab with none installed says so and offers to add one; the add
  dialog lists every kind folder as reserved (scenario 1).
- With sources installed, each shows its folder and its primitives by kind
  (scenario 4).
- Adding from the dialog calls the route and closes; a refusal stays in the
  dialog in the engine's words (scenario 6). Remove calls the route.

Not in this story: resolving a short git form such as `team/charter` to an
address — the source is handed to git as typed ([FR-049](spec.md#fr-049)), and git decides
what it reaches; refusing a folder name that matches a kind — the folder lands
under `.cw/vendor/`, so no name lands on a kind folder ([FR-044](spec.md#fr-044)), and scenario
6's "reserved directory" is met by the dialog listing them; a confirmation
before Remove — it lands as a commit, and git undoes it.

#### 17.2.25 T2.025 — Listing the installed vendors

`ForVendoringCharters.installed()` and `cw vendor list` ([§7.2](#72-listing-what-is-installed-fr-053-fr-122), [§13](#13-the-command-line-fr-093--fr-095-fr-109)).

#### 17.2.26 T2.026 — The vendor routes and the sources panel

The three vendor routes of [§12.2](#122-the-route-table); the sources panel showing each source's folder,
source, version, commit and primitives by kind; its empty state; the add modal
listing the reserved directories; and Remove — each refusal in the engine's words
([Story 8](spec.md#user-story-8---install-see-and-remove-vendor-sources-priority-p4)).

#### 17.2.27 T2.027 — Listing the test files

`suites()` ([§11.3](#113-managing-test-files)).

[Story 9](spec.md#user-story-9---write-run-and-correct-the-self-regression-tests-priority-p5) lands as one change, [T2.027](tasks/002-charter-portal.md#t2.027) – [T2.031](tasks/002-charter-portal.md#t2.031) its steps ([SC-026](spec.md#sc-026)). What
was already there when it opened: `test()` behind the port and `cw test` its
reader; `loadTestSuites` in `service/testSuitesRepo.ts`, one entry per file, a
suite or its fault; `TestCase.describe()` and `activatedIdentity`; a
`DataDTOs.TestSuite` nothing answered with; the Test tab, drawn and empty.

**Listing.** `suites()` answers `DataDTOs.TestSuites`: one `TestSuite` per file
under `.cw/test/`, sorted, as data-model [§11.2](data-model.md#112-test-suites-listed) says it — its name (the path under
`.cw/test/`, `untitled-1.json`), and either its body, description and cases or,
for a file that does not read, the fault `testSuiteOf` raised. A file that does
not read is listed all the same, with no text: it is in `faultsByFiles`, and
opens empty in the editor. No charter is read. A case is said, not handed over as written: its
situation (`touching src/one.ts`, `firing event Stop`), its expectation
(`activates guide:no-any`, `is denied`, `runs sensor:test`) and the identity it
names, where it names one. `TestCase` says the first two, and `describe()` is
the two joined, so a run and a listing say a case the same way.

**Reading.** `loadTestSuites` became `loadTestRoot`, and what it read became a
`TestRoot` ([§11.2](#112-running-them)), the way the charter is a `CharterRoot`. A file that does not
read is filed under its own path, so `cw test` names it the way `cw doctor`
names a charter file, rather than under `.cw/test/` with the path in the
message.

**A run names its file.** Each `TestCaseReport` carries `suiteName`, the name of the file it
came from, so the page marks each case under its file and opens the first file
holding a failure; `cw test` prints what it printed before.

**Writing.** `addSuite()`, `writeSuite(name, text)` and `removeSuite(name)` each
answer the name they wrote or removed; the logic is in `testSuitesRepo`, the
use case delegates. The four test-file use cases are `ForAuthoringTests`,
answered by `TestAuthoring` ([§11.3](#113-managing-test-files)); `api()`, `startPortal()` and the command line's
`Context` take it beside the other two. A new file is `untitled-<n>.json` for the first free `n`,
holding the description and the first case of the sample `testSuiteOf` refuses
with — one sample, not two. `writeSuite` refuses text `testSuiteOf` refuses,
raising its `TestSuiteFault` with the sample, and writes nothing. A name that
is no listed test file is refused by both `writeSuite` and `removeSuite`, so a
name reaching outside `.cw/test/` names nothing. The sample `testSuiteOf` shows
had its event case expecting `activate`, which no suite reads; it expects
`run`.

**The command line.** `cw suite add` writes a new file and says how to edit it;
`cw suite remove <name>` removes one, asking nothing — a test file is small and
committed; `cw suite edit <name>` opens `.cw/test/<name>` in `$VISUAL`, else
`$EDITOR`, as `cw edit` does — the spawning is one helper both call — refusing a
name `suites()` does not list.

**The routes** are the five test-suite rows of [§12.2](#122-the-route-table). `GET /api/test-suites`
answers `suites()`, `200`. `POST` answers `201`, the name, with its path as
`Location`. `PUT /api/test-suites/:name` takes `{ text }` and answers `200`
with the name. `DELETE` answers `204`. A refusal is the `Fault` raised, `422`.
`GET /api/test-suites/outcome` answers `test()`, `200` with the
`TestRunReport`, `422` with the `FaultsByFile`.

**The page.** The Test tab: a bar saying how many cases in how many files, or
after a run how many of how many pass, with New test file and Run all tests;
under it one panel per file — its name, description, case count and, after a
run, how many fail; opened, each case's situation, its expectation, and pass,
fail or not run; a failing case says the unmet fault's message and fix in place
of its expectation. The identity an expectation names opens that primitive; one
the listing does not hold is marked "not in the charter". A file that does not
read shows its fault. Run all tests asks the outcome route and opens the first
file holding a failure; a run refused shows the faults. Edit opens the file's
text in a dialog with Save, Cancel and Delete file; a refused save stays in the
dialog with the engine's message and sample. New test file writes one and opens
its text. Every write — a suite saved, created or removed, a primitive written,
a build — clears the last outcome, which is only asked for by Run all tests.

Acceptance:
- `suites()` lists each file with its name, text, description and cases said as
  situation, expectation and identity; a file that does not read is listed with
  its fault; none for a repository without `.cw/test/` (scenario 1).
- `test()` names each case's suite.
- `addSuite()` writes `untitled-1.json`, then `untitled-2.json`, each holding one
  case that reads as a suite; `writeSuite` writes text that reads and refuses
  text that is not JSON or not a suite with the sample, writing nothing;
  `removeSuite` deletes one file; both refuse a name that is not a test file.
- `cw suite add`, `cw suite remove <name>` and `cw suite edit <name>` do the
  same; `cw suite edit` with no editor set is refused.
- The five routes answer as above (scenarios 2, 3, 4, 6, 7 over HTTP).
- In the browser: the Test tab lists files and, opened, their cases (scenario
  1); Run all tests says how many of how many pass, marks each case, says what
  came up for a failing one and opens its file (scenarios 2, 8); an expected
  identity opens its primitive, an unknown one is marked (scenario 5); a save
  that reads is written and clears the outcome, one that does not is refused in
  the dialog (scenarios 3, 4); New test file opens the new file's text (scenario
  6); Delete file removes it (scenario 7).

Not in this story: a structured case editor — the text is the file, and the
refusal's sample is the correction ([FR-086](spec.md#fr-086)); running one file's cases alone —
`cw test` runs all, and so does the portal; renaming a test file — delete and
create, or rename it on disk; a confirmation before Delete file or
`cw suite remove` — the file is committed, and git undoes it.

#### 17.2.28 T2.028 — Creating and deleting a test file

`addSuite()`, `removeSuite(name)`, `cw suite add` and `cw suite remove <name>`
([§11.3](#113-managing-test-files), [§13](#13-the-command-line-fr-093--fr-095-fr-109)).

#### 17.2.29 T2.029 — Rewriting a test file

`writeSuite(name, text)`, refused with `testSuiteOf`'s refusal and sample;
`cw suite edit <name>` opens the author's editor as `cw edit` does ([§13](#13-the-command-line-fr-093--fr-095-fr-109)).

#### 17.2.30 T2.030 — The test view

`GET /api/test-suites` and `GET /api/test-suites/outcome`; the test view lists
the files, opens the cases per file, runs all tests, and opens the first failing
file ([Story 9](spec.md#user-story-9---write-run-and-correct-the-self-regression-tests-priority-p5), scenarios 1, 2, 5 and 8).

#### 17.2.31 T2.031 — Create, save and delete a test file from the portal

`POST`, `PUT` and `DELETE /api/test-suites[/:name]`; New test file opens the new
file's text, Save shows the refusal and sample, Delete file removes it. The page
clears earlier outcomes on every write, the creation of a new file included
([Story 9](spec.md#user-story-9---write-run-and-correct-the-self-regression-tests-priority-p5), scenarios 3, 4, 6 and 7).

### 17.3 Phase 003: publishing to npm

The list is [tasks/003-npm-publish.md](./tasks/003-npm-publish.md). The stories go in spec order:
[Story 13](spec.md#user-story-13---install-cw-with-one-command-and-use-it-in-any-repository-priority-p1), [Story 14](spec.md#user-story-14---know-which-cw-is-running-and-move-to-another-priority-p2) and [Story 15](spec.md#user-story-15---publish-a-release-that-users-can-trust-priority-p3), each one change ([SC-026](spec.md#sc-026)), cut from `003-npm-publish`. The first version reaches the registry at the end of [Story 15](spec.md#user-story-15---publish-a-release-that-users-can-trust-priority-p3), so nothing before it says the package can be installed from there.

#### 17.3.1 T3.001 — Runtime dependencies only

`dependencies` keeps the eight packages `dist/main.js` imports; everything the page is built from moves to `devDependencies` ([§18.1](#181-what-the-package-holds-fr-126-fr-127-fr-129-fr-130-fr-133)). `test/packaging-the-engine.test.ts` reads every bare import of the built `dist/main.js` — `node:` built-ins aside, a subpath counted as its package — and asserts that set equals `dependencies`.

Acceptance: `pnpm test` green with the page's libraries under `devDependencies`; a runtime import missing from `dependencies`, or a dependency nothing imports, fails the test.

#### 17.3.2 T3.002 — The runtime guard

`bin.ts` beside `main.ts`, built by `tsup` as its own entry to `dist/cw.js` at `target: "es2017"`, so it parses on any Node still in use. It compares `process.versions.node` with the major the package's `engines` names, and either prints what it needs and exits `1`, or imports `./main.js`. `bin` points at `dist/cw.js`; `engines.node` becomes `>=22`.

Acceptance: a test runs `dist/cw.js` under a preload that reports Node 18, and it prints the version needed and exits `1` having written nothing; on the running Node it prints the usage.

#### 17.3.3 T3.003 — What the package holds

`package.json` gains `license: "MIT"`, `repository`, `homepage`, `bugs`, `keywords` and `author`; `LICENSE` is added at the root, the MIT text under `Copyright (c) 2026 Tam Nguyen`. `files` stays `["dist"]`, and npm adds the README, the license and `package.json` by itself. The same test file asserts `npm pack --dry-run --json` lists exactly those and what `dist/` holds, and no path under `src/`, `specs/`, `test/` or `.cw/`.

Acceptance: the file list is the one [FR-130](spec.md#fr-130) names; the license field and file agree.

#### 17.3.4 T3.004 — `cw --version`

`Commander` takes the version from the composition root, which reads it from `package.json` through a JSON import ([§18.3](#183-the-version-it-names-fr-131-fr-132)), and hands it to yargs' `.version()` in place of `.version(false)`.

Acceptance: `cw --version` prints the version from `package.json` and a newline, exit 0; `cw --help` lists `--version`.

#### 17.3.5 T3.005 — The health check names its version

`Context` carries the version; `DoctorCommand` prints `cw <version>` as the report's first line. The page reads the same version from its own build and the Doctor modal shows it beside its title.

Acceptance: `cw doctor` starts with `cw <version>`; the portal's Doctor modal shows the same version.

#### 17.3.6 T3.006 — The release's checks

`scripts/release.ts`, run as `pnpm release <version> [--dry-run]`. In order, refusing at the first that fails and leaving everything as it was: the version is valid semver and above `package.json`'s; the registry has never published it; the working tree is clean and on `develop`, level with `origin/develop`. Then it writes the version into `package.json` and runs `pnpm test`, restoring `package.json` if the tests fail.

Acceptance: each refusal, tried by hand with `--dry-run`, says which check failed and leaves `git status` clean.

#### 17.3.7 T3.007 — The install check

`npm pack` into a temporary folder; that tarball is installed into another with `npm install --prefix`, and its `cw` is run in a fresh `git init` folder: `cw --version` must print the version being released, then `cw init --agent claude`, `cw build` and `cw doctor` must exit 0. Installed size above 20 MB refuses as well ([SC-029](spec.md#sc-029)).

Acceptance: `pnpm release <next> --dry-run` runs every check through this one and stops before committing, with nothing changed.

#### 17.3.8 T3.008 — Commit, tag, publish, push

Without `--dry-run`: commit `package.json` as `Release <version>`, tag `v<version>`, `npm publish <tarball>` — the tarball the install check used — then `git push origin develop v<version>`. A publish that fails deletes the tag and undoes the commit. `prepublishOnly` refuses a bare `npm publish` from the repository, naming `pnpm release`; publishing a tarball runs no lifecycle script, so the release is not stopped by it.

Acceptance: a bare `npm publish` is refused; the release's own publish path is reached only after every check.

#### 17.3.9 T3.009 — The README, then 0.1.0

The README's Install section leads with `npm install -g cherry-works`, then `npx cherry-works` for one run and `npm install -D cherry-works` for a pinned version, and moves building from source under Development ([FR-138](spec.md#fr-138)). Then the maintainer runs `pnpm release 0.1.0`.

Acceptance: `npm install -g cherry-works` on a machine with nothing else installed gives a `cw` that sets a repository up, builds it and opens the portal ([Story 13](spec.md#user-story-13---install-cw-with-one-command-and-use-it-in-any-repository-priority-p1)); `git tag` shows `v0.1.0` at the release commit.

### 17.4 Phase 004: the compiled charter

The list is [tasks/004-compiled-charter.md](./tasks/004-compiled-charter.md): [Story 16](spec.md#user-story-16---open-every-primitive-as-it-was-compiled-priority-p1), one change ([SC-026](spec.md#sc-026)), cut from `develop` as `task/story-20-compiled-charter`.

#### 17.4.1 T4.001 — Listing reads the charter

`CharterAuthoring.list` stops compiling: it reads the charter root and answers one entry per scoped primitive, with the catalogue's fields and `file` as authored, through the function that makes a catalogue entry, handed the file. `filterByKind` and the ordering by identity come with it, so the DTO and what `cw list` and the portal show are unchanged.

Acceptance: `cw list` prints the same lines before and after; the portal's vendor sources still count their primitives by folder.

#### 17.4.2 T4.002 — Every primitive compiled into the output folder

`CompiledPrimitive` beside `Catalogue` in `CharterOutput.ts`; `compile` makes one per scoped primitive, its document the primitive's `toMarkdown` over `charter.bodyOf(it)`; `compile` writes its path, `.cw/out/<kind>/<id>.md`, into the catalogue entry, and the projection walks the catalogue, putting each compiled primitive, found by identity, at its entry's `file`, stamped. Writing headers back out showed that `formatFrontmatterValue` wrote a value YAML reads as something else — a sensor's `run` starting with `[`, a description holding `: ` — bare; such a value is now written in double quotes, for every document written with it.

Acceptance: after `cw build`, every `file` in `catalog.json` exists under `.cw/out/`, a guide's holds its mixin's body before its own, and the builtin skill's is on disk; a primitive removed leaves no compiled document after the next build; `cw build --preview` over a hand-edited one lists it.

### 17.5 Phase 005: knowledge reached through MCP

The list is [tasks/005-mcp-knowledge.md](./tasks/005-mcp-knowledge.md). The stories go in spec order: [Story 17](spec.md#user-story-17---declare-where-knowledge-lives-once-and-point-any-primitive-at-it-priority-p1), [Story 18](spec.md#user-story-18---sign-in-to-every-place-as-yourself-priority-p1), [Story 19](spec.md#user-story-19---give-the-agent-one-server-that-reaches-every-place-priority-p1) and [Story 20](spec.md#user-story-20---hold-a-run-to-the-places-it-needs-priority-p2), each one change ([SC-026](spec.md#sc-026)), cut from `005-mcp-knowledge`. [Story 17](spec.md#user-story-17---declare-where-knowledge-lives-once-and-point-any-primitive-at-it-priority-p1) needs no network: it is the charter and the build. The network arrives with [Story 18](spec.md#user-story-18---sign-in-to-every-place-as-yourself-priority-p1).

#### 17.5.1 T5.001 — Identities joined by `/`

`CommonHeaders.id` becomes segments joined by `/`, each the slug it was. `path.ts` writes `<kind>/<id>.md` with the folders the segments name; reading is already recursive ([§2.3](#23-ports-srchexagonport)). Every name made from an identity — a claude file, a component, `<name>` of data-model [§8](data-model.md#8-compiled-output-fr-030--fr-040) — replaces `/` where it replaces `:`, in one helper.

Acceptance: `cw add guide mfbs/no-any` writes `.cw/charter/guide/mfbs/no-any.md`; the build compiles it to `.cw/out/guide/mfbs/no-any.md`, which `catalog.json` names, and to `.claude/rules/guide-mfbs-no-any.md`; `a//b`, `/a` and `a/` are refused with the kind's sample.

#### 17.5.2 T5.002 — The `mcp` kind and the `mcps` header

`McpPrimitive` beside the other kinds, requiring `endpoint`, `auth` and `tools`, taking `path` ([§19.1](#191-the-kind-and-the-header-fr-142--fr-144)); `mcps` joins `CommonHeaders`. `compositeFaultsByFiles` gains an unresolved `mcps` entry as an `error` under the citing file, and an mcp nobody names as a `warn` under its own. `CatalogueFull` gains `mcps`.

Acceptance: `cw kinds mcp` answers its headers and sample; a file with both `endpoint` and `command`, with neither, or with `command` and `auth: [token]` but no `tokenEnv` is refused with the sample; a guide naming `mcp:missing` stops `cw build` and `cw test` with the error under the guide; an unnamed mcp is a warning in `cw doctor` and stops nothing.

#### 17.5.3 T5.003 — The list of places

`Places` in `domain/models/output/`, made by `compile` from every layer's mcp primitives: grouped by `endpoint` and `path`, prefix, the union of `auth`, the union of `tools`, `declaredBy` ([§19.3](#193-the-list-of-places-fr-145-fr-157)). It projects to `.cw/out/mcps.json`, `replace`. Two `tokenEnv`s for one command and the too-long served name are composite `error`s.

Acceptance: a repository mcp and a vendor mcp at one endpoint and path are one place under both identities, prefixed by the repository's, with the union of their tools and of their `auth`; the same two at different paths are two places; one command with two `tokenEnv`s is an error under both files; a tool name that makes `mcp__cw__<prefix>__<tool>` longer than 64 characters is an error under its mcp.

#### 17.5.4 T5.004 — What the host is given

The claude arm of `compile` gains an `McpConfig` component: `.mcp.json`, `mergeJSON`, writing `mcpServers.cw` alone, and only when the charter holds an mcp ([§19.4](#194-what-the-agents-host-is-given-fr-146-fr-147-fr-156)). The compiled document of a primitive with `mcps`, and every claude document of it, ends with a section naming each place, its path and its served tool names.

Acceptance: a charter with one mcp builds `.mcp.json` holding `cw` beside an entry the repository wrote itself, which is left untouched; a charter with none leaves `.mcp.json` as it was; a guide naming a place has its section in `.cw/out/guide/<id>.md` and in its rule.

#### 17.5.5 T5.005 — The credential store

`ForKeepingSecrets` and `OsSecrets`: `security add-generic-password -U`, `find-generic-password -w` and `delete-generic-password` on macOS, `secret-tool store`, `lookup` and `clear` on Linux, the secret passed on standard input, never as an argument ([§19.5](#195-signing-in-fr-148--fr-151)). Any other platform refuses, naming the two it supports. `InMemorySecrets` for the tests.

Acceptance: on the maintainer's machine, a secret written is read back and removed; no secret appears in the process list while it is written.

#### 17.5.6 T5.006 — `cw mcp auth`, by token

`ForReachingMcps` and `McpReaching`; `signInStatus` reads `.cw/out/mcps.json` and the store; `signInWithToken` writes one credential. `McpAuthCommand` asks at a terminal only: per address not signed in, which way (the intersection), then a hidden token prompt. `--status` and `<identity>` as [FR-150](spec.md#fr-150) says.

Acceptance: at a terminal two addresses are asked about and signed in; the next run asks nothing; without a terminal it names both and exits `1`; `--status` changes nothing; no file under the repository changes throughout.

#### 17.5.7 T5.007 — `cw mcp auth`, by OAuth, and renewal

`ForAuthorizing` and `OAuthFlow` over the SDK's OAuth client: discovery, dynamic registration, PKCE, a one-shot callback on `127.0.0.1` at a free port, the address printed for the developer to open. The registered client is kept with the credential so renewal needs no second registration ([§19.5](#195-signing-in-fr-148--fr-151)).

Acceptance: against a local OAuth test server, a sign-in ends with a credential in the store holding a refresh token; an expired credential is renewed on use with nothing asked; a renewal the server refuses answers to sign in again.

#### 17.5.8 T5.008 — `cw mcp serve`

`startMcpServer` in `src/driver/mcp/server.ts`: the SDK's `Server` on stdio, answering `tools/list` with `ForReachingMcps.served([])` and `tools/call` with `call`. `McpReaching.served` reads `mcps.json`, connects to every place at once with a ten-second limit through `ForCallingMcpServers`, and keeps what each lists that its entry declares ([§19.6](#196-the-server-fr-152--fr-154)).

Acceptance: against two in-memory places, the listed tools are exactly the declared ones under their prefixes; an undeclared name is refused and reaches nothing; a missing `mcps.json` stops the server saying to build.

#### 17.5.9 T5.009 — Forwarding, and one place failing alone

`call` finds the place by prefix, takes the credential under its endpoint, renews it if it has expired, and forwards the call; the answer is returned as it came. A place unreachable at start is left out of the listing with its reason on standard error; a place not signed in answers each call with `cw mcp auth <identity>`.

Acceptance: a call reaches its place with the stored credential in its `Authorization` header; with one place down, the other's tools are listed and answer.

#### 17.5.10 T5.010 — Places started as a local process

`McpClients` gains the SDK's stdio client for a place with `command`: started when the server starts, with `cw`'s environment and the token under `tokenEnv`, closed when the server stops ([§19.6](#196-the-server-fr-152--fr-154)). A command that is not found, or exits before it answers, fails that place alone.

Acceptance: a place declared by a command running a test MCP server over stdio is listed and answers, and the server reads its token from the variable named; a place whose command does not exist is left out with its reason, and the others are served; no process is left running after the server stops.

#### 17.5.11 T5.011 — `--enable`

`served(enable)` resolves each name against `catalog.json` and `mcps.json`: a primitive identity to its `mcps`, an mcp identity to its place, a served name to one tool; the union of them is served ([§19.7](#197-holding-a-run-fr-155-fr-156)). A name neither holds stops the server before it answers.

Acceptance: `--enable playbook:x` serves the tools of the places `x` names; `--enable mcp:y` serves `y`'s; `--enable y__one` serves one; `--enable nothing:here` exits `1` naming it.

#### 17.5.12 T5.012 — An agent held to its places

The claude `Agent` component adds `mcp__cw__<served name>` for every tool of every place its `mcps` names ([FR-156](spec.md#fr-156)).

Acceptance: an agent naming one place compiles with that place's tools beside its own and none of another's.

#### 17.5.13 T5.013 — The README

A section on declaring a place, signing in, and serving it, with the scheduled-run example of [Story 20](spec.md#user-story-20---hold-a-run-to-the-places-it-needs-priority-p2): `cw mcp serve --enable` beside the host's own flag restricting its built-in tools.

Acceptance: a developer following it from a fresh clone reaches one place from Claude Code.

## 18. Distribution (FR-126 – FR-138)

### 18.1 What the package holds (FR-126, FR-127, FR-129, FR-130, FR-133)

The package is `cherry-works` ([§1](#1-technical-context)). It holds `dist/` — the engine's bundle and the portal's page, both built by `pnpm build` — with the README, the MIT `LICENSE` and `package.json`, and nothing else: `files: ["dist"]` is the whole list, and npm adds the other three. What `dist/` needs at run time resolves inside the package: the page through the `#portal/*` import ([§12.1](#121-shape)), which points into `dist/portal/` wherever the package is installed.

`dependencies` is what `dist/main.js` imports and nothing more: `@hono/node-server`, `@hono/zod-openapi`, `hono`, `picomatch`, `prompts`, `yaml`, `yargs` and `zod`. The page's libraries — React, Radix, CodeMirror, TanStack Query, `marked`, the rest — are already inside `dist/portal/main.js`, so they are development dependencies: installing them for a user would put 90 MB on the machine for code that is never loaded. Measured on 2026-09-22, the eight runtime dependencies install at about 15 MB, and the package itself at 1.3 MB, under [SC-029](spec.md#sc-029)'s 20 MB.

The alternative, bundling the eight into `dist/main.js` so the package depends on nothing, was not taken. A security fix in any of them would then need a release of `cw` to reach a user, rather than arriving through the version range, and every bundled package's license notice would have to be carried by hand.

### 18.2 The runtime it needs (FR-128)

`engines.node` says `>=22`, but npm only warns on it and pnpm only refuses under `engine-strict`, so the check that counts is in `cw` itself. It cannot be the first line of `main.ts`: an ES module's static imports load before any of its code runs, and a dependency using syntax an old Node cannot parse fails first with an error that names neither `cw` nor a version. So `bin` points at `dist/cw.js`, a launcher built for old syntax that checks the version and only then imports `main.js`. The launcher reads the major it needs from the `engines` field, so the two cannot disagree.

### 18.3 The version it names (FR-131, FR-132)

The version is `package.json`'s, read at build time. The composition root imports it (`import packageJson from "./package.json" with { type: "json" }`); esbuild inlines it into `dist/main.js`, and `tsx` reads it the same way when `cw` runs from source, so both print the same version. `Commander` gets it with the ports and passes it to every command in `Context`, so `cw --version` and `cw doctor` say it the same way. The engine is not told: which version is running is a fact about the program the driver is part of, not about a charter, so no port and no DTO carries it.

The page, which `page-is-browser-code` keeps from importing anything of the package's own ([§2.2](#22-dependency-rules)), is given the version by `tsup`'s `define`, from the same `package.json`, as a constant the Doctor modal shows. Both halves are built by the one `pnpm build`, so they cannot name different versions.

### 18.4 Releasing (FR-134 – FR-137)

A release is `pnpm release <version>`, run by the maintainer on their own machine ([FR-137](spec.md#fr-137)), from `scripts/release.ts` beside the other maintainer scripts. It is not part of the product and is not in the package. Its order is chosen so that nothing reaches the registry or the remote until everything that can fail has run ([SC-032](spec.md#sc-032)):

1. **Refusals that change nothing** ([FR-134](spec.md#fr-134)): the version is valid semver and above the current one; the registry does not have it; the tree is clean, on `develop`, and level with `origin/develop`.
2. **The version written, and the suite run.** The version goes into `package.json`, and `pnpm test` runs, which builds. If it fails, `package.json` is restored.
3. **The install check** ([FR-135](spec.md#fr-135)). `npm pack` writes the tarball once. It is installed apart from the repository and used on a fresh repository: `--version`, `init`, `build`, `doctor`, and the installed size ([SC-029](spec.md#sc-029)).
4. **Recorded** ([FR-136](spec.md#fr-136)). The version bump is committed and tagged `v<version>`.
5. **Published.** `npm publish` of that same tarball, so what was checked is byte for byte what users get; npm asks for the account's second factor. If it fails, the tag is deleted and the commit undone.
6. **Pushed.** The commit and the tag go to `origin`.

`--dry-run` stops after step 3 and restores `package.json`. `prepublishOnly` refuses a plain `npm publish` in the repository, naming `pnpm release`, so the checks cannot be skipped by habit.

Semantic versioning from `0.1.0` (spec Assumptions). There is no provenance: npm attaches it only to a publish made from CI, which is out of scope.

### 18.5 The README (FR-138)

The README tells a user to install from the registry, with `npx cherry-works` for one run and a development dependency for a pinned version, and moves building from source under Development, since that is the contributor's way. It changes in the same story as the first release, so it never promises a package the registry does not yet have.

## 19. Knowledge reached through MCP (FR-141 – FR-157)

A rule's reasons are partly in the repository — a corpus — and partly elsewhere:
other repositories, a wiki, a chat channel. This part lets the charter say where
the rest is, and lets each developer's agent reach it as that developer. It adds
no concept layer: a guide says the rule, a corpus and the places it names say
why (spec Assumptions).

Two alternatives were weighed and not taken. A **gateway** holding one
credential for everyone makes every call look like the gateway's at the place,
and leaves access to be taken away in two places; signing in per developer keeps
the place's own record and revocation whole. **One MCP entry per place** in the
host's configuration would need every host's configuration written per place,
per developer, and would show the agent every tool each place has; one `cw`
server shows the declared ones.

### 19.1 The kind and the header (FR-142 – FR-144)

`McpPrimitive` is a kind like the other nine: a class with its schema,
`requires`, `activatesWhen` and `sample`, in `PRIMITIVE_CLASSES` (data-model [§17.1](data-model.md#171-mcp-primitive-fr-142)).
Its schema is a union of two shapes — `endpoint`, or `command` with `args` and
`tokenEnv` — refined so that exactly one is declared, `auth` is `token` alone or
left out under `command`, and `tokenEnv` is there exactly when `command` takes a
token. `endpoint` is refused unless it is an `https://` URL, or
`http://127.0.0.1`/`localhost` for a server under test. `auth` takes `oauth`
and `token` only. `requires` names `tools` alone, since which of the other two a
file needs depends on which shape it is; the refinement says so in the fault's
own words, with the sample of the shape it was nearer. `tools` names the place's own tool names; whether the place
has them is known only when it is reached, so it is said by the server, not by
validation ([FR-153](spec.md#fr-153)).

`mcps` is a common header because any kind can have reasons elsewhere, as any
kind can cite a corpus. Unlike `rationale`, one that does not resolve is an
`error`: a corpus that is missing costs a reader an explanation; an mcp that is
missing is a place the agent is told about and cannot reach.

### 19.2 Identities joined by `/` (FR-141)

An identity's `id` may hold `/` so that places — and anything else — can be
grouped by team or domain. Nothing is read from where a file sits
([§5.1](#51-one-identity-one-primitive-fr-015-fr-016)); `/` only puts the file in folders — the authored one and
the compiled one alike ([§6.1](#61-one-pass-produces-everything-fr-030--fr-034-sc-004)) — and names a host is given for an
identity replace it as they replace `:`. The replacement makes `guide:a/b` and
`guide:a-b` one file name; the collision is caught where it is made, as a second
claim on the derived name, filed under the second file.

### 19.3 The list of places (FR-145, FR-157)

`compile` builds `Places` from every layer's mcp primitives and projects it to
`.cw/out/mcps.json` (data-model [§17.2](data-model.md#172-place-fr-145)). It is part of `CharterOutput`, so
it is never written without the catalogue beside it ([SC-004](spec.md#sc-004)), and its
staleness is what `cw build --preview` already reports.

A place is keyed by its address and `path`, not by identity, because the
repository and a vendor may call one place by two names; tools are the union
across them (spec Clarifications, 2026-09-26). The prefix is taken from the
repository's own identity first, so what the repository calls a place is what
its agent sees; then sorted order, so every build names it the same.

Two faults need the whole list and are composite: a local command whose mcps
name two `tokenEnv`s, and a served name longer than the host takes. The ways to
sign in never conflict: they are the union across every identity, as the tools
are, so a narrower list takes nothing away. The
limit is the claude provider's, 64 characters for `mcp__cw__<prefix>__<tool>`,
declared on the provider so that a second host brings its own.

### 19.4 What the agent's host is given (FR-146, FR-147, FR-156)

For claude, three things, each in the provider's classes:

- **`.mcp.json`**, merged ([§6.2](#62-how-each-file-goes-down)): `mcpServers.cw` is
  `{ "command": "cw", "args": ["mcp", "serve"] }`. The entry is written only when
  the charter holds an mcp, and the rest of the file is the repository's. It is
  never deleted, like the settings.
- **A section at the end of each document of a primitive with `mcps`** — its
  compiled document under `.cw/out/` as well as the host's — naming each place's
  identity, its path and its served tool names as the host calls them. The body says the rule; this says where to look further, in the words the
  agent needs to call.
- **An agent's tool list** gains the served names of its places' tools. That is
  the host holding a subagent to its places, which is enforcement rather than
  instruction ([§19.7](#197-holding-a-run-fr-155-fr-156)).

### 19.5 Signing in (FR-148 – FR-151)

`cw mcp auth` reads `.cw/out/mcps.json`, not the charter: what it signs in to is
what the last build said the places are, the same list the server serves. It
groups places by address, since one address is one account at one service. A
local command that takes no token is not asked about.

The prompts are the command's own, as `cw add`'s are ([§1](#1-technical-context)): the use cases
are called with the answers. Without a terminal nothing is asked, which is also
what keeps a token out of an agent's conversation when an agent runs the command.

A token is stored as it was typed; it is the only way for a local command, whose
server has no sign-in of its own to discover. An OAuth sign-in goes through the SDK's
client: discovery of the server's authorization metadata, dynamic registration
of `cw` as a client, PKCE, and a callback on `127.0.0.1` at a free port, closed
after one request. The address to open is printed, not opened ([§15](#15-not-built)). What
the server registered is kept with the credential, so a renewal needs no second
registration.

The credential store is the operating system's, reached by shelling out, with
the secret on standard input so it never shows in a process listing
(data-model [§17.3](data-model.md#173-credential-fr-148--fr-151)). The hexagon sees it through `ForKeepingSecrets` as a
string under a key; what a credential holds is the application's to parse. No
DTO carries one, so no driver — the portal least of all — can show it.

### 19.6 The server (FR-152 – FR-154)

`startMcpServer` is a driver, beside the portal: the SDK's `Server` on stdio,
answering `tools/list` and `tools/call` through `ForReachingMcps` and nothing
else. It is started by the agent's host for a session and ends with it; it is not
a daemon. Standard output is the protocol's, so everything `cw` says while
serving goes to standard error.

At start `served` reads `mcps.json`, and reaches every place at once through
`ForCallingMcpServers`, each with its credential and a ten-second limit. A local
command is started then, through the SDK's stdio client, with the environment
`cw` runs in and its token under the one variable its primitive names; it is
stopped when the server stops, and a command that is not installed fails like a
server that cannot be reached. What a
place lists is kept where its entry declares it, renamed `<prefix>__<tool>`, its
description led by `[<identity> — <path>]`, its input schema passed as it came.
A declared tool the place lacks is said and left out; a place that fails is said
and left out; the rest are served ([SC-039](spec.md#sc-039)).

`call` strips the prefix, finds the place, and forwards. A local command's token
does not expire as far as `cw` knows; the process's own error is returned as it
came. A credential past `expiresAt` is renewed first through `ForAuthorizing`; a `401` from the place is
tried once more after a renewal, and otherwise answered as a tool error naming
`cw mcp auth <identity>`. The place's answer is returned unchanged, errors
included: the server decides what may be called, not what an answer means.

### 19.7 Holding a run (FR-155, FR-156)

Four ways a charter narrows what an agent reaches, from wide to narrow:

| Mechanism | Holds | Enforced by |
|---|---|---|
| an mcp's `tools` | every session: no undeclared tool is ever served | `cw mcp serve` |
| a primitive's `mcps` | where that primitive tells the agent to look | the agent reading it |
| an agent's `mcps` | a subagent's tools | the host |
| `cw mcp serve --enable` | one run, as a scheduled job or CI | `cw mcp serve` |

`--enable` names are resolved against `catalog.json`, which already holds every
primitive's `mcps`, and `mcps.json`; the server reads no charter. A job that must
reach nothing else also runs its agent with the host's own built-in tools
restricted, which is the host's flag, not `cw`'s; the README shows both together.
Nothing here is a posture: a posture decides whether a call needs approval, and
the tools that exist are decided before any call is made.
