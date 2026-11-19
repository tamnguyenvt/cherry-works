import assert from "node:assert/strict";
import { test } from "node:test";
import type { ForAuthoringCharter } from "../src/module/charter/app/port/in/authoring-charter.port.js";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { FaultDTOs } from "../src/module/shared/app/port/in/fault.dto.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { wrapAppToShowPaths } from "../src/presentation/cli/commands/helper.js";
import { buildPortalRoutes } from "../src/presentation/portal/portal.routes.js";
import { answerOf } from "./answer-of.js";
import {
  authoringCharterOf,
  buildingCharterOf,
  installedFoldersOf,
  workspaceSettingsLoaderOf,
} from "./use-cases-of.js";

const repoPath = new URL("file:///repo/");

const guide = (id: string) =>
  ["---", "kind: guide", `id: ${id}`, `description: About ${id}.`, "---", "", "Body.", ""].join("\n");
const vendorRecordTextOf = (charterName: string, source: string) =>
  `${JSON.stringify({ charter: charterName, source, version: "HEAD" })}\n`;

/** What a source here publishes: one charter, `published`, holding one guide. */
const publishedCharterFiles = {
  ".cw/charter/published/primitive/guide/published/index.md": guide("published"),
};

/** The routes over one repository held in memory, and the sources
 *  they install through, so a test reads what was asked of it (plan §12.2).
 *  Sources a test does not hand over put what they hold into the repository. */
const portal = (files: Readonly<Record<string, string>> = {}, givenSourceFetcher?: InMemorySources) => {
  const fileReaders = new InMemoryFileReaders(files);
  const sourceFetcher = givenSourceFetcher ?? new InMemorySources(fileReaders);
  // The sources held in memory read the version asked for after an `@`, so
  // an address holding one is published by what comes before it.
  for (const source of ["git", "/srv/charters/charter"])
    sourceFetcher.sourceFilesBySource[source] ??= publishedCharterFiles;
  const charterAuthoringApp = authoringCharterOf(
    fileReaders,
    new InMemoryFileOutput(fileReaders),
    new InMemoryReporter(),
    { sourceFetcher },
  );
  const portalRoutes = buildPortalRoutes(
    wrapAppToShowPaths(charterAuthoringApp, "/repo"),
    wrapAppToShowPaths(
      buildingCharterOf(
        fileReaders,
        new InMemoryFileOutput(fileReaders),
        new InMemoryTokenCounter(),
        { claude: new InMemoryAgentCli() },
        new InMemoryReporter(),
      ),
      "/repo",
    ),
    workspaceSettingsLoaderOf(fileReaders),
  );
  return { portalRoutes, charterAuthoringApp, sourceFetcher };
};

/** A write, sent the way the page sends one. */
const sending = (method: string, json: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(json),
});

test("the vendors are sent as the installed charters listVendors() answers (FR-122, CORE Story 8 scenario 7, VENDOR Story 3 scenario 21)", async () => {
  const { portalRoutes, charterAuthoringApp } = portal({
    [new URL(".cw/charter/charter/cw-vendor.json", repoPath).href]: vendorRecordTextOf("charter", "acme/charter"),
    [new URL(".cw/charter/charter/primitive/guide/one/index.md", repoPath).href]: guide("one"),
    [new URL(".cw/charter/team/primitive/guide/ours/index.md", repoPath).href]: guide("ours"),
  });

  const answer = await portalRoutes.request("/vendors");

  assert.equal(answer.status, 200);
  assert.deepEqual(await answer.json(), {
    type: "CharterMetadataList",
    data: {
      charters: [
        {
          type: "CharterMetadata",
          data: {
            name: "charter",
            folder: ".cw/charter/charter",
            isInstalled: true,
            source: "acme/charter",
            version: "HEAD",
          },
        },
      ],
    },
  });
  assert.deepEqual(
    answerOf(await charterAuthoringApp.listVendors()).data.charters.map(({ data: { folder } }) => folder),
    ["file:///repo/.cw/charter/charter"],
  );
});

