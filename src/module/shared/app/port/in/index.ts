/**
 * What every module's DTOs are written with, and nothing else: zod through the
 * kernel's validator lib, `dto`, `groupByType`, `StringsSchema` and the faults
 * every module answers with. A DTO file imports this entry rather than the
 * kernel's module.ts, which reaches its adapters and node:*, so a client that
 * imports a DTO bundles no server code (`dtos-are-zod-only`).
 */
export { z } from "../../../domain/libs/validator.lib.js";
export { dto, groupByType, StringsSchema } from "./dto.schema.js";
export { FaultDTOs } from "./fault.dto.js";
