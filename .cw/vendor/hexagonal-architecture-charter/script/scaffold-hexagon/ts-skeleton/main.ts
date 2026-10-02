#!/usr/bin/env node
import { GreetCommand } from "./src/driver/cli/GreetCommand.js";
import { VisitorGreeting } from "./src/hexagon/application/VisitorGreeting.js";
import { SystemClock } from "./src/zdriven/SystemClock.js";
import type { ForGreetingVisitors } from "./src/hexagon/port/driver/ForGreetingVisitors.js";
import type { ForReadingClock } from "./src/hexagon/port/zdriven/ForReadingClock.js";

/**
 * COMPOSITION ROOT — the one place that knows every concrete class.
 *
 * Each binding is declared as its port, never as the class, so the compiler
 * confirms that swapping an adapter needs no change inside the hexagon.
 */
const clock: ForReadingClock = new SystemClock();

const visitorGreetingApp: ForGreetingVisitors = new VisitorGreeting(clock);

const cli = new GreetCommand(visitorGreetingApp);

process.exitCode = await cli.run(process.argv.slice(2));
