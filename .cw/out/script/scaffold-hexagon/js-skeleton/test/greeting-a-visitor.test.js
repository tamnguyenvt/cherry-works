import { test } from "node:test";
import assert from "node:assert/strict";
import { GreetingVisitors } from "../src/hexagon/application/GreetingVisitors.js";
import { InMemoryClock } from "../src/zdriven/InMemoryClock.js";
import { InMemoryLogs } from "../src/zdriven/InMemoryLogs.js";

// Tests drive the real use case through its driver port, over in-memory
// driven adapters: no disk, no network, no mock of the hexagon itself.

test("a visitor is greeted as fits the hour", async () => {
  const clock = new InMemoryClock(new Date(2026, 0, 1, 9));
  const greetingVisitors = new GreetingVisitors(clock, new InMemoryLogs());

  assert.deepEqual(await greetingVisitors.greet("Ada"), { type: "Greeting", data: { text: "Good morning, Ada." } });
  clock.setTo(new Date(2026, 0, 1, 20));
  assert.deepEqual(await greetingVisitors.greet("Ada"), { type: "Greeting", data: { text: "Good evening, Ada." } });
});

test("a visitor with no name is told so, and nothing is logged", async () => {
  const logs = new InMemoryLogs();
  const greetingVisitors = new GreetingVisitors(new InMemoryClock(new Date()), logs);

  assert.deepEqual(await greetingVisitors.greet("  "), {
    type: "Fault",
    data: {
      name: "NamelessVisitorFault",
      message: "A visitor is greeted by name, and none was given.",
      fix: "Give a name.",
    },
  });
  assert.deepEqual(logs.logEntries, []);
});

test("a fault of the system's own reaches the visitor in its own words, and the log as it is", async () => {
  const clock = new InMemoryClock(new Date());
  const logs = new InMemoryLogs();
  const greetingVisitors = new GreetingVisitors(clock, logs);
  clock.breakDown();

  assert.deepEqual(await greetingVisitors.greet("Ada"), {
    type: "Fault",
    data: {
      name: "InternalFault",
      message: "Something went wrong on our side.",
      fix: "Try again in a moment. If it keeps happening, tell whoever runs this system.",
    },
  });
  assert.deepEqual(logs.logEntries, [
    {
      level: "error",
      message: "The clock could not be read.",
      fields: { fault: "ClockUnreadableFault", fix: "Check the machine's clock." },
    },
  ]);
});
