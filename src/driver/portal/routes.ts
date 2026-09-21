import { Hono } from "hono";
import { Fault, type ForManagingCharter } from "#hexagon/port/driver/ForManagingCharter.js";
import { faultDTO } from "#hexagon/application/dtos.js";

/** The portal's routes, one per use case, mounted at `/api` (plan §2.2). The
 *  page calls them through `hc<Api>("/api")`, and imports nothing else of this
 *  file.
 *
 *  No route holds a rule: each reads its arguments, calls one port method, and
 *  sends the answer on as the port gave it. What a route decides is the status
 *  alone — the answer's own `type` says which it is, since a use case hands
 *  back what it found rather than throwing it (FR-009).
 *
 *  The port arrives here rather than being reached for: the command line built
 *  it over the repository it was run in, and `main.ts` stays the one
 *  composition root. */
export function api(charterAuthoringApp: ForManagingCharter) {
  return new Hono()
    .onError((raised, c) => {
      // What no file is wrong with — a word that is no kind, an identity the
      // charter holds nothing of — is raised rather than given back, and reads
      // at the page as every other fault does (plan §2.2).
      if (raised instanceof Fault) return c.json(faultDTO(raised), 422);
      // Nothing the engine meant to say. The page is told what went wrong and
      // the terminal the portal was started from keeps the whole of it.
      console.error(raised);
      return c.text(raised.message, 500);
    })
    .get("/charter/root/faults", async (c) => c.json((await charterAuthoringApp.doctor()).data.faultsByFile))
    .get("/charter/root/primitives", async (c) => {
      // The whole listing, never one kind of it: whoever is showing it by kind
      // is counting every kind as well, so a narrowed answer would be a second
      // call for what the first one already carried.
      const catalogueDTO = await charterAuthoringApp.list();
      return catalogueDTO.type === "FaultsByFile" ? c.json(catalogueDTO, 422) : c.json(catalogueDTO);
    })
    .get("/definitions/kinds", async (c) => c.json(await charterAuthoringApp.kinds()));
}

/** Every route with the answer it sends, for `hc` to type the page's calls by:
 *  a route chained above is here, and nothing is written twice. */
export type Api = ReturnType<typeof api>;
