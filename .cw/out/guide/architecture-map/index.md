---
kind: guide
id: architecture-map
description: Where each part of cw lives, the rules between them, and which existing class to extend before writing a new one.
globs: ["src/**"]
---

Map of `src/`. Before writing a new class, file or function, find its place
here and extend what is already there.

## Layers (hexagonal; enforced by `pnpm lint:deps`)

- `driver/` calls in: `cli/` (`Commander`, one `commands/<Name>Command.ts`
  each, listed in `commands/index.ts`), `portal/` (`routes.ts`, `page/`),
  `mcp/server.ts`. A driver reaches the hexagon only through `hexagon/port/driver/`
  or `hexagon/application/`.
- `hexagon/` decides. It imports nothing outside itself but lodash, picomatch
  and zod: no `node:*`, no adapter.
- `zdriven/` is called out to: one adapter per driven port, plus an `InMemory*`
  twin used by tests (`FileOutput`/`InMemoryFileOutput`, `Git`/`InMemoryVCS`…).

## Inside `hexagon/`

- `port/driver/` — use-case interfaces (`ForManagingCharter`…) and the DTOs
  crossing them (`dtos/data.ts`, `dtos/outcome.ts`).
- `port/zdriven/` — driven ports (`ForReadingFiles`, `ForWritingFiles`,
  `ForVCS`…), named in the adapter's own words, never the domain's.
- `application/` — use cases implementing the driver ports: `CharterAuthoring`,
  `CharterVendoring`, `TestAuthoring`, `McpConnecting`; `dtos.ts` turns domain
  values into DTOs. A use case orchestrates; it holds no rule of its own.
- `service/` — reads and writes through driven ports: `charterRepo`
  (`loadCharterRoot`, `writeCharter`), `buildService` (`plan`,
  `previewPlan`, `executePlan`), `settingsRepo`, `vendorRepo`,
  `testSuitesRepo`, `credentialRepo`, `mcpOriginsRepo`.
- `domain/` — pure rules, no port:
  - `models/charter/` — `CharterRoot` (every primitive, every composite
    fault, in `compositeFaultsByFiles`), `primitive/` (one `<Kind>Primitive`
    per kind extending `BasePrimitive`, registered in `PRIMITIVE_CLASSES` of
    `Primitive.ts`), `builtin/` (the engine's own layer).
  - `models/output/` — what a build produces, knowing no primitive:
    `CharterOutput`; `common/` (`Catalogue`, `CharterMd`, `CompiledPrimitive`,
    `McpOrigin`); `provider-component/` — a host's files: `ProviderComponent`
    ← `DocumentBasedComponent` | `SettingBasedComponent`, host-neutral, and
    `provider-component/<host>/`
    (`ClaudeSkill`, `ClaudeRule`, `ClaudeAgent`, `ClaudeSettings`,
    `ClaudeMcpConfig`, listed in `ClaudeComponent.ts`).
  - `services/` — logic that knows charter and output together:
    `compile/compileService.ts` (`compile`: one reading into a
    `CharterOutput`, hosts dispatched in `providerComponentsOf`) calling one
    factory per output, each `<model>Of()` in `compile/<model>Factory.ts`:
    `compiledPrimitiveOf`, `catalogueOf`, `charterMdOf`, `mcpOriginsOf`, and
    `claudeComponentsOf` in `claudeComponentFactory.ts`;
    `testService.ts`.
  - `path.ts` — the repository's layout: every folder and file name, and the
    URLs built from them. Not a model.
  - `models/` root — what the charter and the output share: closed value
    sets with their type (`AgentProvider`, `McpAuthMethod`), `WorkspaceSettings`,
    `DomainFault` (faults with a fix and a severity).

## Extend, don't add

- A new primitive kind: `<Kind>Primitive.ts` beside the others (schema,
  `requires`, `sample`, `activatesWhen`, `of`) and one line in
  `PRIMITIVE_CLASSES`. `cw kinds`, `cw add`, the portal and `CHARTER.md`
  follow. A kind reached by being named (`mcp:`, `script:`, `template:`) adds
  its mention regex to `identitiesMentionedIn` in `CharterRoot`.
- A new output of a primitive: extend `compiledPrimitiveOf` (extension,
  stamp, built files) rather than adding an output model.
- A new output of the charter: a declarative model in `models/output/` and a
  `<model>Of()` in `compile/<model>Factory.ts`, called from `compile`.
- A new file for a host: a class extending `DocumentBasedComponent` or
  `SettingBasedComponent` that sets its own `path` in `of`, listed in that
  host's `<Host>Component.ts`, built in `<host>ComponentFactory.ts`.
- A new host: `provider-component/<host>/`, `compile/<host>ComponentFactory.ts`, one
  arm in `providerComponentsOf`, one value of `AgentProvider`.
- A new composite check: a fault in `CharterRoot.compositeFaultsByFiles`;
  a warning is `"warn"`, anything that could send an agent to something that is
  not there is an error.
- A new command: `<Name>Command.ts` + `commands/index.ts`, calling a use case;
  anything the portal shows must have a command too.

## Rules

- A model under `models/output/` holds its final values, `document` included
  (stamped or not), and has no `to…()` step. It knows no primitive: building
  it from the charter is its factory's job, where the stamp is decided by
  kind. A host's class keeps an `of` only for what the class alone decides,
  such as its `path`.
- A method that only reads never reaches for the writing port, even where
  its use case holds one (FR-041).
- Tests drive the real use case over `InMemory*` adapters.
- A zod schema is named in PascalCase with a `Schema` suffix
  (`SkillHeadersSchema`, `WorkspaceSettingsSchema`), never UPPER_SNAKE: it is
  a schema, not a constant. The type inferred from it drops the suffix
  (`SkillHeaders`).

<!-- Generated by cherry-works. Do not edit; edit the charter and build again. -->
