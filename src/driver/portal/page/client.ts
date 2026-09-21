import { hc } from "hono/client";
import type { Api } from "../routes.js";

/** Every route under `/api`, typed off the routes themselves: a route chained
 *  onto the app is here with its answer, and nothing is written twice. Each call
 *  carries the token the page was opened with (plan §6). */
export const client = hc<Api>("/api", {
  headers: { Authorization: `Bearer ${new URLSearchParams(location.search).get("t") ?? ""}` },
});
