import { test } from "node:test";
import assert from "node:assert/strict";
import { primitiveOf, PRIMITIVE_CLASSES, type Primitive } from "../src/hexagon/domain/models/charter/primitive/Primitive.js";
import { CharterPrimitiveFault } from "../src/hexagon/domain/models/DomainFault.js";
import type { DomainFault } from "../src/hexagon/domain/models/DomainFault.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";

const parser = new YamlParser();

const guide = [
  "---",
  "kind: guide",
  "id: no-any",
  "description: Reject the any type in application code.",
  'globs: ["src/**/*.ts"]',
  "---",
  "",
  "Body. Loaded only when the primitive activates.",
  "",
].join("\n");

const corpus = [
  "---",
  "kind: corpus",
  "id: type-safety",
  "description: Why types.",
  "---",
  "",
  "Body.",
  "",
].join("\n");

const primitive = (text: string): Primitive => primitiveOf(text, parser);

/** Everything a reading refused this text for. */
const faultsIn = (text: string): readonly DomainFault[] => {
  try {
    primitiveOf(text, parser);
  } catch (raised) {
    assert.ok(raised instanceof AggregateError, String(raised));
    return raised.errors as readonly DomainFault[];
  }
  return assert.fail("this text was read as a primitive");
};

const messages = (faults: readonly DomainFault[]) => faults.map((one) => one.message).join("\n");

test("the headers and the body are read apart", () => {
  const one = primitive(guide);
  assert.equal(one.headers.id, "no-any");
  assert.deepEqual(one.kind === "guide" ? one.headers.globs : [], ["src/**/*.ts"]);
  assert.equal(one.body, "Body. Loaded only when the primitive activates.");
});

test("a file is read as the kind it declares, wherever it sits", () => {
  assert.equal(primitive(guide).kind, "guide");
  assert.equal(primitive(guide).kind, "guide");
});

test("a file that declares no kind is refused, saying so", () => {
  const text = guide.replace("kind: guide\n", "");
  assert.match(messages(faultsIn(text)), /declares no "kind"/);
});

test("a kind the charter does not know is refused, naming it and listing the ones it knows", () => {
  const [found, ...rest] = faultsIn(guide.replace("kind: guide", "kind: concern"));
  assert.deepEqual(rest, []);
  assert.match(found?.message ?? "", /concern/);
  assert.match(found?.fix ?? "", /playbook/);
});

test("headers the kind refuses are one fault, showing the kind's sample", () => {
  const [found, ...rest] = faultsIn("---\nkind: guide\nid: No Any\n---\n");
  assert.deepEqual(rest, []);
  assert.match(found?.message ?? "", /not what a guide holds/);
  assert.match(found?.fix ?? "", /kind: guide\nid: no-any\ndescription: Reject the any type/);
});

test("every kind's sample reads as that kind, since it is what a refused author is shown", () => {
  for (const one of PRIMITIVE_CLASSES)
    assert.equal(primitiveOf({ headers: { kind: one.kind, ...one.sample }, body: "" }).kind, one.kind);
});

test("a guide that names no files still reads", () => {
  const one = primitive(guide.replace('globs: ["src/**/*.ts"]\n', ""));
  assert.equal(one.headers.globs, undefined);
});

test("a mixin that pulls in mixins of its own is refused", () => {
  const text = corpus.replace("kind: corpus", "kind: mixin").replace("id: type-safety", 'id: type-safety\nmixins: ["base"]');
  assert.match(messages(faultsIn(text)), /not what a mixin holds/);
});

test("a body-only file names the frontmatter it is missing", () => {
  assert.match(messages(faultsIn("Just prose.\n")), /frontmatter block/);
});

test("an unclosed block is a problem, not a body that swallows the headers", () => {
  assert.match(messages(faultsIn("---\nid: no-any\n")), /never closed/);
});

test("an empty block declares no kind, and is refused for that first", () => {
  assert.match(messages(faultsIn("---\n---\nBody.\n")), /declares no "kind"/);
});

test("frontmatter that is not a list of named headers is reported as such", () => {
  assert.throws(() => primitiveOf("---\n- one\n- two\n---\n", parser), CharterPrimitiveFault);
  assert.throws(() => primitiveOf("---\nid: [unclosed\n---\n", parser), CharterPrimitiveFault);
});

test("a delimiter inside the body does not reopen the frontmatter", () => {
  const text = ["---", "kind: corpus", "id: no-any", "description: A rule.", "---", "", "Before.", "", "---", "", "After.", ""].join("\n");
  assert.equal(primitive(text).body, "Before.\n\n---\n\nAfter.");
});

test("the same text reads as the same primitive, every time", () => {
  assert.deepEqual(primitiveOf(guide, parser), primitiveOf(guide, parser));
});

test("an agent's model is written <provider>:<model>, the provider one this engine compiles for", () => {
  const agentText = (model: string) =>
    ["---", "kind: agent", "id: locator", "description: Find the code.", 'tools: ["Read"]', `model: "${model}"`, "---", "", "Find it.", ""].join("\n");

  const agentPrimitive = primitive(agentText("claude:haiku-4-5"));
  assert.equal(agentPrimitive.kind === "agent" ? agentPrimitive.headers.model : undefined, "claude:haiku-4-5");
  for (const model of ["haiku-4-5", "claude:", "codex:gpt-5"]) {
    assert.match(messages(faultsIn(agentText(model))), /<provider>:<model>/, model);
  }
});

test("a mixin's position is start or end, and nothing else", () => {
  const mixinText = (position: string) =>
    ["---", "kind: mixin", "id: house-style", "description: What every rule here shares.", `position: ${position}`, "---", "", "Lent.", ""].join("\n");

  const mixinPrimitive = primitive(mixinText("end"));
  assert.equal(mixinPrimitive.kind === "mixin" ? mixinPrimitive.headers.position : undefined, "end");
  assert.match(messages(faultsIn(mixinText("middle"))), /not what a mixin holds/);
});
