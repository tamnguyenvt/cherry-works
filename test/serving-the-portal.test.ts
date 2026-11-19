import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { wrapAppToShowPaths } from "../src/presentation/cli/commands/helper.js";
import { startPortal } from "../src/presentation/portal/portal.server.js";
import { startedPortalOf } from "./answer-of.js";
import { authoringCharterOf, buildingCharterOf, workspaceSettingsLoaderOf } from "./use-cases-of.js";

/** Clear of the default, so a portal left running here does not answer. */
const PORT = 47310;

/** A page as `pnpm build` leaves it, with a file beside its directory that no
 *  request may reach. */
async function builtPage(): Promise<URL> {
  const root = await mkdtemp(join(tmpdir(), "cw-portal-"));
  await writeFile(join(root, "secret.txt"), "not the page's");
  await mkdir(join(root, "portal"));
  await writeFile(join(root, "portal", "index.html"), "<!doctype html><title>Cherry Works</title>");
  await writeFile(join(root, "portal", "main.js"), "render();");
  return pathToFileURL(`${join(root, "portal")}/`);
}

/** The three applications the routes are driven by, over one empty
 *  repository held in memory: what these tests ask about is the guards in
 *  front of the routes, and every one of them answers before a route is
 *  reached. */
function portalApps() {
  const held = new InMemoryFileReaders({});
  return [
    {
      charterAuthoringApp: wrapAppToShowPaths(
        authoringCharterOf(held, new InMemoryFileOutput(held), new InMemoryReporter()),
        "/repo",
      ),
      charterBuildingApp: wrapAppToShowPaths(
        buildingCharterOf(
          held,
          new InMemoryFileOutput(held),
          new InMemoryTokenCounter(),
          { claude: new InMemoryAgentCli() },
          new InMemoryReporter(),
        ),
        "/repo",
      ),
    },
    workspaceSettingsLoaderOf(held),
  ] as const;
}

/** One request with its path and `Host` as written: `fetch` would tidy a `..`
 *  away and set the `Host` itself. Each on a connection of its own, since a
 *  socket kept alive would still reach the portal an earlier test closed, on
 *  the same port and with another token. */
function send(
  address: URL,
  path: string,
  { method = "GET", headers = {} }: { method?: string; headers?: http.OutgoingHttpHeaders } = {},
): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    http
      .request({ host: address.hostname, port: address.port, path, method, headers, agent: false }, (response) => {
        response.resume();
        resolve(response);
      })
      .on("error", reject)
      .end();
  });
}

/** What the page sends on each call to `/api`. */
function bearer(address: URL): http.OutgoingHttpHeaders {
  return { authorization: `Bearer ${address.searchParams.get("t")}` };
}

test("the page is served from / on this machine's own address, and nothing beside it", async () => {
  const { address, server } = startedPortalOf(await startPortal(await builtPage(), ...portalApps(), PORT));
  try {
    assert.equal(address.hostname, "127.0.0.1");
    const index = await fetch(address);
    assert.equal(index.status, 200);
    assert.match(await index.text(), /Cherry Works/);
    assert.equal((await fetch(new URL("main.js", address))).status, 200);
    assert.equal((await send(address, "/../secret.txt")).statusCode, 404);
    assert.equal((await send(address, "/api/nothing", { headers: bearer(address) })).statusCode, 404);
  } finally {
    server.close();
  }
});

test("the token of the run is asked for on the page's address and on every call to /api", async () => {
  const { address, server } = startedPortalOf(await startPortal(await builtPage(), ...portalApps(), PORT));
  const otherPortal = startedPortalOf(await startPortal(await builtPage(), ...portalApps(), PORT));
  try {
    assert.equal(address.searchParams.get("t")?.length, 43);
    assert.notEqual(address.searchParams.get("t"), otherPortal.address.searchParams.get("t"));
    assert.equal((await send(address, "/")).statusCode, 401);
    assert.equal((await send(address, `/${otherPortal.address.search}`)).statusCode, 401);
    assert.equal((await send(address, "/api/charter/root/primitives")).statusCode, 401);
    assert.equal(
      (await send(address, "/api/charter/root/primitives", { headers: bearer(otherPortal.address) })).statusCode,
      401,
    );
  } finally {
    server.close();
    otherPortal.server.close();
  }
});

