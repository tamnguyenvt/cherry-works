import assert from "node:assert/strict";
import { test } from "node:test";
import { CharterDTOs } from "../src/module/charter/app/port/in/charter.dto.js";
import { GuidePrimitive } from "../src/module/charter/domain/models/primitive/guide-primitive.js";
import { Primitives } from "../src/module/charter/domain/models/primitive/primitive.js";
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

const at = (path: string) => new URL(path, "file:///repo/.cw/charter/primitive/").href;

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

/** The routes over one repository held in memory, asked the way the page asks
 *  them: the app's own `request`, so what is tested is the route and its status
 *  rather than the guards the server wraps it in (plan §6, tested there). */
const portal = (
  files: Readonly<Record<string, string>>,
  fileReaders = new InMemoryFileReaders(files),
  progressReporter = new InMemoryReporter(),
) => {
  const sourceFetcher = new InMemorySources();
  const charterAuthoringApp = authoringCharterOf(fileReaders, new InMemoryFileOutput(fileReaders), progressReporter, {
    sourceFetcher,
  });
  const charterRuntimeApps = buildingCharterOf(
    fileReaders,
    new InMemoryFileOutput(fileReaders),
    new InMemoryTokenCounter(),
    { claude: new InMemoryAgentCli() },
    progressReporter,
  );
  return buildPortalRoutes(
    wrapAppToShowPaths(charterAuthoringApp, "/repo"),
    wrapAppToShowPaths(charterRuntimeApps, "/repo"),
    workspaceSettingsLoaderOf(fileReaders),
  );
};

test("the listing is sent as every primitive the charter read, each under its layer (FR-112)", async () => {
  const answer = await portal({
    [at("guide/no-any/index.md")]: guide("no-any"),
    [at("corpus/why/index.md")]: primitive("corpus", "why"),
  }).request("/charter/root/primitives");

  assert.equal(answer.status, 200);
  // Parsed by its schema, which is how the page reads it.
  const { type, data } = CharterDTOs.Primitives.parse(await answer.json());
  assert.equal(type, "Primitives");
  assert.deepEqual(
    data.primitives.map((one) => [one.data.id, one.data.layerName]),
    [
      ["cw-author", "builtin"],
      ["cw-session-tokens-counter", "builtin"],
      ["cw-session-tokens-counter-on-stop", "builtin"],
      ["no-any", "repo"],
      ["why", "repo"],
    ],
  );
});

test("a word sent with the listing narrows it to what mentions the word, and an empty one narrows nothing (FR-114)", async () => {
  const portalRoutes = portal({
    [at("guide/no-any/index.md")]: guide("no-any"),
    [at("corpus/why/index.md")]: primitive("corpus", "why"),
  });

  const narrowed = CharterDTOs.Primitives.parse(
    await (await portalRoutes.request("/charter/root/primitives?matching=WHY")).json(),
  );
  assert.deepEqual(
    narrowed.data.primitives.map((one) => one.data.id),
    ["why"],
  );

  const unnarrowed = CharterDTOs.Primitives.parse(
    await (await portalRoutes.request("/charter/root/primitives?matching=")).json(),
  );
  // The two authored, and the three the engine brings.
  assert.equal(unnarrowed.data.primitives.length, 5);
});

test("one primitive is explained by kind and id, with when it comes up (FR-029, FR-116)", async () => {
  const answer = await portal({
    [at("guide/no-any/index.md")]: guide("no-any", ["rationale: why"]),
    [at("corpus/why/index.md")]: primitive("corpus", "why"),
  }).request("/charter/root/primitives/no-any/explanation");

  assert.equal(answer.status, 200);
  const { data } = CharterDTOs.ExplanationOutcome.parse(await answer.json());
  assert.equal(data.primitive.data.id, "no-any");
  assert.equal(data.activatesWhen, GuidePrimitive.activatesWhen);
  assert.equal(data.rationale?.data.id, "why");
});

test("an id the charter holds nothing of is explained as a fault under no file", async () => {
  const answer = await portal({}).request("/charter/root/primitives/nowhere/explanation");

  assert.equal(answer.status, 422);
  const { data } = FaultDTOs.Fault.parse(await answer.json());
  assert.match(data.message, /holds no "nowhere"/);
});

