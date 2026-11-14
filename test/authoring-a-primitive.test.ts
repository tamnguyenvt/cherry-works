import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import prompts from "prompts";
import type { AuthoringCharter } from "../src/module/charter/app/authoring-charter.use-case.js";
import { CharterDTOs } from "../src/module/charter/app/port/in/charter.dto.js";
import { CwAuthorSkill } from "../src/module/charter/domain/builtin/cw-author-skill.js";
import { ContentHelper } from "../src/module/charter/domain/helper.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { EXIT_OK } from "../src/presentation/cli/commands/command.interface.js";
import { EditCommand } from "../src/presentation/cli/commands/edit.command.js";
import { ExplainCommand } from "../src/presentation/cli/commands/explain.command.js";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { RemoveCommand } from "../src/presentation/cli/commands/remove.command.js";
import { answerOf, faultTextOf } from "./answer-of.js";
import { authoringCharterOf, buildingCharterOf, commandContextOf } from "./use-cases-of.js";

const repoPath = new URL("file:///repo/");
const at = (path: string) => new URL(path, repoPath).href;

const primitive = (kind: string, id: string, headers: readonly string[] = [], body = `The body of ${id}.`) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: About ${id}.`, ...headers, "---", "", body, ""].join("\n");

const guide = (id: string, headers: readonly string[] = []) =>
  primitive("guide", id, ['globs: ["src/**/*.ts"]', ...headers]);

/** The engine over one repository held in memory, and the files it holds, so a
 *  test reads back what was written and changes what is on disk between two
 *  calls. */
const authoring = (files: Readonly<Record<string, string>> = {}) => {
  const held = new InMemoryFileReaders(files);
  const charterAuthoringApp = authoringCharterOf(held, new InMemoryFileOutput(held), new InMemoryReporter());
  const charterRuntimeApps = buildingCharterOf(
    held,
    new InMemoryFileOutput(held),
    new InMemoryTokenCounter(),
    { claude: new InMemoryAgentCli() },
    new InMemoryReporter(),
  );
  return {
    charterAuthoringApp,
    charterRuntimeApps,
    held,
    fileAt: (path: string) => held.readIfThere(new URL(path, repoPath)),
  };
};

/** What each command runs with. Its `run` is called as the command line calls
 *  it, and what it answers is read off the outcome it returns rather than off
 *  a captured stdout, which the test runner reports through too. */
const contextOver = (charterAuthoringApp: AuthoringCharter) =>
  commandContextOf({
    charterAuthoringApp,
    charterRuntimeApp: buildingCharterOf(
      new InMemoryFileReaders({}),
      new InMemoryFileOutput(new InMemoryFileReaders({})),
      new InMemoryTokenCounter(),
      { claude: new InMemoryAgentCli() },
      new InMemoryReporter(),
    ),
  });

test("a primitive added with a body is the file cw add writes, with the body under its headers (FR-117)", async () => {
  const withBody = authoring();
  const withoutBody = authoring();
  const headers = { description: "No any.", globs: ["src/**/*.ts"] };

  await withBody.charterAuthoringApp.addPrimitive("guide", "no-any", headers, "# No any\n\nNever write `any`.");
  await withoutBody.charterAuthoringApp.addPrimitive("guide", "no-any", headers);

  const savedPrimitiveText = (await withBody.fileAt(".cw/charter/primitive/guide/no-any/index.md")) ?? "";
  const scaffolded = (await withoutBody.fileAt(".cw/charter/primitive/guide/no-any/index.md")) ?? "";
  assert.equal(savedPrimitiveText, `${scaffolded.trimEnd()}\n\n# No any\n\nNever write \`any\`.\n`);
});

test("a disable-user-invocation answered as a line is written as the yes or no it is, and read back so (CORE-FR-173)", async () => {
  const { charterAuthoringApp, fileAt } = authoring();

  await charterAuthoringApp.addPrimitive("skill", "ship-review", {
    description: "Review what ships.",
    triggers: ["review the release"],
    "disable-user-invocation": "true",
  });

  const savedPrimitiveText = (await fileAt(".cw/charter/primitive/skill/ship-review/index.md")) ?? "";
  assert.match(savedPrimitiveText, /\ndisable-user-invocation: true\n/);
  const { data: openedPrimitive } = CharterDTOs.Primitive.parse(await charterAuthoringApp.openPrimitive("ship-review"));
  assert.equal(openedPrimitive.headers["disable-user-invocation"], "true");
});

