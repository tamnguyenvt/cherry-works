import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { TomlLib } from "../src/module/shared/domain/libs/toml.lib.js";
import { DomainFault } from "../src/module/shared/domain/models/domain.fault.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { faultTextOf } from "./answer-of.js";
import { buildingCharterOf } from "./use-cases-of.js";

const repo = new URL("file:///repo/");
const inRepo = (path: string) => new URL(path, repo);

const building = (config: string, files: Readonly<Record<string, string>> = {}) => {
  const held = new InMemoryFileReaders({
    [inRepo(".cw/settings.json").href]: '{"agents":["codex"]}',
    [inRepo(".codex/config.toml").href]: config,
    ...files,
  });
  const app = buildingCharterOf(
    held,
    new InMemoryFileOutput(held),
    new InMemoryTokenCounter(),
    {},
    new InMemoryReporter(),
    {},
  );
  return { held, app };
};

test("TOML that cannot be serialized is the caller's to correct, and says none of the library's words", () => {
  assert.throws(
    () => TomlLib.writeTomlText({ bad: () => 0 }),
    (raised: unknown) => {
      assert.ok(raised instanceof DomainFault);
      assert.equal(raised.internal, false);
      assert.equal(raised.message, "TOML could not be serialized.");
      assert.doesNotMatch(raised.message, /function/);
      assert.match(`${raised.cause}`, /function/);
      return true;
    },
  );
});

test("TOML merging preserves quoted dotted keys, inline tables, multiline strings and scalar types", async () => {
  const source = [
    'model = "custom"',
    "max_id = 9223372036854775807",
    "ratio = 1.0",
    "day = 2026-10-30",
    "time = 12:34:56",
    "instant = 2026-10-30T12:34:56+07:00",
    "notes = '''first line\n# CHERRYWORKS START\nthis is data, not TOML\n# CHERRYWORKS END\nlast line'''",
    'mcp_servers."user.server" = { command = "mine", args = ["one"], env = { KEEP = "yes" } }',
  ].join("\n");
  const { held, app } = building(source);
  assert.equal((await app.buildCharter()).type, "ProjectionPlanSummary");
  const parsed = TomlLib.parseTomlTable(await held.readFile(inRepo(".codex/config.toml")));
  const expected = TomlLib.parseTomlTable(
    `${source}\nproject_doc_max_bytes = 1048576\n[mcp_servers.cw]\ncommand = "cw"\nargs = ["run", "mcp"]\n`,
  );
  assert.deepEqual(parsed, expected);
  assert.equal(typeof parsed["max_id"], "bigint");
  assert.equal(typeof parsed["ratio"], "number");
  assert.ok(parsed["day"] instanceof Date);
  assert.equal(parsed["day"].toISOString(), "2026-10-30");
  assert.ok(parsed["instant"] instanceof Date);
  assert.equal(parsed["instant"].toISOString(), "2026-10-30T12:34:56.000+07:00");
});

test("TOML merges in memory without state, writes the hooks of a signal a sensor names over whole and does not duplicate them (CORE-FR-039)", async () => {
  const sensorFile = inRepo(".cw/charter/team/primitive/sensor/check/index.md");
  const { held, app } = building(
    'model = "mine"\n[[hooks.Stop]]\n[[hooks.Stop.hooks]]\ntype = "command"\ncommand = "echo user"\n',
    {
      [sensorFile.href]:
        "---\nkind: sensor\nid: check\ndescription: Check Stop.\nsignal: Stop\nrun: echo check\n---\n\nCheck.\n",
    },
  );
  assert.equal((await app.buildCharter()).type, "ProjectionPlanSummary");
  assert.equal(await held.readIfThere(inRepo(".cw/toml-projections.json")), undefined);
  const builtText = await held.readFile(inRepo(".codex/config.toml"));
  assert.doesNotMatch(builtText, /echo user/);
  assert.match(builtText, /model = "mine"/);
  assert.equal((builtText.match(/\[\[hooks.Stop\]\]/g) ?? []).length, 1);
  const secondBuildAnswer = await app.buildCharter();
  assert.equal(secondBuildAnswer.type, "ProjectionPlanSummary");
  if (secondBuildAnswer.type === "ProjectionPlanSummary") assert.deepEqual(secondBuildAnswer.data.edited, []);
  assert.equal(await held.readFile(inRepo(".codex/config.toml")), builtText);

  // Settings missing from the next projection stay in the existing TOML.
  held.removeFile(sensorFile);
  for (const { fileUrl } of await held.readFilesRecursively(inRepo(".cw/out/"))) held.removeFile(fileUrl);
  assert.equal((await app.buildCharter()).type, "ProjectionPlanSummary");
  assert.equal(await held.readFile(inRepo(".codex/config.toml")), builtText);
});

test("unchanged TOML keeps user formatting and comments byte-for-byte", async () => {
  const { held, app } = building('model = "mine"\n');
  await app.buildCharter();
  const unchanged = `# User comment.\n\n${await held.readFile(inRepo(".codex/config.toml"))}`;
  held.writeFile(inRepo(".codex/config.toml"), unchanged);
  const secondBuildAnswer = await app.buildCharter();
  if (secondBuildAnswer.type === "ProjectionPlanSummary") assert.deepEqual(secondBuildAnswer.data.edited, []);
  assert.equal(await held.readFile(inRepo(".codex/config.toml")), unchanged);
});

test("invalid TOML fails before any file is written", async () => {
  const config = 'model = "unterminated';
  const { held, app } = building(config);
  assert.match(faultTextOf(await app.buildCharter()), /not readable/);
  assert.equal(await held.readFile(inRepo(".codex/config.toml")), config);
  assert.equal(await held.readIfThere(inRepo("AGENTS.md")), undefined);
});

test("preview merges TOML in memory without changing the configuration", async () => {
  const { held, app } = building('model = "mine"\n');
  const preview = await app.previewCharterBuild();
  assert.equal(preview.type, "ProjectionPlanSummary");
  assert.equal(await held.readIfThere(inRepo(".cw/toml-projections.json")), undefined);
  assert.equal(await held.readFile(inRepo(".codex/config.toml")), 'model = "mine"\n');
});