test("a charter with an error explains nothing and hands back what is wrong under its file", async () => {
  const answer = await portal({ [at("guide/no-any/index.md")]: guide("no-any", ['mixins: ["nowhere"]']) }).request(
    "/charter/root/primitives/no-any/explanation",
  );

  assert.equal(answer.status, 422);
  assert.deepEqual(Object.keys(FaultDTOs.FaultsByFile.parse(await answer.json()).data.files), [
    ".cw/charter/primitive/guide/no-any/index.md",
  ]);
});

test("every kind is sent with the line saying when it comes up, whatever the charter holds (FR-010)", async () => {
  const answer = await portal({}).request("/definitions/kinds");

  assert.equal(answer.status, 200);
  const { data } = CharterDTOs.PrimitiveKinds.parse(await answer.json());
  assert.deepEqual(Object.keys(data).sort(), [...Primitives.kinds].sort());
  assert.equal(data.guide, GuidePrimitive.activatesWhen);
});

test("a charter with an error lists nothing and hands back what is wrong under its file (FR-013)", async () => {
  const answer = await portal({ [at("guide/no-any/index.md")]: guide("no-any", ['mixins: ["nowhere"]']) }).request(
    "/charter/root/primitives",
  );

  assert.equal(answer.status, 422);
  const { type, data } = FaultDTOs.FaultsByFile.parse(await answer.json());
  assert.equal(type, "FaultsByFile");
  assert.deepEqual(Object.keys(data.files), [".cw/charter/primitive/guide/no-any/index.md"]);
});

test("what validating found is sent as it stands, a charter that holds having nothing wrong (FR-013)", async () => {
  const holds = await portal({
    [at("guide/no-any/index.md")]: guide("no-any"),
    // A guide no test case names is a warning (FR-014); this one is named.
    "file:///repo/.cw/charter/test/no-any.json": JSON.stringify({
      cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: "no-any" } }],
    }),
  }).request("/charter/root/faults");

  assert.equal(holds.status, 200);
  assert.deepEqual(FaultDTOs.FaultsByFile.parse(await holds.json()).data.files, {});

  const wrong = await portal({ [at("guide/no-any/index.md")]: guide("no-any", ['mixins: ["nowhere"]']) }).request(
    "/charter/root/faults",
  );

  // Read even where the charter does not hold: what is wrong is what this route
  // is for, so it is the answer and not a refusal.
  assert.equal(wrong.status, 200);
  const { data } = FaultDTOs.FaultsByFile.parse(await wrong.json());
  assert.ok(
    data.files[".cw/charter/primitive/guide/no-any/index.md"]?.some(({ data: { message } }) =>
      /the mixin "nowhere"/.test(message),
    ),
  );
});

test("the charter is read again on every call, so what changed on disk is what the next call sends (FR-110)", async () => {
  const fileReaders = new InMemoryFileReaders({ [at("guide/no-any/index.md")]: guide("no-any") });
  const portalRoutes = portal({}, fileReaders);
  await portalRoutes.request("/charter/root/primitives");

  fileReaders.writeFile(new URL(at("corpus/why/index.md")), primitive("corpus", "why"));
  const answer = await portalRoutes.request("/charter/root/primitives");

  const { data } = CharterDTOs.Primitives.parse(await answer.json());
  assert.ok(data.primitives.some((one) => one.data.id === "why"));
});

test("a fault raised rather than given back is sent as a fault, under no file (plan §12.2)", async () => {
  // Settings that do not read raise when they are read: there is no charter
  // file they are wrong with.
  const answer = await portal({ "file:///repo/.cw/settings.json": "not json" }).request("/settings");

  assert.equal(answer.status, 422);
  const { type, data } = FaultDTOs.Fault.parse(await answer.json());
  assert.equal(type, "Fault");
  assert.match(data.message, /not JSON/);
});

test("what the engine never meant to say is a 500 with an internal fault that says none of it, the whole of it logged (plan §12.2, SDK-FR-017, SDK-FR-018)", async (t) => {
  const fileReaders = new InMemoryFileReaders();
  t.mock.method(fileReaders, "readBytesRecursively", async () => {
    throw new Error("The disk went away.");
  });
  const progressReporter = new InMemoryReporter();

  const answer = await portal({}, fileReaders, progressReporter).request("/charter/root/primitives");

  assert.equal(answer.status, 500);
  const faultDTO = FaultDTOs.Fault.parse(await answer.json());
  assert.equal(faultDTO.data.name, "InternalFault");
  assert.doesNotMatch(JSON.stringify(faultDTO), /disk went away/);
  assert.equal(progressReporter.problems.length, 1);
  assert.match(progressReporter.problems[0] ?? "", /listPrimitives[\s\S]*The disk went away\./);
});
