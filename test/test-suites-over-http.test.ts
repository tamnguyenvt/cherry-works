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
import { wrapAppToShowPaths } from "../src/presentation/cli/commands/helper.js";
import { api } from "../src/presentation/portal/portal.routes.js";
import { authoringCharterOf, buildingCharterOf, workspaceSettingsLoaderOf } from "./use-cases-of.js";

const repoPath = new URL("file:///repo/");
const at = (path: string) => new URL(path, repoPath).href;

const guide = (id: string) =>
  [
    "---",
    "kind: guide",
    `id: ${id}`,
    `description: About ${id}.`,
    'globs: ["src/**/*.ts"]',
    "---",
    "",
    "Body.",
    "",
  ].join("\n");

const suiteText = (written: unknown) => `${JSON.stringify(written, undefined, 2)}\n`;

/** A repository with one guide, one passing case and one failing one. */
const withOnePassingOneFailing = () => ({
  [at(".cw/settings.json")]: `${JSON.stringify({ agents: [] })}\n`,
  [at(".cw/charter/primitive/guide/no-any/index.md")]: guide("no-any"),
  [at(".cw/charter/test/guides.json")]: suiteText({
    cases: [
      { do: { touchFile: "src/one.ts" }, expect: { activate: "no-any" } },
      { do: { touchFile: "docs/a.md" }, expect: { activate: "no-any" } },
    ],
  }),
});

/** The routes over one repository held in memory, and what is on disk. */
const portal = (files: Readonly<Record<string, string>>) => {
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
  const portalRoutes = api(
    wrapAppToShowPaths(charterAuthoringApp, "/repo"),
    wrapAppToShowPaths(charterRuntimeApp, "/repo"),
    workspaceSettingsLoaderOf(fileReaders),
  );
  return {
    portalRoutes,
    charterAuthoringApp,
    charterRuntimeApp,
    fileAt: (path: string) => fileReaders.readIfThere(new URL(path, repoPath)),
  };
};

/** A write, sent the way the page sends one. */
const sending = (method: string, json?: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  ...(json === undefined ? {} : { body: JSON.stringify(json) }),
});

test("the test files are sent as suites() answers them (FR-124)", async () => {
  const { portalRoutes, charterAuthoringApp } = portal(withOnePassingOneFailing());

  const answer = await portalRoutes.request("/test-suites");

  assert.equal(answer.status, 200);
  assert.deepEqual(CharterDTOs.TestSuites.parse(await answer.json()), await charterAuthoringApp.suites());
});

test("the outcome is how cw test resolves every case, each under its file (Story 9 scenario 2)", async () => {
  const { portalRoutes, charterAuthoringApp } = portal(withOnePassingOneFailing());

  const answer = await portalRoutes.request("/test-suites/outcome");

  assert.equal(answer.status, 200);
  const testRunReportDTO = CharterDTOs.TestRunReport.parse(await answer.json());
  assert.deepEqual(testRunReportDTO, await charterAuthoringApp.test());
  assert.deepEqual(
    testRunReportDTO.data.testCaseReports.map(({ data }) => [data.suiteName, data.passed]),
    [
      ["guides.json", true],
      ["guides.json", false],
    ],
  );
});

test("a run stopped by a test file that does not read is a 422 naming it (FR-088)", async () => {
  const { portalRoutes } = portal({ ...withOnePassingOneFailing(), [at(".cw/charter/test/broken.json")]: "{ nope" });

  const answer = await portalRoutes.request("/test-suites/outcome");

  assert.equal(answer.status, 422);
  assert.match(JSON.stringify(FaultDTOs.FaultsByFile.parse(await answer.json())), /broken\.json/);
});

test("a test file posted is written under a free name, and answered with its path (Story 9 scenario 6)", async () => {
  const { portalRoutes, fileAt } = portal(withOnePassingOneFailing());

  const answer = await portalRoutes.request("/test-suites", sending("POST"));

  assert.equal(answer.status, 201);
  assert.deepEqual(await answer.json(), { type: "TestSuiteName", data: { name: "untitled-1.json" } });
  assert.equal(answer.headers.get("Location"), "/api/test-suites/untitled-1.json");
  assert.ok(await fileAt(".cw/charter/test/untitled-1.json"));
});

test("text put that reads as a suite is written (Story 9 scenario 3)", async () => {
  const { portalRoutes, fileAt } = portal(withOnePassingOneFailing());
  const text = suiteText({ cases: [{ do: { touchFile: "src/two.ts" }, expect: { activate: "no-any" } }] });

  const answer = await portalRoutes.request("/test-suites/guides.json", sending("PUT", { text }));

  assert.equal(answer.status, 200);
  assert.equal(await fileAt(".cw/charter/test/guides.json"), text);
});

test("text put that is not a suite is a 422 with the sample, and nothing is written (Story 9 scenario 4)", async () => {
  const files = withOnePassingOneFailing();
  const { portalRoutes, fileAt } = portal(files);

  for (const text of ["{ nope", suiteText({ cases: [] })]) {
    const answer = await portalRoutes.request("/test-suites/guides.json", sending("PUT", { text }));
    assert.equal(answer.status, 422);
    assert.match(FaultDTOs.Fault.parse(await answer.json()).data.fix, /^Write it as \{ "cases": \[/);
  }
  assert.equal(await fileAt(".cw/charter/test/guides.json"), files[at(".cw/charter/test/guides.json")]);
});

test("a test file deleted is gone, and a name that is none is a 422 (Story 9 scenario 7)", async () => {
  const { portalRoutes, fileAt } = portal(withOnePassingOneFailing());

  const refused = await portalRoutes.request("/test-suites/missing.json", sending("DELETE"));
  assert.equal(refused.status, 422);

  const answer = await portalRoutes.request("/test-suites/guides.json", sending("DELETE"));
  assert.equal(answer.status, 204);
  assert.equal(await fileAt(".cw/charter/test/guides.json"), undefined);
});
