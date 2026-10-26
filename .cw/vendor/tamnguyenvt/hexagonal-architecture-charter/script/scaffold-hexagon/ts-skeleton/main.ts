#!/usr/bin/env node
import { GreetCommand } from "./src/driver/cli/GreetCommand.js";
import { GreetingVisitors } from "./src/hexagon/application/GreetingVisitors.js";
import { StderrLogs } from "./src/zdriven/StderrLogs.js";
import { SystemClock } from "./src/zdriven/SystemClock.js";
import type { ForGreetingVisitors } from "./src/hexagon/port/driver/ForGreetingVisitors.js";
import type { ForReadingClock } from "./src/hexagon/port/zdriven/ForReadingClock.js";
import type { ForWritingLogs } from "./src/hexagon/port/zdriven/ForWritingLogs.js";

/**
 * COMPOSITION ROOT — the one place that knows every concrete class.
 *
 * Each binding is declared as its port, never as the class, so the compiler
 * confirms that swapping an adapter needs no change inside the hexagon.
 */
const clock: ForReadingClock = new SystemClock();
const logs: ForWritingLogs = new StderrLogs();

const greetingVisitors: ForGreetingVisitors = new GreetingVisitors(clock, logs);

const cli = new GreetCommand(greetingVisitors);

process.exitCode = await cli.run(process.argv.slice(2));
