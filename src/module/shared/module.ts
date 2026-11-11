/**
 * MODULE — the kernel every module shares.
 *
 * Everything it lets the code outside it reach, and the only file the code
 * outside it imports (`.dependency-cruiser.cjs`).
 */
export { ApplicationService } from "./app/application-service.base.js";
export { byType, dto, StringsSchema } from "./app/port/in/dto.schema.js";
export { FaultDTOs } from "./app/port/in/fault.dto.js";
export {
  type ForCallingMcpServers,
  type McpServerAddress,
  type McpServerConnection,
  type ToolAnswer,
  UnauthorizedMcpFault,
  type UpstreamTool,
} from "./app/port/out/calling-mcp-servers.port.js";
export { FolderAddress, type FolderURL } from "./app/port/out/folder-address.port.js";
export type { ForReadingFiles, ListedFile, ReadFile } from "./app/port/out/reading-files.port.js";
export type { ForReportingProgress } from "./app/port/out/reporting-progress.port.js";
export type { ForTellingTime } from "./app/port/out/telling-time.port.js";
export type { ForWritingFiles } from "./app/port/out/writing-files.port.js";
export { AdapterFault } from "./domain/models/adapter.fault.js";
export { ApplicationFault } from "./domain/models/application.fault.js";
export { DomainFault, Faults, FaultsByFile } from "./domain/models/domain.fault.js";
export { ConsoleReporter } from "./infra/console-reporter.adapter.js";
export { FileOutput } from "./infra/file-output.adapter.js";
export { FileReaders } from "./infra/file-readers.adapter.js";
export { checkoutPathOf, decodeContents, encodeContents, filePathOf, pathFromCheckout, urlAt } from "./infra/helper.js";
export type { InMemoryFileReaders } from "./infra/in-memory/in-memory-file-readers.adapter.js";
export { McpClients } from "./infra/mcp-clients.adapter.js";
export { SystemClock } from "./infra/system-clock.adapter.js";
