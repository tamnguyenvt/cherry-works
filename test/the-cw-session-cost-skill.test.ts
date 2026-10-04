import { test } from "node:test";
import assert from "node:assert/strict";
import { CwSessionCostSkill } from "../src/hexagon/domain/models/charter/builtin/CwSessionCostSkill.js";
import { BUILTIN_PRIMITIVES } from "../src/hexagon/domain/models/charter/builtin/index.js";
import { COMMANDS } from "../src/driver/cli/commands/index.js";

const cwSessionCostSkill = new CwSessionCostSkill();
const skillBody = cwSessionCostSkill.body;

test("the engine brings a skill that answers what the kept sessions cost, of its own layer (EVAL-FR-014)", () => {
  assert.ok(BUILTIN_PRIMITIVES.some((builtinPrimitive) => builtinPrimitive.headers.id === "cw-session-cost"));
  assert.equal(cwSessionCostSkill.layerName, "builtin");
  assert.equal(cwSessionCostSkill.file, "(built into cw)/skill/cw-session-cost/index.md");
  assert.ok(cwSessionCostSkill.headers.triggers.length > 0);
});

test("the body reads the sessions through the summary, by a command cw answers with each option it takes (EVAL-FR-014)", () => {
  const sessionsCommand = COMMANDS.find((command) => command.name === "sessions")!;

  assert.match(skillBody, /`cw sessions --json`/);
  const namedCommands = [...skillBody.matchAll(/`cw ([a-z]+)/g)].map(([, name]) => name);
  assert.deepEqual(namedCommands.filter((name) => !COMMANDS.some((command) => command.name.split(" ")[0] === name)), []);
  const namedOptions = [...skillBody.matchAll(/`cw sessions[^`]*`/g)].flatMap(([commandLine]) => [...commandLine.matchAll(/--([a-z]+)/g)].map(([, option]) => option));
  assert.deepEqual(namedOptions.filter((option) => !(option! in sessionsCommand.options)), []);
});

test("the body asks for typed or published prices, and names the prices used and where and when they were read (EVAL-FR-014)", () => {
  assert.match(skillBody, /type/i);
  assert.match(skillBody, /published/);
  assert.match(skillBody, /where and when/);
  for (const tokenKind of ["input", "output", "cacheWrite", "cacheRead"]) assert.match(skillBody, new RegExp(`\`${tokenKind}\``));
  assert.match(skillBody, /each session/);
  assert.match(skillBody, /each day/);
});

test("the body answers a model no price is known for with its tokens and an unknown cost, never a guess (EVAL-FR-015)", () => {
  assert.match(skillBody, /unknown/);
  assert.match(skillBody, /[Nn]ever guess/);
});

test("the body says the engine prices nothing (EVAL-FR-014)", () => {
  assert.match(skillBody, /cw prices nothing/);
});
