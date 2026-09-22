import { z } from "zod";
import { byType, dto, strings } from "./dto.js";

/**
 * Every DTO that is not an outcome: what one model says, reused wherever it
 * appears — as a use case's answer on its own, or inside another DTO. Each is
 * `{ type, data }`, `type` its model's name exactly as `DataDTOs` keys it, and
 * `data` what it says. `DataDTOs.Catalogue` is the schema where a value is
 * wanted and the type where a type is. Zod and nothing else: the page bundles
 * this file.
 */

/** One fault: what is wrong, the next move, and whether it stops a build. */
const fault = dto(
  "Fault",
  z.object({
    message: z.string(),
    fix: z.string(),
    severity: z.enum(["error", "warn"]),
  }),
);

/** Every fault under the file it is wrong with, named from the repository. A
 *  file nothing is wrong with is not in here at all. */
const faultsByFile = dto(
  "FaultsByFile",
  z.object({
    files: z.record(z.string(), z.array(fault).readonly()),
  }),
);

/** Faults under no file yet: what an author's answers were refused for before
 *  anything was written. */
const faults = dto(
  "Faults",
  z.object({
    faults: z.array(fault).readonly(),
  }),
);

/** Every kind the charter knows, and when a primitive of that kind comes up:
 *  the line the kind's own class declares, under the kind it belongs to. Not
 *  one charter's answer but every charter's — what a kind is does not depend on
 *  what was authored (FR-010). */
const primitiveKinds = dto("PrimitiveKinds", z.record(z.string(), z.string()));

/** One primitive as the full listing records it: everything its headers
 *  declare about it, and the file its body is in. A header nobody wrote is
 *  left out rather than recorded as nothing. */
const catalogueEntry = dto(
  "CatalogueEntry",
  z.object({
    identity: z.string(),
    kind: z.string(),
    id: z.string(),
    description: z.string(),
    file: z.string(),
    tags: strings.optional(),
    globs: strings.optional(),
    rationale: z.string().optional(),
    mixins: strings.optional(),
  }),
);

/** What the charter holds, ordered by identity. */
const catalogue = dto(
  "Catalogue",
  z.object({
    entries: z.array(catalogueEntry).readonly(),
  }),
);

/** One primitive as the whole charter sees it: what it is called and what it
 *  is for, the file it was authored in, which layer that file arrived in, and
 *  every header it declared. */
const scopedPrimitive = dto(
  "ScopedPrimitive",
  z.object({
    identity: z.string(),
    kind: z.string(),
    description: z.string(),
    file: z.string(),
    scope: z.enum(["repo", "vendor", "builtin"]),
    headers: z.record(z.string(), z.union([z.string(), strings])),
  }),
);

/** Every primitive the charter holds, each as the whole charter sees it,
 *  ordered by identity. What the portal lists by, since it names the layer and
 *  every header where the catalogue names neither. */
const scopedPrimitives = dto(
  "ScopedPrimitives",
  z.object({
    primitives: z.array(scopedPrimitive).readonly(),
  }),
);

/** One primitive as its file holds it now: the primitive as the whole charter
 *  sees it, its markdown body, and the content hash of it written out — the
 *  revision a save is made over. */
const primitiveSnapshot = dto(
  "PrimitiveSnapshot",
  z.object({
    scopedPrimitive,
    body: z.string(),
    revision: z.string(),
  }),
);

/** What a build did, or would do, to each file it touches. */
const planSummary = dto(
  "PlanSummary",
  z.object({
    added: strings,
    edited: strings,
    deleted: strings,
    unchanged: strings,
  }),
);

/** One header a kind takes: whether it holds a line or a list, whether a file
 *  written without it is refused, and the values it may hold where the kind
 *  reads it from a closed set. */
const primitiveHeader = dto(
  "PrimitiveHeader",
  z.object({
    field: z.string(),
    shape: z.enum(["line", "list"]),
    required: z.boolean(),
    allowedValues: strings.optional(),
  }),
);

/** Everything one kind takes of whoever authors it: every header, and one
 *  primitive of that kind written out as its frontmatter holds it — the lines
 *  themselves, so a driver shows an author a sample without holding a second
 *  spelling of how a header is written. */
const primitiveRequirements = dto(
  "PrimitiveRequirements",
  z.object({
    headers: z.array(primitiveHeader).readonly(),
    sample: z.string(),
  }),
);

