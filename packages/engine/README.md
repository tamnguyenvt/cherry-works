# @cherry-works/engine

The Cherry Works engine for TypeScript and JavaScript tools. Requires Node.js 22 or later.

Import use cases, driver and driven ports, DTO schemas and types, and the faults
an adapter raises from `@cherry-works/engine`. `VERSION` is the package version, shared with `cw`.
The package is ESM. Its only runtime dependencies are `picomatch` and `zod`.

```ts
import { ProjectingCharter, VERSION } from "@cherry-works/engine";
import type { ForRunningCharter, ForReadingFiles, ForReportingProgress, ForWritingFiles } from "@cherry-works/engine";
```

The engine is reached through four applications, each a use case and the
driver port it implements: authoring the charter (`AuthoringCharter`, its
primitives, vendors, test files, and signing in to its mcp origins), projecting
it onto each agent provider (`ProjectingCharter`, setup, the build, the health check, the context, the
sensors and serving the mcp origins), testing it (`TestingCharter`, the tests
and the evaluations) and reviewing the sessions (`ReviewingSessions`). A
driver port answers DTOs alone, never a model of the domain.

Compose a use case with your adapters behind its driven ports, a
`ForReportingProgress` among them: it is where the use case logs an internal
failure for whoever runs the tool. A use case takes no address: every path it
hands a driven port is from the repository's root, such as
`.cw/settings.json`, and the empty path is the root itself. Set your adapters
up on the repository's address, and the sessions' on the developer's home; an
address must have a hierarchical path ending in `/`, and its scheme belongs to
your adapters. What keeps a repository's state is handed, and hands back, the
engine's own models — `RawPrimitive`, `Primitive`, `RawTestSuite`,
`TestSuite`, `RawEvalSuite`, `FetchedSource`, `FetchedVendor`,
`InstalledVendor`, `McpCredential`, `McpClientRegistration`, `SessionLogs` — each kept
thing known by its layer, kind and id or name, never by where it sits; its
`uri` is your store's to give, in your own scheme, and the engine only says it
back. Builtin primitives and their assets are embedded in the package.
No adapter, CLI, portal or composition root is included.

A use case never throws for a failure of what it was asked: every answer is a
DTO, read by its `type`. Validation findings come back as data grouped by file.
A fault that stops a use case comes back as a `Fault` DTO carrying `name`,
`message`, `fix` and `severity`; no fault class is needed to read it.

A fault is the system's own unless raised with `{ internal: false }`. Your
adapters raise `AdapterFault`, and YAML parsers `CharterPrimitiveFault` for
invalid notation: mark the ones the person using your tool can act on with
`{ internal: false }`. Anything else a port raises, an internal fault
included, is logged through `ForReportingProgress.problem` — its stack and
causes, never the arguments of the call — and answered as `InternalFault`,
in the system's own words. An internal fault's message and every cause under
it are logged as they are, so an adapter puts no secret in either.

Only the root exports and the file-adapter duties below are the public contract.
Internal paths cannot be imported. The contract follows semantic versioning from
the first public release, 1.0.0, read conservatively: removing an exported name
or changing an existing declaration in any way, even adding an optional member to
it, is a major version; adding a newly named declaration is a minor version; a
change to comments or layout alone does not change the contract. No release
judges whether a change to a declaration is compatible.

A file adapter must read back a completed write on any later read, preserve the
order of writes to one file, and allow deletes to be asked at once. Reading or
deleting a missing file succeeds; an empty file remains a file. Every listed
file is at a URL under the requested folder, with names escaped as URLs escape
them, and `findFileAddress` names a file's address as the reader was set up on it. Binary reads and writes preserve every byte. Builds are not atomic: a
failed write leaves earlier writes in place.

From the repository root, run `pnpm build`, then
`npm pack ./packages/engine/dist` to build and pack a local tarball. Release
publication is handled separately from building this package.
