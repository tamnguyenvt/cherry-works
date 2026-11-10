import { z } from "zod";
import { byType, dto } from "./dto.schema.js";

/**
 * The faults every module answers with: one fault, every fault under the file
 * it is wrong with, and faults under no file yet. Each is `{ type, data }`,
 * `type` its name exactly as `FaultDTOs` keys it. Zod and nothing else: the
 * page bundles this file.
 */

/** One fault: which fault it is, what is wrong, the next move, and whether it
 *  stops a build. An internal one is named `InternalFault` and says nothing of
 *  how the system is set up (SDK-FR-018). */
const FaultSchema = dto(
  "Fault",
  z.object({
    name: z.string(),
    message: z.string(),
    fix: z.string(),
    severity: z.enum(["error", "warn"]),
  }),
);

/** Every fault under the file it is wrong with, named from the repository. A
 *  file nothing is wrong with is not in here at all. */
const FaultsByFileSchema = dto(
  "FaultsByFile",
  z.object({
    files: z.record(z.string(), z.array(FaultSchema).readonly()),
  }),
);

/** Faults under no file yet: what an author's answers were refused for before
 *  anything was written. */
const FaultsSchema = dto(
  "Faults",
  z.object({
    faults: z.array(FaultSchema).readonly(),
  }),
);

/** Every schema of this module's DTOs, under its name — the name it carries
 *  as `type` — in alphabetical order. */
export const FaultDTOs = byType(
  FaultSchema,
  FaultsSchema,
  FaultsByFileSchema,
);

/** Every DTO's type, under its name: what its schema infers. */
export namespace FaultDTOs {
  export type Fault = z.infer<typeof FaultDTOs.Fault>;
  export type Faults = z.infer<typeof FaultDTOs.Faults>;
  export type FaultsByFile = z.infer<typeof FaultDTOs.FaultsByFile>;
}
