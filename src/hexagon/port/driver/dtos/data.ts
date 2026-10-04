import { z } from "zod";
import { byType, dto, StringsSchema } from "./dto.js";

/**
 * Every DTO that is not an outcome: what one model says, reused wherever it
 * appears — as a use case's answer on its own, or inside another DTO. Each is
 * `{ type, data }`, `type` its model's name exactly as `DataDTOs` keys it, and
 * `data` what it says. `DataDTOs.Catalogue` is the schema where a value is
 * wanted and the type where a type is. Zod and nothing else: the page bundles
 * this file.
 */

/** One fault: what is wrong, the next move, and whether it stops a build. */
const FaultSchema = dto(
  "Fault",
  z.object({
    message: z.string(),
    fix: z.string(),
    severity: z.enum(["error", "warn"]),
  }),
);

/** Every FaultSchema under the file it is wrong with, named from the repository. A
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

/** Every kind the charter knows, and when a primitive of that kind comes up:
 *  the line the kind's own class declares, under the kind it belongs to. Not
 *  one charter's answer but every charter's — what a kind is does not depend on
 *  what was authored (FR-010). */
const PrimitiveKindsSchema = dto("PrimitiveKinds", z.record(z.string(), z.string()));

/** One primitive as the listing records it: what it is called, what it is
 *  for, the files it applies to, and the file its body is in. Globs nobody
 *  wrote are left out rather than recorded as nothing. */
const CatalogueEntrySchema = dto(
  "CatalogueEntry",
  z.object({
    id: z.string(),
    kind: z.string(),
    description: z.string(),
    file: z.string(),
    globs: StringsSchema.optional(),
  }),
);

/** What the charter holds, ordered by id. */
const CatalogueSchema = dto(
  "Catalogue",
  z.object({
    entries: z.array(CatalogueEntrySchema).readonly(),
  }),
);

/** One primitive as the whole charter sees it: what it is called and what it
 *  is for, the file it was authored in, which layer that file arrived in, every
 *  header it declared, its body, and the hash of it written out — what a save
 *  is made over. */
const PrimitiveSchema = dto(
  "Primitive",
  z.object({
    id: z.string(),
    kind: z.string(),
    description: z.string(),
    file: z.string(),
    layerName: z.enum(["repo", "vendor", "builtin"]),
    headers: z.record(z.string(), z.union([z.string(), StringsSchema])),
    body: z.string(),
    hash: z.string(),
  }),
);

/** Every primitive the charter holds, each as the whole charter sees it,
 *  ordered by id. What the portal lists by, since it names the layer and
 *  every header where the CatalogueSchema names neither. */
const PrimitivesSchema = dto(
  "Primitives",
  z.object({
    primitives: z.array(PrimitiveSchema).readonly(),
  }),
);

/** What a build did, or would do, to each file it touches. */
const PlanSummarySchema = dto(
  "PlanSummary",
  z.object({
    added: StringsSchema,
    edited: StringsSchema,
    deleted: StringsSchema,
    unchanged: StringsSchema,
  }),
);

/** One header a kind takes: whether it holds a line or a list, whether a file
 *  written without it is refused, and the values it may hold where the kind
 *  reads it from a closed set. */
const PrimitiveHeaderSchema = dto(
  "PrimitiveHeader",
  z.object({
    field: z.string(),
    shape: z.enum(["line", "list"]),
    required: z.boolean(),
    allowedValues: StringsSchema.optional(),
  }),
);

/** Everything one kind takes of whoever authors it: every header, and one
 *  primitive of that kind written out as its frontmatter holds it — the lines
 *  themselves, so a driver shows an author a sample without holding a second
 *  spelling of how a header is written. */
const PrimitiveRequirementsSchema = dto(
  "PrimitiveRequirements",
  z.object({
    headers: z.array(PrimitiveHeaderSchema).readonly(),
    sample: z.string(),
  }),
);

/** Every situation put under the test file it was written in, named from the
 *  repository. A file putting none of the situations asked about is not in here
 *  at all. Nothing is resolved in them — how a case came out is what a run
 *  answers. */
const TestCasesByFileSchema = dto("TestCasesByFile", z.record(z.string(), StringsSchema));

