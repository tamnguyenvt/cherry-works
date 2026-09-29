import { test } from "node:test";
import assert from "node:assert/strict";
import { McpConnecting } from "../src/hexagon/application/McpConnecting.js";
import { DomainFault } from "../src/hexagon/domain/models/DomainFault.js";
import type { McpOrigin } from "../src/hexagon/domain/models/output/common/McpOrigin.js";
import { InMemoryAuthorizing } from "../src/zdriven/InMemoryAuthorizing.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryMcpServers } from "../src/zdriven/InMemoryMcpServers.js";
import { InMemorySecrets } from "../src/zdriven/InMemorySecrets.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";

const OUT = "file:///repo/.cw/out/";
const GITHUB = "https://api.githubcopilot.com/mcp/";
const LINEAR = "https://mcp.linear.app/mcp";

/** Two places at two addresses, each declared by one mcp. */
const ORIGINS: readonly McpOrigin[] = [
  { identities: ["mcp:github/billing"], names: { "mcp:github/billing": "github_aaaa" }, address: GITHUB, endpoint: GITHUB, path: "acme/billing", auth: ["oauth", "token"] },
  { identities: ["mcp:linear"], names: { "mcp:linear": "linear_bbbb" }, address: LINEAR, endpoint: LINEAR, auth: ["token"] },
];

/** What each mcp declares, as its compiled document under `.cw/out/` holds it. */
const COMPILED_MCPS = {
  "mcp:github/billing": { file: ".cw/out/mcp/github/billing.md", headers: `endpoint: ${GITHUB}\npath: acme/billing\nauth: [oauth, token]\ntools: [get_file_contents, search_code]` },
  "mcp:linear": { file: ".cw/out/mcp/linear.md", headers: `endpoint: ${LINEAR}\nauth: [token]\ntools: [list_issues, create_issue]` },
} as const;

/** The names the build wrote into the list of places, which the server
 *  serves under rather than making its own. */
const IDENTITY_NAMES = { "mcp:github/billing": "github_aaaa", "mcp:linear": "linear_bbbb" } as const;
const servedName = (identity: keyof typeof COMPILED_MCPS, tool: string) => `${IDENTITY_NAMES[identity]}__${tool}`;

const toolNamed = (name: string) => ({ name, description: `${name} at its place`, inputSchema: { type: "object", properties: {} } });

/** A built repository with both places listed and both signed in to by token;
 *  GitHub lists a tool nobody declared, Linear lacks one it was declared with. */
const placesServed = ({ origins = ORIGINS as readonly McpOrigin[] | null } = {}) => {
  const held = new InMemoryFileReaders({
    ...(origins !== null && { [`${OUT}mcp-origins.json`]: JSON.stringify({ origins }) }),
    [`${OUT}catalog.json`]: JSON.stringify(
      Object.entries(COMPILED_MCPS).map(([identity, { file }]) => ({ identity, kind: "mcp", id: identity.slice(4), description: "A place.", file })),
    ),
    ...Object.fromEntries(
      Object.entries(COMPILED_MCPS).map(([identity, { file, headers }]) => [
        `file:///repo/${file}`,
        `---\nkind: mcp\nid: ${identity.slice(4)}\ndescription: A place.\n${headers}\n---\n\nRead it.\n`,
      ]),
    ),
  });
  const secrets = new InMemorySecrets();
  const authorizing = new InMemoryAuthorizing();
  const mcpServers = new InMemoryMcpServers();
  mcpServers.servers.set(GITHUB, { tools: ["get_file_contents", "search_code", "delete_repository"].map(toolNamed) });
  mcpServers.servers.set(LINEAR, { tools: ["list_issues"].map(toolNamed) });
  const mcpConnectingApp = new McpConnecting(new URL("file:///repo/"), held, secrets, authorizing, new YamlParser(), mcpServers);
  return { held, secrets, authorizing, mcpServers, mcpConnectingApp };
};

const signIn = (secrets: InMemorySecrets, address: string, credential: Record<string, unknown> = {}) =>
  secrets.writeSecret(address, JSON.stringify({ address, method: "token", accessToken: `${address} token`, ...credential }));

const signedInPlaces = async () => {
  const places = placesServed();
  await signIn(places.secrets, GITHUB);
  await signIn(places.secrets, LINEAR);
  return places;
};

test("the tools served are exactly the declared ones, each under its identity's prefix (FR-153, SC-037)", async () => {
  const { mcpConnectingApp } = await signedInPlaces();

  const servedTools = await mcpConnectingApp.served();

  assert.deepEqual(
    servedTools.data.tools.map(({ data }) => data.name),
    [
      servedName("mcp:github/billing", "get_file_contents"),
      servedName("mcp:github/billing", "search_code"),
      servedName("mcp:linear", "list_issues"),
    ].sort(),
  );
});

