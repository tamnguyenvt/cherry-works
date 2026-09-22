import { test } from "node:test";
import assert from "node:assert/strict";
import { api } from "../src/driver/portal/routes.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { TestAuthoring } from "../src/hexagon/application/TestAuthoring.js";
import { DataDTOs } from "../src/hexagon/port/driver/dtos/index.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";

const repoPath = new URL("file:///repo/");

const guide = (id: string) => ["---", "kind: guide", `id: ${id}`, `description: About ${id}.`, "---", "", "Body.", ""].join("\n");

/** The routes over one repository held in memory, and the version control
 *  they install through, so a test reads what was asked of it (plan §12.2). */
const portal = (files: Readonly<Record<string, string>> = {}, vcs = new InMemoryVCS()) => {
  const held = new InMemoryFileReaders(files);
  const charterVendoringApp = new CharterVendoring(repoPath, held, vcs);
  const portalRoutes = api(
    new CharterAuthoring(repoPath, held, new YamlParser(), new InMemoryFileOutput(held), vcs),
    charterVendoringApp,
    new TestAuthoring(repoPath, held, new InMemoryFileOutput(held)),
  );
  return { portalRoutes, charterVendoringApp, vcs };
};

/** A write, sent the way the page sends one. */
const sending = (method: string, json: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(json),
});

test("the vendors are sent as the folders installed() answers (FR-122)", async () => {
  const { portalRoutes, charterVendoringApp } = portal({ [new URL(".cw/vendor/acme/guide/one.md", repoPath).href]: guide("one") });

  const answer = await portalRoutes.request("/vendors");

  assert.equal(answer.status, 200);
  assert.deepEqual(await answer.json(), [".cw/vendor/acme"]);
  assert.deepEqual(await charterVendoringApp.installed(), [".cw/vendor/acme"]);
});

test("a source posted is installed as cw vendor add installs it (Story 8 scenario 2)", async () => {
  const { portalRoutes, vcs } = portal();

  const answer = await portalRoutes.request("/vendors", sending("POST", { source: "git@github.com:team/charter.git", version: "v1.2.0" }));

  assert.equal(answer.status, 204);
  assert.deepEqual(vcs.installed, [
    { source: "git@github.com:team/charter.git", repo: repoPath, intoSubFolder: ".cw/vendor/charter", version: "v1.2.0" },
  ]);
});

test("a source posted with no version is installed at its default", async () => {
  const { portalRoutes, vcs } = portal();

  await portalRoutes.request("/vendors", sending("POST", { source: "/srv/charters/charter" }));

  assert.equal(vcs.installed[0]?.version, undefined);
});

test("a vendor deleted is taken away by its folder name (Story 8 scenario 5)", async () => {
  const { portalRoutes, vcs } = portal();

  const answer = await portalRoutes.request("/vendors/charter", sending("DELETE", {}));

  assert.equal(answer.status, 204);
  assert.deepEqual(vcs.removed, [{ repo: repoPath, subFolder: ".cw/vendor/charter" }]);
});

test("with work in hand, adding and removing are refused in the engine's words and touch nothing (Story 8 scenario 3)", async () => {
  const { portalRoutes, vcs } = portal({}, new InMemoryVCS(true, false));

  const added = await portalRoutes.request("/vendors", sending("POST", { source: "team/charter" }));
  const removed = await portalRoutes.request("/vendors/charter", sending("DELETE", {}));

  for (const answer of [added, removed]) {
    assert.equal(answer.status, 422);
    const faultDTO = DataDTOs.Fault.parse(await answer.json());
    assert.match(faultDTO.data.message, /work in hand/);
    assert.match(faultDTO.data.fix, /stash/);
  }
  assert.deepEqual(vcs.installed, []);
  assert.deepEqual(vcs.removed, []);
});

test("outside version control, adding is refused saying the next move", async () => {
  const { portalRoutes, vcs } = portal({}, new InMemoryVCS(false));

  const answer = await portalRoutes.request("/vendors", sending("POST", { source: "team/charter" }));

  assert.equal(answer.status, 422);
  assert.match(DataDTOs.Fault.parse(await answer.json()).data.fix, /git init/);
  assert.deepEqual(vcs.installed, []);
});

test("a name that climbs out of the vendor folder stays under it (FR-044)", async () => {
  const { portalRoutes, vcs } = portal();

  const answer = await portalRoutes.request("/vendors/..%2F..%2Fsrc", sending("DELETE", {}));

  assert.equal(answer.status, 204);
  assert.deepEqual(vcs.removed, [{ repo: repoPath, subFolder: ".cw/vendor/src" }]);
});

test("a name that is no folder is refused in the engine's words, and nothing is taken away (FR-044)", async () => {
  const { portalRoutes, vcs } = portal();

  const answer = await portalRoutes.request("/vendors/team%2F..", sending("DELETE", {}));

  assert.equal(answer.status, 422);
  assert.match(DataDTOs.Fault.parse(await answer.json()).data.message, /Invalid path/);
  assert.deepEqual(vcs.removed, []);
});
