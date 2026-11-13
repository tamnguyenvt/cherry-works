import { dto, FaultDTOs, groupByType, StringsSchema, z } from "#module/shared/app/port/in/index.js";

/**
 * What the charter module answers with, through authoring and projection:
 * what one model of the charter says, and what came of doing something with
 * it, `…Outcome`. Each is `{ type, data }`, `type` its name exactly as
 * `CharterDTOs` keys it. Written with the kernel's DTO entry alone, never its
 * module.ts: a client that imports this file bundles no server code.
 */

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
    agentProviders: z.union([z.literal("all"), StringsSchema]),
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
 *  every header where the catalogue names neither. */
const PrimitivesSchema = dto(
  "Primitives",
  z.object({
    primitives: z.array(PrimitiveSchema).readonly(),
  }),
);

/** What a build did, or would do, to each file it touches. */
const ProjectionPlanSummarySchema = dto(
  "ProjectionPlanSummary",
  z.object({
    added: StringsSchema,
    edited: StringsSchema,
    deleted: StringsSchema,
    unchanged: StringsSchema,
    warnings: StringsSchema.optional(),
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
    unmet: FaultDTOs.Fault.optional(),
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

/** One test file, by its name under `.cw/charter/test/`: the text it holds, what it is
 *  about and the cases it pins down, or — for a file that does not read — why
 *  not (FR-124). */
const TestSuiteSchema = dto(
  "TestSuite",
  z.object({
    name: z.string(),
    text: z.string().optional(),
    description: z.string().optional(),
    cases: z.array(TestCaseSchema).readonly(),
    fault: FaultDTOs.Fault.optional(),
  }),
);

/** Every test file, in the order their names sort in. */
const TestSuitesSchema = dto(
  "TestSuites",
  z.object({
    testSuites: z.array(TestSuiteSchema).readonly(),
  }),
);

/** The name of one test file under `.cw/charter/test/`, written or taken away
 *  (FR-090 – FR-092). */
const TestSuiteNameSchema = dto(
  "TestSuiteName",
  z.object({
    name: z.string(),
  }),
);

/** One evaluation case: the prompt put to the agent, and what is expected of
 *  it (EVAL-FR-020). */
const EvalCaseSchema = dto(
  "EvalCase",
  z.object({
    prompt: z.string(),
    invoke: z.string().optional(),
    follow: z.string().optional(),
    read: z.string().optional(),
    maxTokens: z.number().optional(),
  }),
);

/** One file of evaluation cases, by its name: the text it holds, what it is
 *  about and its cases, or — for a file that does not read — why not. */
const EvalSuiteSchema = dto(
  "EvalSuite",
  z.object({
    name: z.string(),
    text: z.string().optional(),
    description: z.string().optional(),
    cases: z.array(EvalCaseSchema).readonly(),
    fault: FaultDTOs.Fault.optional(),
  }),
);

/** Every file of evaluation cases, in the order their names sort in. */
const EvalSuitesSchema = dto(
  "EvalSuites",
  z.object({
    evalSuites: z.array(EvalSuiteSchema).readonly(),
  }),
);

/** The name of one file of evaluation cases, written or taken away. */
const EvalSuiteNameSchema = dto(
  "EvalSuiteName",
  z.object({
    name: z.string(),
  }),
);

/** One folder a vendor source was installed as, or taken away from (FR-023). */
const VendorFolderSchema = dto(
  "VendorFolder",
  z.object({
    folder: z.string(),
  }),
);

/** Every folder a vendor source was installed as (FR-122). */
const VendorFoldersSchema = dto(
  "VendorFolders",
  z.object({
    folders: StringsSchema,
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

/** Every address a developer signs in to, ordered by address (FR-150). */
const SignInStatusesSchema = dto(
  "SignInStatuses",
  z.object({
    signInStatuses: z.array(SignInStatusSchema).readonly(),
  }),
);

/** One tool `cw mcp serve` shows the agent: named `<prefix>__<tool>` after the
 *  id declaring it, its description led by that id and its path,
 *  its input schema the mcp origin's own (FR-153). */
const ServedToolSchema = dto(
  "ServedTool",
  z.object({
    name: z.string(),
    description: z.string(),
    inputSchema: z.record(z.string(), z.unknown()),
  }),
);

/** What one run serves, ordered by name, and what was left out and why: a
 *  mcp origin down or not signed in to, a declared tool its mcp origin lacks (FR-153,
 *  FR-154). */
const ServedToolsSchema = dto(
  "ServedTools",
  z.object({
    tools: z.array(ServedToolSchema).readonly(),
    problems: StringsSchema,
  }),
);

/** One primitive installed from a vendor source: its kind, id and
 *  description, and, for a skill converted from a `SKILL.md`, the headers the
 *  charter has no field for (CORE-FR-184, CORE-FR-186). */
const VendorPrimitiveSchema = dto(
  "VendorPrimitive",
  z.object({
    kind: z.string(),
    id: z.string(),
    description: z.string(),
    leftOutHeaders: StringsSchema,
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

/** An access token to one mcp origin, the developer's own, renewed where it
 *  had expired: what the runtime calls the mcp origin with. */
const AccessTokenSchema = dto(
  "AccessToken",
  z.object({
    accessToken: z.string(),
  }),
);

/** Where an mcp origin is reached: its address, the endpoint or the local
 *  command it is served at, the path under it, and how it takes a sign-in. */
const McpOriginAddressSchema = z.object({
  address: z.string(),
  endpoint: z.string().optional(),
  command: z.object({ command: z.string(), args: StringsSchema, tokenEnv: z.string().optional() }).optional(),
  path: z.string().optional(),
  auth: StringsSchema,
});

/** One tool an mcp declares, under the name it is served by, and the mcp
 *  origin a call to it is forwarded to. */
const DeclaredToolSchema = dto(
  "DeclaredTool",
  z.object({
    servedName: z.string(),
    tool: z.string(),
    mcpId: z.string(),
    origin: McpOriginAddressSchema,
  }),
);

/** Every tool the last build's mcp origins declare, and what kept one from
 *  being served, the fix among it: what runtime forwards calls by. */
const DeclaredToolsSchema = dto(
  "DeclaredTools",
  z.object({
    tools: z.array(DeclaredToolSchema).readonly(),
    problems: StringsSchema,
  }),
);

/** The commands the last build laid for one signal of one agent: what runtime
 *  runs as that signal's hook. */
const SensorCommandsSchema = dto(
  "SensorCommands",
  z.object({
    commands: StringsSchema,
  }),
);

/** What each agent the repository compiles for is sent of the charter when a
 *  session opens, each text as the build lays it: what runtime has the agent's
 *  own command line count exactly. */
const MainContextTextsSchema = dto(
  "MainContextTexts",
  z.object({
    agents: z
      .array(
        z.object({
          agent: z.string(),
          texts: z
            .array(z.object({ id: z.string(), kind: z.string(), text: z.string(), globs: StringsSchema.optional() }))
            .readonly(),
        }),
      )
      .readonly(),
  }),
);

/** Every evaluation case the store holds now, committed or not, checked against its charter: its
 *  file's name, its prompt, what it expects, and the body of the guide it
 *  follows, where it follows one. */
const EvalCasesSchema = dto(
  "EvalCases",
  z.object({
    cases: z
      .array(
        z.object({
          suiteName: z.string(),
          prompt: z.string(),
          expect: z.object({
            invoke: z.string().optional(),
            follow: z.string().optional(),
            read: z.string().optional(),
            maxTokens: z.number().optional(),
          }),
          guideBody: z.string().optional(),
        }),
      )
      .readonly(),
  }),
);

/** Where the charter is kept, laid out in three parts (CORE-FR-224). */
const CharterLayoutSchema = dto(
  "CharterLayout",
  z.object({
    charterUri: z.string(),
  }),
);

/** What checking a repository found (FR-040): which agents it compiles for;
 *  every fault in its charter under its file, how many of them are errors and
 *  how many warnings; how many files a build would still change — `null` where
 *  the charter does not hold and nothing was previewed; and how many of those
 *  three questions are unwell. Beside them, what each agent's main context is estimated to open a
 *  session with — none where the charter does not hold — and the ceiling it is
 *  held to, which warns and is no question unwell (EVAL-FR-006). */
const DoctorOutcomeSchema = dto(
  "DoctorOutcome",
  z.object({
    agents: StringsSchema,
    errorCount: z.number(),
    warnCount: z.number(),
    pendingCount: z.number().nullable(),
    faultsByFile: FaultDTOs.FaultsByFile,
    problemCount: z.number(),
    mainContexts: z.array(z.object({ agent: z.string(), totalTokens: z.number() })).readonly(),
    mainContextCeiling: z.number(),
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
    primitive: PrimitiveSchema,
    activatesWhen: z.string(),
    useMixins: z.array(PrimitiveSchema).readonly(),
    rationale: PrimitiveSchema.optional(),
    /** Every primitive that pulls this mixin in. */
    usedByPrimitives: z.array(PrimitiveSchema).readonly(),
    citers: z.array(PrimitiveSchema).readonly(),
    mentioners: z.array(PrimitiveSchema).readonly(),
    testCasesByFile: TestCasesByFileSchema,
  }),
);

/** What installing one vendor source came to (CORE-FR-184, CORE-FR-196):
 *  each vendor folder it filled — its one charter's, each charter picked, the
 *  skills chosen — with the primitives installed there. */
const VendorAddOutcomeSchema = dto(
  "VendorAddOutcome",
  z
    .array(
      z.object({
        folder: z.string(),
        primitives: z.array(VendorPrimitiveSchema).readonly(),
      }),
    )
    .readonly(),
);

/** Every schema of this module's DTOs, under its name — the name it carries
 *  as `type` — in alphabetical order. */
export const CharterDTOs = groupByType(
  AccessTokenSchema,
  CatalogueSchema,
  CatalogueEntrySchema,
  CharterLayoutSchema,
  DeclaredToolSchema,
  DeclaredToolsSchema,
  DoctorOutcomeSchema,
  EvalCaseSchema,
  EvalCasesSchema,
  EvalSuiteSchema,
  EvalSuiteNameSchema,
  EvalSuitesSchema,
  ExplanationOutcomeSchema,
  MainContextSchema,
  MainContextLoadSchema,
  MainContextTextsSchema,
  MainContextsSchema,
  ProjectionPlanSummarySchema,
  PrimitiveSchema,
  PrimitiveHeaderSchema,
  PrimitiveKindsSchema,
  PrimitiveRequirementsSchema,
  PrimitivesSchema,
  SensorCommandsSchema,
  ServedToolSchema,
  ServedToolsSchema,
  SignInStatusSchema,
  SignInStatusesSchema,
  TestCaseSchema,
  TestCaseReportSchema,
  TestCasesByFileSchema,
  TestRunReportSchema,
  TestSuiteSchema,
  TestSuiteNameSchema,
  TestSuitesSchema,
  VendorAddOutcomeSchema,
  VendorFolderSchema,
  VendorFoldersSchema,
  VendorPrimitiveSchema,
);

/** Every DTO's type, under its name: what its schema infers. */
export namespace CharterDTOs {
  export type AccessToken = z.infer<typeof CharterDTOs.AccessToken>;
  export type Catalogue = z.infer<typeof CharterDTOs.Catalogue>;
  export type CatalogueEntry = z.infer<typeof CharterDTOs.CatalogueEntry>;
  export type CharterLayout = z.infer<typeof CharterDTOs.CharterLayout>;
  export type DeclaredTool = z.infer<typeof CharterDTOs.DeclaredTool>;
  export type DeclaredTools = z.infer<typeof CharterDTOs.DeclaredTools>;
  export type DoctorOutcome = z.infer<typeof CharterDTOs.DoctorOutcome>;
  export type EvalCase = z.infer<typeof CharterDTOs.EvalCase>;
  export type EvalCases = z.infer<typeof CharterDTOs.EvalCases>;
  export type EvalSuite = z.infer<typeof CharterDTOs.EvalSuite>;
  export type EvalSuiteName = z.infer<typeof CharterDTOs.EvalSuiteName>;
  export type EvalSuites = z.infer<typeof CharterDTOs.EvalSuites>;
  export type ExplanationOutcome = z.infer<typeof CharterDTOs.ExplanationOutcome>;
  export type MainContext = z.infer<typeof CharterDTOs.MainContext>;
  export type MainContextLoad = z.infer<typeof CharterDTOs.MainContextLoad>;
  export type MainContextTexts = z.infer<typeof CharterDTOs.MainContextTexts>;
  export type MainContexts = z.infer<typeof CharterDTOs.MainContexts>;
  export type ProjectionPlanSummary = z.infer<typeof CharterDTOs.ProjectionPlanSummary>;
  export type Primitive = z.infer<typeof CharterDTOs.Primitive>;
  export type PrimitiveHeader = z.infer<typeof CharterDTOs.PrimitiveHeader>;
  export type PrimitiveKinds = z.infer<typeof CharterDTOs.PrimitiveKinds>;
  export type PrimitiveRequirements = z.infer<typeof CharterDTOs.PrimitiveRequirements>;
  export type Primitives = z.infer<typeof CharterDTOs.Primitives>;
  export type SensorCommands = z.infer<typeof CharterDTOs.SensorCommands>;
  export type ServedTool = z.infer<typeof CharterDTOs.ServedTool>;
  export type ServedTools = z.infer<typeof CharterDTOs.ServedTools>;
  export type SignInStatus = z.infer<typeof CharterDTOs.SignInStatus>;
  export type SignInStatuses = z.infer<typeof CharterDTOs.SignInStatuses>;
  export type TestCase = z.infer<typeof CharterDTOs.TestCase>;
  export type TestCaseReport = z.infer<typeof CharterDTOs.TestCaseReport>;
  export type TestCasesByFile = z.infer<typeof CharterDTOs.TestCasesByFile>;
  export type TestRunReport = z.infer<typeof CharterDTOs.TestRunReport>;
  export type TestSuite = z.infer<typeof CharterDTOs.TestSuite>;
  export type TestSuiteName = z.infer<typeof CharterDTOs.TestSuiteName>;
  export type TestSuites = z.infer<typeof CharterDTOs.TestSuites>;
  export type VendorAddOutcome = z.infer<typeof CharterDTOs.VendorAddOutcome>;
  export type VendorFolder = z.infer<typeof CharterDTOs.VendorFolder>;
  export type VendorFolders = z.infer<typeof CharterDTOs.VendorFolders>;
  export type VendorPrimitive = z.infer<typeof CharterDTOs.VendorPrimitive>;
}
