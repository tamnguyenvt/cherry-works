import { test } from "node:test";
import assert from "node:assert/strict";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { InMemoryTokenCounter } from "../src/zdriven/InMemoryTokenCounter.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import { TomlParser } from "../src/zdriven/TomlParser.js";

const repo = new URL("file:///repo/");
const inRepo = (path: string) => new URL(path, repo);
const toml = new TomlParser();

const building = (config: string, files: Readonly<Record<string, string>> = {}) => {
  const held = new InMemoryFileReaders({
    [inRepo(".cw/settings.json").href]: '{"agents":["codex"]}',
    [inRepo(".codex/config.toml").href]: config,
    ...files,
  });
  const app = new CharterAuthoring(repo, held, new YamlParser(), new InMemoryFileOutput(held), new InMemoryVCS(), new InMemoryTokenCounter(), {}, undefined, undefined, undefined, toml);
  return { held, app };
};

test("TOML merging preserves quoted dotted keys, inline tables, multiline strings and scalar types", async () => {
  const source = [
    'model = "custom"',
    'max_id = 9223372036854775807',
    'ratio = 1.0',
    'day = 2026-10-30',
    'time = 12:34:56',
    'instant = 2026-10-30T12:34:56+07:00',
    "notes = '''first line\n# CHERRYWORKS START\nthis is data, not TOML\n# CHERRYWORKS END\nlast line'''",
    'mcp_servers."user.server" = { command = "mine", args = ["one"], env = { KEEP = "yes" } }',
  ].join("\n");
  const { held, app } = building(source);
  assert.equal((await app.build()).type, "PlanSummary");
  const parsed = toml.parse(await held.read(inRepo(".codex/config.toml")));
  const expected = toml.parse(`${source}\nproject_doc_max_bytes = 1048576\n[mcp_servers.cw]\ncommand = "cw"\nargs = ["mcp", "serve"]\n`);
  assert.deepEqual(parsed, expected);
  assert.equal(typeof parsed["max_id"], "bigint");
  assert.equal(typeof parsed["ratio"], "number");
  assert.ok(parsed["day"] instanceof Date);
  assert.equal(parsed["day"].toISOString(), "2026-10-30");
  assert.ok(parsed["instant"] instanceof Date);
  assert.equal(parsed["instant"].toISOString(), "2026-10-30T12:34:56.000+07:00");
});

test("TOML merges in memory without state, preserves existing hook groups and does not duplicate generated hooks", async () => {
  const sensorFile = inRepo(".cw/charter/sensor/check/index.md");
  const { held, app } = building('model = "mine"\n[[hooks.Stop]]\n[[hooks.Stop.hooks]]\ntype = "command"\ncommand = "echo user"\n', {
    [sensorFile.href]: '---\nkind: sensor\nid: check\ndescription: Check Stop.\nsignal: Stop\nrun: echo check\n---\n\nCheck.\n',
  });
  assert.equal((await app.build()).type, "PlanSummary");
  assert.equal(await held.readIfThere(inRepo(".cw/toml-projections.json")), undefined);
  const builtText = await held.read(inRepo(".codex/config.toml"));
  assert.match(builtText, /echo user/);
  assert.equal((builtText.match(/\[\[hooks.Stop\]\]/g) ?? []).length, 2);
  const rebuilt = await app.build();
  assert.equal(rebuilt.type, "PlanSummary");
  if (rebuilt.type === "PlanSummary") assert.deepEqual(rebuilt.data.edited, []);
  assert.equal(await held.read(inRepo(".codex/config.toml")), builtText);

  // Settings missing from the next projection stay in the existing TOML.
  held.remove(sensorFile);
  for (const { file } of await held.readFilesRecursively(inRepo(".cw/out/"))) held.remove(file);
  assert.equal((await app.build()).type, "PlanSummary");
  assert.equal(await held.read(inRepo(".codex/config.toml")), builtText);
});

test("unchanged TOML keeps user formatting and comments byte-for-byte", async () => {
  const { held, app } = building('model = "mine"\n');
  await app.build();
  const unchanged = `# User comment.\n\n${await held.read(inRepo(".codex/config.toml"))}`;
  held.write(inRepo(".codex/config.toml"), unchanged);
  const rebuilt = await app.build();
  if (rebuilt.type === "PlanSummary") assert.deepEqual(rebuilt.data.edited, []);
  assert.equal(await held.read(inRepo(".codex/config.toml")), unchanged);
});

test("invalid TOML fails before any file is written", async () => {
  const config = 'model = "unterminated';
  const { held, app } = building(config);
  await assert.rejects(app.build(), /not readable/);
  assert.equal(await held.read(inRepo(".codex/config.toml")), config);
  assert.equal(await held.readIfThere(inRepo("AGENTS.md")), undefined);
});

test("preview merges TOML in memory without changing the configuration", async () => {
  const { held, app } = building('model = "mine"\n');
  const preview = await app.preview();
  assert.equal(preview.type, "PlanSummary");
  assert.equal(await held.readIfThere(inRepo(".cw/toml-projections.json")), undefined);
  assert.equal(await held.read(inRepo(".codex/config.toml")), 'model = "mine"\n');
});