/** One test case, resolved: the test file it is in, the situation it put, and
 *  where the charter did not answer it as expected, why. */
const TestCaseReportSchema = dto(
  "TestCaseReport",
  z.object({
    suiteName: z.string(),
    situation: z.string(),
    passed: z.boolean(),
    unmet: FaultSchema.optional(),
  }),
);

/** How every case one repository wrote down came out. */
const TestRunReportSchema = dto(
  "TestRunReport",
  z.object({
    testCaseReports: z.array(TestCaseReportSchema).readonly(),
  }),
);

/** One situation a test pins down, said rather than handed over as written:
 *  the file it touches or the event it raises, what it expects of it, and the
 *  id it names where it names one. */
const TestCaseSchema = dto(
  "TestCase",
  z.object({
    situation: z.string(),
    expectation: z.string(),
    id: z.string().optional(),
  }),
);

/** One test file, by its name under `.cw/test/`: the text it holds, what it is
 *  about and the cases it pins down, or — for a file that does not read — why
 *  not (FR-124). */
const TestSuiteSchema = dto(
  "TestSuite",
  z.object({
    name: z.string(),
    text: z.string().optional(),
    description: z.string().optional(),
    cases: z.array(TestCaseSchema).readonly(),
    fault: FaultSchema.optional(),
  }),
);

/** Every test file, in the order their names sort in. */
const TestSuitesSchema = dto(
  "TestSuites",
  z.object({
    testSuites: z.array(TestSuiteSchema).readonly(),
  }),
);

/** One address a developer signs in to, and whether they have (FR-150): every
 *  mcp at it whatever its path, the ways any of them allows, and how the
 *  developer signed in there. Never the credential itself (SC-036). */
const SignInStatusSchema = dto(
  "SignInStatus",
  z.object({
    address: z.string(),
    ids: StringsSchema,
    auth: z.array(z.enum(["oauth", "token"])).readonly(),
    signedIn: z.boolean(),
    method: z.enum(["oauth", "token"]).optional(),
  }),
);

/** One tool `cw mcp serve` shows the agent: named `<prefix>__<tool>` after the
 *  id declaring it, its description led by that id and its path,
 *  its input schema the place's own (FR-153). */
const ServedToolSchema = dto(
  "ServedTool",
  z.object({
    name: z.string(),
    description: z.string(),
    inputSchema: z.record(z.string(), z.unknown()),
  }),
);

/** What one run serves, ordered by name, and what was left out and why: a
 *  place down or not signed in to, a declared tool its place lacks (FR-153,
 *  FR-154). */
const ServedToolsSchema = dto(
  "ServedTools",
  z.object({
    tools: z.array(ServedToolSchema).readonly(),
    problems: StringsSchema,
  }),
);

/** What a call answered: the place's answer as it came, or an error answer
 *  saying why no place was reached (FR-154). */
const ToolAnswerSchema = dto("ToolAnswer", z.record(z.string(), z.unknown()));

/** What a repository configured itself with. */
const WorkspaceSettingsSchema = dto(
  "WorkspaceSettings",
  z.object({
    agents: StringsSchema,
    mainContextCeiling: z.number(),
  }),
);

/** What one primitive, or the charter itself, puts into an agent's main
 *  context, in tokens; with the globs a file touched has to match, where it
 *  is loaded only then. */
const MainContextLoadSchema = dto(
  "MainContextLoad",
  z.object({
    id: z.string(),
    kind: z.string(),
    tokens: z.number(),
    globs: StringsSchema.optional(),
  }),
);

/** What a charter puts into one agent's main context: what is loaded when a
 *  session opens, the largest first, and their total; apart, what is loaded
 *  when a file is touched; and whether it was counted exactly or estimated. */
const MainContextSchema = dto(
  "MainContext",
  z.object({
    agent: z.string(),
    isExact: z.boolean(),
    sessionLoads: z.array(MainContextLoadSchema).readonly(),
    fileLoads: z.array(MainContextLoadSchema).readonly(),
    totalTokens: z.number(),
  }),
);

/** The main context of every agent the repository compiles for. */
const MainContextsSchema = dto(
  "MainContexts",
  z.object({
    contexts: z.array(MainContextSchema).readonly(),
  }),
);