test("an id another layer already holds is refused naming its file, and nothing is written (FR-014, CORE Story 10 scenario 5)", async () => {
  const { charterAuthoringApp, fileAt } = authoring({
    [at(".cw/charter/vendor/team/rules/root/primitive/guide/no-any/index.md")]: guide("no-any"),
  });

  assert.match(
    faultTextOf(await charterAuthoringApp.addPrimitive("guide", "no-any", { description: "Mine.", globs: ["src/**"] })),
    /"no-any" is already there, declared by file:\/\/\/repo\/\.cw\/charter\/vendor\/team\/rules\/root\/primitive\/guide\/no-any\/index\.md/,
  );
  assert.match(
    faultTextOf(
      await charterAuthoringApp.addPrimitive("skill", "cw-author", { description: "Mine.", triggers: ["write"] }),
    ),
    /declared by \(built into cw\)\/skill\/cw-author\/index\.md/,
  );
  assert.equal(await fileAt("file:///repo/.cw/charter/primitive/guide/no-any/index.md"), undefined);
});

test("a primitive opens with its headers, body, file, layer and revision, whatever else is wrong (FR-075)", async () => {
  const text = guide("no-any", ["rationale: why"]);
  const { charterAuthoringApp } = authoring({
    [at(".cw/charter/primitive/guide/no-any/index.md")]: text,
    [at(".cw/charter/primitive/guide/broken/index.md")]: guide("broken", ['mixins: ["nowhere"]']),
  });

  const { data: openedPrimitive } = CharterDTOs.Primitive.parse(await charterAuthoringApp.openPrimitive("no-any"));

  // The hash is of the primitive written out, which is what a save writes.
  assert.equal(openedPrimitive.hash, ContentHelper.createContentHash(text));
  assert.equal(openedPrimitive.body, "The body of no-any.");
  assert.equal(openedPrimitive.file, "file:///repo/.cw/charter/primitive/guide/no-any/index.md");
  assert.equal(openedPrimitive.layerName, "repo");
  assert.deepEqual(openedPrimitive.headers.globs, ["src/**/*.ts"]);
  assert.equal(openedPrimitive.headers.rationale, "why");
});

test("a vendored and a builtin primitive open too, each under its own layer", async () => {
  const { charterAuthoringApp } = authoring({
    [at(".cw/charter/vendor/team/rules/root/primitive/guide/no-any/index.md")]: guide("no-any"),
  });

  const vendorPrimitiveDTO = answerOf(await charterAuthoringApp.openPrimitive("no-any")).data;
  assert.equal(vendorPrimitiveDTO.layerName, "vendor");
  assert.equal(
    vendorPrimitiveDTO.file,
    "file:///repo/.cw/charter/vendor/team/rules/root/primitive/guide/no-any/index.md",
  );

  const builtin = answerOf(await charterAuthoringApp.openPrimitive("cw-author")).data;
  assert.equal(builtin.layerName, "builtin");
  assert.match(builtin.hash, /^[0-9a-f]{16}$/);
});

test("what the engine brings is read as the running engine says it, whatever an earlier engine's build left behind, with nothing to refresh (CORE Story 12 scenario 3, FR-018, CORE Story 55 scenario 8)", async () => {
  const { charterAuthoringApp, charterRuntimeApps, fileAt } = authoring({
    [at(".cw/settings.json")]: `${JSON.stringify({ agents: ["claude"] })}\n`,
    [at(".cw/out/skill/cw-author/index.md")]: "What an earlier engine said.\n",
    [at(".claude/skills/cw-author/SKILL.md")]: "---\nname: cw-author\n---\n\nWhat an earlier engine said.\n",
  });

  const builtinPrimitiveDTO = answerOf(await charterAuthoringApp.openPrimitive("cw-author")).data;
  assert.equal(builtinPrimitiveDTO.body, new CwAuthorSkill().body);
  assert.equal(builtinPrimitiveDTO.layerName, "builtin");

  // The next build writes the running engine's word over the earlier one's.
  answerOf(await charterRuntimeApps.buildCharter());
  assert.doesNotMatch((await fileAt(".claude/skills/cw-author/SKILL.md")) ?? "", /What an earlier engine said/);
  assert.ok(((await fileAt(".cw/out/skill/cw-author/index.md")) ?? "").includes(new CwAuthorSkill().body.trim()));
});

