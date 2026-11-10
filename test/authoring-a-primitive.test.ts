import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import prompts from "prompts";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { EditCommand } from "../src/presentation/cli/commands/edit.command.js";
import { ExplainCommand } from "../src/presentation/cli/commands/explain.command.js";
import { RemoveCommand } from "../src/presentation/cli/commands/remove.command.js";
import { EXIT_OK } from "../src/presentation/cli/commands/command.interface.js";
import type { AuthoringCharter } from "../src/module/charter/app/authoring-charter.use-case.js";
import { CharterDTOs } from "../src/module/charter/app/port/in/charter.dto.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { ModelHelper } from "../src/module/charter/domain/helper.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { answerOf, faultTextOf } from "./answer-of.js";
import { authoringCharterOf, buildingCharterOf, testingCharterOf, commandContextOf } from "./use-cases-of.js";

const repoPath = new URL("file:///repo/");
const at = (path: string) => new URL(path, repoPath).href;

const primitive = (kind: string, id: string, headers: readonly string[] = [], body = `The body of ${id}.`) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: About ${id}.`, ...headers, "---", "", body, ""].join("\n");

const guide = (id: string, headers: readonly string[] = []) => primitive("guide", id, ['globs: ["src/**/*.ts"]', ...headers]);

/** The engine over one repository held in memory, and the files it holds, so a
 *  test reads back what was written and changes what is on disk between two
 *  calls. */
const authoring = (files: Readonly<Record<string, string>> = {}) => {
  const held = new InMemoryFileReaders(files);
  const charterAuthoringApp = authoringCharterOf(held, new InMemoryFileOutput(held), new InMemoryReporter());
  const charterRuntimeApp = buildingCharterOf(held, new InMemoryFileOutput(held), new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() }, new InMemoryReporter());
  return { charterAuthoringApp, charterRuntimeApp, held, fileAt: (path: string) => held.readIfThere(new URL(path, repoPath)) };
};

/** What each command runs with. Its `run` is called as the command line calls
 *  it, and what it answers is read off the outcome it returns rather than off
 *  a captured stdout, which the test runner reports through too. */
const contextOver = (charterAuthoringApp: AuthoringCharter) => (commandContextOf({
  charterAuthoringApp,
  charterRuntimeApp: buildingCharterOf(new InMemoryFileReaders({}), new InMemoryFileOutput(new InMemoryFileReaders({})), new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() }, new InMemoryReporter()),
  }));

test("a primitive added with a body is the file cw add writes, with the body under its headers (FR-117)", async () => {
  const withBody = authoring();
  const withoutBody = authoring();
  const headers = { description: "No any.", globs: ["src/**/*.ts"] };

  await withBody.charterAuthoringApp.add("guide", "no-any", headers, "# No any\n\nNever write `any`.");
  await withoutBody.charterAuthoringApp.add("guide", "no-any", headers);

  const written = (await withBody.fileAt(".cw/charter/primitive/guide/no-any/index.md")) ?? "";
  const scaffolded = (await withoutBody.fileAt(".cw/charter/primitive/guide/no-any/index.md")) ?? "";
  assert.equal(written, `${scaffolded.trimEnd()}\n\n# No any\n\nNever write \`any\`.\n`);
});

test("a disable-user-invocation answered as a line is written as the yes or no it is, and read back so (CORE-FR-173)", async () => {
  const { charterAuthoringApp, fileAt } = authoring();

  await charterAuthoringApp.add("skill", "ship-review", { description: "Review what ships.", triggers: ["review the release"], "disable-user-invocation": "true" });

  const written = (await fileAt(".cw/charter/primitive/skill/ship-review/index.md")) ?? "";
  assert.match(written, /\ndisable-user-invocation: true\n/);
  const { data } = CharterDTOs.Primitive.parse(await charterAuthoringApp.open("ship-review"));
  assert.equal(data.headers["disable-user-invocation"], "true");
});

test("an id another layer already holds is refused naming its file, and nothing is written (FR-014)", async () => {
  const { charterAuthoringApp, fileAt } = authoring({ [at(".cw/charter/vendor/team/rules/root/primitive/guide/no-any/index.md")]: guide("no-any") });

  assert.match(faultTextOf(await charterAuthoringApp.add("guide", "no-any", { description: "Mine.", globs: ["src/**"] })), /"no-any" is already there, declared by file:\/\/\/repo\/\.cw\/charter\/vendor\/team\/rules\/root\/primitive\/guide\/no-any\/index\.md/);
  assert.match(faultTextOf(await charterAuthoringApp.add("skill", "cw-author", { description: "Mine.", triggers: ["write"] })), /declared by \(built into cw\)\/skill\/cw-author\/index\.md/);
  assert.equal(await fileAt("file:///repo/.cw/charter/primitive/guide/no-any/index.md"), undefined);
});

