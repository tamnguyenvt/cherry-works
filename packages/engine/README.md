# @cherry-works/engine

The Cherry Works engine for TypeScript and JavaScript tools. Requires Node.js 22 or later.

Import use cases, driver and driven ports, DTO schemas and types, and faults from
`@cherry-works/engine`. `VERSION` is the package version, shared with `cw`.
The package is ESM. Its only runtime dependencies are `picomatch` and `zod`.

```ts
import { CharterAuthoring, DomainFault, VERSION } from "@cherry-works/engine";
import type { ForManagingCharter, ForReadingFiles, ForWritingFiles } from "@cherry-works/engine";
```

Compose a use case with your adapters behind its driven ports. Repository and
home addresses must have a hierarchical path ending in `/`; their scheme belongs
to your adapters. Builtin primitives and their assets are embedded in the package.
No adapter, CLI, portal or composition root is included.

Validation findings come back as DTO data grouped by file. A fault that stops a
use case is thrown as `DomainFault`, carrying `message`, `fix` and `severity`.
Adapters raise `AdapterFault`; YAML parsers raise `CharterPrimitiveFault` for
invalid notation. Both extend `DomainFault`.

Only the root exports and the file-adapter duties below are the public contract.
Internal paths cannot be imported. The contract follows semantic versioning from
the first public release, 1.0.0.

A file adapter must read back a completed write on any later read, preserve the
order of writes to one file, and allow deletes to be asked at once. Reading or
deleting a missing file succeeds; an empty file remains a file. Every listed
file is at a URL under the requested folder, with names escaped as URLs escape
them. Binary reads and writes preserve every byte. Builds are not atomic: a
failed write leaves earlier writes in place.

From the repository root, run `pnpm build`, then
`npm pack ./packages/engine/dist` to build and pack a local tarball. Release
publication is handled separately from building this package.
