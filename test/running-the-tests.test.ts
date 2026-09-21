import { test } from "node:test";
import assert from "node:assert/strict";
import { Commander } from "../src/driver/cli/Commander.js";
import { COMMANDS } from "../src/driver/cli/commands/index.js";
import { EXIT_FAILURE, EXIT_OK } from "../src/driver/cli/commands/Command.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";

const repo = "/repo";
const root = new URL("file:///repo/.cw/charter/");
const at = (path: string) => new URL(path, root).href;
const inRepo = (path: string) => new URL(path, "file:///repo/").href;

const primitive = (kind: string, id: string, headers: readonly string[] = []) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: About ${id}.`, ...headers, "---", "", `The body of ${id}.`, ""].join("\n");

const guide = (id: string, globs: readonly string[]) => primitive("guide", id, [`globs: ${JSON.stringify(globs)}`]);
const sensor = (id: string, signal: string) =>
  primitive("sensor", id, [`signal: ${signal}`, 'run: "pnpm test"']);
const posture = (id: string, deny: readonly string[]) =>
  primitive("posture", id, ['allow: ["src/**"]', `deny: ${JSON.stringify(deny)}`]);

const settings = { [inRepo(".cw/settings.json")]: `${JSON.stringify({ agents: [] }, undefined, 2)}\n` };

/** One test file, written the way an author writes it, in the folder tests are
 *  read from. */
const suite = (written: unknown, name = "suite"): Record<string, string> => ({
  [inRepo(`.cw/test/${name}.json`)]: `${JSON.stringify(written, undefined, 2)}\n`,
});

/** Everything one run wrote, kept apart the way a pipeline reads it. */
const writing = async (work: () => Promise<number>) => {
  const results: string[] = [];
  const problems: string[] = [];
  const streams = [
    { stream: process.stdout, kept: process.stdout.write, into: results },
    { stream: process.stderr, kept: process.stderr.write, into: problems },
  ];
  for (const { stream, into } of streams) {
    stream.write = ((text: string | Uint8Array) => {
      into.push(String(text));
      return true;
    }) as typeof stream.write;
  }
  try {
    const code = await work();
    return { code, result: results.join(""), problem: problems.join("") };
  } finally {
    for (const { stream, kept } of streams) stream.write = kept;
  }
};

const commandLine = (files: Readonly<Record<string, string>>) => {
  const held = new InMemoryFileReaders(files);
  const vcs = new InMemoryVCS();
  const charterAuthoringApp = new CharterAuthoring(new URL(`file://${repo}/`), held, new YamlParser(), new InMemoryFileOutput(held), vcs);
  const cli = new Commander({ cwd: repo, charterAuthoringApp, charterVendoringApp: new CharterVendoring(new URL(`file://${repo}/`), vcs) }, COMMANDS);
  return (argv: readonly string[] = ["test"]) => writing(() => cli.run([...argv]));
};

const charter = {
  ...settings,
  [at("guide/no-any.md")]: guide("no-any", ["src/**/*.ts"]),
  [at("guide/docs-tone.md")]: guide("docs-tone", ["docs/**/*.md"]),
  [at("sensor/tests.md")]: sensor("tests", "Stop"),
  [at("posture/secrets.md")]: posture("secrets", [".env", "**/*.pem"]),
};

test("a touched file that matches a guide's globs brings it up, and the case passes (FR-048)", async () => {
  const run = commandLine({
    ...charter,
    ...suite({
      cases: [{ do: { touchFile: "src/services/user.ts" }, expect: { activate: "guide:no-any" } }],
    }),
  });

  const { code, result } = await run();

  assert.equal(code, EXIT_OK);
  assert.match(result, /pass {2}touching src\/services\/user\.ts activates guide:no-any/);
  assert.match(result, /1 case passed\./);
});

test("a touched file that matches none of the guide's globs fails, naming the globs it has (FR-048, FR-050)", async () => {
  const run = commandLine({
    ...charter,
    ...suite({
      cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: "guide:docs-tone" } }],
    }),
  });

  const { code, result } = await run();

  assert.equal(code, EXIT_FAILURE);
  assert.match(result, /FAIL {2}touching src\/one\.ts activates guide:docs-tone/);
  assert.match(result, /This file matches none of the globs "guide:docs-tone" speaks about: docs\/\*\*\/\*\.md\./);
  assert.match(result, /1 of 1 case failed\./);
});

