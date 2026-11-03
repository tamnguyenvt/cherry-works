import { test } from "node:test";
import assert from "node:assert/strict";
import { api } from "../src/driver/portal/routes.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { TestAuthoring } from "../src/hexagon/application/TestAuthoring.js";
import { DataDTOs } from "../src/hexagon/port/driver/dtos/index.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemorySources } from "../src/zdriven/InMemorySources.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import { InMemoryTokenCounter } from "../src/zdriven/InMemoryTokenCounter.js";
import { InMemoryAgentCli } from "../src/zdriven/InMemoryAgentCli.js";

const repoPath = new URL("file:///repo/");

const guide = (id: string) => ["---", "kind: guide", `id: ${id}`, `description: About ${id}.`, "---", "", "Body.", ""].join("\n");

/** The routes over one repository held in memory, and the sources
 *  they install through, so a test reads what was asked of it (plan §12.2). */
const portal = (files: Readonly<Record<string, string>> = {}, sourceFetcher = new InMemorySources()) => {
  const fileReaders = new InMemoryFileReaders(files);
  const charterVendoringApp = new CharterVendoring(repoPath, fileReaders, sourceFetcher, new InMemoryFileOutput(fileReaders), new YamlParser());
  const portalRoutes = api(
    new CharterAuthoring(repoPath, fileReaders, new YamlParser(), new InMemoryFileOutput(fileReaders), new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() }),
    charterVendoringApp,
    new TestAuthoring(repoPath, fileReaders, new InMemoryFileOutput(fileReaders)),
  );
  return { portalRoutes, charterVendoringApp, sourceFetcher };
};

/** A write, sent the way the page sends one. */
const sending = (method: string, json: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(json),
});

test("the vendors are sent as the folders installed() answers (FR-122)", async () => {
  const { portalRoutes, charterVendoringApp } = portal({ [new URL(".cw/vendor/acme/guide/one/index.md", repoPath).href]: guide("one") });

  const answer = await portalRoutes.request("/vendors");

  assert.equal(answer.status, 200);
  assert.deepEqual(await answer.json(), [".cw/vendor/acme"]);
  assert.deepEqual(await charterVendoringApp.installed(), [".cw/vendor/acme"]);
});

test("a source posted is installed as cw vendor add installs it (Story 8 scenario 2)", async () => {
  const { portalRoutes, sourceFetcher } = portal();

  const answer = await portalRoutes.request("/vendors", sending("POST", { source: "git@github.com:team/charter.git", version: "v1.2.0" }));

  assert.equal(answer.status, 204);
  assert.deepEqual(sourceFetcher.fetchedSources, [{ source: "git@github.com:team/charter.git", version: "v1.2.0" }]);
  assert.deepEqual(sourceFetcher.checkedOutFolders, [{ commit: "git@github.com:team/charter.git@v1.2.0", fromFolder: ".cw/charter", intoSubFolder: ".cw/vendor/team/charter" }]);
});

test("a source posted with no version is installed at its default", async () => {
  const { portalRoutes, sourceFetcher } = portal();

  await portalRoutes.request("/vendors", sending("POST", { source: "/srv/charters/charter" }));

  assert.equal(sourceFetcher.fetchedSources[0]?.version, undefined);
});

test("a skills repository posted has every skill it holds installed, asking nothing (CORE-FR-188)", async () => {
  const sourceFetcher = new InMemorySources();
  sourceFetcher.sourceFilesBySource["team/skills"] = {
    "skills/one/SKILL.md": "---\nname: one\ndescription: The first.\n---\n\nOne.\n",
    "skills/two/SKILL.md": "---\nname: two\ndescription: The second.\n---\n\nTwo.\n",
  };
  const { portalRoutes } = portal({}, sourceFetcher);

  const answer = await portalRoutes.request("/vendors", sending("POST", { source: "team/skills" }));

  assert.equal(answer.status, 204);
  assert.deepEqual(sourceFetcher.checkedOutFolders.map(({ intoSubFolder }) => intoSubFolder), [".cw/vendor/team/skills/skill/one", ".cw/vendor/team/skills/skill/two"]);
});

test("a source holding no charter folder is refused, saying how to make it one", async () => {
  const sourceFetcher = new InMemorySources();
  sourceFetcher.sourcesWithoutSubFolder.push("team/notes");
  const { portalRoutes } = portal({}, sourceFetcher);

  const answer = await portalRoutes.request("/vendors", sending("POST", { source: "team/notes" }));

  assert.equal(answer.status, 422);
  const faultDTO = DataDTOs.Fault.parse(await answer.json());
  assert.match(faultDTO.data.message, /no "\.cw\/charter"/);
  assert.deepEqual(sourceFetcher.checkedOutFolders, []);
});

/** One vendor installed at this folder, and work of the repository's beside it. */
const filesHoldingVendor = (vendorName: string) => ({
  [new URL(`.cw/vendor/${vendorName}/guide/one/index.md`, repoPath).href]: guide("one"),
  [new URL("work.txt", repoPath).href]: "In hand.\n",
});

const installedVendors = async (charterVendoringApp: CharterVendoring) => [...(await charterVendoringApp.installed())];

test("a vendor deleted is taken away by its folder name (Story 8 scenario 5)", async () => {
  const { portalRoutes, charterVendoringApp } = portal(filesHoldingVendor("charter"));

  const answer = await portalRoutes.request("/vendors/charter", sending("DELETE", {}));

  assert.equal(answer.status, 204);
  assert.deepEqual(await installedVendors(charterVendoringApp), []);
});

test("a vendor under its owner is taken away by its folder name, owner and repository (FR-050)", async () => {
  const { portalRoutes, charterVendoringApp } = portal(filesHoldingVendor("team/charter"));

  const answer = await portalRoutes.request(`/vendors/${encodeURIComponent("team/charter")}`, sending("DELETE", {}));

  assert.equal(answer.status, 204);
  assert.deepEqual(await installedVendors(charterVendoringApp), []);
});

test("a name no vendor folder answers to is refused in the engine's words (CORE-FR-204)", async () => {
  const { portalRoutes, charterVendoringApp } = portal(filesHoldingVendor("team/charter"));

  const answer = await portalRoutes.request("/vendors/absent", sending("DELETE", {}));

  assert.equal(answer.status, 422);
  assert.match(DataDTOs.Fault.parse(await answer.json()).data.message, /No vendor folder/);
  assert.deepEqual(await installedVendors(charterVendoringApp), [".cw/vendor/team/charter"]);
});

test("a name that climbs out of the vendor folder is refused, and nothing is taken away (FR-044)", async () => {
  const { portalRoutes, charterVendoringApp } = portal(filesHoldingVendor("team/charter"));

  const answer = await portalRoutes.request("/vendors/..%2F..%2Fsrc", sending("DELETE", {}));

  assert.equal(answer.status, 422);
  assert.deepEqual(await installedVendors(charterVendoringApp), [".cw/vendor/team/charter"]);
});

test("a name that is no folder is refused in the engine's words, and nothing is taken away (FR-044)", async () => {
  const { portalRoutes, charterVendoringApp } = portal(filesHoldingVendor("team/charter"));

  const answer = await portalRoutes.request("/vendors/team%2F..", sending("DELETE", {}));

  assert.equal(answer.status, 422);
  assert.match(DataDTOs.Fault.parse(await answer.json()).data.message, /Invalid path/);
  assert.deepEqual(await installedVendors(charterVendoringApp), [".cw/vendor/team/charter"]);
});
