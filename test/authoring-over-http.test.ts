import assert from "node:assert/strict";
import { test } from "node:test";
import { CharterDTOs } from "../src/module/charter/app/port/in/charter.dto.js";
import { SensorPrimitive } from "../src/module/charter/domain/models/primitive/sensor-primitive.js";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { FaultDTOs } from "../src/module/shared/app/port/in/fault.dto.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { wrapAppToShowPaths } from "../src/presentation/cli/commands/helper.js";
import { buildPortalRoutes } from "../src/presentation/portal/portal.routes.js";
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
    `The body of ${id}.`,
    "",
  ].join("\n");

/** The routes over one repository held in memory, asked through the app's own
 *  `request`, and the files it holds (plan §12.2). */
const portal = (files: Readonly<Record<string, string>> = {}) => {
  const fileReaders = new InMemoryFileReaders(files);
  const sourceFetcher = new InMemorySources();
  const portalRoutes = buildPortalRoutes(
    wrapAppToShowPaths(
      authoringCharterOf(fileReaders, new InMemoryFileOutput(fileReaders), new InMemoryReporter(), { sourceFetcher }),
      "/repo",
    ),
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
  return { portalRoutes, fileAt: (path: string) => fileReaders.readIfThere(new URL(path, repoPath)), fileReaders };
};

/** A write, sent the way the page sends one. */
const sending = (method: string, json: unknown, headers: Record<string, string> = {}) => ({
  method,
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(json),
});

test("a new primitive is created with its body, answered 201 with where it lives (FR-117)", async () => {
  const { portalRoutes, fileAt } = portal();

  const answer = await portalRoutes.request(
    "/charter/root/primitives",
    sending("POST", {
      kind: "guide",
      id: "no-any",
      headers: { description: "No any.", globs: ["src/**/*.ts"] },
      body: "Never any.",
    }),
  );

  assert.equal(answer.status, 201);
  assert.equal(answer.headers.get("Location"), "/api/charter/root/primitives/no-any");
  assert.equal(
    CharterDTOs.Primitive.parse(await answer.json()).data.file,
    ".cw/charter/primitive/guide/no-any/index.md",
  );
  assert.match((await fileAt(".cw/charter/primitive/guide/no-any/index.md")) ?? "", /---\n\nNever any\.\n$/);
});

test("an id holding / is reached encoded, as the page sends it (FR-141)", async () => {
  const { portalRoutes } = portal({ [at(".cw/charter/primitive/guide/mfbs/no-any/index.md")]: guide("mfbs/no-any") });

  const answer = await portalRoutes.request(`/charter/root/primitives/${encodeURIComponent("mfbs/no-any")}`);

  assert.equal(answer.status, 200);
  assert.equal(CharterDTOs.Primitive.parse(await answer.json()).data.id, "mfbs/no-any");
});

test("answers the kind refuses are 422 and every fault, and an id already claimed is 422 and one fault", async () => {
  const { portalRoutes, fileAt } = portal({ [at(".cw/charter/primitive/guide/no-any/index.md")]: guide("no-any") });

  const refused = await portalRoutes.request(
    "/charter/root/primitives",
    sending("POST", { kind: "guide", id: "Not A Slug", headers: {}, body: "" }),
  );
  assert.equal(refused.status, 422);
  assert.ok(FaultDTOs.Faults.parse(await refused.json()).data.faults.length > 0);

  const claimed = await portalRoutes.request(
    "/charter/root/primitives",
    sending("POST", { kind: "guide", id: "no-any", headers: { description: "Again.", globs: ["src/**"] }, body: "" }),
  );
  assert.equal(claimed.status, 422);
  assert.match(
    FaultDTOs.Fault.parse(await claimed.json()).data.message,
    /declared by \.cw\/charter\/primitive\/guide\/no-any\/index\.md/,
  );
  assert.equal(await fileAt(".cw/charter/primitive/guide/not-a-slug/index.md"), undefined);
});

test("a primitive is opened with an ETag, and saved with it as If-Match (FR-075)", async () => {
  const { portalRoutes, fileAt } = portal({ [at(".cw/charter/primitive/guide/no-any/index.md")]: guide("no-any") });

  const opened = await portalRoutes.request("/charter/root/primitives/no-any");
  assert.equal(opened.status, 200);
  const entityTag = opened.headers.get("ETag") ?? "";
  assert.match(entityTag, /^"[0-9a-f]{16}"$/);
  assert.equal(entityTag, `"${CharterDTOs.Primitive.parse(await opened.json()).data.hash}"`);

  const saved = await portalRoutes.request(
    "/charter/root/primitives/no-any",
    sending(
      "PUT",
      { headers: { description: "Never any.", globs: ["src/**"] }, body: "Use unknown." },
      { "If-Match": entityTag },
    ),
  );
  assert.equal(saved.status, 200);
  assert.match(
    (await fileAt(".cw/charter/primitive/guide/no-any/index.md")) ?? "",
    /description: Never any\.[\s\S]*Use unknown\.\n$/,
  );
});

test("a save over a file changed on disk, or with no If-Match, is 412 naming the file, and the file stays (FR-078)", async () => {
  const { portalRoutes, fileAt, fileReaders } = portal({
    [at(".cw/charter/primitive/guide/no-any/index.md")]: guide("no-any"),
  });
  const entityTag = (await portalRoutes.request("/charter/root/primitives/no-any")).headers.get("ETag") ?? "";
  const changedOnDisk = guide("no-any").replace("About no-any.", "Changed elsewhere.");
  fileReaders.writeFile(new URL(at(".cw/charter/primitive/guide/no-any/index.md")), changedOnDisk);

  for (const ifMatch of [{ "If-Match": entityTag }, {}]) {
    const refused = await portalRoutes.request(
      "/charter/root/primitives/no-any",
      sending("PUT", { headers: { description: "Mine.", globs: ["src/**"] }, body: "" }, ifMatch),
    );
    assert.equal(refused.status, 412);
    assert.match(
      FaultDTOs.Fault.parse(await refused.json()).data.message,
      /\.cw\/charter\/primitive\/guide\/no-any\/index\.md changed on disk/,
    );
  }
  assert.equal(await fileAt(".cw/charter/primitive/guide/no-any/index.md"), changedOnDisk);
});

test("a sensor with no command and a mixin naming a mixin are refused in the engine's words, and nothing is written (CORE Story 6 scenario 2, FR-117, FR-108, CORE Story 55 scenario 8)", async () => {
  const { portalRoutes, fileReaders } = portal();
  const filesBefore = await fileReaders.readFilesRecursively(repoPath);

  const sensorRefused = await portalRoutes.request(
    "/charter/root/primitives",
    sending("POST", {
      kind: "sensor",
      id: "check",
      headers: { description: "Checks.", signal: "PostToolUse" },
      body: "",
    }),
  );
  assert.equal(sensorRefused.status, 422);
  const [sensorFault] = FaultDTOs.Faults.parse(await sensorRefused.json()).data.faults;
  assert.equal(sensorFault?.data.message, "These headers are not what a sensor holds.");
  assert.match(sensorFault?.data.fix ?? "", /\nrun: pnpm test/);

  const mixinRefused = await portalRoutes.request(
    "/charter/root/primitives",
    sending("POST", {
      kind: "mixin",
      id: "voice",
      headers: { description: "A voice.", mixins: ["base"] },
      body: "",
    }),
  );
  assert.equal(mixinRefused.status, 422);
  assert.match(JSON.stringify(FaultDTOs.Faults.parse(await mixinRefused.json()).data.faults), /not what a mixin holds/);

  assert.deepEqual(await fileReaders.readFilesRecursively(repoPath), filesBefore);
});

test("a repository primitive is deleted with 204, and a vendored one is refused with 422 (FR-076, FR-077)", async () => {
  const { portalRoutes, fileAt } = portal({
    [at(".cw/charter/primitive/guide/no-any/index.md")]: guide("no-any"),
    [at(".cw/charter/vendor/team/rules/root/primitive/guide/theirs/index.md")]: guide("theirs"),
  });

  const deleted = await portalRoutes.request("/charter/root/primitives/no-any", { method: "DELETE" });
  assert.equal(deleted.status, 204);
  assert.equal(await fileAt(".cw/charter/primitive/guide/no-any/index.md"), undefined);

  const refused = await portalRoutes.request("/charter/root/primitives/theirs", { method: "DELETE" });
  assert.equal(refused.status, 422);
  assert.match(
    FaultDTOs.Fault.parse(await refused.json()).data.message,
    /\.cw\/charter\/vendor\/team\/rules\/root\/primitive\/guide\/theirs\/index\.md is read-only/,
  );
  assert.ok(await fileAt(".cw/charter/vendor/team/rules/root/primitive/guide/theirs/index.md"));
});

test("a deleted primitive still named by a primitive and a test case leaves both as they were, and the next validation reports each as dangling (CORE Story 6 scenario 6, FR-076, FR-007, CORE Story 55 scenario 8)", async () => {
  const namingGuideText = guide("small-diffs").replace("The body of small-diffs.", "Read [[no-any]] first.");
  const namingTestText = `${JSON.stringify({ cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: "no-any" } }] })}\n`;
  // A primitive naming it: the health check reports it under that file.
  const namedByPrimitive = portal({
    [at(".cw/settings.json")]: `${JSON.stringify({ agents: ["claude"] })}\n`,
    [at(".cw/charter/primitive/guide/no-any/index.md")]: guide("no-any"),
    [at(".cw/charter/primitive/guide/small-diffs/index.md")]: namingGuideText,
  });
  assert.equal(
    (await namedByPrimitive.portalRoutes.request("/charter/root/primitives/no-any", { method: "DELETE" })).status,
    204,
  );
  assert.equal(await namedByPrimitive.fileAt(".cw/charter/primitive/guide/no-any/index.md"), undefined);
  assert.equal(await namedByPrimitive.fileAt(".cw/charter/primitive/guide/small-diffs/index.md"), namingGuideText);
  const health = CharterDTOs.DoctorOutcome.parse(
    await (await namedByPrimitive.portalRoutes.request("/charter/root/health")).json(),
  ).data;
  assert.match(
    JSON.stringify(health.faultsByFile.data.files[".cw/charter/primitive/guide/small-diffs/index.md"] ?? []),
    /names \\"no-any\\", and this charter holds no primitive of that id/,
  );

  // A test case naming it: the test run reports it, the case left as written.
  const namedByTestCase = portal({
    [at(".cw/settings.json")]: `${JSON.stringify({ agents: ["claude"] })}\n`,
    [at(".cw/charter/primitive/guide/no-any/index.md")]: guide("no-any"),
    [at(".cw/charter/test/no-any.json")]: namingTestText,
  });
  assert.equal(
    (await namedByTestCase.portalRoutes.request("/charter/root/primitives/no-any", { method: "DELETE" })).status,
    204,
  );
  assert.equal(await namedByTestCase.fileAt(".cw/charter/test/no-any.json"), namingTestText);
  const testRunAnswer = await namedByTestCase.portalRoutes.request("/test-suites/outcome");
  assert.match(JSON.stringify(await testRunAnswer.json()), /This charter holds no primitive called \\"no-any\\"/);
});

test("a save and a delete compile nothing: what a build wrote stays as it was, and the health check says the output is behind until the next build (CORE Story 6 scenario 8, FR-079, CORE Story 55 scenario 8)", async () => {
  const { portalRoutes, fileReaders } = portal({
    [at(".cw/settings.json")]: `${JSON.stringify({ agents: ["claude"] })}\n`,
    [at(".cw/charter/primitive/guide/no-any/index.md")]: guide("no-any"),
    [at(".cw/charter/primitive/guide/small-diffs/index.md")]: guide("small-diffs"),
  });
  assert.equal((await portalRoutes.request("/charter/root/build", sending("POST", {}))).status, 200);
  const pendingCountOf = async () =>
    CharterDTOs.DoctorOutcome.parse(await (await portalRoutes.request("/charter/root/health")).json()).data
      .pendingCount;
  assert.equal(await pendingCountOf(), 0);
  /** Every file outside the charter's own folder: what a build writes. */
  const builtFilesOf = async () =>
    (await fileReaders.readFilesRecursively(repoPath))
      .filter(({ fileUrl }) => !fileUrl.href.startsWith(at(".cw/charter/")))
      .map(({ fileUrl, contents }) => `${fileUrl.href} ${contents}`)
      .sort();
  const builtFilesBefore = await builtFilesOf();

  const opened = await portalRoutes.request("/charter/root/primitives/no-any");
  const saved = await portalRoutes.request(
    "/charter/root/primitives/no-any",
    sending(
      "PUT",
      { headers: { description: "Never any.", globs: ["src/**"] }, body: "Use unknown." },
      { "If-Match": opened.headers.get("ETag") ?? "" },
    ),
  );
  assert.equal(saved.status, 200);
  assert.deepEqual(await builtFilesOf(), builtFilesBefore, "a save compiles nothing");
  assert.ok(((await pendingCountOf()) ?? 0) > 0, "after a save, the output is behind");

  assert.equal((await portalRoutes.request("/charter/root/primitives/small-diffs", { method: "DELETE" })).status, 204);
  assert.deepEqual(await builtFilesOf(), builtFilesBefore, "a delete compiles nothing");
  assert.ok(((await pendingCountOf()) ?? 0) > 0, "after a delete, the output is behind");

  assert.equal((await portalRoutes.request("/charter/root/build", sending("POST", {}))).status, 200);
  assert.equal(await pendingCountOf(), 0);
});

test("text not shaped as an id is a 422 and a fault before the engine is asked (FR-172)", async () => {
  const { portalRoutes } = portal();

  const answer = await portalRoutes.request("/charter/root/primitives/guide%3Ano-any");

  assert.equal(answer.status, 422);
  assert.match(FaultDTOs.Fault.parse(await answer.json()).data.message, /"guide:no-any" is not an id/);
});

test("what a kind requires is sent under /definitions, a closed header with its values (FR-117, FR-118)", async () => {
  const { portalRoutes } = portal();

  const answer = await portalRoutes.request("/definitions/kinds/sensor/requirements");
  assert.equal(answer.status, 200);
  const { data } = CharterDTOs.PrimitiveRequirements.parse(await answer.json());
  assert.deepEqual(
    data.headers.find(({ data: { field } }) => field === "signal")?.data.allowedValues,
    SensorPrimitive.signals,
  );

  const unknown = await portalRoutes.request("/definitions/kinds/rule/requirements");
  assert.equal(unknown.status, 422);
  assert.match(FaultDTOs.Fault.parse(await unknown.json()).data.message, /"rule" is not a kind/);
});
