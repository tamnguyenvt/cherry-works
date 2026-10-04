import { z } from "zod";
import { DataDTOs } from "./data.js";
import { byType, dto, StringsSchema } from "./dto.js";

/**
 * Every DTO named `…Outcome`: what came of a use case doing something, rather
 * than what one model says. Each is `{ type, data }`, `type` its name exactly
 * as `OutcomeDTOs` keys it, and `data` what came of it, made of the data DTOs
 * beside this file. What arrives untyped — at the page, most of all — is parsed
 * by looking its schema up by its own `type` in either set. Zod and nothing
 * else: the page bundles this file.
 */

/** What checking a repository found (FR-040): which agents it compiles for;
 *  every FaultSchema in its charter under its file, how many of them are errors and
 *  how many warnings; how many files a build would still change — `null` where
 *  the charter does not hold and nothing was previewed; which installed
 *  charters are edited here; and how many of those four questions are
 *  unwell. Beside them, what each agent's main context is estimated to open a
 *  session with — none where the charter does not hold — and the ceiling it is
 *  held to, which warns and is no question unwell (EVAL-FR-006). */
const DoctorOutcomeSchema = dto(
  "DoctorOutcome",
  z.object({
    agents: StringsSchema,
    errorCount: z.number(),
    warnCount: z.number(),
    pendingCount: z.number().nullable(),
    faultsByFile: DataDTOs.FaultsByFile,
    driftedVendors: StringsSchema,
    problemCount: z.number(),
    mainContexts: z.array(z.object({ agent: z.string(), totalTokens: z.number() })).readonly(),
    contextCeiling: z.number(),
  }),
);

/** What explaining one primitive found (FR-014, FR-017): the primitive, when
 *  it comes up, the mixins it uses and the corpus it cites, what uses, cites or
 *  names it, and the test cases that name it. A rationale it cites and this
 *  charter does not hold is left out here and read off the primitive's own
 *  headers. */
const ExplanationOutcomeSchema = dto(
  "ExplanationOutcome",
  z.object({
    primitive: DataDTOs.Primitive,
    activatesWhen: z.string(),
    useMixins: z.array(DataDTOs.Primitive).readonly(),
    rationale: DataDTOs.Primitive.optional(),
    hosts: z.array(DataDTOs.Primitive).readonly(),
    citers: z.array(DataDTOs.Primitive).readonly(),
    mentioners: z.array(DataDTOs.Primitive).readonly(),
    testCasesByFile: DataDTOs.TestCasesByFile,
  }),
);

/** Every outcome DTO's schema, under its name — the name it carries as `type` —
 *  in alphabetical order. */
export const OutcomeDTOs = byType(DoctorOutcomeSchema, ExplanationOutcomeSchema);

/** Every outcome DTO's type, under its name: what its schema infers. */
export namespace OutcomeDTOs {
  export type DoctorOutcome = z.infer<typeof OutcomeDTOs.DoctorOutcome>;
  export type ExplanationOutcome = z.infer<typeof OutcomeDTOs.ExplanationOutcome>;
}
