import assert from "node:assert/strict";
import { test } from "node:test";
import { CwAuthorSkill } from "../src/module/charter/domain/builtin/cw-author-skill.js";
import { Primitives } from "../src/module/charter/domain/models/primitive/primitive.js";
import { CharterOutputService } from "../src/module/charter/domain/services/charter-output.service.js";
import { AgentProvider } from "../src/module/shared/domain/value-objects/agent-provider.value-object.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { putDownBy } from "./put-down-by.js";
import { loadCharterRoot } from "./use-cases-of.js";

const skillBody = new CwAuthorSkill().body;

test("the body names no header of any kind, so a kind can change without it (FR-023, SC-002)", () => {
  const headerNames = [...new Set(Primitives.classes.flatMap((one) => Object.keys(one.schema.shape)))];

  // A header named as a header is written: `name: value`, `name=value`, or
  // `name` on its own. The same word in a sentence is only a word.
  const namedHeaders = headerNames.filter((name) =>
    new RegExp(`(^|[^\\w<-])${name}[:=]|\`${name}\``, "m").test(skillBody),
  );

  assert.ok(headerNames.length > 0);
  assert.deepEqual(namedHeaders, []);
});

test("every command the body names is one cw answers", () => {
  const commandNames = COMMANDS.map((one) => one.name.split(" ")[0]);

  const namedCommands = [...skillBody.matchAll(/`cw ([a-z]+)/g)].map(([, name]) => name);

  assert.deepEqual(
    namedCommands.filter((name) => !commandNames.includes(name ?? "")),
    [],
  );
});

test("the body says the procedure in order: ask the kind, add with flags, build (FR-024)", () => {
  const steps = ["`cw kinds`", "`cw kinds <kind>`", "`cw add <kind> <id> --header <name>=<value>`", "`cw build`"];

  const positions = steps.map((step) => skillBody.indexOf(step));

  assert.ok(
    positions.every((position) => position >= 0),
    `missing a step: ${JSON.stringify(positions)}`,
  );
  assert.deepEqual(
    [...positions].sort((left, right) => left - right),
    positions,
  );
});

test("the body says whose it is, and what it does not cover (FR-025, FR-027)", () => {
  assert.match(skillBody, /not authored in this\s+repository/);
  assert.match(skillBody, /writes a primitive of its own/);
  assert.match(skillBody, /Changing or removing one that already exists\s+is not what it covers/);
});

test("the skill the engine brings is of the engine's layer, at the name that layer gives its files (FR-015, FR-018)", () => {
  const cwAuthorSkill = new CwAuthorSkill();

  assert.equal(cwAuthorSkill.layer.name, "builtin");
  assert.equal(cwAuthorSkill.uri, "(built into cw)/skill/cw-author/index.md");
});

test("the skill as each agent reads it comes up for writing any primitive, and sends a refusal to be answered and a refused build to cw doctor (CORE Story 56 scenario 4)", async () => {
  const skillFileReaders = new InMemoryFileReaders({});
  const charterRoot = await loadCharterRoot(skillFileReaders);
  await putDownBy(
    charterRoot,
    CharterOutputService.compileCharterRoot(charterRoot, [new AgentProvider("claude"), new AgentProvider("codex")]),
    skillFileReaders,
  );
  const readText = async (path: string) => (await skillFileReaders.readIfThere(new URL(path, "file:///repo/"))) ?? "";

  for (const skillPath of [".claude/skills/cw-author/SKILL.md", ".agents/skills/cw-author/SKILL.md"])
    assert.match(
      await readText(skillPath),
      /Use when: write a rule; add a standard; write a skill; author a primitive of the charter\./,
      skillPath,
    );
  const compiledBody = (await readText(".cw/out/skill/cw-author/index.md")).replace(/\s+/g, " ");
  assert.match(
    compiledBody,
    /Run `cw add <kind> <id>[^.]*\. .*If cw refuses, it says why and shows the kind's sample: answer again with that in hand\./,
  );
  assert.match(
    compiledBody,
    /Run `cw build`\. If it refuses, `cw doctor` names each file with a problem and how to fix it\./,
  );
});
