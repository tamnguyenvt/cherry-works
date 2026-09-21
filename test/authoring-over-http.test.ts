import { test } from "node:test";
import assert from "node:assert/strict";
import { api } from "../src/driver/portal/routes.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { DataDTOs } from "../src/hexagon/port/driver/dtos/index.js";
import { SIGNALS } from "../src/hexagon/domain/models/charter/primitive/SensorPrimitive.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";

const repoPath = new URL("file:///repo/");
const at = (path: string) => new URL(path, repoPath).href;

const guide = (id: string) =>
  ["---", "kind: guide", `id: ${id}`, `description: About ${id}.`, 'globs: ["src/**/*.ts"]', "---", "", `The body of ${id}.`, ""].join("\n");

/** The routes over one repository held in memory, asked through the app's own
 *  `request`, and the files it holds (plan §12.2). */
const portal = (files: Readonly<Record<string, string>> = {}) => {
  const held = new InMemoryFileReaders(files);
  const portalRoutes = api(new CharterAuthoring(repoPath, held, new YamlParser(), new InMemoryFileOutput(held), new InMemoryVCS()));
  return { portalRoutes, fileAt: (path: string) => held.readIfThere(new URL(path, repoPath)), held };
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
    sending("POST", { kind: "guide", id: "no-any", headers: { description: "No any.", globs: ["src/**/*.ts"] }, body: "Never any." }),
  );

  assert.equal(answer.status, 201);
  assert.equal(answer.headers.get("Location"), "/api/charter/root/primitives/guide:no-any");
  assert.equal(DataDTOs.ScopedPrimitive.parse(await answer.json()).data.file, ".cw/charter/guide/no-any.md");
  assert.match((await fileAt(".cw/charter/guide/no-any.md")) ?? "", /---\n\nNever any\.\n$/);
});

test("answers the kind refuses are 422 and every fault, and an identity already claimed is 422 and one fault", async () => {
  const { portalRoutes, fileAt } = portal({ [at(".cw/charter/guide/no-any.md")]: guide("no-any") });

  const refused = await portalRoutes.request(
    "/charter/root/primitives",
    sending("POST", { kind: "guide", id: "Not A Slug", headers: {}, body: "" }),
  );
  assert.equal(refused.status, 422);
  assert.ok(DataDTOs.Faults.parse(await refused.json()).data.faults.length > 0);

  const claimed = await portalRoutes.request(
    "/charter/root/primitives",
    sending("POST", { kind: "guide", id: "no-any", headers: { description: "Again.", globs: ["src/**"] }, body: "" }),
  );
  assert.equal(claimed.status, 422);
  assert.match(DataDTOs.Fault.parse(await claimed.json()).data.message, /declared by \.cw\/charter\/guide\/no-any\.md/);
  assert.equal(await fileAt(".cw/charter/guide/not-a-slug.md"), undefined);
});

test("a primitive is opened with an ETag, and saved with it as If-Match (FR-075)", async () => {
  const { portalRoutes, fileAt } = portal({ [at(".cw/charter/guide/no-any.md")]: guide("no-any") });

  const opened = await portalRoutes.request("/charter/root/primitives/guide:no-any");
  assert.equal(opened.status, 200);
  const entityTag = opened.headers.get("ETag") ?? "";
  assert.match(entityTag, /^"[0-9a-f]{64}"$/);
  assert.equal(entityTag, `"${DataDTOs.PrimitiveSnapshot.parse(await opened.json()).data.revision}"`);

  const saved = await portalRoutes.request(
    "/charter/root/primitives/guide:no-any",
    sending("PUT", { headers: { description: "Never any.", globs: ["src/**"] }, body: "Use unknown." }, { "If-Match": entityTag }),
  );
  assert.equal(saved.status, 200);
  assert.match((await fileAt(".cw/charter/guide/no-any.md")) ?? "", /description: Never any\.[\s\S]*Use unknown\.\n$/);
});

test("a save over a file changed on disk, or with no If-Match, is 412 naming the file, and the file stays (FR-078)", async () => {
  const { portalRoutes, fileAt, held } = portal({ [at(".cw/charter/guide/no-any.md")]: guide("no-any") });
  const entityTag = (await portalRoutes.request("/charter/root/primitives/guide:no-any")).headers.get("ETag") ?? "";
  const changedOnDisk = guide("no-any").replace("About no-any.", "Changed elsewhere.");
  held.write(new URL(at(".cw/charter/guide/no-any.md")), changedOnDisk);

  for (const ifMatch of [{ "If-Match": entityTag }, {}]) {
    const refused = await portalRoutes.request(
      "/charter/root/primitives/guide:no-any",
      sending("PUT", { headers: { description: "Mine.", globs: ["src/**"] }, body: "" }, ifMatch),
    );
    assert.equal(refused.status, 412);
    assert.match(DataDTOs.Fault.parse(await refused.json()).data.message, /\.cw\/charter\/guide\/no-any\.md changed on disk/);
  }
  assert.equal(await fileAt(".cw/charter/guide/no-any.md"), changedOnDisk);
});

test("a repository primitive is deleted with 204, and a vendored one is refused with 422 (FR-076, FR-077)", async () => {
  const { portalRoutes, fileAt } = portal({
    [at(".cw/charter/guide/no-any.md")]: guide("no-any"),
    [at(".cw/vendor/team/guide/theirs.md")]: guide("theirs"),
  });

  const deleted = await portalRoutes.request("/charter/root/primitives/guide:no-any", { method: "DELETE" });
  assert.equal(deleted.status, 204);
  assert.equal(await fileAt(".cw/charter/guide/no-any.md"), undefined);

  const refused = await portalRoutes.request("/charter/root/primitives/guide:theirs", { method: "DELETE" });
  assert.equal(refused.status, 422);
  assert.match(DataDTOs.Fault.parse(await refused.json()).data.message, /\.cw\/vendor\/team\/guide\/theirs\.md is read-only/);
  assert.ok(await fileAt(".cw/vendor/team/guide/theirs.md"));
});

test("an identity not written <kind>:<id> is a 422 and a fault before the engine is asked (FR-014)", async () => {
  const { portalRoutes } = portal();

  const answer = await portalRoutes.request("/charter/root/primitives/no-any");

  assert.equal(answer.status, 422);
  assert.match(DataDTOs.Fault.parse(await answer.json()).data.message, /"no-any" is not an identity/);
});

test("what a kind requires is sent under /definitions, a closed header with its values (FR-117, FR-118)", async () => {
  const { portalRoutes } = portal();

  const answer = await portalRoutes.request("/definitions/kinds/sensor/requirements");
  assert.equal(answer.status, 200);
  const { data } = DataDTOs.PrimitiveRequirements.parse(await answer.json());
  assert.deepEqual(data.headers.find(({ data: { field } }) => field === "signal")?.data.allowedValues, SIGNALS);

  const unknown = await portalRoutes.request("/definitions/kinds/rule/requirements");
  assert.equal(unknown.status, 422);
  assert.match(DataDTOs.Fault.parse(await unknown.json()).data.message, /"rule" is not a kind/);
});
