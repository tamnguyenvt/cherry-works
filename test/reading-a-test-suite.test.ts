import { test } from "node:test";
import assert from "node:assert/strict";
import { testSuiteOf, type TestSuite } from "../src/hexagon/domain/models/test/TestSuite.js";
import { Fault } from "../src/hexagon/domain/models/Fault.js";

/** One test file, written the way an author writes it. */
const file = (written: unknown) => JSON.stringify(written, null, 2);

const read = (text: string): TestSuite => testSuiteOf(text);

/** Every case of one suite as its author wrote it down: what a case holds is
 *  what these are about, and the case itself is what says the situation. */
const written = (suite: TestSuite) => suite.cases.map((each) => each.written);

/** Why a reading refused this text: a suite or nothing, so what comes back is
 *  the one fault raised. */
const refusing = (text: string): Fault => {
  try {
    testSuiteOf(text);
  } catch (raised) {
    assert.ok(raised instanceof Fault);
    return raised;
  }
  return assert.fail("this text was read as a suite");
};

const said = (fault: Fault) => `${fault.message}\n${fault.fix}`;

test("a touched file is read with the primitive it is expected to bring up", () => {
  const suite = read(
    file({
      description: "Type guides must come up when application code is touched.",
      cases: [{ do: { touchFile: "src/services/user.ts" }, expect: { activate: "guide:no-any" } }],
    }),
  );

  assert.equal(suite.description, "Type guides must come up when application code is touched.");
  assert.deepEqual(written(suite), [
    { do: { touchFile: "src/services/user.ts" }, expect: { activate: "guide:no-any" } },
  ]);
});

test("a touched file is read with the permission it is expected to meet, either way", () => {
  const suite = read(
    file({
      cases: [
        { do: { touchFile: ".env" }, expect: { allow: false } },
        { do: { touchFile: "src/one.ts" }, expect: { allow: true } },
      ],
    }),
  );

  assert.deepEqual(written(suite), [
    { do: { touchFile: ".env" }, expect: { allow: false } },
    { do: { touchFile: "src/one.ts" }, expect: { allow: true } },
  ]);
});

test("a raised event is read with the sensor it is expected to run", () => {
  const suite = read(file({ cases: [{ when: "PreToolUse", expect: { run: "sensor:no-secrets" } }] }));

  assert.deepEqual(written(suite), [{ when: "PreToolUse", expect: { run: "sensor:no-secrets" } }]);
});

test("one file holds as many cases as it describes, in the order they are written", () => {
  const suite = read(
    file({
      cases: [
        { do: { touchFile: "src/one.ts" }, expect: { activate: "guide:no-any" } },
        { when: "Stop", expect: { run: "sensor:tests" } },
      ],
    }),
  );

  assert.deepEqual(
    written(suite).map((each) => ("do" in each ? each.do.touchFile : each.when)),
    ["src/one.ts", "Stop"],
  );
});

test("a file that is not JSON is refused, saying so", () => {
  const fault = refusing("## Case: editing a service\ntouchFile: src/one.ts\n");

  assert.match(said(fault), /is not JSON/);
});

test("a file the shape refuses is shown a suite that reads, rather than told which field went wrong", () => {
  const fault = refusing(file({ cases: [{ expect: { activate: "guide:no-any" } }] }));

  assert.match(said(fault), /is not written as a suite of cases/);
  assert.match(said(fault), /"do": \{ "touchFile": "src\/one\.ts" \}/);
  assert.match(said(fault), /"when": "PreToolUse"/);
  assert.match(said(fault), /"allow": false/);
});

test("a file describing no case is refused, since running it would assert nothing", () => {
  assert.ok(refusing(file({ description: "Meant to pin the guides down.", cases: [] })) !== undefined);
});

test("a case putting both a touched file and an event is refused, since a case is one situation", () => {
  assert.ok(refusing(file({ cases: [{ do: { touchFile: "src/one.ts" }, when: "Stop", expect: { activate: "guide:no-any" } }] })) !== undefined);
});

test("a raised event expecting a permission is refused, since an event touches no file", () => {
  assert.ok(refusing(file({ cases: [{ when: "PreToolUse", expect: { allow: false } }] })) !== undefined);
});

test("a case expecting both an activation and a permission is refused", () => {
  assert.ok(refusing(file({ cases: [{ do: { touchFile: ".env" }, expect: { activate: "guide:no-any", allow: false } }] })) !== undefined);
});

test("a case raising an event nothing raises is refused", () => {
  assert.ok(refusing(file({ cases: [{ when: "OnSave", expect: { run: "sensor:tests" } }] })) !== undefined);
});

test("an expectation that is not an identity is refused, since nothing answers to it", () => {
  assert.ok(refusing(file({ cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: "no-any" } }] })) !== undefined);
});

test("a field nothing reads is refused rather than passed over", () => {
  assert.ok(refusing(
      file({ cases: [{ do: { touchFile: "src/one.ts", request: "add a field" }, expect: { activate: "guide:no-any" } }] }),
    ) !== undefined);
});
