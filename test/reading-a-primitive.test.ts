import assert from "node:assert/strict";
import { test } from "node:test";
import { InvalidPrimitiveFault } from "../src/module/charter/domain/models/charter.fault.js";
import { type Primitive, Primitives } from "../src/module/charter/domain/models/primitive/primitive.js";
import { type DomainFault, UnsoundModelFault } from "../src/module/shared/domain/models/domain.fault.js";
import { AgentProvider } from "../src/module/shared/domain/value-objects/agent-provider.value-object.js";
import { charterRootOf, readPrimitive } from "./use-cases-of.js";

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

const corpus = ["---", "kind: corpus", "id: type-safety", "description: Why types.", "---", "", "Body.", ""].join("\n");

const primitive = (text: string): Primitive => readPrimitive(text);

/** Everything a reading refused this text for. */
const faultsIn = (text: string): readonly DomainFault[] => {
  try {
    readPrimitive(text);
  } catch (raised) {
    assert.ok(raised instanceof UnsoundModelFault, String(raised));
    return raised.faults as readonly DomainFault[];
  }
  return assert.fail("this text was read as a primitive");
};

const messages = (faults: readonly DomainFault[]) => faults.map((fault) => fault.message).join("\n");

test("the headers and the body are read apart", () => {
  const guidePrimitive = primitive(guide);
  assert.equal(guidePrimitive.headers.id, "no-any");
  assert.deepEqual(guidePrimitive.kind === "guide" ? guidePrimitive.headers.globs : [], ["src/**/*.ts"]);
  assert.equal(guidePrimitive.body, "Body. Loaded only when the primitive activates.");
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
  const [kindFault, ...otherFaults] = faultsIn(guide.replace("kind: guide", "kind: concern"));
  assert.deepEqual(otherFaults, []);
  assert.match(kindFault?.message ?? "", /concern/);
  assert.match(kindFault?.fix ?? "", /playbook/);
});

test("headers the kind refuses are one fault, showing the kind's sample", () => {
  const [kindFault, ...otherFaults] = faultsIn("---\nkind: guide\nid: No Any\n---\n");
  assert.deepEqual(otherFaults, []);
  assert.match(kindFault?.message ?? "", /not what a guide holds/);
  assert.match(kindFault?.fix ?? "", /kind: guide\nid: no-any\ndescription: Reject the any type/);
});

test("every kind's sample reads as that kind, since it is what a refused author is shown", () => {
  for (const primitiveClass of Primitives.classes)
    assert.equal(
      readPrimitive({ headers: { kind: primitiveClass.kind, ...primitiveClass.sample }, body: "" }).kind,
      primitiveClass.kind,
    );
});

test("a guide that names no files still reads", () => {
  const guidePrimitive = primitive(guide.replace('globs: ["src/**/*.ts"]\n', ""));
  assert.equal(guidePrimitive.headers.globs, undefined);
});

test("a mixin that pulls in mixins of its own is refused", () => {
  const text = corpus
    .replace("kind: corpus", "kind: mixin")
    .replace("id: type-safety", 'id: type-safety\nmixins: ["base"]');
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
  assert.throws(() => readPrimitive("---\n- one\n- two\n---\n"), InvalidPrimitiveFault);
  assert.throws(() => readPrimitive("---\nid: [unclosed\n---\n"), InvalidPrimitiveFault);
});

test("a delimiter inside the body does not reopen the frontmatter", () => {
  const text = [
    "---",
    "kind: corpus",
    "id: no-any",
    "description: A rule.",
    "---",
    "",
    "Before.",
    "",
    "---",
    "",
    "After.",
    "",
  ].join("\n");
  assert.equal(primitive(text).body, "Before.\n\n---\n\nAfter.");
});

test("the same text reads as the same primitive, every time", () => {
  assert.deepEqual(readPrimitive(guide), readPrimitive(guide));
});

