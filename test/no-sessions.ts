import { InMemoryClock } from "../src/module/shared/infra/in-memory/in-memory-clock.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { reviewingSessionsOf } from "./use-cases-of.js";

/** What the sessions are read back through where a test asks nothing of them:
 *  a context always carries every use case, and this one has none kept. */
export const noSessionsKept = reviewingSessionsOf(new URL("file:///repo/"), new URL("file:///home/"), new InMemoryFileReaders({}), (rootFolder) => new InMemoryFileReaders({}, rootFolder), new InMemoryClock(new Date()), new InMemoryReporter());