test("a primitive opens with its headers, body, file, layer and revision, whatever else is wrong (FR-075)", async () => {
  const text = guide("no-any", ["rationale: why"]);
  const { charterAuthoringApp } = authoring({
    [at(".cw/charter/primitive/guide/no-any/index.md")]: text,
    [at(".cw/charter/primitive/guide/broken/index.md")]: guide("broken", ['mixins: ["nowhere"]']),
  });

  const { data } = CharterDTOs.Primitive.parse(await charterAuthoringApp.open("no-any"));

  // The hash is of the primitive written out, which is what a save writes.
  assert.equal(data.hash, ModelHelper.contentHashOf(text));
  assert.equal(data.body, "The body of no-any.");
  assert.equal(data.file, "file:///repo/.cw/charter/primitive/guide/no-any/index.md");
  assert.equal(data.layerName, "repo");
  assert.deepEqual(data.headers.globs, ["src/**/*.ts"]);
  assert.equal(data.headers.rationale, "why");
});

test("a vendored and a builtin primitive open too, each under its own layer", async () => {
  const { charterAuthoringApp } = authoring({ [at(".cw/charter/vendor/team/rules/root/primitive/guide/no-any/index.md")]: guide("no-any") });

  const vendored = answerOf(await charterAuthoringApp.open("no-any")).data;
  assert.equal(vendored.layerName, "vendor");
  assert.equal(vendored.file, "file:///repo/.cw/charter/vendor/team/rules/root/primitive/guide/no-any/index.md");

  const builtin = answerOf(await charterAuthoringApp.open("cw-author")).data;
  assert.equal(builtin.layerName, "builtin");
  assert.match(builtin.hash, /^[0-9a-f]{16}$/);
});

test("an id the charter holds nothing of opens nothing", async () => {
  assert.match(faultTextOf(await authoring().charterAuthoringApp.open("nowhere")), /holds no "nowhere"/);
});

test("a rewrite at the revision opened replaces the headers and body, keeping kind, id and file (FR-075)", async () => {
  // Written somewhere other than the convention: where a file sits says only
  // that it is looked at, so a rewrite leaves it there.
  const { charterAuthoringApp, fileAt, held } = authoring({
    [at(".cw/charter/primitive/guide/no-any/index.md")]: guide("no-any"),
    [at(".cw/charter/primitive/corpus/why/index.md")]: primitive("corpus", "why"),
  });
  const filesOnDisk = async () => new Map((await held.readFilesRecursively(repoPath)).map(({ file, contents }) => [file.href, contents]));
  const before = await filesOnDisk();
  const { hash: revision } = answerOf(await charterAuthoringApp.open("no-any")).data;

  const primitiveDTO = await charterAuthoringApp.rewrite("no-any",
    { description: "Never any.", globs: ["src/**/*.ts", "test/**/*.ts"] },
    "Use unknown.",
    revision,
  );

  assert.equal(primitiveDTO.type, "Primitive");
  const rewritten = (await fileAt(".cw/charter/primitive/guide/no-any/index.md")) ?? "";
  assert.match(rewritten, /^---\nkind: guide\nid: no-any\ndescription: Never any\.\nglobs: \["src\/\*\*\/\*\.ts", "test\/\*\*\/\*\.ts"\]\n---\n\nUse unknown\.\n$/);
  // Nothing else on disk moved.
  assert.deepEqual([...(await filesOnDisk()).keys()].sort(), [...before.keys()].sort());
  assert.equal(await fileAt(".cw/charter/primitive/corpus/why/index.md"), before.get(at(".cw/charter/primitive/corpus/why/index.md")));
});

test("a file written by hand in another layout saves at the revision it opened at (FR-078)", async () => {
  // A list written as a block and a comment: the same primitive, not the text
  // `toMarkdown()` writes.
  const byHand = ["---", "kind: guide", "id: no-any", "# why this exists", "description: About no-any.", "globs:", "  - src/**/*.ts", "---", "", "Body.", ""].join("\n");
  const { charterAuthoringApp, fileAt } = authoring({ [at(".cw/charter/primitive/guide/no-any/index.md")]: byHand });
  const { hash: revision } = answerOf(await charterAuthoringApp.open("no-any")).data;

  const primitiveDTO = answerOf(await charterAuthoringApp.rewrite("no-any", { description: "Never any.", globs: ["src/**"] }, "Body.", revision));

  assert.equal(primitiveDTO.type, "Primitive");
  assert.match((await fileAt(".cw/charter/primitive/guide/no-any/index.md")) ?? "", /description: Never any\./);
});

