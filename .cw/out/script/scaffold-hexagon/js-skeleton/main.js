#!/usr/bin/env node
import { GreetCommand } from "./src/driver/cli/GreetCommand.js";
import { VisitorGreeting } from "./src/hexagon/application/VisitorGreeting.js";
import { SystemClock } from "./src/zdriven/SystemClock.js";

/**
 * COMPOSITION ROOT — the one place that knows every concrete class.
 *
 * Each binding is declared as its port, never as the class, so the type
 * checker confirms that swapping an adapter needs no change inside the hexagon.
 */

/** @type {import("./src/hexagon/port/zdriven/ForReadingClock.js").ForReadingClock} */
const clock = new SystemClock();

/** @type {import("./src/hexagon/port/driver/ForGreetingVisitors.js").ForGreetingVisitors} */
const visitorGreetingApp = new VisitorGreeting(clock);

const cli = new GreetCommand(visitorGreetingApp);

process.exitCode = await cli.run(process.argv.slice(2));