test("an agent's model is written <provider>:<model>, the provider one of the agents the charter is compiled for", () => {
  const agentText = (model: string) =>
    [
      "---",
      "kind: agent",
      "id: locator",
      "description: Find the code.",
      'tools: ["Read"]',
      `model: "${model}"`,
      "---",
      "",
      "Find it.",
      "",
    ].join("\n");

  const agentPrimitive = primitive(agentText("claude:haiku-4-5"));
  assert.equal(agentPrimitive.kind === "agent" ? agentPrimitive.headers.model : undefined, "claude:haiku-4-5");
  for (const model of ["haiku-4-5", "claude:"]) {
    assert.match(messages(faultsIn(agentText(model))), /<provider>:<model>/, model);
  }
  // Which agents there are is known where the charter is compiled, not where it is read.
  const unknownModelPrimitive = primitive(agentText("unknown:gpt-5"));
  const [agentFault] = Object.values(
    charterRootOf([unknownModelPrimitive]).agentFaultsByFilesOf(["claude", "codex"]).faultsByFilePath,
  ).flat();
  assert.match(agentFault?.message ?? "", /"model" names "unknown"/);
});

test("a mixin's position is start or end, and nothing else", () => {
  const mixinText = (position: string) =>
    [
      "---",
      "kind: mixin",
      "id: house-style",
      "description: What every rule here shares.",
      `position: ${position}`,
      "---",
      "",
      "Lent.",
      "",
    ].join("\n");

  const mixinPrimitive = primitive(mixinText("end"));
  assert.equal(mixinPrimitive.kind === "mixin" ? mixinPrimitive.headers.position : undefined, "end");
  assert.match(messages(faultsIn(mixinText("middle"))), /not what a mixin holds/);
});

test("posture and sensor support agent-provider, with omitted and empty lists supporting all hosts", () => {
  for (const primitiveClass of Primitives.classes.filter((primitiveClass) =>
    ["posture", "sensor"].includes(primitiveClass.kind),
  )) {
    for (const agentProviders of [undefined, [], ["claude"], ["codex"], ["claude", "codex"]]) {
      const charterPrimitive = readPrimitive({
        headers: {
          kind: primitiveClass.kind,
          ...primitiveClass.sample,
          ...(agentProviders === undefined ? {} : { "agent-provider": agentProviders }),
        },
        body: "Provider-specific instructions.",
      });
      for (const agent of [new AgentProvider("claude"), new AgentProvider("codex")])
        assert.equal(
          charterPrimitive.supportsAgent(agent),
          !agentProviders?.length || agentProviders.includes(agent.name),
          primitiveClass.kind,
        );
      const rereadPrimitive = readPrimitive(charterPrimitive.writeMarkdown());
      assert.ok(rereadPrimitive.kind === "posture" || rereadPrimitive.kind === "sensor");
      assert.deepEqual(rereadPrimitive.headers["agent-provider"], agentProviders);
    }
  }
});

test("only posture and sensor accept agent-provider in authored files and authoring requests", () => {
  for (const primitiveClass of Primitives.classes) {
    const headers = { kind: primitiveClass.kind, ...primitiveClass.sample, "agent-provider": ["claude"] };
    if (["posture", "sensor"].includes(primitiveClass.kind)) {
      assert.throws(() => readPrimitive({ headers: { ...headers, "agent-provider": "claude" }, body: "" }));
      const unknownAgentPrimitive = readPrimitive({ headers: { ...headers, "agent-provider": ["unknown"] }, body: "" });
      assert.equal(charterRootOf([unknownAgentPrimitive]).agentFaultsByFilesOf(["claude", "codex"]).isEmpty, false);
    } else {
      assert.throws(() => readPrimitive({ headers, body: "" }));
      const authoredPrimitive = readPrimitive({
        headers: { kind: primitiveClass.kind, ...primitiveClass.sample },
        body: "Shared.",
      });
      const fileText = authoredPrimitive
        .writeMarkdown()
        .replace("description:", "agent-provider: [claude]\ndescription:");
      assert.match(messages(faultsIn(fileText)), /holds no "agent-provider"/);
      assert.equal(authoredPrimitive.supportsAgent(new AgentProvider("claude")), true);
      assert.equal(authoredPrimitive.supportsAgent(new AgentProvider("codex")), true);
    }
  }
});
