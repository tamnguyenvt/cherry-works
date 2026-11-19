import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { CharterDTOs, type ForAuthoringCharter, type ForBuildingCharter } from "#module/charter/module.js";
import { FaultDTOs, INTERNAL_FAULT_DTO, z } from "#module/shared/module.js";
import { WorkspaceDTOs } from "#module/workspace/module.js";

/** One answer sent as JSON, under the schema it parses by. */
const describeJsonContent = <Schema extends z.ZodType>(schema: Schema, description: string) => ({
  content: { "application/json": { schema } },
  description,
});

/** The portal's routes, one per use case, mounted at `/api` (plan §2.2). The
 *  page calls them through `hc<Api>("/api")`, and imports nothing else of this
 *  file.
 *
 *  Each is declared as OpenAPI declares one: its path, what it takes — the path
 *  segments, the query, the request body — and every answer it sends under its
 *  status. The page's calls are typed off these declarations, request and
 *  answer alike, and a request whose body is not the shape declared is refused
 *  with a 400 before the engine is asked. The shape is all it checks: which
 *  headers a kind takes, and whether an answer is one it takes, is the
 *  engine's to say.
 *
 *  No route holds a rule: each reads its arguments, calls one port method, and
 *  sends the answer on as the port gave it. What a route decides is the status
 *  alone — the answer's own `type` says which it is, since a use case hands
 *  back what it found rather than throwing it (FR-009).
 *
 *  The port arrives here rather than being reached for: the command line built
 *  it over the repository it was run in, and `main.ts` stays the one
 *  composition root. */