test("a source posted is installed as cw vendor add installs it, and the portal then lists its charter and the primitives it brought (CORE Story 8 scenario 2, FR-123, FR-109, CORE Story 55 scenario 8, VENDOR Story 3 scenario 14)", async () => {
  const { portalRoutes, sourceFetcher } = portal();

  const answer = await portalRoutes.request(
    "/vendors",
    sending("POST", { source: "git@github.com:team/charter.git", version: "v1.2.0" }),
  );

  assert.equal(answer.status, 204);
  assert.deepEqual(sourceFetcher.fetchedSources, [{ source: "git@github.com:team/charter.git", version: "v1.2.0" }]);
  assert.deepEqual(installedFoldersOf(sourceFetcher), [
    {
      commit: "git@github.com:team/charter.git@v1.2.0",
      fromFolder: ".cw/charter/published/primitive/guide/published",
      intoSubFolder: ".cw/charter/published/primitive/guide/published",
    },
  ]);
  const chartersListing = (await (await portalRoutes.request("/vendors")).json()) as {
    data: { charters: { data: { name: string; folder: string; source?: string; version?: string } }[] };
  };
  assert.deepEqual(
    chartersListing.data.charters.map(({ data: { name, folder, source, version } }) => [name, folder, source, version]),
    [["published", ".cw/charter/published", "git@github.com:team/charter.git", "v1.2.0"]],
  );
  const primitivesListing = (await (await portalRoutes.request("/charter/root/primitives")).json()) as {
    data: { primitives: { data: { id: string; layerName: string; file: string } }[] };
  };
  assert.deepEqual(
    primitivesListing.data.primitives
      .filter(({ data: primitive }) => primitive.layerName === "vendor")
      .map(({ data: { id, file } }) => [id, file]),
    [["published", ".cw/charter/published/primitive/guide/published/index.md"]],
  );
});

test("a source posted with no version is installed at its default", async () => {
  const { portalRoutes, sourceFetcher } = portal();

  await portalRoutes.request("/vendors", sending("POST", { source: "/srv/charters/charter" }));

  assert.equal(sourceFetcher.fetchedSources[0]?.version, undefined);
});

test("a source of many charters posted with none picked has every charter it authored installed, asking nothing (CORE-FR-193, VENDOR Story 3 scenario 15)", async () => {
  const sourceFetcher = new InMemorySources();
  sourceFetcher.sourceFilesBySource["team/charters"] = {
    ".cw/charter/one/primitive/guide/one/index.md": guide("one"),
    ".cw/charter/two/primitive/guide/two/index.md": guide("two"),
  };
  const { portalRoutes } = portal({}, sourceFetcher);

  const answer = await portalRoutes.request("/vendors", sending("POST", { source: "team/charters" }));

  assert.equal(answer.status, 204);
  assert.deepEqual(
    installedFoldersOf(sourceFetcher).map(({ intoSubFolder }) => intoSubFolder),
    [".cw/charter/one/primitive/guide/one", ".cw/charter/two/primitive/guide/two"],
  );
});

test("a source holding no charter is refused, saying how to make it one", async () => {
  const sourceFetcher = new InMemorySources();
  sourceFetcher.sourcesWithoutSubFolder.push("team/notes");
  const { portalRoutes } = portal({}, sourceFetcher);

  const answer = await portalRoutes.request("/vendors", sending("POST", { source: "team/notes" }));

  assert.equal(answer.status, 422);
  const faultDTO = FaultDTOs.Fault.parse(await answer.json());
  assert.match(faultDTO.data.message, /is no vendor/);
  assert.deepEqual(installedFoldersOf(sourceFetcher), []);
});