test("an id the charter holds nothing of opens nothing", async () => {
  assert.match(faultTextOf(await authoring().charterAuthoringApp.openPrimitive("nowhere")), /holds no "nowhere"/);
});

test("a rewrite at the revision opened replaces the headers and body, keeping kind, id and file (FR-075)", async () => {
  // Written somewhere other than the convention: where a file sits says only
  // that it is looked at, so a rewrite leaves it there.
  const { charterAuthoringApp, fileAt, held } = authoring({
    [at(".cw/charter/primitive/guide/no-any/index.md")]: guide("no-any"),
    [at(".cw/charter/primitive/corpus/why/index.md")]: primitive("corpus", "why"),
  });
  const filesOnDisk = async () =>
    new Map((await held.readFilesRecursively(repoPath)).map(({ fileUrl, contents }) => [fileUrl.href, contents]));
  const before = await filesOnDisk();
  const { hash: revision } = answerOf(await charterAuthoringApp.openPrimitive("no-any")).data;

  const primitiveDTO = await charterAuthoringApp.rewritePrimitive(
    "no-any",
    { description: "Never any.", globs: ["src/**/*.ts", "test/**/*.ts"] },
    "Use unknown.",
    revision,
  );

  assert.equal(primitiveDTO.type, "Primitive");
  const rewritten = (await fileAt(".cw/charter/primitive/guide/no-any/index.md")) ?? "";
  assert.match(
    rewritten,
    /^---\nkind: guide\nid: no-any\ndescription: Never any\.\nglobs: \["src\/\*\*\/\*\.ts", "test\/\*\*\/\*\.ts"\]\n---\n\nUse unknown\.\n$/,
  );
  // Nothing else on disk moved.
  assert.deepEqual([...(await filesOnDisk()).keys()].sort(), [...before.keys()].sort());
  assert.equal(
    await fileAt(".cw/charter/primitive/corpus/why/index.md"),
    before.get(at(".cw/charter/primitive/corpus/why/index.md")),
  );
});

test("a file written by hand in another layout saves at the revision it opened at (FR-078)", async () => {
  // A list written as a block and a comment: the same primitive, not the text
  // `writeMarkdown()` writes.
  const byHand = [
    "---",
    "kind: guide",
    "id: no-any",
    "# why this exists",
    "description: About no-any.",
    "globs:",
    "  - src/**/*.ts",
    "---",
    "",
    "Body.",
    "",
  ].join("\n");
  const { charterAuthoringApp, fileAt } = authoring({ [at(".cw/charter/primitive/guide/no-any/index.md")]: byHand });
  const { hash: revision } = answerOf(await charterAuthoringApp.openPrimitive("no-any")).data;

  const primitiveDTO = answerOf(
    await charterAuthoringApp.rewritePrimitive(
      "no-any",
      { description: "Never any.", globs: ["src/**"] },
      "Body.",
      revision,
    ),
  );

  assert.equal(primitiveDTO.type, "Primitive");
  assert.match((await fileAt(".cw/charter/primitive/guide/no-any/index.md")) ?? "", /description: Never any\./);
});

test("a rewrite over a file changed since it was opened is refused naming it, and the change stays (FR-078)", async () => {
  const { charterAuthoringApp, fileAt, held } = authoring({
    [at(".cw/charter/primitive/guide/no-any/index.md")]: guide("no-any"),
  });
  const { hash: revision } = answerOf(await charterAuthoringApp.openPrimitive("no-any")).data;
  const changedOnDisk = guide("no-any", ["tags: [edited]"]);
  held.writeFile(new URL(at(".cw/charter/primitive/guide/no-any/index.md")), changedOnDisk);

  assert.match(
    faultTextOf(
      await charterAuthoringApp.rewritePrimitive("no-any", { description: "Mine.", globs: ["src/**"] }, "", revision),
    ),
    /\.cw\/charter\/primitive\/guide\/no-any\/index\.md changed on disk after it was opened/,
  );
  assert.equal(await fileAt(".cw/charter/primitive/guide/no-any/index.md"), changedOnDisk);
});