test("a rewrite over a file changed since it was opened is refused naming it, and the change stays (FR-078)", async () => {
  const { charterAuthoringApp, fileAt, held } = authoring({ [at(".cw/charter/primitive/guide/no-any/index.md")]: guide("no-any") });
  const { hash: revision } = answerOf(await charterAuthoringApp.open("no-any")).data;
  const changedOnDisk = guide("no-any", ["tags: [edited]"]);
  held.write(new URL(at(".cw/charter/primitive/guide/no-any/index.md")), changedOnDisk);

  assert.match(faultTextOf(await charterAuthoringApp.rewrite("no-any", { description: "Mine.", globs: ["src/**"] }, "", revision)), /\.cw\/charter\/primitive\/guide\/no-any\/index\.md changed on disk after it was opened/);
  assert.equal(await fileAt(".cw/charter/primitive/guide/no-any/index.md"), changedOnDisk);
});

test("answers the kind refuses are refused on a rewrite in the words add refuses them in (FR-075)", async () => {
  const sensor = primitive("sensor", "on-stop", ["signal: Stop", "run: pnpm test"]);
  const { charterAuthoringApp, fileAt } = authoring({ [at(".cw/charter/primitive/sensor/on-stop/index.md")]: sensor });
  const { hash: revision } = answerOf(await charterAuthoringApp.open("on-stop")).data;
  const answers = { description: "On stop.", signal: "NotAnEvent", run: "pnpm test", colour: "red" };

  const rewriteFaults = answerOf(await charterAuthoringApp.rewrite("on-stop", answers, "", revision));
  const addFaults = answerOf(await authoring().charterAuthoringApp.add("sensor", "on-stop", answers));

  assert.equal(rewriteFaults.type, "Faults");
  assert.deepEqual(rewriteFaults, addFaults);
  assert.equal(await fileAt(".cw/charter/primitive/sensor/on-stop/index.md"), sensor);
});

test("a vendored or builtin primitive is neither rewritten nor removed, naming where it came from (FR-077)", async () => {
  const vendored = guide("no-any");
  const { charterAuthoringApp, fileAt } = authoring({ [at(".cw/charter/vendor/team/rules/root/primitive/guide/no-any/index.md")]: vendored });
  const { hash: revision } = answerOf(await charterAuthoringApp.open("no-any")).data;

  assert.match(faultTextOf(await charterAuthoringApp.rewrite("no-any", { description: "Mine.", globs: ["src/**"] }, "", revision)), /\.cw\/charter\/vendor\/team\/rules\/root\/primitive\/guide\/no-any\/index\.md is read-only/);
  assert.match(faultTextOf(await charterAuthoringApp.remove("no-any")), /\.cw\/charter\/vendor\/team\/rules\/root\/primitive\/guide\/no-any\/index\.md is read-only/);
  assert.match(faultTextOf(await charterAuthoringApp.remove("cw-author")), /built into cw/);
  assert.equal(await fileAt(".cw/charter/vendor/team/rules/root/primitive/guide/no-any/index.md"), vendored);
});

test("a removed primitive's file is gone and nothing else is, and what named it is dangling at the next check (FR-076)", async () => {
  const hosting = guide("uses-it", ['mixins: ["shared"]']);
  const { charterAuthoringApp, charterRuntimeApp, fileAt } = authoring({
    [at(".cw/charter/primitive/mixin/shared/index.md")]: primitive("mixin", "shared"),
    [at(".cw/charter/primitive/guide/uses-it/index.md")]: hosting,
  });

  const primitiveDTO = answerOf(await charterAuthoringApp.remove("shared"));

  assert.equal(primitiveDTO.data.file, "file:///repo/.cw/charter/primitive/mixin/shared/index.md");
  assert.equal(await fileAt("file:///repo/.cw/charter/primitive/mixin/shared/index.md"), undefined);
  assert.equal(await fileAt("file:///repo/.cw/charter/primitive/guide/uses-it/index.md"), hosting);
  const { data } = answerOf(await charterRuntimeApp.doctor());
  assert.ok(data.faultsByFile.data.files["file:///repo/.cw/charter/primitive/guide/uses-it/index.md"]?.some(({ data: { message } }) => /the mixin "shared"/.test(message)));
});

test("cw remove and cw edit are commands of the command line (FR-109)", () => {
  const names = COMMANDS.map((command) => command.name);
  assert.ok(names.includes("remove <id>"));
  assert.ok(names.includes("edit <id>"));
});

