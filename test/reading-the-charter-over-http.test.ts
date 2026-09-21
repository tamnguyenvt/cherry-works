import { test } from "node:test";
import assert from "node:assert/strict";
import { api } from "../src/driver/portal/routes.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { DataDTOs } from "../src/hexagon/port/driver/dtos/index.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import { KINDS } from "../src/hexagon/domain/models/charter/primitive/Primitive.js";
import { GuidePrimitive } from "../src/hexagon/domain/models/charter/primitive/GuidePrimitive.js";

const repo = new URL("file:///repo/");
const at = (path: string) => new URL(path, "file:///repo/.cw/charter/").href;

const primitive = (kind: string, id: string, headers: readonly string[] = []) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: About ${id}.`, ...headers, "---", "", `The body of ${id}.`, ""].join("\n");

const guide = (id: string, headers: readonly string[] = []) => primitive("guide", id, ['globs: ["src/**/*.ts"]', ...headers]);

/** The routes over one repository held in memory, asked the way the page asks
 *  them: the app's own `request`, so what is tested is the route and its status
 *  rather than the guards the server wraps it in (plan §6, tested there). */
const portal = (files: Readonly<Record<string, string>>) => {
  const held = new InMemoryFileReaders(files);
  const charterAuthoringApp = new CharterAuthoring(repo, held, new YamlParser(), new InMemoryFileOutput(held), new InMemoryVCS());
  return api(charterAuthoringApp);
};

test("the listing is sent as the catalogue the charter compiles to (FR-009)", async () => {
  const answer = await portal({ [at("guide/no-any.md")]: guide("no-any"), [at("corpus/why.md")]: primitive("corpus", "why") }).request(
    "/charter/root/primitives",
  );

  assert.equal(answer.status, 200);
  // Parsed by its schema, which is how the page reads it.
  const { type, data } = DataDTOs.Catalogue.parse(await answer.json());
  assert.equal(type, "Catalogue");
  assert.deepEqual(
    data.entries.map((one) => one.data.identity),
    ["corpus:why", "guide:no-any", "skill:cw-author"],
  );
});

test("every kind is sent with the line saying when it comes up, whatever the charter holds (FR-010)", async () => {
  const answer = await portal({}).request("/definitions/kinds");

  assert.equal(answer.status, 200);
  const { data } = DataDTOs.PrimitiveKinds.parse(await answer.json());
  assert.deepEqual(Object.keys(data).sort(), [...KINDS].sort());
  assert.equal(data.guide, GuidePrimitive.activatesWhen);
});

test("a charter with an error lists nothing and hands back what is wrong under its file (FR-013)", async () => {
  const answer = await portal({ [at("guide/no-any.md")]: guide("no-any", ['mixins: ["nowhere"]']) }).request("/charter/root/primitives");

  assert.equal(answer.status, 422);
  const { type, data } = DataDTOs.FaultsByFile.parse(await answer.json());
  assert.equal(type, "FaultsByFile");
  assert.deepEqual(Object.keys(data.files), [".cw/charter/guide/no-any.md"]);
});

test("what validating found is sent as it stands, a charter that holds having nothing wrong (FR-013)", async () => {
  const holds = await portal({ [at("guide/no-any.md")]: guide("no-any") }).request("/charter/root/faults");

  assert.equal(holds.status, 200);
  assert.deepEqual(DataDTOs.FaultsByFile.parse(await holds.json()).data.files, {});

  const wrong = await portal({ [at("guide/no-any.md")]: guide("no-any", ['mixins: ["nowhere"]']) }).request("/charter/root/faults");

  // Read even where the charter does not hold: what is wrong is what this route
  // is for, so it is the answer and not a refusal.
  assert.equal(wrong.status, 200);
  const { data } = DataDTOs.FaultsByFile.parse(await wrong.json());
  assert.ok(data.files[".cw/charter/guide/no-any.md"]?.some(({ data: { message } }) => /the mixin "nowhere"/.test(message)));
});
