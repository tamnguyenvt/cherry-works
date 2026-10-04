import { test } from "node:test";
import assert from "node:assert/strict";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { DataDTOs } from "../src/hexagon/port/driver/dtos/index.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import { InMemoryTokenCounter } from "../src/zdriven/InMemoryTokenCounter.js";
import { InMemoryAgentCli } from "../src/zdriven/InMemoryAgentCli.js";

const root = new URL("file:///repo/.cw/charter/");
const vendored = new URL("file:///repo/.cw/vendor/acme/");

const primitive = (kind: string, id: string, headers: readonly string[] = []) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: About ${id}.`, ...headers, "---", "", `The body of ${id}.`, ""].join("\n");

/** One primitive of each layer, and a sensor whose signal and command are
 *  headers the catalogue does not record. */
const charter = {
  [new URL("guide/no-any/index.md", root).href]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]']),
  [new URL("sensor/lint/index.md", root).href]: primitive("sensor", "lint", ["signal: PostToolUse", "run: pnpm lint"]),
  [new URL("guide/small-diffs/index.md", vendored).href]: primitive("guide", "small-diffs"),
};

const fullListOf = async (files: Readonly<Record<string, string>>, matching?: string) => {
  const readers = new InMemoryFileReaders(files);
  const charterAuthoringApp = new CharterAuthoring(new URL("file:///repo/"), readers, new YamlParser(), new InMemoryFileOutput(readers), new InMemoryVCS(), new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() });
  return charterAuthoringApp.fullList(matching);
};

const idsIn = (answer: DataDTOs.Primitives | DataDTOs.FaultsByFile) => {
  assert.equal(answer.type, "Primitives");
  return DataDTOs.Primitives.parse(answer).data.primitives.map(({ data }) => data.id);
};

test("every primitive of every layer is listed by id, each under the layer it arrived in (FR-112)", async () => {
  const answer = DataDTOs.Primitives.parse(await fullListOf(charter));

  assert.deepEqual(
    answer.data.primitives.map(({ data: { id, layerName } }) => [id, layerName]),
    [
      ["cw-author", "builtin"],
      ["lint", "repo"],
      ["no-any", "repo"],
      ["session-tokens-counter", "builtin"],
      ["session-tokens-counter-on-stop", "builtin"],
      ["small-diffs", "vendor"],
    ],
  );
});

test("each primitive carries every header it declared, the ones the catalogue does not record included", async () => {
  const answer = DataDTOs.Primitives.parse(await fullListOf(charter));
  const sensor = answer.data.primitives.find(({ data }) => data.id === "lint")!;

  assert.equal(sensor.data.file, ".cw/charter/sensor/lint/index.md");
  assert.equal(sensor.data.headers.signal, "PostToolUse");
  assert.equal(sensor.data.headers.run, "pnpm lint");
});

test("a word keeps only the primitives mentioning it, in a header value as much as in a description (FR-114)", async () => {
  assert.deepEqual(idsIn(await fullListOf(charter, "posttooluse")), ["lint"]);
  assert.deepEqual(idsIn(await fullListOf(charter, "About small")), ["small-diffs"]);
  assert.deepEqual(idsIn(await fullListOf(charter, ".cw/vendor")), ["small-diffs"]);
});

test("a word is found in the line saying when a primitive's kind comes up", async () => {
  // Only a sensor's kind says the harness runs something: the authored one, and
  // the one the engine brings to count a session's tokens.
  assert.deepEqual(idsIn(await fullListOf(charter, "the harness runs")), ["lint", "session-tokens-counter-on-stop"]);
});

test("a word nothing mentions lists nothing, and is no fault", async () => {
  assert.deepEqual(idsIn(await fullListOf(charter, "nowhere-at-all")), []);
});

test("a charter with an error lists nothing and hands back what is wrong under its file", async () => {
  const answer = await fullListOf({ [new URL("guide/broken/index.md", root).href]: "not a primitive at all\n" });

  assert.equal(answer.type, "FaultsByFile");
  assert.deepEqual(Object.keys(DataDTOs.FaultsByFile.parse(answer).data.files), [".cw/charter/guide/broken/index.md"]);
});