test("cw remove asks first, naming the file, and removes it only on a yes (FR-076, FR-109)", async (t) => {
  const kept = process.stdin.isTTY;
  t.after(() => {
    process.stdin.isTTY = kept;
  });
  process.stdin.isTTY = true;
  const { charterAuthoringApp, fileAt } = authoring({ [at(".cw/charter/primitive/guide/no-any/index.md")]: guide("no-any") });

  prompts.inject([false]);
  const declined = await new RemoveCommand().run(contextOver(charterAuthoringApp), { id: "no-any", yes: false });
  assert.equal(declined.code, EXIT_OK);
  assert.equal(declined.result, "Nothing was removed.\n");
  assert.ok(await fileAt(".cw/charter/primitive/guide/no-any/index.md"));

  prompts.inject([true]);
  const confirmed = await new RemoveCommand().run(contextOver(charterAuthoringApp), { id: "no-any", yes: false });
  assert.match(confirmed.result ?? "", /Removed \.cw\/charter\/primitive\/guide\/no-any\/index\.md\./);
  assert.equal(await fileAt(".cw/charter/primitive/guide/no-any/index.md"), undefined);
});

test("cw remove with nobody at the terminal removes only with --yes (FR-076, FR-109)", async (t) => {
  const kept = process.stdin.isTTY;
  t.after(() => {
    process.stdin.isTTY = kept;
  });
  process.stdin.isTTY = false;
  const { charterAuthoringApp, fileAt } = authoring({ [at(".cw/charter/primitive/guide/no-any/index.md")]: guide("no-any") });

  assert.match((await new RemoveCommand().run(contextOver(charterAuthoringApp), { id: "no-any", yes: false })).problem ?? "", /nobody is at the terminal/);
  assert.ok(await fileAt(".cw/charter/primitive/guide/no-any/index.md"));

  const outcome = await new RemoveCommand().run(contextOver(charterAuthoringApp), { id: "no-any", yes: true });
  assert.equal(outcome.code, EXIT_OK);
  assert.equal(await fileAt(".cw/charter/primitive/guide/no-any/index.md"), undefined);
});

test("text not shaped as an id is refused before the engine is asked (FR-172)", async () => {
  const context = contextOver(authoring().charterAuthoringApp);

  for (const typed of ["guide:no-any", "guide:", ":no-any", "No Any"])
    assert.match((await new RemoveCommand().run(context, { id: typed, yes: true })).problem ?? "", new RegExp(`"${typed}" is not an id`));
  assert.match((await new ExplainCommand().run(context, { id: "guide:no-any" })).problem ?? "", /"guide:no-any" is not an id/);
});

test("cw remove refuses a vendored primitive before asking anything (FR-077)", async () => {
  const { charterAuthoringApp } = authoring({ [at(".cw/charter/vendor/team/rules/root/primitive/guide/theirs/index.md")]: guide("theirs") });

  assert.match((await new RemoveCommand().run(contextOver(charterAuthoringApp), { id: "theirs", yes: false })).problem ?? "", /\.cw\/charter\/vendor\/team\/rules\/root\/primitive\/guide\/theirs\/index\.md is read-only/);
});

test("cw edit refuses with no editor set, and on what the engine brings (FR-109)", async (t) => {
  const kept = { visual: process.env.VISUAL, editor: process.env.EDITOR };
  t.after(() => {
    process.env.VISUAL = kept.visual ?? "";
    process.env.EDITOR = kept.editor ?? "";
  });
  process.env.VISUAL = "";
  process.env.EDITOR = "";
  const context = contextOver(authoring({ [at(".cw/charter/primitive/guide/no-any/index.md")]: guide("no-any") }).charterAuthoringApp);

  assert.match((await new EditCommand().run(context, { id: "no-any" })).problem ?? "", /Neither \$VISUAL nor \$EDITOR is set/);

  process.env.VISUAL = "true";
  assert.match((await new EditCommand().run(context, { id: "cw-author" })).problem ?? "", /built into cw/);
});

test("cw edit hands the primitive's file to $VISUAL and writes nothing itself (FR-109)", async (t) => {
  const scratch = await mkdtemp(join(tmpdir(), "cw-edit-"));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const handedOver = join(scratch, "handed-over");
  const kept = { visual: process.env.VISUAL, editor: process.env.EDITOR };
  t.after(() => {
    process.env.VISUAL = kept.visual ?? "";
    process.env.EDITOR = kept.editor ?? "";
  });
  // An editor that writes down the file it was handed and exits.
  process.env.VISUAL = `node -e "require('node:fs').writeFileSync('${handedOver}', process.argv[1])"`;
  const text = guide("no-any");
  const { charterAuthoringApp, fileAt } = authoring({ [at(".cw/charter/primitive/guide/no-any/index.md")]: text });

  const outcome = await new EditCommand().run(contextOver(charterAuthoringApp), { id: "no-any" });

  assert.equal(outcome.code, EXIT_OK);
  assert.equal(await readFile(handedOver, "utf8"), "/repo/.cw/charter/primitive/guide/no-any/index.md");
  assert.equal(await fileAt(".cw/charter/primitive/guide/no-any/index.md"), text);
});
