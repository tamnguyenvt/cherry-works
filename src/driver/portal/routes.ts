import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { Fault, type ForManagingCharter } from "#hexagon/port/driver/ForManagingCharter.js";
import type { ForVendoringCharters } from "#hexagon/port/driver/ForVendoringCharters.js";
import { DataDTOs, OutcomeDTOs } from "#hexagon/port/driver/dtos/index.js";
import { faultDTO } from "#hexagon/application/dtos.js";

/** One answer sent as JSON, under the schema it parses by. */
const json = <Schema extends z.ZodType>(schema: Schema, description: string) => ({
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
export function api(charterAuthoringApp: ForManagingCharter, charterVendoringApp: ForVendoringCharters) {
  const app = new OpenAPIHono();
  app.onError((raised, c) => {
    // What no file is wrong with — a word that is no kind, an identity the
    // charter holds nothing of — is raised rather than given back, and reads
    // at the page as every other fault does (plan §2.2).
    if (raised instanceof Fault) return c.json(faultDTO(raised), 422);
    // What hono refused before a route was reached — a body that is not JSON —
    // goes out with the status hono gave it.
    if (raised instanceof HTTPException) return raised.getResponse();
    // Nothing the engine meant to say. The page is told what went wrong and
    // the terminal the portal was started from keeps the whole of it.
    console.error(raised);
    return c.text(raised.message, 500);
  });

  return app
    .openapi(
      createRoute({
        method: "get",
        path: "/charter/root/faults",
        responses: { 200: json(DataDTOs.FaultsByFile, "Everything wrong with the charter, under each file") },
      }),
      async (c) => c.json((await charterAuthoringApp.doctor()).data.faultsByFile, 200),
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/charter/root/primitives",
        request: { query: z.object({ matching: z.string().optional() }) },
        responses: {
          200: json(DataDTOs.ScopedPrimitives, "Every primitive of every layer, or those mentioning the word"),
          422: json(z.union([DataDTOs.FaultsByFile, DataDTOs.Fault]), "The charter does not hold"),
        },
      }),
      async (c) => {
        // Never one kind of it: whoever is showing it by kind is counting every
        // kind as well, so a narrowed answer would be a second call for what the
        // first one already carried. A word searched for narrows it, and an
        // empty box is no word.
        const scopedPrimitivesDTO = await charterAuthoringApp.fullList(c.req.valid("query").matching || undefined);
        return scopedPrimitivesDTO.type === "FaultsByFile" ? c.json(scopedPrimitivesDTO, 422) : c.json(scopedPrimitivesDTO, 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/charter/root/primitives/{identity}/explanation",
        request: { params: z.object({ identity: z.string() }) },
        responses: {
          200: json(OutcomeDTOs.ExplanationOutcome, "What the engine says of one primitive"),
          422: json(z.union([DataDTOs.FaultsByFile, DataDTOs.Fault]), "The charter does not hold, or holds nothing of it"),
        },
      }),
      async (c) => {
        const { identity } = c.req.valid("param");
        const explanationOutcomeDTO = await charterAuthoringApp.explain(identity);
        return explanationOutcomeDTO.type === "FaultsByFile" ? c.json(explanationOutcomeDTO, 422) : c.json(explanationOutcomeDTO, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/charter/root/primitives",
        request: {
          body: json(
            z.object({
              kind: z.string(),
              id: z.string(),
              headers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
              body: z.string(),
            }),
            "A new primitive: its kind and id, a line or a list under each header, and its body",
          ),
        },
        responses: {
          201: {
            ...json(DataDTOs.ScopedPrimitive, "The primitive written"),
            headers: z.object({ Location: z.string() }),
          },
          422: json(z.union([DataDTOs.Faults, DataDTOs.Fault]), "The answers the kind refused, or an identity already claimed"),
        },
      }),
      async (c) => {
        const { kind, id, headers, body } = c.req.valid("json");
        const scopedPrimitiveDTO = await charterAuthoringApp.add(kind, id, headers, body);
        if (scopedPrimitiveDTO.type === "Faults") return c.json(scopedPrimitiveDTO, 422);
        return c.json(scopedPrimitiveDTO, 201, { Location: `/api/charter/root/primitives/${scopedPrimitiveDTO.data.identity}` });
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/charter/root/primitives/{identity}",
        request: { params: z.object({ identity: z.string() }) },
        responses: {
          200: {
            ...json(DataDTOs.PrimitiveSnapshot, "One primitive as the charter read it"),
            headers: z.object({ ETag: z.string() }),
          },
          422: json(DataDTOs.Fault, "The charter holds nothing of it"),
        },
      }),
      async (c) => {
        const { identity } = c.req.valid("param");
        const primitiveSnapshotDTO = await charterAuthoringApp.open(identity);
        // The revision is a content hash already; an entity tag is quoted.
        return c.json(primitiveSnapshotDTO, 200, { ETag: `"${primitiveSnapshotDTO.data.revision}"` });
      },
    )
    .openapi(
      createRoute({
        method: "put",
        path: "/charter/root/primitives/{identity}",
        request: {
          params: z.object({ identity: z.string() }),
          headers: z.object({ "if-match": z.string().optional() }),
          body: json(
            z.object({
              headers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
              body: z.string(),
            }),
            "A line or a list under each header, and the body, written over the primitive's own",
          ),
        },
        responses: {
          200: json(DataDTOs.ScopedPrimitive, "The primitive written"),
          412: json(DataDTOs.Fault, "The file changed on disk after it was opened"),
          422: json(z.union([DataDTOs.Faults, DataDTOs.Fault]), "The answers the kind refused, or a primitive this repository did not author"),
        },
      }),
      async (c) => {
        const { identity } = c.req.valid("param");
        // The primitive is opened again here, and its revision held against the
        // one the page opened it at, so a stale one is a 412 rather than a
        // refusal like any other; `rewrite` is handed the revision just opened,
        // and checks it once more as it writes (FR-078).
        const { revision, scopedPrimitive } = (await charterAuthoringApp.open(identity)).data;
        if (c.req.valid("header")["if-match"] !== `"${revision}"`)
          return c.json(
            faultDTO(
              new Fault(
                `${scopedPrimitive.data.file} changed on disk after it was opened, and saving would write over that change.`,
                "Open it again to see what changed, then make your edit there.",
              ),
            ),
            412,
          );

        const { headers, body } = c.req.valid("json");
        const scopedPrimitiveDTO = await charterAuthoringApp.rewrite(identity, headers, body, revision);
        return scopedPrimitiveDTO.type === "Faults" ? c.json(scopedPrimitiveDTO, 422) : c.json(scopedPrimitiveDTO, 200);
      },
    )
    .openapi(
      createRoute({
        method: "delete",
        path: "/charter/root/primitives/{identity}",
        request: { params: z.object({ identity: z.string() }) },
        responses: {
          204: { description: "The file is gone" },
          422: json(DataDTOs.Fault, "A primitive this repository did not author, or none at all"),
        },
      }),
      async (c) => {
        const { identity } = c.req.valid("param");
        await charterAuthoringApp.remove(identity);
        return c.body(null, 204);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/definitions/kinds",
        responses: { 200: json(DataDTOs.PrimitiveKinds, "Every kind, and when a primitive of it comes up") },
      }),
      async (c) => c.json(await charterAuthoringApp.kinds(), 200),
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/definitions/kinds/{kind}/requirements",
        request: { params: z.object({ kind: z.string() }) },
        responses: {
          200: json(DataDTOs.PrimitiveRequirements, "Every header the kind takes, and its sample"),
          422: json(DataDTOs.Fault, "A word that is no kind"),
        },
      }),
      async (c) => c.json(await charterAuthoringApp.listPrimitiveRequirements(c.req.valid("param").kind), 200),
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/charter/root/build",
        responses: {
          200: json(DataDTOs.PlanSummary, "What a build would do to every file, nothing written"),
          422: json(DataDTOs.FaultsByFile, "The charter does not hold"),
        },
      }),
      async (c) => {
        const planSummaryDTO = await charterAuthoringApp.preview();
        return planSummaryDTO.type === "FaultsByFile" ? c.json(planSummaryDTO, 422) : c.json(planSummaryDTO, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/charter/root/build",
        responses: {
          200: json(DataDTOs.PlanSummary, "What the build wrote and deleted"),
          422: json(DataDTOs.FaultsByFile, "The charter does not hold, and nothing was written"),
        },
      }),
      async (c) => {
        const planSummaryDTO = await charterAuthoringApp.build();
        return planSummaryDTO.type === "FaultsByFile" ? c.json(planSummaryDTO, 422) : c.json(planSummaryDTO, 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/charter/root/health",
        responses: { 200: json(OutcomeDTOs.DoctorOutcome, "The four answers cw doctor gives, and every fault") },
      }),
      async (c) => c.json(await charterAuthoringApp.doctor(), 200),
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/vendors",
        responses: { 200: json(z.array(z.string()).readonly(), "Every folder a vendor source was installed as") },
      }),
      async (c) => c.json(await charterVendoringApp.installed(), 200),
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/vendors",
        request: {
          body: json(
            z.object({ source: z.string(), version: z.string().optional() }),
            "A source as git fetches it, and the version to pin it to where one is named",
          ),
        },
        responses: {
          204: { description: "The source is installed, and committed" },
          422: json(DataDTOs.Fault, "No repository, work in hand, or what git refused"),
        },
      }),
      async (c) => {
        const { source, version } = c.req.valid("json");
        await charterVendoringApp.add(source, version);
        return c.body(null, 204);
      },
    )
    .openapi(
      createRoute({
        method: "delete",
        path: "/vendors/{name}",
        request: { params: z.object({ name: z.string() }) },
        responses: {
          204: { description: "The folder is gone, and that it is gone is committed" },
          422: json(DataDTOs.Fault, "No repository, work in hand, or what git refused"),
        },
      }),
      async (c) => {
        await charterVendoringApp.remove(c.req.valid("param").name);
        return c.body(null, 204);
      },
    );
}

/** Every route with what it takes and the answer it sends, for `hc` to type
 *  the page's calls by: a route declared above is here, and nothing is written
 *  twice. */
export type Api = ReturnType<typeof api>;