test("answers the kind refuses are refused on a rewrite in the words add refuses them in (FR-075)", async () => {
  const sensor = primitive("sensor", "on-stop", ["signal: Stop", "run: pnpm test"]);
  const { charterAuthoringApp, fileAt } = authoring({ [at(".cw/charter/primitive/sensor/on-stop/index.md")]: sensor });
  const { hash: revision } = answerOf(await charterAuthoringApp.openPrimitive("on-stop")).data;
  const answers = { description: "On stop.", signal: "NotAnEvent", run: "pnpm test", colour: "red" };

  const rewriteFaults = answerOf(await charterAuthoringApp.rewritePrimitive("on-stop", answers, "", revision));
  const addFaults = answerOf(await authoring().charterAuthoringApp.addPrimitive("sensor", "on-stop", answers));

  assert.equal(rewriteFaults.type, "Faults");
  assert.deepEqual(rewriteFaults, addFaults);
  assert.equal(await fileAt(".cw/charter/primitive/sensor/on-stop/index.md"), sensor);
});

test("a vendored or builtin primitive is neither rewritten nor removed, naming where it came from (FR-077)", async () => {
  const vendorGuideText = guide("no-any");
  const { charterAuthoringApp, fileAt } = authoring({
    [at(".cw/charter/vendor/team/rules/root/primitive/guide/no-any/index.md")]: vendorGuideText,
  });
  const { hash: revision } = answerOf(await charterAuthoringApp.openPrimitive("no-any")).data;

  assert.match(
    faultTextOf(
      await charterAuthoringApp.rewritePrimitive("no-any", { description: "Mine.", globs: ["src/**"] }, "", revision),
    ),
    /\.cw\/charter\/vendor\/team\/rules\/root\/primitive\/guide\/no-any\/index\.md is read-only/,
  );
  assert.match(
    faultTextOf(await charterAuthoringApp.removePrimitive("no-any")),
    /\.cw\/charter\/vendor\/team\/rules\/root\/primitive\/guide\/no-any\/index\.md is read-only/,
  );
  assert.match(faultTextOf(await charterAuthoringApp.removePrimitive("cw-author")), /built into cw/);
  assert.equal(await fileAt(".cw/charter/vendor/team/rules/root/primitive/guide/no-any/index.md"), vendorGuideText);
});

test("a removed primitive's file is gone and nothing else is, and what named it is dangling at the next check (FR-076)", async () => {
  const hosting = guide("uses-it", ['mixins: ["shared"]']);
  const { charterAuthoringApp, charterRuntimeApps, fileAt } = authoring({
    [at(".cw/charter/primitive/mixin/shared/index.md")]: primitive("mixin", "shared"),
    [at(".cw/charter/primitive/guide/uses-it/index.md")]: hosting,
  });

  const primitiveDTO = answerOf(await charterAuthoringApp.removePrimitive("shared"));

  assert.equal(primitiveDTO.data.file, "file:///repo/.cw/charter/primitive/mixin/shared/index.md");
  assert.equal(await fileAt("file:///repo/.cw/charter/primitive/mixin/shared/index.md"), undefined);
  assert.equal(await fileAt("file:///repo/.cw/charter/primitive/guide/uses-it/index.md"), hosting);
  const { data: charterDiagnosis } = answerOf(await charterRuntimeApps.diagnoseCharter());
  assert.ok(
    charterDiagnosis.faultsByFile.data.files["file:///repo/.cw/charter/primitive/guide/uses-it/index.md"]?.some(
      ({ data: { message } }) => /the mixin "shared"/.test(message),
    ),
  );
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
  const { charterAuthoringApp, fileAt } = authoring({
    [at(".cw/charter/primitive/guide/no-any/index.md")]: guide("no-any"),
  });

  prompts.inject([false]);
  const declinedRemoveOutcome = await new RemoveCommand().runCommand(contextOver(charterAuthoringApp), {
    id: "no-any",
    yes: false,
  });
  assert.equal(declinedRemoveOutcome.exitCode, EXIT_OK);
  assert.equal(declinedRemoveOutcome.resultText, "Nothing was removed.\n");
  assert.ok(await fileAt(".cw/charter/primitive/guide/no-any/index.md"));

  prompts.inject([true]);
  const confirmedRemoveOutcome = await new RemoveCommand().runCommand(contextOver(charterAuthoringApp), {
    id: "no-any",
    yes: false,
  });
  assert.match(confirmedRemoveOutcome.resultText ?? "", /Removed \.cw\/charter\/primitive\/guide\/no-any\/index\.md\./);
  assert.equal(await fileAt(".cw/charter/primitive/guide/no-any/index.md"), undefined);
});

