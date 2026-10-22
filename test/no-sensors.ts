import { SensorRunning } from "../src/hexagon/application/SensorRunning.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryShellCommands } from "../src/zdriven/InMemoryShellCommands.js";

/** What the sensors are run through where a test asks nothing of them: a
 *  context always carries every use case, and this one has none built. */
export const noSensorsRun = new SensorRunning(new URL("file:///repo/"), new InMemoryFileReaders({}), new InMemoryShellCommands());