export function buildPortalRoutes(
  charterAuthoringApp: ForAuthoringCharter,
  charterBuildingApp: ForBuildingCharter,
  /** What the repository configured itself with, as the command line reads
   *  it (CORE-FR-231). */
  loadWorkspaceSettings: () => Promise<WorkspaceDTOs.WorkspaceSettings | FaultDTOs.Fault>,
) {
  const portalRoutes = new OpenAPIHono();
  // Every use case answers its faults as DTOs, a `Fault` going out as a 422
  // like every other refusal (plan §2.2, SDK-FR-004) — but for the system's
  // own, which no request of the caller's caused: an `InternalFault` goes out
  // as a 500, its body the same DTO (SDK-FR-018).
  portalRoutes.use("*", async (requestContext, nextMiddleware) => {
    await nextMiddleware();
    if (requestContext.res.status !== 422) return;
    const faultDTO = (await requestContext.res
      .clone()
      .json()
      .catch(() => undefined)) as Partial<FaultDTOs.Fault> | undefined;
    if (faultDTO?.type === "Fault" && faultDTO.data?.name === "InternalFault")
      requestContext.res = new Response(requestContext.res.body, { status: 500, headers: requestContext.res.headers });
  });
  // What is left to catch here is hono's own.
  portalRoutes.onError((honoError, requestContext) => {
    // What hono refused before a route was reached — a body that is not JSON —
    // goes out with the status hono gave it.
    if (honoError instanceof HTTPException) return honoError.getResponse();
    // Nothing the engine meant to say. The terminal the portal was started
    // from keeps the whole of it; the page is told only the internal fault
    // (SDK-FR-018).
    console.error(honoError);
    return requestContext.json(INTERNAL_FAULT_DTO, 500);
  });

  return portalRoutes
    .openapi(
      createRoute({
        method: "get",
        path: "/charter/root/faults",
        responses: {
          200: describeJsonContent(FaultDTOs.FaultsByFile, "Everything wrong with the charter, under each file"),
          422: describeJsonContent(FaultDTOs.Fault, "What stopped the charter being read"),
        },
      }),
      async (requestContext) => {
        const doctorOutcomeDTO = await charterBuildingApp.diagnoseCharter();
        return doctorOutcomeDTO.type === "Fault"
          ? requestContext.json(doctorOutcomeDTO, 422)
          : requestContext.json(doctorOutcomeDTO.data.faultsByFile, 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/charter/root/primitives",
        request: { query: z.object({ matching: z.string().optional() }) },
        responses: {
          200: describeJsonContent(
            CharterDTOs.Primitives,
            "Every primitive of every layer, or those mentioning the word",
          ),
          422: describeJsonContent(z.union([FaultDTOs.FaultsByFile, FaultDTOs.Fault]), "The charter does not hold"),
        },
      }),
      async (requestContext) => {
        // Never one kind of it: whoever is showing it by kind is counting every
        // kind as well, so a narrowed answer would be a second call for what the
        // first one already carried. A word searched for narrows it, and an
        // empty box is no word.
        const primitivesDTO = await charterAuthoringApp.listPrimitives(
          requestContext.req.valid("query").matching || undefined,
        );
        return primitivesDTO.type === "Primitives"
          ? requestContext.json(primitivesDTO, 200)
          : requestContext.json(primitivesDTO, 422);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/charter/{charterName}/primitives",
        request: {
          params: z.object({ charterName: z.string() }),
          query: z.object({ matching: z.string().optional() }),
        },
        responses: {
          200: describeJsonContent(
            CharterDTOs.Primitives,
            "Every primitive of one charter, or those mentioning the word",
          ),
          422: describeJsonContent(
            z.union([FaultDTOs.FaultsByFile, FaultDTOs.Fault]),
            "The charter does not hold, or holds no charter of the name",
          ),
        },
      }),
      async (requestContext) => {
        const primitivesDTO = await charterAuthoringApp.listPrimitives(
          requestContext.req.valid("query").matching || undefined,
          requestContext.req.valid("param").charterName,
        );
        return primitivesDTO.type === "Primitives"
          ? requestContext.json(primitivesDTO, 200)
          : requestContext.json(primitivesDTO, 422);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/charter/root/primitives/{id}/explanation",
        request: { params: z.object({ id: z.string() }) },
        responses: {
          200: describeJsonContent(CharterDTOs.ExplanationOutcome, "What the engine says of one primitive"),
          422: describeJsonContent(
            z.union([FaultDTOs.FaultsByFile, FaultDTOs.Fault]),
            "The charter does not hold, or holds nothing of it",
          ),
        },
      }),
      async (requestContext) => {
        const { id } = requestContext.req.valid("param");
        const explanationOutcomeDTO = await charterAuthoringApp.explainPrimitive(id);
        return explanationOutcomeDTO.type === "ExplanationOutcome"
          ? requestContext.json(explanationOutcomeDTO, 200)
          : requestContext.json(explanationOutcomeDTO, 422);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/charter/root/charters",
        responses: {
          200: describeJsonContent(
            CharterDTOs.CharterMetadataList,
            "Every charter of the charter root, authored or installed",
          ),
          422: describeJsonContent(FaultDTOs.Fault, "The charters do not read"),
        },
      }),
      async (requestContext) => {
        const chartersDTO = await charterAuthoringApp.listCharters();
        return chartersDTO.type === "CharterMetadataList"
          ? requestContext.json(chartersDTO, 200)
          : requestContext.json(chartersDTO, 422);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/charter/{charterName}/primitives",
        request: {
          params: z.object({ charterName: z.string() }),
          body: describeJsonContent(
            z.object({
              kind: z.string(),
              id: z.string(),
              headers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
              body: z.string(),
            }),
            "A new primitive of the charter named: its kind and id, a line or a list under each header, and its body",
          ),
        },
        responses: {
          201: {
            ...describeJsonContent(CharterDTOs.Primitive, "The primitive written"),
            headers: z.object({ Location: z.string() }),
          },
          422: describeJsonContent(
            z.union([FaultDTOs.Faults, FaultDTOs.Fault]),
            "The answers the kind refused, or an id already claimed",
          ),
        },
      }),
      async (requestContext) => {
        const { charterName } = requestContext.req.valid("param");
        const { kind, id, headers, body } = requestContext.req.valid("json");
        const primitiveDTO = await charterAuthoringApp.addPrimitive(kind, id, charterName, headers, body);
        if (primitiveDTO.type !== "Primitive") return requestContext.json(primitiveDTO, 422);
        return requestContext.json(primitiveDTO, 201, {
          Location: `/api/charter/root/primitives/${encodeURIComponent(primitiveDTO.data.id)}`,
        });
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/charter/root/primitives/{id}",
        request: { params: z.object({ id: z.string() }) },
        responses: {
          200: {
            ...describeJsonContent(CharterDTOs.Primitive, "One primitive as the charter read it"),
            headers: z.object({ ETag: z.string() }),
          },
          422: describeJsonContent(FaultDTOs.Fault, "The charter holds nothing of it"),
        },
      }),
      async (requestContext) => {
        const { id } = requestContext.req.valid("param");
        const primitiveDTO = await charterAuthoringApp.openPrimitive(id);
        if (primitiveDTO.type === "Fault") return requestContext.json(primitiveDTO, 422);
        // Its hash is the entity tag, quoted.
        return requestContext.json(primitiveDTO, 200, { ETag: `"${primitiveDTO.data.hash}"` });
      },
    )
    .openapi(
      createRoute({
        method: "put",
        path: "/charter/root/primitives/{id}",
        request: {
          params: z.object({ id: z.string() }),
          headers: z.object({ "if-match": z.string().optional() }),
          body: describeJsonContent(
            z.object({
              headers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
              body: z.string(),
            }),
            "A line or a list under each header, and the body, written over the primitive's own",
          ),
        },
        responses: {
          200: describeJsonContent(CharterDTOs.Primitive, "The primitive written"),
          412: describeJsonContent(FaultDTOs.Fault, "The file changed on disk after it was opened"),
          422: describeJsonContent(
            z.union([FaultDTOs.Faults, FaultDTOs.Fault]),
            "The answers the kind refused, or a primitive this repository did not author",
          ),
        },
      }),
      async (requestContext) => {
        const { id } = requestContext.req.valid("param");
        // The entity tag the page opened it at is the hash `rewritePrimitive` holds the
        // file to, so a stale one is refused there, and answered as a 412
        // rather than a refusal like any other (FR-078).
        const openedHash = /^"(.*)"$/.exec(requestContext.req.valid("header")["if-match"] ?? "")?.[1] ?? "";
        const { headers, body } = requestContext.req.valid("json");
        const primitiveDTO = await charterAuthoringApp.rewritePrimitive(id, headers, body, openedHash);
        if (primitiveDTO.type === "Fault" && primitiveDTO.data.name === "PrimitiveChangedFault")
          return requestContext.json(primitiveDTO, 412);
        return primitiveDTO.type === "Primitive"
          ? requestContext.json(primitiveDTO, 200)
          : requestContext.json(primitiveDTO, 422);
      },
    )
    .openapi(
      createRoute({
        method: "delete",
        path: "/charter/root/primitives/{id}",
        request: { params: z.object({ id: z.string() }) },
        responses: {
          204: { description: "The file is gone" },
          422: describeJsonContent(FaultDTOs.Fault, "A primitive this repository did not author, or none at all"),
        },
      }),
      async (requestContext) => {
        const { id } = requestContext.req.valid("param");
        const primitiveDTO = await charterAuthoringApp.removePrimitive(id);
        if (primitiveDTO.type === "Fault") return requestContext.json(primitiveDTO, 422);
        return requestContext.body(null, 204);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/definitions/kinds",
        responses: {
          200: describeJsonContent(CharterDTOs.PrimitiveKinds, "Every kind, and when a primitive of it comes up"),
          422: describeJsonContent(FaultDTOs.Fault, "What stopped the kinds being said"),
        },
      }),
      async (requestContext) => {
        const primitiveKindsDTO = await charterAuthoringApp.listKinds();
        return primitiveKindsDTO.type === "Fault"
          ? requestContext.json(primitiveKindsDTO, 422)
          : requestContext.json(primitiveKindsDTO, 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/definitions/kinds/{kind}/requirements",
        request: { params: z.object({ kind: z.string() }) },
        responses: {
          200: describeJsonContent(CharterDTOs.PrimitiveRequirements, "Every header the kind takes, and its sample"),
          422: describeJsonContent(FaultDTOs.Fault, "A word that is no kind"),
        },
      }),
      async (requestContext) => {
        const primitiveRequirementsDTO = await charterAuthoringApp.listPrimitiveRequirements(
          requestContext.req.valid("param").kind,
        );
        return primitiveRequirementsDTO.type === "Fault"
          ? requestContext.json(primitiveRequirementsDTO, 422)
          : requestContext.json(primitiveRequirementsDTO, 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/charter/root/build",
        responses: {
          200: describeJsonContent(
            CharterDTOs.ProjectionPlanSummary,
            "What a build would do to every file, nothing written",
          ),
          422: describeJsonContent(z.union([FaultDTOs.FaultsByFile, FaultDTOs.Fault]), "The charter does not hold"),
        },
      }),
      async (requestContext) => {
        const planSummaryDTO = await charterBuildingApp.previewCharterBuild();
        return planSummaryDTO.type === "ProjectionPlanSummary"
          ? requestContext.json(planSummaryDTO, 200)
          : requestContext.json(planSummaryDTO, 422);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/charter/root/build",
        responses: {
          200: describeJsonContent(CharterDTOs.ProjectionPlanSummary, "What the build wrote and deleted"),
          422: describeJsonContent(
            z.union([FaultDTOs.FaultsByFile, FaultDTOs.Fault]),
            "The charter does not hold, and nothing was written",
          ),
        },
      }),
      async (requestContext) => {
        const planSummaryDTO = await charterBuildingApp.buildCharter();
        return planSummaryDTO.type === "ProjectionPlanSummary"
          ? requestContext.json(planSummaryDTO, 200)
          : requestContext.json(planSummaryDTO, 422);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/charter/root/health",
        responses: {
          200: describeJsonContent(CharterDTOs.DoctorOutcome, "The four answers cw doctor gives, and every fault"),
          422: describeJsonContent(FaultDTOs.Fault, "What stopped the questions being asked"),
        },
      }),
      async (requestContext) => {
        const doctorOutcomeDTO = await charterBuildingApp.diagnoseCharter();
        return doctorOutcomeDTO.type === "Fault"
          ? requestContext.json(doctorOutcomeDTO, 422)
          : requestContext.json(doctorOutcomeDTO, 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/charter/root/context",
        responses: {
          200: describeJsonContent(
            CharterDTOs.MainContexts,
            "What the charter puts into each agent's main context, estimated, as cw context lists it",
          ),
          422: describeJsonContent(z.union([FaultDTOs.FaultsByFile, FaultDTOs.Fault]), "The charter does not hold"),
        },
      }),
      async (requestContext) => {
        const mainContextsDTO = await charterBuildingApp.predictMainContext();
        return mainContextsDTO.type === "MainContexts"
          ? requestContext.json(mainContextsDTO, 200)
          : requestContext.json(mainContextsDTO, 422);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/settings",
        responses: {
          200: describeJsonContent(
            WorkspaceDTOs.WorkspaceSettings,
            "What this repository configured itself with, whole",
          ),
          422: describeJsonContent(FaultDTOs.Fault, "Settings that do not read"),
        },
      }),
      async (requestContext) => {
        const workspaceSettingsDTO = await loadWorkspaceSettings();
        return workspaceSettingsDTO.type === "Fault"
          ? requestContext.json(workspaceSettingsDTO, 422)
          : requestContext.json(workspaceSettingsDTO, 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/test-suites",
        responses: {
          200: describeJsonContent(
            CharterDTOs.TestSuites,
            "Every test file, its text, and its cases or why it does not read",
          ),
          422: describeJsonContent(FaultDTOs.Fault, "What stopped the test files being read"),
        },
      }),
      async (requestContext) => {
        const testSuitesDTO = await charterAuthoringApp.listTestSuites();
        return testSuitesDTO.type === "Fault"
          ? requestContext.json(testSuitesDTO, 422)
          : requestContext.json(testSuitesDTO, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/test-suites",
        request: {
          body: describeJsonContent(
            z.object({ charterName: z.string().optional() }),
            "The charter it is written into, or none for the one charter the repository authored",
          ),
        },
        responses: {
          201: {
            ...describeJsonContent(CharterDTOs.TestSuiteName, "The name of the test file written"),
            headers: z.object({ Location: z.string() }),
          },
          422: describeJsonContent(FaultDTOs.Fault, "What stopped the test file being written"),
        },
      }),
      async (requestContext) => {
        const testSuiteNameDTO = await charterAuthoringApp.addTestSuite(
          requestContext.req.valid("json").charterName || undefined,
        );
        if (testSuiteNameDTO.type === "Fault") return requestContext.json(testSuiteNameDTO, 422);
        return requestContext.json(testSuiteNameDTO, 201, {
          Location: `/api/test-suites/${testSuiteNameDTO.data.charterName}/${testSuiteNameDTO.data.name}`,
        });
      },
    )
    .openapi(
      createRoute({
        method: "put",
        path: "/test-suites/{charterName}/{name}",
        request: {
          params: z.object({ charterName: z.string(), name: z.string() }),
          body: describeJsonContent(
            z.object({ text: z.string() }),
            "The whole text the test file is written over with",
          ),
        },
        responses: {
          200: describeJsonContent(CharterDTOs.TestSuiteName, "The name of the test file written"),
          422: describeJsonContent(
            FaultDTOs.Fault,
            "Text that is not a suite, with its sample, or a name that is no test file of the charter",
          ),
        },
      }),
      async (requestContext) => {
        const testSuiteNameDTO = await charterAuthoringApp.writeTestSuite(
          requestContext.req.valid("param").charterName,
          requestContext.req.valid("param").name,
          requestContext.req.valid("json").text,
        );
        return testSuiteNameDTO.type === "TestSuiteName"
          ? requestContext.json(testSuiteNameDTO, 200)
          : requestContext.json(testSuiteNameDTO, 422);
      },
    )
    .openapi(
      createRoute({
        method: "delete",
        path: "/test-suites/{charterName}/{name}",
        request: { params: z.object({ charterName: z.string(), name: z.string() }) },
        responses: {
          204: { description: "The test file is gone" },
          422: describeJsonContent(FaultDTOs.Fault, "A name that is no test file"),
        },
      }),
      async (requestContext) => {
        const { charterName, name: testSuiteName } = requestContext.req.valid("param");
        const testSuiteNameDTO = await charterAuthoringApp.removeTestSuite(charterName, testSuiteName);
        if (testSuiteNameDTO.type === "Fault") return requestContext.json(testSuiteNameDTO, 422);
        return requestContext.body(null, 204);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/test-suites/outcome",
        responses: {
          200: describeJsonContent(CharterDTOs.TestRunReport, "How every case came out"),
          422: describeJsonContent(
            z.union([FaultDTOs.FaultsByFile, FaultDTOs.Fault]),
            "The charter does not hold, or a test file does not read",
          ),
        },
      }),
      async (requestContext) => {
        const testRunReportDTO = await charterAuthoringApp.testCharter();
        return testRunReportDTO.type === "TestRunReport"
          ? requestContext.json(testRunReportDTO, 200)
          : requestContext.json(testRunReportDTO, 422);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/vendors",
        responses: {
          200: describeJsonContent(
            CharterDTOs.CharterMetadataList,
            "Every charter installed, with its source and version",
          ),
          422: describeJsonContent(FaultDTOs.Fault, "What stopped the installed charters being listed"),
        },
      }),
      async (requestContext) => {
        const chartersDTO = await charterAuthoringApp.listVendors();
        return chartersDTO.type === "CharterMetadataList"
          ? requestContext.json(chartersDTO, 200)
          : requestContext.json(chartersDTO, 422);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/vendors",
        request: {
          body: describeJsonContent(
            z.object({ source: z.string(), version: z.string().optional() }),
            "A source as git fetches it, and the version to pin it to where one is named",
          ),
        },
        responses: {
          204: {
            description: "The source is installed — every charter it authored, with what each includes — left unstaged",
          },
          422: describeJsonContent(
            FaultDTOs.Fault,
            "No git on the machine, a source authoring no charter, a name already held, or what git refused",
          ),
        },
      }),
      async (requestContext) => {
        const { source, version } = requestContext.req.valid("json");
        const vendorAddOutcomeDTO = await charterAuthoringApp.addVendor(source, version);
        if (vendorAddOutcomeDTO.type === "Fault") return requestContext.json(vendorAddOutcomeDTO, 422);
        return requestContext.body(null, 204);
      },
    )
    .openapi(
      createRoute({
        method: "delete",
        path: "/vendors/{name}",
        request: { params: z.object({ name: z.string() }) },
        responses: {
          204: { description: "The charter is gone, left uncommitted in the working tree" },
          422: describeJsonContent(
            FaultDTOs.Fault,
            "A name no installed charter answers to, or a charter that cannot be taken away",
          ),
        },
      }),
      async (requestContext) => {
        const vendorFolderDTO = await charterAuthoringApp.removeVendor(requestContext.req.valid("param").name);
        if (vendorFolderDTO.type === "Fault") return requestContext.json(vendorFolderDTO, 422);
        return requestContext.body(null, 204);
      },
    );
}

/** Every route with what it takes and the answer it sends, for `hc` to type
 *  the page's calls by: a route declared above is here, and nothing is written
 *  twice. */
export type Api = ReturnType<typeof buildPortalRoutes>;
