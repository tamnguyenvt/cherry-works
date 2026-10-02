import { test } from "node:test";
import assert from "node:assert/strict";
import { VisitorGreeting } from "../src/hexagon/application/VisitorGreeting.js";
import { InMemoryClock } from "../src/zdriven/InMemoryClock.js";

// Tests drive the real use case through its driver port, over in-memory
// driven adapters: no disk, no network, no mock of the hexagon itself.

test("a visitor is greeted as fits the hour", async () => {
  const clock = new InMemoryClock(new Date(2026, 0, 1, 9));
  const visitorGreetingApp = new VisitorGreeting(clock);

  assert.equal((await visitorGreetingApp.greet("Ada")).text, "Good morning, Ada.");
  clock.setTo(new Date(2026, 0, 1, 20));
  assert.equal((await visitorGreetingApp.greet("Ada")).text, "Good evening, Ada.");
});

test("a visitor with no name is refused", async () => {
  const visitorGreetingApp = new VisitorGreeting(new InMemoryClock(new Date()));

  await assert.rejects(visitorGreetingApp.greet("  "), /by name/);
});