test("a served tool's description names its place, and its input schema is the place's own (FR-153)", async () => {
  const { mcpConnectingApp } = await signedInPlaces();

  const servedTools = await mcpConnectingApp.served();

  const searchCode = servedTools.data.tools.find(({ data }) => data.name === servedName("mcp:github/billing", "search_code"));
  const listIssues = servedTools.data.tools.find(({ data }) => data.name === servedName("mcp:linear", "list_issues"));
  assert.equal(searchCode?.data.description, "[mcp:github/billing — acme/billing] search_code at its place");
  assert.equal(listIssues?.data.description, "[mcp:linear] list_issues at its place");
  assert.deepEqual(searchCode?.data.inputSchema, { type: "object", properties: {} });
});

test("a declared tool its place does not have is said, naming the mcp and the tool, and the rest are served (FR-153)", async () => {
  const { mcpConnectingApp } = await signedInPlaces();

  const servedTools = await mcpConnectingApp.served();

  assert.ok(servedTools.data.problems.some((problem) => problem.includes("mcp:linear") && problem.includes("create_issue")));
  assert.ok(servedTools.data.tools.some(({ data }) => data.name === servedName("mcp:linear", "list_issues")));
});

test("every place is reached once, however often the tools are asked for", async () => {
  const { mcpConnectingApp, mcpServers } = await signedInPlaces();

  await Promise.all([mcpConnectingApp.served(), mcpConnectingApp.served()]);
  await mcpConnectingApp.served();

  assert.deepEqual(mcpServers.connected.map(({ address }) => address).sort(), [GITHUB, LINEAR].sort());
});

test("a call to a tool that was not served is refused, and reaches no place (FR-153, SC-037)", async () => {
  const { mcpConnectingApp, mcpServers } = await signedInPlaces();

  const undeclared = await mcpConnectingApp.call(servedName("mcp:github/billing", "delete_repository"), {});
  const unknown = await mcpConnectingApp.call("nothing__at_all", {});

  assert.equal(undeclared.data.isError, true);
  assert.equal(unknown.data.isError, true);
  assert.deepEqual(mcpServers.calls, []);
});

test("a call reaches its place under the developer's own credential, and the answer comes back as it came (FR-154, SC-035)", async () => {
  const { mcpConnectingApp, mcpServers } = await signedInPlaces();
  const placeAnswer = { content: [{ type: "text", text: "3 issues" }], isError: false, structuredContent: { count: 3 } };
  mcpServers.servers.set(LINEAR, { tools: [toolNamed("list_issues")], answer: () => placeAnswer });

  const toolAnswer = await mcpConnectingApp.call(servedName("mcp:linear", "list_issues"), { team: "core" });

  assert.deepEqual(mcpServers.calls, [{ address: LINEAR, name: "list_issues", args: { team: "core" }, accessToken: `${LINEAR} token` }]);
  assert.deepEqual(toolAnswer.data, placeAnswer);
});

test("a place not signed in to is left out, said naming the command, and its calls answer the same (FR-154, SC-039)", async () => {
  const { mcpConnectingApp, mcpServers, secrets } = placesServed();
  await signIn(secrets, GITHUB);

  const servedTools = await mcpConnectingApp.served();
  const toolAnswer = await mcpConnectingApp.call(servedName("mcp:linear", "list_issues"), {});

  assert.ok(servedTools.data.tools.every(({ data }) => !data.name.startsWith(`${IDENTITY_NAMES["mcp:linear"]}__`)));
  assert.ok(servedTools.data.problems.some((problem) => problem.includes("cw mcp auth mcp:linear")));
  assert.equal(toolAnswer.data.isError, true);
  assert.match(JSON.stringify(toolAnswer.data), /cw mcp auth mcp:linear/);
  assert.ok(mcpServers.calls.every(({ address }) => address !== LINEAR));
  assert.ok(servedTools.data.tools.some(({ data }) => data.name === servedName("mcp:github/billing", "search_code")));
});

test("a place that cannot be reached is left out and said, and every other place is served and answers (FR-154, SC-039)", async () => {
  const { mcpConnectingApp, mcpServers } = await signedInPlaces();
  mcpServers.servers.delete(GITHUB);

  const servedTools = await mcpConnectingApp.served();
  const unreachableAnswer = await mcpConnectingApp.call(servedName("mcp:github/billing", "search_code"), {});
  const reachableAnswer = await mcpConnectingApp.call(servedName("mcp:linear", "list_issues"), {});

  assert.deepEqual(servedTools.data.tools.map(({ data }) => data.name), [servedName("mcp:linear", "list_issues")]);
  assert.ok(servedTools.data.problems.some((problem) => problem.includes(GITHUB)));
  assert.equal(unreachableAnswer.data.isError, true);
  assert.equal(reachableAnswer.data.isError, undefined);
});

