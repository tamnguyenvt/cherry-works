import { SessionReviewing } from "../src/hexagon/application/SessionReviewing.js";
import { InMemoryClock } from "../src/zdriven/InMemoryClock.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";

/** What the sessions are read back through where a test asks nothing of them:
 *  a context always carries every use case, and this one has none kept. */
export const noSessionsKept = new SessionReviewing(new URL("file:///repo/"), new URL("file:///home/"), new InMemoryFileReaders({}), new InMemoryClock(new Date()));
