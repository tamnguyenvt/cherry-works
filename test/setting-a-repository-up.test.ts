import { test } from "node:test";
import assert from "node:assert/strict";
import { Commander } from "../src/driver/cli/Commander.js";
import { COMMANDS } from "../src/driver/cli/commands/index.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { KINDS } from "../src/hexagon/domain/models/charter/primitive/Primitive.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";

const repo = "/repo";

/** What installing a vendor is driven through: a context always carries every
 *  use case, and nothing here asks this one for anything. */
const charterVendoringApp = new CharterVendoring(new URL(`file://${repo}/`), new InMemoryFileReaders({}), new InMemoryVCS());


const repoPath = new URL("file:///repo/");

/** The command line as a user meets it, over a repository held in memory: the
 *  real `cw init`, the real service behind it, and files a test can read back
 *  out of. */
const setUp = async (
  files: Readonly<Record<string, string>> = {},
  argv: readonly string[] = ["init"],
  versioned = true,
) => {
  const held = new InMemoryFileReaders(files);
  const charterAuthoringApp = new CharterAuthoring(new URL(`file://${repo}/`), held, new YamlParser(), new InMemoryFileOutput(held), new InMemoryVCS(versioned));
  const results: string[] = [];
  const problems: string[] = [];
  const kept = { out: process.stdout.write, err: process.stderr.write };
  process.stdout.write = ((text: string) => (results.push(text), true)) as typeof kept.out;
  process.stderr.write = ((text: string) => (problems.push(text), true)) as typeof kept.err;
  try {
    const code = await new Commander({ cwd: repo, charterAuthoringApp, charterVendoringApp }, COMMANDS).run(argv);
    return { code, held, results: results.join(""), problems: problems.join("") };
  } finally {
    process.stdout.write = kept.out;
    process.stderr.write = kept.err;
  }
};

/** What one file of the set-up repository holds, or nothing where it was never
 *  written. */
const held = (files: InMemoryFileReaders, path: string) => files.readIfThere(new URL(path, repoPath));

test("setting up writes a directory per kind, so a charter has somewhere to be authored (FR-037)", async () => {
  const { code, held: files } = await setUp({}, ["init", "--agent", "claude"]);

  assert.equal(code, 0);
  for (const kind of KINDS) assert.notEqual(await held(files, `.cw/charter/${kind}/.gitkeep`), undefined);
});

test("what the repository answered is what its settings keep (FR-033, FR-037)", async () => {
  const { held: files } = await setUp({}, ["init", "--agent", "claude"]);

  assert.deepEqual(JSON.parse((await held(files, ".cw/settings.json")) ?? ""), { agents: ["claude"] });
});

test("an agent this engine does not compile for is refused, naming the ones it does", async () => {
  const { code, problems } = await setUp({}, ["init", "--agent", "cursor"]);

  assert.equal(code, 1);
  assert.match(problems, /no agent called "cursor"/);
});

test("with nobody to ask and nothing chosen yet, setup is refused, naming the flag, and writes nothing (FR-033, FR-035)", async () => {
  const { code, held: files, problems } = await setUp();

  assert.equal(code, 1);
  assert.match(problems, /cw init --agent <name>/);
  assert.equal(await held(files, ".cw/settings.json"), undefined);
});

test("setup given no agent is refused by the engine, whatever drives it (FR-033)", async () => {
  const held = new InMemoryFileReaders({});
  const charterAuthoringApp = new CharterAuthoring(repoPath, held, new YamlParser(), new InMemoryFileOutput(held), new InMemoryVCS());

  await assert.rejects(charterAuthoringApp.init({ agents: [] }), /no agent to compile for/);
  assert.equal(await held.readIfThere(new URL(".cw/settings.json", repoPath)), undefined);
});

test("what this repository already chose is the default the next run keeps (FR-038)", async () => {
  const { held: files } = await setUp({
    [new URL(".cw/settings.json", repoPath).href]: `${JSON.stringify({ agents: ["claude"] }, undefined, 2)}\n`,
  });

  assert.deepEqual(JSON.parse((await held(files, ".cw/settings.json")) ?? ""), { agents: ["claude"] });
});

test("setting up compiles nothing: a build is what compiles the charter, and it says to run one (FR-037)", async () => {
  const { code, held: files, results } = await setUp(
    {
      [new URL(".cw/charter/guide/no-any.md", repoPath).href]:
        '---\nkind: guide\nid: no-any\ndescription: No any.\nglobs: ["src/**/*.ts"]\n---\n\nBody.\n',
    },
    ["init", "--agent", "claude"],
  );

  assert.equal(code, 0);
  assert.equal(await held(files, ".claude/rules/guide-no-any.md"), undefined);
  assert.equal(await held(files, ".cw/out/CHARTER.md"), undefined);
  assert.match(results, /run "cw build"/);
});

test("setting up writes nothing for what the engine brings: it is supplied on every read (FR-016, FR-020)", async () => {
  const { code, held: files } = await setUp({}, ["init", "--agent", "claude"]);

  assert.equal(code, 0);
  const repositoryFiles = await files.readFilesRecursively(repoPath);
  assert.deepEqual(
    repositoryFiles.map(({ file }) => file.href).filter((href) => href.includes("cw-author")),
    [],
  );
});

test("setting up again discards nothing authored (FR-038)", async () => {
  const authored = new URL(".cw/charter/guide/no-any.md", repoPath).href;
  const { code, held: files } = await setUp(
    { [authored]: "---\nkind: guide\nid: no-any\ndescription: No any.\nglobs: [\"src/**/*.ts\"]\n---\n\nBody.\n" },
    ["init", "--agent", "claude"],
  );

  assert.equal(code, 0);
  assert.equal(
    await files.readIfThere(new URL(authored)),
    "---\nkind: guide\nid: no-any\ndescription: No any.\nglobs: [\"src/**/*.ts\"]\n---\n\nBody.\n",
  );
});

test("nothing is written into an ignore file: what a vendor installed is committed too", async () => {
  const { held: files } = await setUp({ [new URL(".gitignore", repoPath).href]: "node_modules/\n" }, [
    "init",
    "--agent",
    "claude",
  ]);

  assert.equal(await held(files, ".gitignore"), "node_modules/\n");
});

test("a folder under no repository is refused before anything is written (FR-032)", async () => {
  const { code, held: files, problems } = await setUp({}, ["init", "--agent", "claude"], false);

  assert.equal(code, 1);
  assert.match(problems, /not inside a git repository/);
  assert.equal(await held(files, ".cw/settings.json"), undefined);
});
