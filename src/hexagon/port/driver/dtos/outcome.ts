import { z } from "zod";
import { DataDTOs } from "./data.js";
import { byType, dto, strings } from "./dto.js";

/**
 * Every DTO named `…Outcome`: what came of a use case doing something, rather
 * than what one model says. Each is `{ type, data }`, `type` its name exactly
 * as `OutcomeDTOs` keys it, and `data` what came of it, made of the data DTOs
 * beside this file. What arrives untyped — at the page, most of all — is parsed
 * by looking its schema up by its own `type` in either set. Zod and nothing
 * else: the page bundles this file.
 */

/** What checking a repository found (FR-040): which agents it compiles for;
 *  every fault in its charter under its file, how many of them are errors and
 *  how many warnings; how many files a build would still change — `null` where
 *  the charter does not hold and nothing was previewed; which installed
 *  charters are edited here; and how many of those four questions are
 *  unwell. */
const doctorOutcome = dto(
  "DoctorOutcome",
  z.object({
    agents: strings,
    errorCount: z.number(),
    warnCount: z.number(),
    pendingCount: z.number().nullable(),
    faultsByFile: DataDTOs.FaultsByFile,
    driftedVendors: strings,
    problemCount: z.number(),
  }),
);

/** What explaining one primitive found (FR-014, FR-017): the primitive, the
 *  mixins it uses and the corpus it cites, what uses or cites it, and the test
 *  cases that name it. A rationale it cites and this charter does not hold is
 *  left out here and read off the primitive's own headers. */
const explanationOutcome = dto(
  "ExplanationOutcome",
  z.object({
    scopedPrimitive: DataDTOs.ScopedPrimitive,
    useMixins: z.array(DataDTOs.ScopedPrimitive).readonly(),
    rationale: DataDTOs.ScopedPrimitive.optional(),
    hosts: z.array(DataDTOs.ScopedPrimitive).readonly(),
    citers: z.array(DataDTOs.ScopedPrimitive).readonly(),
    testCasesByFile: DataDTOs.TestCasesByFile,
  }),
);

/** Every outcome DTO's schema, under its name — the name it carries as `type` —
 *  in alphabetical order. */
export const OutcomeDTOs = byType(doctorOutcome, explanationOutcome);

/** Every outcome DTO's type, under its name: what its schema infers. */
export namespace OutcomeDTOs {
  export type DoctorOutcome = z.infer<typeof OutcomeDTOs.DoctorOutcome>;
  export type ExplanationOutcome = z.infer<typeof OutcomeDTOs.ExplanationOutcome>;
}
