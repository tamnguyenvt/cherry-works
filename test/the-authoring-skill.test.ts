import { test } from "node:test";
import assert from "node:assert/strict";
import { CwAuthorSkill } from "../src/hexagon/domain/models/charter/builtin/CwAuthorSkill.js";
import { PRIMITIVE_CLASSES } from "../src/hexagon/domain/models/charter/primitive/Primitive.js";
import { COMMANDS } from "../src/driver/cli/commands/index.js";

const skillBody = new CwAuthorSkill().body;

test("the body names no header of any kind, so a kind can change without it (FR-023, SC-002)", () => {
  const headerNames = [...new Set(PRIMITIVE_CLASSES.flatMap((one) => Object.keys(one.schema.shape)))];

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

  assert.deepEqual(namedCommands.filter((name) => !commandNames.includes(name ?? "")), []);
});

test("the body says the procedure in order: ask the kind, add with flags, build (FR-024)", () => {
  const steps = ["`cw kinds`", "`cw kinds <kind>`", "`cw add <kind> <id> --header <name>=<value>`", "`cw build`"];

  const positions = steps.map((step) => skillBody.indexOf(step));

  assert.ok(positions.every((position) => position >= 0), `missing a step: ${JSON.stringify(positions)}`);
  assert.deepEqual([...positions].sort((left, right) => left - right), positions);
});

test("the body says whose it is, and what it does not cover (FR-025, FR-027)", () => {
  assert.match(skillBody, /not authored in this\s+repository/);
  assert.match(skillBody, /writes a primitive of its own/);
  assert.match(skillBody, /Changing or removing one that already exists\s+is not what it covers/);
});

test("the skill the engine brings is of the engine's layer, at the name that layer gives its files (FR-015, FR-018)", () => {
  const cwAuthorSkill = new CwAuthorSkill();

  assert.equal(cwAuthorSkill.layerName, "builtin");
  assert.equal(cwAuthorSkill.file, "(built into cw)/skill/cw-author/index.md");
});
