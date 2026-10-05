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


/** What each mcp declares, as its compiled document under `.cw/out/` holds it. */
const COMPILED_MCPS = {
  "github/billing": { file: ".cw/out/mcp/github/billing/index.md", headers: `endpoint: ${GITHUB}\npath: acme/billing\nauth: [oauth, token]\ntools: [get_file_contents, search_code]` },
  "linear": { file: ".cw/out/mcp/linear/index.md", headers: `endpoint: ${LINEAR}\nauth: [token]\ntools: [list_issues, create_issue]` },
} as const;

/** The names the build wrote into the list of mcp origins, which the server
 *  serves under rather than making its own. */
const SERVED_PREFIXES = { "github/billing": "github_aaaa", "linear": "linear_bbbb" } as const;
const servedName = (id: keyof typeof COMPILED_MCPS, tool: string) => `${SERVED_PREFIXES[id]}__${tool}`;

const toolNamed = (name: string) => ({ name, description: `${name} at its mcp origin`, inputSchema: { type: "object", properties: {} } });

/** Two mcp origins at two addresses, each declared by one mcp, with the tools the
 *  build kept of each: Linear's lacks one it was declared with, as a list
 *  edited since the build would. */
const ORIGINS: readonly McpOrigin[] = [
  {
    ids: ["github/billing"],
    names: { "github/billing": "github_aaaa" },
    address: GITHUB,
    endpoint: GITHUB,
    path: "acme/billing",
    auth: ["oauth", "token"],
    tools: ["get_file_contents", "search_code"].map(toolNamed),
  },
  { ids: ["linear"], names: { "linear": "linear_bbbb" }, address: LINEAR, endpoint: LINEAR, auth: ["token"], tools: ["list_issues"].map(toolNamed) },
];

/** A built repository with both mcp origins listed and both signed in to by token;
 *  GitHub lists a tool nobody declared, Linear lacks one it was declared with. */