/** Every situation put under the test file it was written in, named from the
 *  repository. A file putting none of the situations asked about is not in here
 *  at all. Nothing is resolved in them — how a case came out is what a run
 *  answers. */
const testCasesByFile = dto("TestCasesByFile", z.record(z.string(), strings));

/** One test case, resolved: the test file it is in, the situation it put, and
 *  where the charter did not answer it as expected, why. */
const testCaseReport = dto(
  "TestCaseReport",
  z.object({
    suiteName: z.string(),
    situation: z.string(),
    passed: z.boolean(),
    unmet: fault.optional(),
  }),
);

/** How every case one repository wrote down came out. */
const testRunReport = dto(
  "TestRunReport",
  z.object({
    testCaseReports: z.array(testCaseReport).readonly(),
  }),
);

/** One situation a test pins down, said rather than handed over as written:
 *  the file it touches or the event it raises, what it expects of it, and the
 *  identity it names where it names one. */
const testCase = dto(
  "TestCase",
  z.object({
    situation: z.string(),
    expectation: z.string(),
    identity: z.string().optional(),
  }),
);

/** One test file, by its name under `.cw/test/`: the text it holds, what it is
 *  about and the cases it pins down, or — for a file that does not read — why
 *  not (FR-124). */
const testSuite = dto(
  "TestSuite",
  z.object({
    name: z.string(),
    text: z.string().optional(),
    description: z.string().optional(),
    cases: z.array(testCase).readonly(),
    fault: fault.optional(),
  }),
);

/** Every test file, in the order their names sort in. */
const testSuites = dto(
  "TestSuites",
  z.object({
    testSuites: z.array(testSuite).readonly(),
  }),
);

/** What a repository configured itself with. */
const workspaceSettings = dto(
  "WorkspaceSettings",
  z.object({
    agents: strings,
  }),
);

/** Every data DTO's schema, under the model's name — the name its DTO carries
 *  as `type` — in alphabetical order. */
export const DataDTOs = byType(
  catalogue,
  catalogueEntry,
  fault,
  faults,
  faultsByFile,
  planSummary,
  primitiveHeader,
  primitiveKinds,
  primitiveRequirements,
  primitiveSnapshot,
  scopedPrimitive,
  scopedPrimitives,
  testCase,
  testCaseReport,
  testCasesByFile,
  testRunReport,
  testSuite,
  testSuites,
  workspaceSettings,
);

/** Every data DTO's type, under the model's name: what its schema infers. */
export namespace DataDTOs {
  export type Catalogue = z.infer<typeof DataDTOs.Catalogue>;
  export type CatalogueEntry = z.infer<typeof DataDTOs.CatalogueEntry>;
  export type Fault = z.infer<typeof DataDTOs.Fault>;
  export type Faults = z.infer<typeof DataDTOs.Faults>;
  export type FaultsByFile = z.infer<typeof DataDTOs.FaultsByFile>;
  export type PlanSummary = z.infer<typeof DataDTOs.PlanSummary>;
  export type PrimitiveKinds = z.infer<typeof DataDTOs.PrimitiveKinds>;
  export type PrimitiveHeader = z.infer<typeof DataDTOs.PrimitiveHeader>;
  export type PrimitiveRequirements = z.infer<typeof DataDTOs.PrimitiveRequirements>;
  export type PrimitiveSnapshot = z.infer<typeof DataDTOs.PrimitiveSnapshot>;
  export type ScopedPrimitive = z.infer<typeof DataDTOs.ScopedPrimitive>;
  export type ScopedPrimitives = z.infer<typeof DataDTOs.ScopedPrimitives>;
  export type TestCase = z.infer<typeof DataDTOs.TestCase>;
  export type TestCaseReport = z.infer<typeof DataDTOs.TestCaseReport>;
  export type TestCasesByFile = z.infer<typeof DataDTOs.TestCasesByFile>;
  export type TestRunReport = z.infer<typeof DataDTOs.TestRunReport>;
  export type TestSuite = z.infer<typeof DataDTOs.TestSuite>;
  export type TestSuites = z.infer<typeof DataDTOs.TestSuites>;
  export type WorkspaceSettings = z.infer<typeof DataDTOs.WorkspaceSettings>;
}
