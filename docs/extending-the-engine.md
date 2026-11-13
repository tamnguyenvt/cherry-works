# Extending the engine

`cw` is one front end of the Cherry Works engine. The same package exports the
engine as a library, so your own tool — an editor extension, a CI job, a web
service — can author, build, test and evaluate a charter without shelling out
to `cw`, and can keep a repository's files wherever it likes.

This guide is for tool authors. It shows how to compose the engine, how to
read what it answers, and how to hand it adapters of your own. The precise
contract is in [the reference](reference.md#the-engine-as-a-library).

## What you can change

- **Call the engine** through four applications: the workspace (a repository's
  settings), charter authoring, charter building, and runtime.
- **Replace any adapter** — where files are read and written, the store that
  keeps the charter, what each agent reads of a charter and its command line,
  how time is told, how tokens are counted, where credentials are kept, and
  the rest — by writing a class or object that implements its port, or by
  extending `cw`'s own.

What you do not replace is the engine itself: its rules are the same
whichever adapters it runs over.

## Install

The library needs Node.js 22 or later and is ESM only.

```bash
npm install cherry-works
```

Installing it adds nothing else: every library it uses, their types included,
is bundled in.

```ts
import { composeApplications, VERSION } from "cherry-works";
import type { EngineAdapters, ForReportingProgress } from "cherry-works";
```

## Compose the engine

`composeApplications(repoFolder, homeFolder, adapters?)` composes the engine
the way `cw` does:

- `repoFolder` is the repository's address, a URL ending in `/`;
- `homeFolder` is the developer's home, where sessions and promptfoo are kept;
- `adapters` holds only the adapters you replace; every other one is `cw`'s
  own.

It answers `workspaceApp` and `engineApp`:

| Application | Port | What it does |
|---|---|---|
| `workspaceApp` | `ForManagingWorkspace` | reads and writes `.cw/settings.json`: which agents a repository builds for |
| `engineApp.charterAuthoringApp` | `ForAuthoringCharter` | primitives, vendors, test and eval files, the tests, signing in to mcp origins |
| `engineApp.charterBuildingApp` | `ForBuildingCharter` | the build, its preview, the health check, the context, the sensors |
| `engineApp.charterRuntimeApp` | `ForRunningCharter` | runs evaluations, executes sensors for the agent you name, and serves the mcp gateway |

The engine is composed for the settings the repository holds **when one of
`engineApp`'s applications is first called**; composing itself reads nothing,
at an address of any scheme. Settings naming no agent yet, as before setup,
are read again on the next call; once they name one, `workspaceApp.setUpWorkspace(…)`
writing new settings needs composing again to get an engine for them.

```ts
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";
import { composeApplications, VERSION } from "cherry-works";

const repoFolder = pathToFileURL(`${process.cwd()}/`);
const homeFolder = pathToFileURL(`${homedir()}/`);

// Set the repository up for Claude Code, as `cw init --agent claude` does.
const { workspaceApp } = await composeApplications(repoFolder, homeFolder);
const settingsAnswer = await workspaceApp.setUpWorkspace(["claude"], VERSION);
if (settingsAnswer.type === "Fault") throw new Error(settingsAnswer.data.message);

// Compose again: the engine now builds for the settings just written.
const { engineApp } = await composeApplications(repoFolder, homeFolder);
await engineApp.charterAuthoringApp.setUpCharter();

// Add a guide, as `cw add guide no-any --header description=…` does.
const addAnswer = await engineApp.charterAuthoringApp.addPrimitive(
  "guide",
  "no-any",
  { description: "Never type a value as any.", globs: ["src/**/*.ts"] },
  "Use unknown and narrow it.\n",
);

// Build what Claude Code reads.
const buildAnswer = await engineApp.charterBuildingApp.buildCharter();
if (buildAnswer.type === "ProjectionPlanSummary") console.log(buildAnswer.data.added);
```

A header with several values, such as `globs`, is handed as a list. To know
which headers a kind takes, ask `charterAuthoringApp.listPrimitiveRequirements(kind)`,
as `cw kinds <kind>` does.

## Read the answers

No operation throws for something that went wrong with what it was asked.
Every answer is a DTO with a `type` and its `data`; read the `type` first:

| `type` | Meaning |
|---|---|
| the operation's own, such as `ProjectionPlanSummary`, `Primitive`, `WorkspaceSettings` | it did what was asked |
| `Fault` | one thing stopped it: `data.name`, `data.message`, `data.fix`, `data.severity` |
| `Faults` | several things are wrong with what was handed, such as a primitive's headers |
| `FaultsByFile` | the charter does not hold, and these are its faults, file by file |

The shapes of every DTO are in `CharterDTOs`, `RuntimeDTOs`, `WorkspaceDTOs`
and `FaultDTOs`, each exported as types for TypeScript.

## Replace an adapter

Hand only what you replace. A progress reporter of your own, for instance,
sends what the engine reports to your tool's log instead of the terminal:

```ts
import type { ForReportingProgress } from "cherry-works";

const progressReporter: ForReportingProgress = {
  report: (text) => myLogger.info(text),
  problem: (text) => myLogger.warn(text),
};

const { engineApp } = await composeApplications(repoFolder, homeFolder, { progressReporter });
```

Every adapter you may hand, as a `Partial<EngineAdapters>`:

| Key | Port | `cw`'s own |
|---|---|---|
| `agentProvider` | `{ [agent]: { projection: ForManagingLocalAgentOutput, agentCli: ForCheckingAgentCli } }` | Claude Code's and Codex's: `ClaudeProjection`, `CodexProjection`, `ClaudeCli`, `CodexCli` |
| `charterRepository` | `ForManagingCharter` | `FileCharterRepository`: the charter as files under `.cw/charter/` |
| `workspaceSettingsRepository` | `ForStoringWorkspaceSettings` | `FileWorkspaceSettingsRepository`: `.cw/settings.json`, through the file adapters |
| `sessionAnalysisRepository` | `ForLoadingSessionAnalysis` | `FileSessionAnalysisRepository`: the session logs under the home |
| `localOutput` | `ForManagingLocalOutput` | `LocalRepoManipulator`: lays a build's output into `.cw/out/`, through the file adapters |
| `fileReader` | `ForReadingFiles` | the repository's files on disk |
| `fileWriter` | `ForWritingFiles` | the repository's files on disk |
| `sourceFetcher` | `ForFetchingCharterSources` | git, to fetch a vendor's source |
| `worktrees` | `ForKeepingWorktrees` | git worktrees, one per evaluated case |
| `shell` | `ForRunningShellCommands` | the shell, in the repository |
| `promptfooRunner` | `ForRunningPromptfoo` | promptfoo, installed under the home's `.cherry-works` |
| `mcpServers` | `ForCallingMcpServers` | MCP clients over HTTP and stdio |
| `oauthAuthorizer` | `ForAuthorizingOAuthClients` | OAuth in the browser |
| `credentialsRepository` | `ForStoringCredentials` | the operating system's keychain |
| `tokenCounter` | `ForCountingTokens` | an offline tokenizer |
| `clock` | `ForTellingTime` | the system clock |
| `progressReporter` | `ForReportingProgress` | the terminal |

### Support another agent, or keep the charter elsewhere

`agentProvider` names the agents the engine builds for: a repository may be
set up for exactly those. Hand it whole — every agent you want — since it
replaces `cw`'s map. The easiest way to write a projection is to extend
`cw`'s own, or the abstract `AgentProjection`; a command line extends
`AgentCli`:

```ts
import { AgentCli, ClaudeProjection, CodexCli, CodexProjection } from "cherry-works";

class QuietClaudeCli extends AgentCli {
  async isInstalled() {
    return true;
  }
}

const { engineApp } = await composeApplications(repoFolder, homeFolder, {
  agentProvider: {
    claude: { projection: new ClaudeProjection(fileReader), agentCli: new QuietClaudeCli() },
    codex: { projection: new CodexProjection(fileReader), agentCli: new CodexCli() },
  },
});
```

`charterRepository` keeps the charter's primitives, vendors, test and eval
cases. `cw`'s own keeps them as files, through the file adapters; hand your own
`ForManagingCharter` to keep them in a database instead, or extend
`FileCharterRepository`. The models its methods take and answer, such as
`RawPrimitive` and `VendorRoot`, are exported with it. A store is never asked
for a version or a checkout: an evaluation reads the charter and its cases as
the store holds them now, committed or not, and lays the build into each
case's worktree of the repository through `createCheckoutOutput` and
`createCheckoutProjection`, which answer the same output or projection built
over that checkout. `cw`'s own build only themselves: every class extending
one overrides the method to build itself over the checkout, by its own
constructor, and one that does not is refused with
`UnbuiltCheckoutAdapterFault` before anything is laid.

`sessionAnalysisRepository` is set up with the folder the sessions are kept
in: `cw`'s own, with the one the repository's settings name. A store of your
own knows where it keeps them.

Every adapter of `cw`'s in the table above is exported, for a tool to extend
rather than write anew: an extension is handed as any other adapter.

```ts
import { FileCharterRepository, FileOutput, FileReaders, GitSources } from "cherry-works";
import type { RawPrimitive } from "cherry-works";

class LoggedCharterRepository extends FileCharterRepository {
  override async loadCharter(): Promise<readonly RawPrimitive[]> {
    myLogger.info("reading the charter");
    return super.loadCharter();
  }
}

const fileReader = new FileReaders(repoFolder);
const fileWriter = new FileOutput(repoFolder);
const { engineApp } = await composeApplications(repoFolder, homeFolder, {
  charterRepository: new LoggedCharterRepository(fileReader, fileWriter, new GitSources(repoFolder)),
});
```

### Keep the files somewhere else

The two file adapters decide where a repository lives. Hand your own and the
charter, its build and its settings are read and written there: in memory, in
a database, in object storage. The repository's address may then use any
scheme your adapters understand, such as `memory:/team/`.

```ts
import type { ForReadingFiles, ForWritingFiles } from "cherry-works";

const repoFolder = new URL("memory:/team/");
const homeFolder = new URL("memory:/home/");
const fileReader: ForReadingFiles = new MapFileReader(repoFolder, fileBytesByPath);
const fileWriter: ForWritingFiles = new MapFileWriter(fileBytesByPath);

const { engineApp } = await composeApplications(repoFolder, homeFolder, { fileReader, fileWriter });
```

What an adapter receives:

- **Every path is from the repository's root**, such as `.cw/settings.json`,
  with `/` between its names. The empty path is the root itself. The engine
  never hands an adapter an address: set your adapter up on the repository's
  address yourself.
- **A folder that is not there holds no files**, and a file that is not there
  reads as `undefined`; neither is a failure.

What a file adapter owes the engine:

- a completed write is read back by any later read;
- writes to one file arrive in the order they were made, and deletes may be
  asked at once;
- reading or deleting a missing file succeeds, and an empty file is a file;
- every listed file is at an address under the folder asked of, its name
  escaped as a URL escapes it, and `findFileAddress` names it the same way;
- bytes written as bytes are read back unchanged.

A build is not atomic: when a write fails halfway, what was written stays.

## Raise faults from an adapter

When your adapter cannot do what it was asked, throw. The engine catches it
and answers a `Fault` DTO; it never reaches your caller as an exception.

- Throw `AdapterFault` for a failure the person using your tool can act on,
  and mark it `{ internal: false }` so its message reaches them as written:

  ```ts
  import { AdapterFault } from "cherry-works";

  throw new AdapterFault("The bucket refused the write.", "Check the bucket's permissions.", { internal: false });
  ```

- Anything else you throw is treated as the system's own: the engine logs it,
  with its stack and causes, through `progressReporter.problem`, and answers
  a generic internal fault instead. Put no secret in a message or a cause.
- An MCP client throws `UnauthorizedMcpFault` when an mcp origin refuses its
  credential (`401`): the engine renews the credential and asks again.

## Stay compatible

What `cherry-works` exports, with the file adapter's duties above, is a public
contract under semantic versioning. It includes the models the charter's store
and the projections speak in, so a change to one of them is a change to the
contract. It is recorded in the folder `contract/` at the root of the
repository, a declarations file per module of the engine (`charter.d.ts`,
`runtime.d.ts`…) and the entry `index.d.ts` holding every name exported, and
each release is compared with it:

- removing an export, or changing an existing declaration in any way — a
  port gaining a method included — is a new major version;
- a new export is a new minor version.

An adapter written against one major version keeps compiling and working
until the next. Read the changelog's **Breaking** entries before moving to a
new major.
