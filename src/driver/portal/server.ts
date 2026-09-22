import { randomBytes } from "node:crypto";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { serve, type ServerType } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Fault, type ForManagingCharter } from "#hexagon/port/driver/ForManagingCharter.js";
import type { ForVendoringCharters } from "#hexagon/port/driver/ForVendoringCharters.js";
import { api } from "./routes.js";

export const DEFAULT_PORT = 9927;

/**
 * Serve the routes and the page built into `page` on this machine alone
 * (FR-003), from `port` or the next free one when it is taken. The address
 * answered carries the token of this run (plan §6).
 *
 * The routes are driven by the ports this was handed, over the repository the
 * caller built them for: the portal is a second driving adapter and composes
 * nothing of its own.
 *
 * Refused when the page was never built: a blank page says less than a portal
 * that does not start (plan §8).
 */
export async function startPortal(
  page: URL,
  charterAuthoringApp: ForManagingCharter,
  charterVendoringApp: ForVendoringCharters,
  port = DEFAULT_PORT,
): Promise<{ address: URL; server: ServerType }> {
  await access(new URL("index.html", page)).catch(() => {
    throw new Fault("The portal's page is not built.", 'Run "pnpm build", then start the portal again.');
  });

  const token = randomBytes(32).toString("base64url");
  for (let next = port; ; next++) {
    try {
      const address = new URL(`http://127.0.0.1:${next}/?t=${token}`);
      return { address, server: await listen(portal(page, charterAuthoringApp, charterVendoringApp, token, next), next) };
    } catch (raised) {
      if ((raised as NodeJS.ErrnoException).code !== "EADDRINUSE" || next === 65535) throw raised;
    }
  }
}

/**
 * The routes and the page behind the guards of plan §6: a `Host` naming this
 * port, JSON on every verb but `GET`, and the token on the page's address and
 * on every call to `/api`. The page's other files are the bundle `pnpm build`
 * wrote, and ask for no token: the browser fetches them from the page's own
 * markup, which cannot carry one. No CORS header is sent, so a page of another
 * origin fails the preflight of every write.
 */
function portal(
  page: URL,
  charterAuthoringApp: ForManagingCharter,
  charterVendoringApp: ForVendoringCharters,
  token: string,
  port: number,
): Hono {
  const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
  return new Hono()
    .use(async (c, next) => {
      if (!hosts.includes(c.req.header("host") ?? "")) {
        return c.text(`The portal answers only at ${hosts.join(" and ")}.`, 403);
      }
      if (c.req.method !== "GET" && c.req.header("content-type")?.split(";")[0]?.trim() !== "application/json") {
        return c.text("Every request but a GET is sent with Content-Type: application/json.", 415);
      }
      await next();
    })
    .use("/", async (c, next) => {
      if (c.req.query("t") !== token) return c.text('Open the address "cw portal" printed: this one has no token.', 401);
      await next();
    })
    .use("/api/*", bearerAuth({ token }))
    .route("/api", api(charterAuthoringApp, charterVendoringApp))
    .use("/*", serveStatic({ root: fileURLToPath(page) }));
}

function listen(app: Hono, port: number): Promise<ServerType> {
  return new Promise((resolve, reject) => {
    const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port }, () => resolve(server));
    server.once("error", reject);
  });
}
