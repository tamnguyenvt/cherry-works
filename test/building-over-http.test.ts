import assert from "node:assert/strict";
import { test } from "node:test";
import { CharterDTOs } from "../src/module/charter/app/port/in/charter.dto.js";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { FaultDTOs } from "../src/module/shared/app/port/in/fault.dto.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { Commander } from "../src/presentation/cli/cli.commander.js";
import { wrapAppToShowPaths } from "../src/presentation/cli/commands/helper.js";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { api } from "../src/presentation/portal/portal.routes.js";
import { authoringCharterOf, buildingCharterOf, commandLineOf, workspaceSettingsLoaderOf } from "./use-cases-of.js";

const repoPath = new URL("file:///repo/");
const at = (path: string) => new URL(path, repoPath).href;

const primitive = (kind: string, id: string, headers: readonly string[] = []) =>
  [
    "---",
    `kind: ${kind}`,
    `id: ${id}`,
    `description: About ${id}.`,
    ...headers,
    "---",
    "",
    `The body of ${id}.`,
    "",
  ].join("\n");

const guide = (id: string, headers: readonly string[] = []) =>
  primitive("guide", id, ['globs: ["src/**/*.ts"]', ...headers]);

/** A repository compiling for claude, one guide, and the case naming it. */
const holding = (extra: Readonly<Record<string, string>> = {}) => ({
  [at(".cw/settings.json")]: `${JSON.stringify({ agents: ["claude"] })}\n`,
  [at(".cw/charter/primitive/guide/no-any/index.md")]: guide("no-any"),
  [at(".cw/charter/test/no-any.json")]: JSON.stringify({
    cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: "no-any" } }],
  }),
  ...extra,
});

/** The routes and the command line over one repository held in memory, so
 *  what each surface says of it can be held side by side (SC-014). */
const surfaces = (files: Readonly<Record<string, string>>) => {
  const fileReaders = new InMemoryFileReaders(files);
  const sourceFetcher = new InMemorySources();
  const charterAuthoringApp = authoringCharterOf(
    fileReaders,
    new InMemoryFileOutput(fileReaders),
    new InMemoryReporter(),
    { sourceFetcher },
  );
  const charterRuntimeApp = buildingCharterOf(
    fileReaders,
    new InMemoryFileOutput(fileReaders),
    new InMemoryTokenCounter(),
    { claude: new InMemoryAgentCli() },
    new InMemoryReporter(),
  );
  const cli = new Commander(
    commandLineOf(
      fileReaders,
      new InMemoryFileOutput(fileReaders),
      { charterAuthoringApp, charterRuntimeApp },
      "/repo",
    ),
    COMMANDS,
  );
  return {
    portalRoutes: api(
      wrapAppToShowPaths(charterAuthoringApp, "/repo"),
      wrapAppToShowPaths(charterRuntimeApp, "/repo"),
      workspaceSettingsLoaderOf(fileReaders),
    ),
    fileReaders,
    cli,
  };
};

/** What one command printed, and its exit status. */
const printed = async (cli: Commander, argv: readonly string[]) => {
  const written: string[] = [];
  const kept = process.stdout.write;
  process.stdout.write = ((text: string | Uint8Array) => (
    written.push(String(text)), true
  )) as typeof process.stdout.write;
  try {
    return { code: await cli.run(argv), text: written.join("") };
  } finally {
    process.stdout.write = kept;
  }
};

const buildRequest = { method: "POST", headers: { "Content-Type": "application/json" } };

test("the preview lists every target cw build --preview prints, and writes nothing (FR-120, SC-014)", async () => {
  const { portalRoutes, fileReaders, cli } = surfaces(holding());

  const answer = await portalRoutes.request("/charter/root/build");

  assert.equal(answer.status, 200);
  const { added, edited, deleted, unchanged } = CharterDTOs.PlanSummary.parse(await answer.json()).data;
  assert.ok(added.includes(".cw/out/catalogue.json"));
  assert.equal(await fileReaders.readIfThere(new URL(".cw/out/catalogue.json", repoPath)), undefined);

  const { text } = await printed(cli, ["build", "--preview"]);
  const listed = text.split("\n").flatMap(
    (line) =>
      line
        .match(/^ {2}(\S+) +(\S+)$/)
        ?.slice(1, 3)
        .join(" ") ?? [],
  );
  assert.deepEqual(listed, [
    ...added.map((path) => `create ${path}`),
    ...edited.map((path) => `update ${path}`),
    ...deleted.map((path) => `delete ${path}`),
    ...unchanged.map((path) => `unchanged ${path}`),
  ]);
});

test("building writes, says what it wrote, and the health check then says the output is up to date (FR-120, FR-121)", async () => {
  const { portalRoutes, fileReaders } = surfaces(holding());

  const answer = await portalRoutes.request("/charter/root/build", buildRequest);

  assert.equal(answer.status, 200);
  const { added } = CharterDTOs.PlanSummary.parse(await answer.json()).data;
  assert.ok(added.includes(".cw/out/catalogue.json"));
  assert.notEqual(await fileReaders.readIfThere(new URL(".cw/out/catalogue.json", repoPath)), undefined);

  const health = CharterDTOs.DoctorOutcome.parse(
    await (await portalRoutes.request("/charter/root/health")).json(),
  ).data;
  assert.equal(health.pendingCount, 0);
  assert.equal(health.problemCount, 0);
});

test("a charter with an error builds nothing, and its faults are sent under their files (FR-120)", async () => {
  const { portalRoutes, fileReaders } = surfaces(
    holding({ [at(".cw/charter/primitive/guide/no-any/index.md")]: guide("no-any", ['mixins: ["nowhere"]']) }),
  );

  const answer = await portalRoutes.request("/charter/root/build", buildRequest);

  assert.equal(answer.status, 422);
  assert.deepEqual(Object.keys(FaultDTOs.FaultsByFile.parse(await answer.json()).data.files), [
    ".cw/charter/primitive/guide/no-any/index.md",
  ]);
  assert.equal(await fileReaders.readIfThere(new URL(".cw/out/catalogue.json", repoPath)), undefined);
});

test("the health check is what doctor answers, and names the faults cw doctor prints (FR-121, SC-014)", async () => {
  const { portalRoutes, cli } = surfaces(
    holding({
      [at(".cw/charter/primitive/corpus/why/index.md")]: primitive("corpus", "why"),
      [at(".cw/charter/primitive/mixin/ts/index.md")]: primitive("mixin", "ts"),
    }),
  );

  const answer = await portalRoutes.request("/charter/root/health");

  assert.equal(answer.status, 200);
  const { warnCount, pendingCount, faultsByFile } = CharterDTOs.DoctorOutcome.parse(await answer.json()).data;
  assert.equal(warnCount, 2);
  assert.ok(pendingCount !== null && pendingCount > 0);

  const { text } = await printed(cli, ["doctor"]);
  for (const [file, faults] of Object.entries(faultsByFile.data.files)) {
    assert.ok(text.includes(file));
    for (const { data } of faults) assert.ok(text.includes(`${data.severity}: ${data.message}`));
  }
});
