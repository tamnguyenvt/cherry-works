import { z } from "zod";
import { byType, dto } from "./dto.js";

/**
 * DTOS — every DTO that is not an outcome: what one model says, reused
 * wherever it appears — as a use case's answer on its own, or inside another
 * DTO. Each is `{ type, data }`, `type` its model's name exactly as `DataDTOs`
 * keys it, and `data` what it says. `DataDTOs.Fault` is the schema where a
 * value is wanted and the type where a type is. Zod and nothing else: a client
 * may import this file, and parse what it is sent with it.
 */

/** One fault: which one, what is wrong and the next move — an internal fault
 *  arrives as `InternalFault`, in the system's own words. */
const FaultSchema = dto(
  "Fault",
  z.object({
    name: z.string(),
    message: z.string(),
    fix: z.string(),
  }),
);
// @example-start

/** A greeting, ready to print or to send. */
const GreetingSchema = dto(
  "Greeting",
  z.object({
    text: z.string(),
  }),
);
// @example-end

/** Every data DTO's schema, under the model's name — the name its DTO carries
 *  as `type` — in alphabetical order. */
export const DataDTOs = byType(
  FaultSchema,
  // @example-start
  GreetingSchema,
  // @example-end
);

/** Every data DTO's type, under the model's name: what its schema infers. */
export namespace DataDTOs {
  export type Fault = z.infer<typeof DataDTOs.Fault>;
  // @example-start
  export type Greeting = z.infer<typeof DataDTOs.Greeting>;
  // @example-end
}