test("cw remove with nobody at the terminal removes only with --yes (FR-076, FR-109)", async (t) => {
  const kept = process.stdin.isTTY;
  t.after(() => {
    process.stdin.isTTY = kept;
  });
  process.stdin.isTTY = false;
  const { charterAuthoringApp, fileAt } = authoring({
    [at(".cw/charter/primitive/guide/no-any/index.md")]: guide("no-any"),
  });

  assert.match(
    (await new RemoveCommand().runCommand(contextOver(charterAuthoringApp), { id: "no-any", yes: false }))
      .problemText ?? "",
    /nobody is at the terminal/,
  );
  assert.ok(await fileAt(".cw/charter/primitive/guide/no-any/index.md"));

  const outcome = await new RemoveCommand().runCommand(contextOver(charterAuthoringApp), { id: "no-any", yes: true });
  assert.equal(outcome.exitCode, EXIT_OK);
  assert.equal(await fileAt(".cw/charter/primitive/guide/no-any/index.md"), undefined);
});

test("text not shaped as an id is refused before the engine is asked (FR-172)", async () => {
  const context = contextOver(authoring().charterAuthoringApp);

  for (const typed of ["guide:no-any", "guide:", ":no-any", "No Any"])
    assert.match(
      (await new RemoveCommand().runCommand(context, { id: typed, yes: true })).problemText ?? "",
      new RegExp(`"${typed}" is not an id`),
    );
  assert.match(
    (await new ExplainCommand().runCommand(context, { id: "guide:no-any" })).problemText ?? "",
    /"guide:no-any" is not an id/,
  );
});

test("cw remove refuses a vendored primitive before asking anything (FR-077)", async () => {
  const { charterAuthoringApp } = authoring({
    [at(".cw/charter/vendor/team/rules/root/primitive/guide/theirs/index.md")]: guide("theirs"),
  });

  assert.match(
    (await new RemoveCommand().runCommand(contextOver(charterAuthoringApp), { id: "theirs", yes: false }))
      .problemText ?? "",
    /\.cw\/charter\/vendor\/team\/rules\/root\/primitive\/guide\/theirs\/index\.md is read-only/,
  );
});

test("cw edit refuses with no editor set, and on what the engine brings (FR-109)", async (t) => {
  const kept = { visual: process.env.VISUAL, editor: process.env.EDITOR };
  t.after(() => {
    process.env.VISUAL = kept.visual ?? "";
    process.env.EDITOR = kept.editor ?? "";
  });
  process.env.VISUAL = "";
  process.env.EDITOR = "";
  const context = contextOver(
    authoring({ [at(".cw/charter/primitive/guide/no-any/index.md")]: guide("no-any") }).charterAuthoringApp,
  );

  assert.match(
    (await new EditCommand().runCommand(context, { id: "no-any" })).problemText ?? "",
    /Neither \$VISUAL nor \$EDITOR is set/,
  );

  process.env.VISUAL = "true";
  assert.match((await new EditCommand().runCommand(context, { id: "cw-author" })).problemText ?? "", /built into cw/);
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

  const outcome = await new EditCommand().runCommand(contextOver(charterAuthoringApp), { id: "no-any" });

  assert.equal(outcome.exitCode, EXIT_OK);
  assert.equal(await readFile(handedOver, "utf8"), "/repo/.cw/charter/primitive/guide/no-any/index.md");
  assert.equal(await fileAt(".cw/charter/primitive/guide/no-any/index.md"), text);
});