/** The sessions kept within a span, both its days counted in (EVAL-FR-012):
 *  each once at its last stop, the largest first, how many, and their total. */
const SessionSummarySchema = dto(
  "SessionSummary",
  z.object({
    span: z.object({ since: z.string(), until: z.string() }),
    sessions: z
      .array(
        z.object({
          sessionId: z.string(),
          model: z.string(),
          lastStopAt: z.string(),
          /** Its tokens by kind at that stop, which a cost is reckoned from
           *  (EVAL-FR-014). */
          tokens: z.object({ input: z.number(), output: z.number(), cacheWrite: z.number(), cacheRead: z.number() }),
          /** Its tokens so far, subagents included (EVAL-FR-008). */
          totalTokens: z.number(),
        }),
      )
      .readonly(),
    sessionCount: z.number(),
    totalTokens: z.number(),
  }),
);

/** Every data DTO's schema, under the model's name — the name its DTO carries
 *  as `type` — in alphabetical order. */
export const DataDTOs = byType(
  CatalogueSchema,
  CatalogueEntrySchema,
  FaultSchema,
  FaultsSchema,
  FaultsByFileSchema,
  MainContextSchema,
  MainContextLoadSchema,
  MainContextsSchema,
  PlanSummarySchema,
  PrimitiveHeaderSchema,
  PrimitiveKindsSchema,
  PrimitiveRequirementsSchema,
  PrimitiveSchema,
  PrimitivesSchema,
  ServedToolSchema,
  ServedToolsSchema,
  SessionSummarySchema,
  SignInStatusSchema,
  TestCaseSchema,
  TestCaseReportSchema,
  TestCasesByFileSchema,
  TestRunReportSchema,
  TestSuiteSchema,
  TestSuitesSchema,
  ToolAnswerSchema,
  WorkspaceSettingsSchema,
);

/** Every data DTO's type, under the model's name: what its schema infers. */
export namespace DataDTOs {
  export type Catalogue = z.infer<typeof DataDTOs.Catalogue>;
  export type CatalogueEntry = z.infer<typeof DataDTOs.CatalogueEntry>;
  export type Fault = z.infer<typeof DataDTOs.Fault>;
  export type Faults = z.infer<typeof DataDTOs.Faults>;
  export type FaultsByFile = z.infer<typeof DataDTOs.FaultsByFile>;
  export type MainContext = z.infer<typeof DataDTOs.MainContext>;
  export type MainContextLoad = z.infer<typeof DataDTOs.MainContextLoad>;
  export type MainContexts = z.infer<typeof DataDTOs.MainContexts>;
  export type PlanSummary = z.infer<typeof DataDTOs.PlanSummary>;
  export type PrimitiveKinds = z.infer<typeof DataDTOs.PrimitiveKinds>;
  export type PrimitiveHeader = z.infer<typeof DataDTOs.PrimitiveHeader>;
  export type PrimitiveRequirements = z.infer<typeof DataDTOs.PrimitiveRequirements>;
  export type Primitive = z.infer<typeof DataDTOs.Primitive>;
  export type Primitives = z.infer<typeof DataDTOs.Primitives>;
  export type ServedTool = z.infer<typeof DataDTOs.ServedTool>;
  export type ServedTools = z.infer<typeof DataDTOs.ServedTools>;
  export type SessionSummary = z.infer<typeof DataDTOs.SessionSummary>;
  export type SignInStatus = z.infer<typeof DataDTOs.SignInStatus>;
  export type TestCase = z.infer<typeof DataDTOs.TestCase>;
  export type TestCaseReport = z.infer<typeof DataDTOs.TestCaseReport>;
  export type TestCasesByFile = z.infer<typeof DataDTOs.TestCasesByFile>;
  export type TestRunReport = z.infer<typeof DataDTOs.TestRunReport>;
  export type TestSuite = z.infer<typeof DataDTOs.TestSuite>;
  export type TestSuites = z.infer<typeof DataDTOs.TestSuites>;
  export type ToolAnswer = z.infer<typeof DataDTOs.ToolAnswer>;
  export type WorkspaceSettings = z.infer<typeof DataDTOs.WorkspaceSettings>;
}
