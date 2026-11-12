import { randomBytes } from "node:crypto";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { type ServerType, serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import type { ForAuthoringCharter, ForBuildingCharter } from "#module/charter/module.js";
import type { FaultDTOs } from "#module/shared/module.js";
import type { WorkspaceDTOs } from "#module/workspace/module.js";
import { buildPortalRoutes } from "./portal.routes.js";

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
 * that does not start (plan §8). What comes back then is what to report, in
 * place of the address.
 */
export async function startPortal(
  page: URL,
  {
    charterAuthoringApp,
    charterBuildingApp,
  }: { readonly charterAuthoringApp: ForAuthoringCharter; readonly charterBuildingApp: ForBuildingCharter },
  loadWorkspaceSettings: () => Promise<WorkspaceDTOs.WorkspaceSettings | FaultDTOs.Fault>,
  port = DEFAULT_PORT,
): Promise<{ address: URL; server: ServerType } | string> {
  const isPageBuilt = await access(new URL("index.html", page)).then(
    () => true,
    () => false,
  );
  if (!isPageBuilt) return `The portal's page is not built.\n  Run "pnpm build", then start the portal again.\n`;

  const token = randomBytes(32).toString("base64url");
  for (let candidatePort = port; ; candidatePort++) {
    try {
      const address = new URL(`http://127.0.0.1:${candidatePort}/?t=${token}`);
      const portalApp = buildPortalApp(
        page,
        charterAuthoringApp,
        charterBuildingApp,
        loadWorkspaceSettings,
        token,
        candidatePort,
      );
      const server = await new Promise<ServerType>((resolve, reject) => {
        const listeningServer = serve({ fetch: portalApp.fetch, hostname: "127.0.0.1", port: candidatePort }, () =>
          resolve(listeningServer),
        );
        listeningServer.once("error", reject);
      });
      return { address, server };
    } catch (listenError) {
      // A port taken is the next one tried; any other refusal of the machine's
      // is said as what to report, as a page never built is.
      if ((listenError as NodeJS.ErrnoException).code === "EADDRINUSE" && candidatePort < 65535) continue;
      return `The portal could not listen on 127.0.0.1:${candidatePort}: ${(listenError as Error).message}\n  Free a port on this machine, then start the portal again.\n`;
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
function buildPortalApp(
  page: URL,
  charterAuthoringApp: ForAuthoringCharter,
  charterBuildingApp: ForBuildingCharter,
  loadWorkspaceSettings: () => Promise<WorkspaceDTOs.WorkspaceSettings | FaultDTOs.Fault>,
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
      if (c.req.query("t") !== token)
        return c.text('Open the address "cw portal" printed: this one has no token.', 401);
      await next();
    })
    .use("/api/*", bearerAuth({ token }))
    .route("/api", buildPortalRoutes(charterAuthoringApp, charterBuildingApp, loadWorkspaceSettings))
    .use("/*", serveStatic({ root: fileURLToPath(page) }));
}