/** One charter installed under this name, and work of the repository's beside it. */
const filesHoldingVendor = (charterName: string) => ({
  [new URL(`.cw/charter/${charterName}/cw-vendor.json`, repoPath).href]: vendorRecordTextOf(
    charterName,
    "team/charter",
  ),
  [new URL(`.cw/charter/${charterName}/primitive/guide/one/index.md`, repoPath).href]: guide("one"),
  [new URL("work.txt", repoPath).href]: "In hand.\n",
});

const installedVendors = async (charterAuthoringApp: ForAuthoringCharter) =>
  answerOf(await charterAuthoringApp.listVendors()).data.charters.map(({ data: { folder } }) => folder);

test("a vendor an earlier version laid out in one folder is refused when deleted as the old layout, saying to install it again (CORE Story 8 scenario 5, FR-180, VENDOR Story 3 scenario 4)", async () => {
  const { portalRoutes } = portal({
    [new URL(".cw/charter/vendor/charter/guide/one/index.md", repoPath).href]: guide("one"),
  });

  const answer = await portalRoutes.request("/vendors/charter", sending("DELETE", {}));

  assert.equal(answer.status, 422);
  const faultDTO = FaultDTOs.Fault.parse(await answer.json());
  assert.match(faultDTO.data.message, /is laid out the old way: \.cw\/charter\/vendor\/ sits/);
  assert.match(
    faultDTO.data.fix,
    /delete each vendor under \.cw\/charter\/vendor\/ and install it again with "cw vendor add"/,
  );
});

test("an installed charter is taken away by its name (CORE Story 8 scenario 5, FR-050, VENDOR Story 3 scenario 21)", async () => {
  const { portalRoutes, charterAuthoringApp } = portal(filesHoldingVendor("charter"));

  const answer = await portalRoutes.request("/vendors/charter", sending("DELETE", {}));

  assert.equal(answer.status, 204);
  assert.deepEqual(await installedVendors(charterAuthoringApp), []);
});

test("a name no installed charter answers to is refused in the engine's words (CORE-FR-204)", async () => {
  const { portalRoutes, charterAuthoringApp } = portal(filesHoldingVendor("charter"));

  const answer = await portalRoutes.request("/vendors/absent", sending("DELETE", {}));

  assert.equal(answer.status, 422);
  assert.match(FaultDTOs.Fault.parse(await answer.json()).data.message, /No charter is named/);
  assert.deepEqual(await installedVendors(charterAuthoringApp), ["file:///repo/.cw/charter/charter"]);
});

test("a name that climbs out of the charters' folder is refused, and nothing is taken away (FR-044)", async () => {
  const { portalRoutes, charterAuthoringApp } = portal(filesHoldingVendor("charter"));

  const answer = await portalRoutes.request("/vendors/..%2F..%2Fsrc", sending("DELETE", {}));

  assert.equal(answer.status, 422);
  assert.deepEqual(await installedVendors(charterAuthoringApp), ["file:///repo/.cw/charter/charter"]);
});

test("a name that is no folder is refused in the engine's words, and nothing is taken away (FR-044)", async () => {
  const { portalRoutes, charterAuthoringApp } = portal(filesHoldingVendor("charter"));

  const answer = await portalRoutes.request("/vendors/team%2F..", sending("DELETE", {}));

  assert.equal(answer.status, 422);
  assert.match(FaultDTOs.Fault.parse(await answer.json()).data.message, /No charter is named/);
  assert.deepEqual(await installedVendors(charterAuthoringApp), ["file:///repo/.cw/charter/charter"]);
});

