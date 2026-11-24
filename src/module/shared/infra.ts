/**
 * INFRA — the adapters of the kernel every module shares.
 *
 * Everything of its infrastructure it lets the composition root, the entry
 * points and the other modules' adapters reach (`.dependency-cruiser.cjs`).
 */
export { ConsoleReporter } from "./infra/console-reporter.adapter.js";
export { FileOutput } from "./infra/file-output.adapter.js";
export { FileReaders } from "./infra/file-readers.adapter.js";
export {
  decodeContents,
  encodeContents,
  resolveCheckoutPath,
  resolveFileUrl,
  resolveRepoPath,
} from "./infra/helper.js";
export type { InMemoryFileReaders } from "./infra/in-memory/in-memory-file-readers.adapter.js";
export { McpClients } from "./infra/mcp-clients.adapter.js";
export { StderrReporter } from "./infra/stderr-reporter.adapter.js";
export { SystemClock } from "./infra/system-clock.adapter.js";