test("a Host other than this machine's address and port is refused (CORE Story 5 scenario 8)", async () => {
  const { address, server } = startedPortalOf(await startPortal(await builtPage(), ...portalApps(), PORT));
  const path = `/${address.search}`;
  try {
    assert.equal((await send(address, path, { headers: { host: `localhost:${address.port}` } })).statusCode, 200);
    assert.equal((await send(address, path, { headers: { host: `rebound.example:${address.port}` } })).statusCode, 403);
    assert.equal((await send(address, path, { headers: { host: "127.0.0.1:80" } })).statusCode, 403);
  } finally {
    server.close();
  }
});

test("every verb but GET is sent as JSON, and no CORS header answers another origin", async () => {
  const { address, server } = startedPortalOf(await startPortal(await builtPage(), ...portalApps(), PORT));
  const path = "/api/charter/root/primitives";
  try {
    const json = { ...bearer(address), "content-type": "application/json; charset=utf-8" };
    // Past the guard, and refused by the route for carrying no body.
    assert.equal((await send(address, path, { method: "POST", headers: json })).statusCode, 400);
    assert.equal((await send(address, path, { method: "POST", headers: bearer(address) })).statusCode, 415);
    const form = { ...bearer(address), "content-type": "application/x-www-form-urlencoded" };
    assert.equal((await send(address, path, { method: "DELETE", headers: form })).statusCode, 415);

    const preflight = await send(address, path, {
      method: "OPTIONS",
      headers: { origin: "http://rebound.example", "access-control-request-method": "PUT" },
    });
    assert.equal(preflight.headers["access-control-allow-origin"], undefined);
  } finally {
    server.close();
  }
});

test("a port that is taken gives way to the next free one", async () => {
  const taken = http.createServer();
  await new Promise<void>((resolve) => taken.listen(PORT, "127.0.0.1", resolve));
  try {
    const { address, server } = startedPortalOf(await startPortal(await builtPage(), ...portalApps(), PORT));
    assert.equal(address.port, String(PORT + 1));
    server.close();
  } finally {
    taken.close();
  }
});

test("no port left to listen on is said as what to report, never thrown (CORE Story 53 scenario 2)", async () => {
  const LAST_PORT = 65535;
  const takenServer = http.createServer();
  await new Promise<void>((resolve) => takenServer.listen(LAST_PORT, "127.0.0.1", resolve));
  try {
    const refusalText = String(await startPortal(await builtPage(), ...portalApps(), LAST_PORT));
    assert.match(refusalText, /^The portal could not listen on 127\.0\.0\.1:65535: /);
    assert.match(refusalText, /Free a port on this machine, then start the portal again\./);
  } finally {
    takenServer.close();
  }
});

test("a page never built refuses to start, naming pnpm build", async () => {
  const unbuilt = pathToFileURL(`${await mkdtemp(join(tmpdir(), "cw-portal-"))}/`);
  assert.match(String(await startPortal(unbuilt, ...portalApps(), PORT)), /pnpm build/);
});

test("the built page names the cherry logo laid beside it as its icon", async () => {
  // `pnpm test` builds first, so the page read is this working tree's.
  const builtPortalUrl = new URL("../dist/portal/", import.meta.url);
  const pageText = await readFile(new URL("index.html", builtPortalUrl), "utf8");

  assert.match(pageText, /<link rel="icon" type="image\/png" href="\.\/logo\.png">/);
  await access(new URL("logo.png", builtPortalUrl));
});