test("an expired credential is renewed before the call, asking nobody, and the renewal is kept (FR-151)", async () => {
  const { mcpConnectingApp, mcpServers, secrets, authorizing } = placesServed();
  await signIn(secrets, GITHUB);
  await signIn(secrets, LINEAR, {
    method: "oauth",
    refreshToken: "refresh",
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
    client: { clientId: "cw", issuer: LINEAR },
  });
  authorizing.renewedGrant = { accessToken: "renewed", refreshToken: "refresh-2", client: { clientId: "cw", issuer: LINEAR } };

  await mcpConnectingApp.call(servedName("mcp:linear", "list_issues"), {});

  assert.equal(mcpServers.calls.at(-1)?.accessToken, "renewed");
  assert.equal(JSON.parse(secrets.secrets.get(LINEAR) ?? "").accessToken, "renewed");
});

test("a call the place refuses with 401 is tried once more after a renewal (FR-151)", async () => {
  const { mcpConnectingApp, mcpServers, secrets, authorizing } = placesServed();
  await signIn(secrets, GITHUB);
  await signIn(secrets, LINEAR, { method: "oauth", refreshToken: "refresh", client: { clientId: "cw", issuer: LINEAR } });
  authorizing.renewedGrant = { accessToken: "renewed", client: { clientId: "cw", issuer: LINEAR } };
  mcpServers.servers.set(LINEAR, { tools: [toolNamed("list_issues")], acceptsToken: (accessToken) => accessToken === "renewed" });

  const toolAnswer = await mcpConnectingApp.call(servedName("mcp:linear", "list_issues"), {});

  assert.deepEqual(mcpServers.calls.map(({ accessToken }) => accessToken), [`${LINEAR} token`, "renewed"]);
  assert.equal(toolAnswer.data.isError, undefined);
});

test("a 401 that no renewal gets past answers to sign in again, naming the command (FR-151)", async () => {
  const { mcpConnectingApp, mcpServers } = await signedInPlaces();
  mcpServers.servers.set(LINEAR, { tools: [toolNamed("list_issues")], acceptsToken: () => false });

  const toolAnswer = await mcpConnectingApp.call(servedName("mcp:linear", "list_issues"), {});

  assert.equal(toolAnswer.data.isError, true);
  assert.match(JSON.stringify(toolAnswer.data), /cw mcp auth mcp:linear/);
  assert.equal(mcpServers.calls.length, 1);
});

test("no token appears in anything served, said or answered (SC-036)", async () => {
  const { mcpConnectingApp, mcpServers } = await signedInPlaces();
  mcpServers.servers.set(LINEAR, { tools: [toolNamed("list_issues")], acceptsToken: () => false });

  const servedTools = await mcpConnectingApp.served();
  const toolAnswer = await mcpConnectingApp.call(servedName("mcp:linear", "list_issues"), {});

  const everythingShown = JSON.stringify([servedTools, toolAnswer]);
  assert.ok(!everythingShown.includes(`${LINEAR} token`) && !everythingShown.includes(`${GITHUB} token`));
});

test("with no list of places, serving stops saying to build (FR-152)", async () => {
  const { mcpConnectingApp } = placesServed({ origins: null });

  await assert.rejects(mcpConnectingApp.served(), (raised: DomainFault) => raised instanceof DomainFault && /cw build/.test(raised.fix));
});

test("a list of places written without names serves nothing of it, saying to build again (FR-145)", async () => {
  const { mcpConnectingApp, secrets } = placesServed({ origins: ORIGINS.map(({ names, ...origin }) => origin) as unknown as McpOrigin[] });
  await signIn(secrets, GITHUB);
  await signIn(secrets, LINEAR);

  const servedTools = await mcpConnectingApp.served();

  assert.deepEqual(servedTools.data.tools, []);
  assert.ok(servedTools.data.problems.some((problem) => problem.includes("mcp:linear") && problem.includes("cw build")));
});

test("stopping lets go of every place reached", async () => {
  const { mcpConnectingApp, mcpServers } = await signedInPlaces();
  await mcpConnectingApp.served();

  await mcpConnectingApp.stopServing();

  assert.deepEqual([...mcpServers.closed].sort(), [GITHUB, LINEAR].sort());
});