test("a raised event runs the sensor that names it, and fails naming the event it does name", async () => {
  const run = commandLine({
    ...charter,
    ...suite({
      cases: [
        { when: "Stop", expect: { run: "sensor:tests" } },
        { when: "PreToolUse", expect: { run: "sensor:tests" } },
      ],
    }),
  });

  const { code, result } = await run();

  assert.equal(code, EXIT_FAILURE);
  assert.match(result, /pass {2}firing event Stop runs sensor:tests/);
  assert.match(result, /FAIL {2}firing event PreToolUse runs sensor:tests/);
  assert.match(result, /"sensor:tests" fires on Stop, not on PreToolUse\./);
});

test("a touched file a posture denies is refused, and one no posture denies fails saying so", async () => {
  const run = commandLine({
    ...charter,
    ...suite({
      cases: [
        { do: { touchFile: ".env" }, expect: { allow: false } },
        { do: { touchFile: "src/one.ts" }, expect: { allow: false } },
      ],
    }),
  });

  const { code, result } = await run();

  assert.equal(code, EXIT_FAILURE);
  assert.match(result, /pass {2}touching \.env is denied/);
  assert.match(result, /FAIL {2}touching src\/one\.ts is denied/);
  assert.match(result, /No posture denies this file\./);
});

test("a touched file no posture denies is allowed, and one a posture denies fails naming it", async () => {
  const run = commandLine({
    ...charter,
    ...suite({
      cases: [
        { do: { touchFile: "src/one.ts" }, expect: { allow: true } },
        { do: { touchFile: "key.pem" }, expect: { allow: true } },
      ],
    }),
  });

  const { code, result } = await run();

  assert.equal(code, EXIT_FAILURE);
  assert.match(result, /pass {2}touching src\/one\.ts is allowed/);
  assert.match(result, /FAIL {2}touching key\.pem is allowed/);
  assert.match(result, /"posture:secrets" denies this file\./);
});

test("an identity of the wrong kind fails saying whose rule the case asked for", async () => {
  const run = commandLine({
    ...charter,
    ...suite({
      cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: "sensor:tests" } }],
    }),
  });

  const { code, result } = await run();

  assert.equal(code, EXIT_FAILURE);
  assert.match(result, /Coming up when a file is touched is a guide's rule, and "sensor:tests" is a sensor\./);
});

test("a case naming an identity the charter holds nothing of fails rather than passing about nothing", async () => {
  const run = commandLine({
    ...charter,
    ...suite({
      cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: "guide:renamed-away" } }],
    }),
  });

  const { code, result } = await run();

  assert.equal(code, EXIT_FAILURE);
  assert.match(result, /This charter holds no primitive called "guide:renamed-away"\./);
});

test("every case in the file is run, and the count is of all of them", async () => {
  const run = commandLine({
    ...charter,
    ...suite({
      cases: [
        { do: { touchFile: "src/one.ts" }, expect: { activate: "guide:no-any" } },
        { when: "Stop", expect: { run: "sensor:tests" } },
        { do: { touchFile: "docs/one.md" }, expect: { activate: "guide:no-any" } },
      ],
    }),
  });

  const { code, result } = await run();

  assert.equal(code, EXIT_FAILURE);
  assert.match(result, /1 of 3 cases failed\./);
});

test("a test file that will not read is refused, naming it, and nothing is resolved (FR-009)", async () => {
  const run = commandLine({
    ...charter,
    [inRepo(".cw/test/broken.json")]: "{ not json",
    ...suite({ cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: "guide:no-any" } }] }),
  });

  const { code, result, problem } = await run();

  assert.equal(code, EXIT_FAILURE);
  assert.equal(result, "");
  assert.match(problem, /error: \.cw\/test\/broken\.json: This file is not JSON/);
});

test("a repository that wrote no test is told so and passes", async () => {
  const { code, result } = await commandLine(charter)();

  assert.equal(code, EXIT_OK);
  assert.match(result, /No tests: \.cw\/test\/ holds no case\./);
});

test("a charter with an error resolves nothing and says where to read what is wrong (FR-009)", async () => {
  const run = commandLine({
    ...charter,
    [at("guide/broken.md")]: "no frontmatter here",
    ...suite({ cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: "guide:no-any" } }] }),
  });

  const { code, result, problem } = await run();

  assert.equal(code, EXIT_FAILURE);
  assert.equal(result, "");
  assert.match(problem, /Nothing was resolved\./);
  assert.match(problem, /\.cw\/charter\/guide\/broken\.md/);
});
