#!/usr/bin/env node
import { GreetCommand } from "./src/driver/cli/GreetCommand.js";
import { GreetingVisitors } from "./src/hexagon/application/GreetingVisitors.js";
import { StderrLogs } from "./src/zdriven/StderrLogs.js";
import { SystemClock } from "./src/zdriven/SystemClock.js";

/**
 * COMPOSITION ROOT — the one place that knows every concrete class.
 *
 * Each binding is declared as its port, never as the class, so the type
 * checker confirms that swapping an adapter needs no change inside the hexagon.
 */

/** @type {import("./src/hexagon/port/zdriven/ForReadingClock.js").ForReadingClock} */
const clock = new SystemClock();

/** @type {import("./src/hexagon/port/zdriven/ForWritingLogs.js").ForWritingLogs} */
const logs = new StderrLogs();

/** @type {import("./src/hexagon/port/driver/ForGreetingVisitors.js").ForGreetingVisitors} */
const greetingVisitors = new GreetingVisitors(clock, logs);

const cli = new GreetCommand(greetingVisitors);

process.exitCode = await cli.run(process.argv.slice(2));
