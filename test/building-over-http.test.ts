import { test } from "node:test";
import assert from "node:assert/strict";
import { api } from "../src/driver/portal/routes.js";
import { Commander } from "../src/driver/cli/Commander.js";
import { COMMANDS } from "../src/driver/cli/commands/index.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { TestAuthoring } from "../src/hexagon/application/TestAuthoring.js";
import { DataDTOs, OutcomeDTOs } from "../src/hexagon/port/driver/dtos/index.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";

const repoPath = new URL("file:///repo/");
const at = (path: string) => new URL(path, repoPath).href;

const primitive = (kind: string, id: string, headers: readonly string[] = []) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: About ${id}.`, ...headers, "---", "", `The body of ${id}.`, ""].join("\n");

const guide = (id: string, headers: readonly string[] = []) => primitive("guide", id, ['globs: ["src/**/*.ts"]', ...headers]);

/** A repository compiling for claude, one guide, and the case naming it. */
const holding = (extra: Readonly<Record<string, string>> = {}) => ({
  [at(".cw/settings.json")]: `${JSON.stringify({ agents: ["claude"] })}\n`,
  [at(".cw/charter/guide/no-any.md")]: guide("no-any"),
  [at(".cw/test/no-any.json")]: JSON.stringify({ cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: "guide:no-any" } }] }),
  ...extra,
});

/** The routes and the command line over one repository held in memory, so
 *  what each surface says of it can be held side by side (SC-014). */
const surfaces = (files: Readonly<Record<string, string>>) => {
  const held = new InMemoryFileReaders(files);
  const vcs = new InMemoryVCS();
  const charterAuthoringApp = new CharterAuthoring(repoPath, held, new YamlParser(), new InMemoryFileOutput(held), vcs);
  const charterVendoringApp = new CharterVendoring(repoPath, held, vcs);
  const testAuthoringApp = new TestAuthoring(repoPath, held, new InMemoryFileOutput(held));
  const cli = new Commander({ cwd: "/repo", charterAuthoringApp, charterVendoringApp, testAuthoringApp }, COMMANDS);
  return { portalRoutes: api(charterAuthoringApp, charterVendoringApp, testAuthoringApp), held, cli };
};

/** What one command printed, and its exit status. */
const printed = async (cli: Commander, argv: readonly string[]) => {
  const written: string[] = [];
  const kept = process.stdout.write;
  process.stdout.write = ((text: string | Uint8Array) => (written.push(String(text)), true)) as typeof process.stdout.write;
  try {
    return { code: await cli.run(argv), text: written.join("") };
  } finally {
    process.stdout.write = kept;
  }
};

const buildRequest = { method: "POST", headers: { "Content-Type": "application/json" } };

test("the preview lists every target cw build --preview prints, and writes nothing (FR-120, SC-014)", async () => {
  const { portalRoutes, held, cli } = surfaces(holding());

  const answer = await portalRoutes.request("/charter/root/build");

  assert.equal(answer.status, 200);
  const { added, edited, deleted, unchanged } = DataDTOs.PlanSummary.parse(await answer.json()).data;
  assert.ok(added.includes(".cw/out/catalog.json"));
  assert.equal(await held.readIfThere(new URL(".cw/out/catalog.json", repoPath)), undefined);

  const { text } = await printed(cli, ["build", "--preview"]);
  const listed = text.split("\n").flatMap((line) => line.match(/^ {2}(\S+) +(\S+)$/)?.slice(1, 3).join(" ") ?? []);
  assert.deepEqual(listed, [
    ...added.map((path) => `create ${path}`),
    ...edited.map((path) => `update ${path}`),
    ...deleted.map((path) => `delete ${path}`),
    ...unchanged.map((path) => `unchanged ${path}`),
  ]);
});

test("building writes, says what it wrote, and the health check then says the output is up to date (FR-120, FR-121)", async () => {
  const { portalRoutes, held } = surfaces(holding());

  const answer = await portalRoutes.request("/charter/root/build", buildRequest);

  assert.equal(answer.status, 200);
  const { added } = DataDTOs.PlanSummary.parse(await answer.json()).data;
  assert.ok(added.includes(".cw/out/catalog.json"));
  assert.notEqual(await held.readIfThere(new URL(".cw/out/catalog.json", repoPath)), undefined);

  const health = OutcomeDTOs.DoctorOutcome.parse(await (await portalRoutes.request("/charter/root/health")).json()).data;
  assert.equal(health.pendingCount, 0);
  assert.equal(health.problemCount, 0);
});

test("a charter with an error builds nothing, and its faults are sent under their files (FR-120)", async () => {
  const { portalRoutes, held } = surfaces(holding({ [at(".cw/charter/guide/no-any.md")]: guide("no-any", ['mixins: ["nowhere"]']) }));

  const answer = await portalRoutes.request("/charter/root/build", buildRequest);

  assert.equal(answer.status, 422);
  assert.deepEqual(Object.keys(DataDTOs.FaultsByFile.parse(await answer.json()).data.files), [".cw/charter/guide/no-any.md"]);
  assert.equal(await held.readIfThere(new URL(".cw/out/catalog.json", repoPath)), undefined);
});

test("the health check is what doctor answers, and names the faults cw doctor prints (FR-121, SC-014)", async () => {
  const { portalRoutes, cli } = surfaces(
    holding({ [at(".cw/charter/corpus/why.md")]: primitive("corpus", "why"), [at(".cw/charter/mixin/ts.md")]: primitive("mixin", "ts") }),
  );

  const answer = await portalRoutes.request("/charter/root/health");

  assert.equal(answer.status, 200);
  const { warnCount, pendingCount, faultsByFile } = OutcomeDTOs.DoctorOutcome.parse(await answer.json()).data;
  assert.equal(warnCount, 2);
  assert.ok(pendingCount !== null && pendingCount > 0);

  const { text } = await printed(cli, ["doctor"]);
  for (const [file, faults] of Object.entries(faultsByFile.data.files)) {
    assert.ok(text.includes(file));
    for (const { data } of faults) assert.ok(text.includes(`${data.severity}: ${data.message}`));
  }
});