const mcpOriginsServed = ({ origins = ORIGINS as readonly McpOrigin[] | null } = {}) => {
  const held = new InMemoryFileReaders({
    ...(origins !== null && { [`${OUT}mcp-origins.json`]: JSON.stringify({ origins }) }),
    [`${OUT}catalog.json`]: JSON.stringify(
      Object.entries(COMPILED_MCPS).map(([id, { file }]) => ({ kind: "mcp", id, description: "An mcp origin.", file })),
    ),
    ...Object.fromEntries(
      Object.entries(COMPILED_MCPS).map(([id, { file, headers }]) => [
        `file:///repo/${file}`,
        `---\nkind: mcp\nid: ${id}\ndescription: An mcp origin.\n${headers}\n---\n\nRead it.\n`,
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

const signedInMcpOrigins = async () => {
  const mcpOrigins = mcpOriginsServed();
  await signIn(mcpOrigins.secrets, GITHUB);
  await signIn(mcpOrigins.secrets, LINEAR);
  return mcpOrigins;
};

test("the tools served are exactly the declared ones, each under its id's prefix (FR-153, SC-037)", async () => {
  const { mcpConnectingApp } = await signedInMcpOrigins();

  const servedTools = await mcpConnectingApp.tools();

  assert.deepEqual(
    servedTools.data.tools.map(({ data }) => data.name),
    [
      servedName("github/billing", "get_file_contents"),
      servedName("github/billing", "search_code"),
      servedName("linear", "list_issues"),
    ].sort(),
  );
});

test("a served tool's description names its mcp origin, and its input schema is the mcp origin's own (FR-153)", async () => {
  const { mcpConnectingApp } = await signedInMcpOrigins();

  const servedTools = await mcpConnectingApp.tools();

  const searchCode = servedTools.data.tools.find(({ data }) => data.name === servedName("github/billing", "search_code"));
  const listIssues = servedTools.data.tools.find(({ data }) => data.name === servedName("linear", "list_issues"));
  assert.equal(searchCode?.data.description, "[github/billing — acme/billing] search_code at its mcp origin");
  assert.equal(listIssues?.data.description, "[linear] list_issues at its mcp origin");
  assert.deepEqual(searchCode?.data.inputSchema, { type: "object", properties: {} });
});

test("a declared tool its mcp origin does not have is said, naming the mcp and the tool, and the rest are served (FR-153)", async () => {
  const { mcpConnectingApp } = await signedInMcpOrigins();

  const servedTools = await mcpConnectingApp.tools();

  assert.ok(servedTools.data.problems.some((problem) => problem.includes("linear") && problem.includes("create_issue")));
  assert.ok(servedTools.data.tools.some(({ data }) => data.name === servedName("linear", "list_issues")));
});

test("the tools are listed off what the build kept, reaching no mcp origin (EVAL-FR-031)", async () => {
  const { mcpConnectingApp, mcpServers } = await signedInMcpOrigins();

  await mcpConnectingApp.tools();

  assert.deepEqual(mcpServers.connected, []);
});

test("a call to a tool that was not served is refused, and reaches no mcp origin (FR-153, SC-037)", async () => {
  const { mcpConnectingApp, mcpServers } = await signedInMcpOrigins();

  const undeclared = await mcpConnectingApp.call(servedName("github/billing", "delete_repository"), {});
  const unknown = await mcpConnectingApp.call("nothing__at_all", {});

  assert.equal(undeclared.data.isError, true);
  assert.equal(unknown.data.isError, true);
  assert.deepEqual(mcpServers.calls, []);
});

test("a call reaches its mcp origin under the developer's own credential, and the answer comes back as it came (FR-154, SC-035)", async () => {
  const { mcpConnectingApp, mcpServers } = await signedInMcpOrigins();
  const mcpOriginAnswer = { content: [{ type: "text", text: "3 issues" }], isError: false, structuredContent: { count: 3 } };
  mcpServers.servers.set(LINEAR, { tools: [toolNamed("list_issues")], answer: () => mcpOriginAnswer });

  const toolAnswer = await mcpConnectingApp.call(servedName("linear", "list_issues"), { team: "core" });

  assert.deepEqual(mcpServers.calls, [{ address: LINEAR, name: "list_issues", args: { team: "core" }, accessToken: `${LINEAR} token` }]);
  assert.deepEqual(toolAnswer.data, mcpOriginAnswer);
});

test("a call to an mcp origin not signed in to answers why, naming the command, and reaches it not (FR-154, SC-039)", async () => {
  const { mcpConnectingApp, mcpServers, secrets } = mcpOriginsServed();
  await signIn(secrets, GITHUB);

  const servedTools = await mcpConnectingApp.tools();
  const toolAnswer = await mcpConnectingApp.call(servedName("linear", "list_issues"), {});

  assert.equal(toolAnswer.data.isError, true);
  assert.match(JSON.stringify(toolAnswer.data), /cw mcp auth linear/);
  assert.ok(mcpServers.calls.every(({ address }) => address !== LINEAR));
  assert.ok(servedTools.data.tools.some(({ data }) => data.name === servedName("github/billing", "search_code")));
});

test("a call to an mcp origin that cannot be reached answers why, and every other mcp origin answers (FR-154, SC-039)", async () => {
  const { mcpConnectingApp, mcpServers } = await signedInMcpOrigins();
  mcpServers.servers.delete(GITHUB);

  const unreachableAnswer = await mcpConnectingApp.call(servedName("github/billing", "search_code"), {});
  const reachableAnswer = await mcpConnectingApp.call(servedName("linear", "list_issues"), {});

  assert.match(JSON.stringify(unreachableAnswer.data), /could not be reached/);
  assert.equal(unreachableAnswer.data.isError, true);
  assert.equal(reachableAnswer.data.isError, undefined);
});

test("an expired credential is renewed before the call, asking nobody, and the renewal is kept (FR-151)", async () => {
  const { mcpConnectingApp, mcpServers, secrets, authorizing } = mcpOriginsServed();
  await signIn(secrets, GITHUB);
  await signIn(secrets, LINEAR, {
    method: "oauth",
    refreshToken: "refresh",
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
    client: { clientId: "cw", issuer: LINEAR },
  });
  authorizing.renewedGrant = { accessToken: "renewed", refreshToken: "refresh-2", client: { clientId: "cw", issuer: LINEAR } };

  await mcpConnectingApp.call(servedName("linear", "list_issues"), {});

  assert.equal(mcpServers.calls.at(-1)?.accessToken, "renewed");
  assert.equal(JSON.parse(secrets.secrets.get(LINEAR) ?? "").accessToken, "renewed");
});

test("a call the mcp origin refuses with 401 is tried once more after a renewal (FR-151)", async () => {
  const { mcpConnectingApp, mcpServers, secrets, authorizing } = mcpOriginsServed();
  await signIn(secrets, GITHUB);
  await signIn(secrets, LINEAR, { method: "oauth", refreshToken: "refresh", client: { clientId: "cw", issuer: LINEAR } });
  authorizing.renewedGrant = { accessToken: "renewed", client: { clientId: "cw", issuer: LINEAR } };
  mcpServers.servers.set(LINEAR, { tools: [toolNamed("list_issues")], acceptsToken: (accessToken) => accessToken === "renewed" });

  const toolAnswer = await mcpConnectingApp.call(servedName("linear", "list_issues"), {});

  assert.deepEqual(mcpServers.calls.map(({ accessToken }) => accessToken), [`${LINEAR} token`, "renewed"]);
  assert.equal(toolAnswer.data.isError, undefined);
});

test("a 401 that no renewal gets past answers to sign in again, naming the command (FR-151)", async () => {
  const { mcpConnectingApp, mcpServers } = await signedInMcpOrigins();
  mcpServers.servers.set(LINEAR, { tools: [toolNamed("list_issues")], acceptsToken: () => false });

  const toolAnswer = await mcpConnectingApp.call(servedName("linear", "list_issues"), {});

  assert.equal(toolAnswer.data.isError, true);
  assert.match(JSON.stringify(toolAnswer.data), /cw mcp auth linear/);
  assert.equal(mcpServers.calls.length, 1);
});

test("no token appears in anything served, said or answered (SC-036)", async () => {
  const { mcpConnectingApp, mcpServers } = await signedInMcpOrigins();
  mcpServers.servers.set(LINEAR, { tools: [toolNamed("list_issues")], acceptsToken: () => false });

  const servedTools = await mcpConnectingApp.tools();
  const toolAnswer = await mcpConnectingApp.call(servedName("linear", "list_issues"), {});

  const everythingShown = JSON.stringify([servedTools, toolAnswer]);
  assert.ok(!everythingShown.includes(`${LINEAR} token`) && !everythingShown.includes(`${GITHUB} token`));
});

test("with no list of mcp origins, serving stops saying to build (FR-152)", async () => {
  const { mcpConnectingApp } = mcpOriginsServed({ origins: null });

  await assert.rejects(mcpConnectingApp.tools(), (raised: DomainFault) => raised instanceof DomainFault && /cw build/.test(raised.fix));
});

test("a list of mcp origins written without names serves nothing of it, saying to build again (FR-145)", async () => {
  const { mcpConnectingApp, secrets } = mcpOriginsServed({ origins: ORIGINS.map(({ names, ...origin }) => origin) as unknown as McpOrigin[] });
  await signIn(secrets, GITHUB);
  await signIn(secrets, LINEAR);

  const servedTools = await mcpConnectingApp.tools();

  assert.deepEqual(servedTools.data.tools, []);
  assert.ok(servedTools.data.problems.some((problem) => problem.includes("linear") && problem.includes("cw build")));
});

test("an mcp origin reached for a call is let go once it has answered", async () => {
  const { mcpConnectingApp, mcpServers } = await signedInMcpOrigins();

  await mcpConnectingApp.call(servedName("linear", "list_issues"), {});

  assert.deepEqual(mcpServers.closed, [LINEAR]);
});