test("the portal serves the repository it was started in alone, and offers no way to point it at another (CORE Story 56 scenario 5)", async () => {
  const { portalRoutes } = portal({
    [new URL(".cw/charter/team/primitive/guide/ours/index.md", repoPath).href]: guide("ours"),
    "file:///other/.cw/charter/team/primitive/guide/theirs/index.md": guide("theirs"),
  });

  for (const pointingRequest of [
    "/charter/root/primitives?repo=file:///other/",
    "/charter/root/primitives?cwd=/other",
  ]) {
    const primitivesResponse = await portalRoutes.request(pointingRequest, {
      headers: { "X-Repository": "file:///other/" },
    });
    const primitiveIds = (
      (await primitivesResponse.json()) as { data: { primitives: { data: { id: string } }[] } }
    ).data.primitives.map((primitiveDTO) => primitiveDTO.data.id);
    assert.ok(primitiveIds.includes("ours"), `${pointingRequest}: ${primitiveIds}`);
    assert.ok(!primitiveIds.includes("theirs"), pointingRequest);
  }
  const portalDocument = portalRoutes.getOpenAPIDocument({ openapi: "3.0.0", info: { title: "cw", version: "0" } });
  const parameterNames = Object.values(portalDocument.paths ?? {}).flatMap((pathItem) =>
    Object.values(pathItem ?? {}).flatMap((operation) =>
      ((operation as { parameters?: { name: string }[] }).parameters ?? []).map((parameter) => parameter.name),
    ),
  );
  assert.ok(parameterNames.length > 0);
  assert.deepEqual(
    parameterNames.filter((parameterName) => /repo|folder|path|cwd|root|dir/i.test(parameterName)),
    [],
  );
});

test("with no network, everything the portal offers works but adding or updating a vendor source (CORE Story 56 scenario 5)", async () => {
  /** A machine with no network: every source it would reach is unreachable. */
  class OfflineSources extends InMemorySources {
    override async fetchCommit(source: string, version?: string): Promise<string> {
      if (!this.unreachableSources.includes(source)) this.unreachableSources.push(source);
      return super.fetchCommit(source, version);
    }
  }
  const { portalRoutes } = portal(
    {
      [new URL(".cw/settings.json", repoPath).href]: JSON.stringify({ agents: ["claude"] }),
      [new URL(".cw/charter/team/primitive/guide/ours/index.md", repoPath).href]: guide("ours"),
      [new URL(".cw/charter/charter/cw-vendor.json", repoPath).href]: vendorRecordTextOf("charter", "acme/charter"),
      [new URL(".cw/charter/charter/primitive/guide/one/index.md", repoPath).href]: guide("one"),
    },
    new OfflineSources(),
  );

  for (const [routePath, requestInit] of [
    ["/charter/root/primitives", undefined],
    ["/charter/root/primitives/ours", undefined],
    ["/charter/root/primitives/ours/explanation", undefined],
    ["/charter/root/faults", undefined],
    ["/definitions/kinds", undefined],
    ["/definitions/kinds/guide/requirements", undefined],
    ["/charter/root/build", undefined],
    ["/charter/root/health", undefined],
    ["/charter/root/context", undefined],
    ["/settings", undefined],
    ["/test-suites", undefined],
    ["/vendors", undefined],
    [
      "/charter/team/primitives",
      sending("POST", {
        kind: "guide",
        id: "added",
        headers: { description: "Added." },
        body: "Body.",
      }),
    ],
    ["/charter/root/build", sending("POST", {})],
    ["/vendors/charter", sending("DELETE", {})],
  ] as const) {
    const routeResponse = await portalRoutes.request(routePath, requestInit);
    assert.ok(
      routeResponse.status < 300,
      `${requestInit?.method ?? "GET"} ${routePath}: ${routeResponse.status} ${await routeResponse.text()}`,
    );
  }
  // Added at its default, then updated to a version: both need the source.
  for (const vendorRequest of [
    { source: "git@github.com:team/charter.git" },
    { source: "git@github.com:team/charter.git", version: "v2.0.0" },
  ]) {
    const vendorResponse = await portalRoutes.request("/vendors", sending("POST", vendorRequest));
    assert.equal(vendorResponse.status, 422, JSON.stringify(vendorRequest));
    assert.match(await vendorResponse.text(), /could not be fetched/);
  }
});
