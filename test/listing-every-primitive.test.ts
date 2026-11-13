import assert from "node:assert/strict";
import { test } from "node:test";
import { CharterDTOs } from "../src/module/charter/app/port/in/charter.dto.js";
import { FaultDTOs } from "../src/module/shared/app/port/in/fault.dto.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { authoringCharterOf } from "./use-cases-of.js";

const root = new URL("file:///repo/.cw/charter/primitive/");
const vendored = new URL("file:///repo/.cw/charter/vendor/acme/charter/root/primitive/");

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

/** One primitive of each layer, and a sensor whose signal and command are
 *  headers the catalogue does not record. */
const charter = {
  [new URL("guide/no-any/index.md", root).href]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]']),
  [new URL("sensor/lint/index.md", root).href]: primitive("sensor", "lint", ["signal: PostToolUse", "run: pnpm lint"]),
  [new URL("guide/small-diffs/index.md", vendored).href]: primitive("guide", "small-diffs"),
};

const fullListOf = async (files: Readonly<Record<string, string>>, matching?: string) => {
  const readers = new InMemoryFileReaders(files);
  const charterAuthoringApp = authoringCharterOf(readers, new InMemoryFileOutput(readers), new InMemoryReporter());
  return charterAuthoringApp.listPrimitives(matching);
};

const idsIn = (answer: CharterDTOs.Primitives | FaultDTOs.FaultsByFile | FaultDTOs.Fault) => {
  assert.equal(answer.type, "Primitives");
  return CharterDTOs.Primitives.parse(answer).data.primitives.map(({ data }) => data.id);
};

test("every primitive of every layer is listed by id, each under the layer it arrived in (FR-112)", async () => {
  const answer = CharterDTOs.Primitives.parse(await fullListOf(charter));

  assert.deepEqual(
    answer.data.primitives.map(({ data: { id, layerName } }) => [id, layerName]),
    [
      ["cw-author", "builtin"],
      ["cw-session-tokens-counter", "builtin"],
      ["cw-session-tokens-counter-on-stop", "builtin"],
      ["lint", "repo"],
      ["no-any", "repo"],
      ["small-diffs", "vendor"],
    ],
  );
});

test("each primitive carries every header it declared, the ones the catalogue does not record included", async () => {
  const answer = CharterDTOs.Primitives.parse(await fullListOf(charter));
  const sensor = answer.data.primitives.find(({ data }) => data.id === "lint")!;

  assert.equal(sensor.data.file, "file:///repo/.cw/charter/primitive/sensor/lint/index.md");
  assert.equal(sensor.data.headers.signal, "PostToolUse");
  assert.equal(sensor.data.headers.run, "pnpm lint");
});

test("a word keeps only the primitives mentioning it, in a header value as much as in a description (FR-114)", async () => {
  assert.deepEqual(idsIn(await fullListOf(charter, "posttooluse")), ["lint"]);
  assert.deepEqual(idsIn(await fullListOf(charter, "About small")), ["small-diffs"]);
  assert.deepEqual(idsIn(await fullListOf(charter, "vendor")), ["small-diffs"]);
});

test("a word is found in the line saying when a primitive's kind comes up", async () => {
  // Only a sensor's kind says the harness runs something: the authored one, and
  // the one the engine brings to count a session's tokens.
  assert.deepEqual(idsIn(await fullListOf(charter, "the harness runs")), ["cw-session-tokens-counter-on-stop", "lint"]);
});

test("a word nothing mentions lists nothing, and is no fault", async () => {
  assert.deepEqual(idsIn(await fullListOf(charter, "nowhere-at-all")), []);
});

test("a charter with an error lists nothing and hands back what is wrong under its file", async () => {
  const answer = await fullListOf({ [new URL("guide/broken/index.md", root).href]: "not a primitive at all\n" });

  assert.equal(answer.type, "FaultsByFile");
  assert.deepEqual(Object.keys(FaultDTOs.FaultsByFile.parse(answer).data.files), [
    "file:///repo/.cw/charter/primitive/guide/broken/index.md",
  ]);
});
