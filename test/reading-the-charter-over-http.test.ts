import { test } from "node:test";
import assert from "node:assert/strict";
import { api } from "../src/driver/portal/routes.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { TestAuthoring } from "../src/hexagon/application/TestAuthoring.js";
import { DataDTOs, OutcomeDTOs } from "../src/hexagon/port/driver/dtos/index.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import { KINDS } from "../src/hexagon/domain/models/charter/primitive/Primitive.js";
import { GuidePrimitive } from "../src/hexagon/domain/models/charter/primitive/GuidePrimitive.js";
import { InMemoryTokenCounter } from "../src/zdriven/InMemoryTokenCounter.js";
import { InMemoryAgentCli } from "../src/zdriven/InMemoryAgentCli.js";

const repo = new URL("file:///repo/");
const at = (path: string) => new URL(path, "file:///repo/.cw/charter/").href;

const primitive = (kind: string, id: string, headers: readonly string[] = []) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: About ${id}.`, ...headers, "---", "", `The body of ${id}.`, ""].join("\n");

const guide = (id: string, headers: readonly string[] = []) => primitive("guide", id, ['globs: ["src/**/*.ts"]', ...headers]);

/** The routes over one repository held in memory, asked the way the page asks
 *  them: the app's own `request`, so what is tested is the route and its status
 *  rather than the guards the server wraps it in (plan §6, tested there). */
const portal = (files: Readonly<Record<string, string>>, held = new InMemoryFileReaders(files)) => {
  const vcs = new InMemoryVCS();
  const charterAuthoringApp = new CharterAuthoring(repo, held, new YamlParser(), new InMemoryFileOutput(held), vcs, new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() });
  return api(charterAuthoringApp, new CharterVendoring(repo, held, vcs), new TestAuthoring(repo, held, new InMemoryFileOutput(held)));
};

test("the listing is sent as every primitive the charter read, each under its layer (FR-112)", async () => {
  const answer = await portal({ [at("guide/no-any/index.md")]: guide("no-any"), [at("corpus/why/index.md")]: primitive("corpus", "why") }).request(
    "/charter/root/primitives",
  );

  assert.equal(answer.status, 200);
  // Parsed by its schema, which is how the page reads it.
  const { type, data } = DataDTOs.Primitives.parse(await answer.json());
  assert.equal(type, "Primitives");
  assert.deepEqual(
    data.primitives.map((one) => [one.data.id, one.data.layerName]),
    [
      ["cw-author", "builtin"],
      ["no-any", "repo"],
      ["session-tokens-counter", "builtin"],
      ["session-tokens-counter-on-stop", "builtin"],
      ["why", "repo"],
    ],
  );
});

test("a word sent with the listing narrows it to what mentions the word, and an empty one narrows nothing (FR-114)", async () => {
  const portalRoutes = portal({ [at("guide/no-any/index.md")]: guide("no-any"), [at("corpus/why/index.md")]: primitive("corpus", "why") });

  const narrowed = DataDTOs.Primitives.parse(await (await portalRoutes.request("/charter/root/primitives?matching=WHY")).json());
  assert.deepEqual(
    narrowed.data.primitives.map((one) => one.data.id),
    ["why"],
  );

  const unnarrowed = DataDTOs.Primitives.parse(await (await portalRoutes.request("/charter/root/primitives?matching=")).json());
  // The two authored, and the three the engine brings.
  assert.equal(unnarrowed.data.primitives.length, 5);
});

test("one primitive is explained by kind and id, with when it comes up (FR-029, FR-116)", async () => {
  const answer = await portal({ [at("guide/no-any/index.md")]: guide("no-any", ["rationale: why"]), [at("corpus/why/index.md")]: primitive("corpus", "why") }).request(
    "/charter/root/primitives/no-any/explanation",
  );

  assert.equal(answer.status, 200);
  const { data } = OutcomeDTOs.ExplanationOutcome.parse(await answer.json());
  assert.equal(data.primitive.data.id, "no-any");
  assert.equal(data.activatesWhen, GuidePrimitive.activatesWhen);
  assert.equal(data.rationale?.data.id, "why");
});

test("an id the charter holds nothing of is explained as a fault under no file", async () => {
  const answer = await portal({}).request("/charter/root/primitives/nowhere/explanation");

  assert.equal(answer.status, 422);
  const { data } = DataDTOs.Fault.parse(await answer.json());
  assert.match(data.message, /holds no "nowhere"/);
});

test("a charter with an error explains nothing and hands back what is wrong under its file", async () => {
  const answer = await portal({ [at("guide/no-any/index.md")]: guide("no-any", ['mixins: ["nowhere"]']) }).request(
    "/charter/root/primitives/no-any/explanation",
  );

  assert.equal(answer.status, 422);
  assert.deepEqual(Object.keys(DataDTOs.FaultsByFile.parse(await answer.json()).data.files), [".cw/charter/guide/no-any/index.md"]);
});

test("every kind is sent with the line saying when it comes up, whatever the charter holds (FR-010)", async () => {
  const answer = await portal({}).request("/definitions/kinds");

  assert.equal(answer.status, 200);
  const { data } = DataDTOs.PrimitiveKinds.parse(await answer.json());
  assert.deepEqual(Object.keys(data).sort(), [...KINDS].sort());
  assert.equal(data.guide, GuidePrimitive.activatesWhen);
});

test("a charter with an error lists nothing and hands back what is wrong under its file (FR-013)", async () => {
  const answer = await portal({ [at("guide/no-any/index.md")]: guide("no-any", ['mixins: ["nowhere"]']) }).request("/charter/root/primitives");

  assert.equal(answer.status, 422);
  const { type, data } = DataDTOs.FaultsByFile.parse(await answer.json());
  assert.equal(type, "FaultsByFile");
  assert.deepEqual(Object.keys(data.files), [".cw/charter/guide/no-any/index.md"]);
});

test("what validating found is sent as it stands, a charter that holds having nothing wrong (FR-013)", async () => {
  const holds = await portal({
    [at("guide/no-any/index.md")]: guide("no-any"),
    // A guide no test case names is a warning (FR-014); this one is named.
    "file:///repo/.cw/test/no-any.json": JSON.stringify({ cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: "no-any" } }] }),
  }).request("/charter/root/faults");

  assert.equal(holds.status, 200);
  assert.deepEqual(DataDTOs.FaultsByFile.parse(await holds.json()).data.files, {});

  const wrong = await portal({ [at("guide/no-any/index.md")]: guide("no-any", ['mixins: ["nowhere"]']) }).request("/charter/root/faults");

  // Read even where the charter does not hold: what is wrong is what this route
  // is for, so it is the answer and not a refusal.
  assert.equal(wrong.status, 200);
  const { data } = DataDTOs.FaultsByFile.parse(await wrong.json());
  assert.ok(data.files[".cw/charter/guide/no-any/index.md"]?.some(({ data: { message } }) => /the mixin "nowhere"/.test(message)));
});

test("the charter is read again on every call, so what changed on disk is what the next call sends (FR-110)", async () => {
  const held = new InMemoryFileReaders({ [at("guide/no-any/index.md")]: guide("no-any") });
  const portalRoutes = portal({}, held);
  await portalRoutes.request("/charter/root/primitives");

  held.write(new URL(at("corpus/why/index.md")), primitive("corpus", "why"));
  const answer = await portalRoutes.request("/charter/root/primitives");

  const { data } = DataDTOs.Primitives.parse(await answer.json());
  assert.ok(data.primitives.some((one) => one.data.id === "why"));
});

test("a fault raised rather than given back is sent as a fault, under no file (plan §12.2)", async () => {
  // Settings that do not read leave nothing to validate against, so reading
  // them raises: there is no charter file it is wrong with.
  const answer = await portal({ "file:///repo/.cw/settings.json": "not json" }).request("/charter/root/primitives");

  assert.equal(answer.status, 422);
  const { type, data } = DataDTOs.Fault.parse(await answer.json());
  assert.equal(type, "Fault");
  assert.match(data.message, /not JSON/);
});

test("what the engine never meant to say is a 500 with its message, the whole of it logged (plan §12.2)", async (t) => {
  const consoleErrorMock = t.mock.method(console, "error", () => {});
  const held = new InMemoryFileReaders();
  t.mock.method(held, "readFilesRecursively", async () => {
    throw new Error("The disk went away.");
  });

  const answer = await portal({}, held).request("/charter/root/primitives");

  assert.equal(answer.status, 500);
  assert.equal(await answer.text(), "The disk went away.");
  assert.equal(consoleErrorMock.mock.callCount(), 1);
});
