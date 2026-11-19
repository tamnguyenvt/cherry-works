import assert from "node:assert/strict";
import { test } from "node:test";
import { loadMcpOriginsService } from "../src/module/charter/app/services/load-mcp-origins.service.js";
import { McpOrigin } from "../src/module/charter/domain/models/charter-output/mcp-origin.js";
import { McpAuthMethod } from "../src/module/charter/domain/models/mcp/mcp-auth-method.value-object.js";
import { InMemoryCredentialsRepository } from "../src/module/charter/infra/in-memory/in-memory-credentials.repository.js";
import { InMemoryOAuthAuthorizer } from "../src/module/charter/infra/in-memory/in-memory-oauth-authorizer.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryMcpServers } from "../src/module/shared/infra/in-memory/in-memory-mcp-servers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { answerOf, faultOf } from "./answer-of.js";
import { buildingCharterOf } from "./use-cases-of.js";

const OUT = "file:///repo/.cw/out/";
const GITHUB = "https://api.githubcopilot.com/mcp/";
const LINEAR = "https://mcp.linear.app/mcp";

/** What each mcp declares, as its compiled document under `.cw/out/` holds it. */
const COMPILED_MCPS = {
  "github/billing": {
    file: ".cw/out/mcp/github/billing/index.md",
    headers: `endpoint: ${GITHUB}\npath: acme/billing\nauth: [oauth, token]\ntools: [get_file_contents, search_code]`,
  },
  linear: {
    file: ".cw/out/mcp/linear/index.md",
    headers: `endpoint: ${LINEAR}\nauth: [token]\ntools: [list_issues, create_issue]`,
  },
} as const;

/** The names the build wrote into the list of mcp origins, which the server
 *  serves under rather than making its own. */
const SERVED_PREFIXES = { "github/billing": "github_aaaa", linear: "linear_bbbb" } as const;
const servedName = (id: keyof typeof COMPILED_MCPS, tool: string) => `${SERVED_PREFIXES[id]}__${tool}`;

const toolNamed = (name: string) => ({
  name,
  description: `${name} at its mcp origin`,
  inputSchema: { type: "object", properties: {} },
});

/** Two mcp origins at two addresses, each declared by one mcp, with the tools the
 *  build kept of each: Linear's lacks one it was declared with, as a list
 *  edited since the build would. */
const ORIGINS: readonly McpOrigin[] = [
  new McpOrigin({
    ids: ["github/billing"],
    names: { "github/billing": "github_aaaa" },
    address: GITHUB,
    endpoint: GITHUB,
    path: "acme/billing",
    auth: [McpAuthMethod.OAUTH, McpAuthMethod.TOKEN],
    tools: ["get_file_contents", "search_code"].map(toolNamed),
  }),
  new McpOrigin({
    ids: ["linear"],
    names: { linear: "linear_bbbb" },
    address: LINEAR,
    endpoint: LINEAR,
    auth: [McpAuthMethod.TOKEN],
    tools: ["list_issues"].map(toolNamed),
  }),
];

/** A built repository with both mcp origins listed and both signed in to by token;
 *  GitHub lists a tool nobody declared, Linear lacks one it was declared with. */
const mcpOriginsServed = ({ origins = ORIGINS as readonly McpOrigin[] | null } = {}) => {
  const held = new InMemoryFileReaders({
    ...(origins !== null && { [`${OUT}mcp-origins.json`]: JSON.stringify({ origins }) }),
    [`${OUT}catalogue.json`]: JSON.stringify(
      Object.entries(COMPILED_MCPS).map(([id, { file }]) => ({ kind: "mcp", id, description: "An mcp origin.", file })),
    ),
    ...Object.fromEntries(
      Object.entries(COMPILED_MCPS).map(([id, { file, headers }]) => [
        `file:///repo/${file}`,
        `---\nkind: mcp\nid: ${id}\ndescription: An mcp origin.\n${headers}\n---\n\nRead it.\n`,
      ]),
    ),
  });
  const credentialsRepository = new InMemoryCredentialsRepository();
  const oauthAuthorizer = new InMemoryOAuthAuthorizer();
  const mcpServerCaller = new InMemoryMcpServers();
  mcpServerCaller.mcpServerByAddress.set(GITHUB, {
    tools: ["get_file_contents", "search_code", "delete_repository"].map(toolNamed),
  });
  mcpServerCaller.mcpServerByAddress.set(LINEAR, { tools: ["list_issues"].map(toolNamed) });
  const charterRuntimeApps = buildingCharterOf(
    held,
    new InMemoryFileOutput(held),
    new InMemoryTokenCounter(),
    {},
    new InMemoryReporter(),
    { mcpServerCaller, credentialsRepository, oauthAuthorizer },
  );
  return { held, credentialsRepository, oauthAuthorizer, mcpServerCaller, charterRuntimeApps };
};

const signIn = (
  credentialsRepository: InMemoryCredentialsRepository,
  address: string,
  credential: Record<string, unknown> = {},
) =>
  credentialsRepository.secretByAddress.set(
    address,
    JSON.stringify({ address, method: "token", accessToken: `${address} token`, ...credential }),
  );

const signedInMcpOrigins = async () => {
  const mcpOrigins = mcpOriginsServed();
  await signIn(mcpOrigins.credentialsRepository, GITHUB);
  await signIn(mcpOrigins.credentialsRepository, LINEAR);
  return mcpOrigins;
};

test("the tools served are exactly the declared ones, each under its id's prefix (FR-153, SC-037, CORE Story 19 scenario 1, EVAL Story 5 scenario 2)", async () => {
  const { charterRuntimeApps } = await signedInMcpOrigins();

  const servedTools = answerOf(await charterRuntimeApps.listServedTools());

  assert.deepEqual(
    servedTools.data.tools.map(({ data: servedTool }) => servedTool.name),
    [
      servedName("github/billing", "get_file_contents"),
      servedName("github/billing", "search_code"),
      servedName("linear", "list_issues"),
    ].sort(),
  );
});

test("a served tool's description names its mcp origin, and its input schema is the mcp origin's own (FR-153)", async () => {
  const { charterRuntimeApps } = await signedInMcpOrigins();

  const servedTools = answerOf(await charterRuntimeApps.listServedTools());

  const searchCode = servedTools.data.tools.find(
    ({ data: servedTool }) => servedTool.name === servedName("github/billing", "search_code"),
  );
  const listIssuesTool = servedTools.data.tools.find(
    ({ data: servedTool }) => servedTool.name === servedName("linear", "list_issues"),
  );
  assert.equal(searchCode?.data.description, "[github/billing — acme/billing] search_code at its mcp origin");
  assert.equal(listIssuesTool?.data.description, "[linear] list_issues at its mcp origin");
  assert.deepEqual(searchCode?.data.inputSchema, { type: "object", properties: {} });
});

test("a declared tool its mcp origin does not have is said, naming the mcp and the tool, and the rest are served (FR-153, CORE Story 19 scenario 10)", async () => {
  const { charterRuntimeApps } = await signedInMcpOrigins();

  const servedTools = answerOf(await charterRuntimeApps.listServedTools());

  assert.ok(
    servedTools.data.problems.some((problem) => problem.includes("linear") && problem.includes("create_issue")),
  );
  assert.ok(
    servedTools.data.tools.some(({ data: servedTool }) => servedTool.name === servedName("linear", "list_issues")),
  );
});

test("the tools are listed off what the build kept, reaching no mcp origin (EVAL-FR-031, CORE Story 19 scenarios 5, 10, EVAL Story 5 scenario 2)", async () => {
  const { charterRuntimeApps, mcpServerCaller } = await signedInMcpOrigins();

  await charterRuntimeApps.listServedTools();

  assert.deepEqual(mcpServerCaller.serverConnections, []);
});

test("a call to a tool that was not served is refused, and reaches no mcp origin (FR-153, SC-037, CORE Story 19 scenario 2)", async () => {
  const { charterRuntimeApps, mcpServerCaller } = await signedInMcpOrigins();

  const unlistedToolFault = faultOf(
    await charterRuntimeApps.callTool(servedName("github/billing", "delete_repository"), {}),
  );
  const unknown = faultOf(await charterRuntimeApps.callTool("nothing__at_all", {}));

  assert.equal(unlistedToolFault.name, "UnknownToolFault");
  assert.match(unlistedToolFault.message, /delete_repository/);
  assert.equal(unknown.name, "UnknownToolFault");
  assert.match(unknown.message, /nothing__at_all/);
  assert.deepEqual(mcpServerCaller.calls, []);
});

test("a call reaches its mcp origin under the developer's own credential, and the answer comes back as it came (FR-154, SC-035, CORE Story 19 scenario 3, EVAL Story 5 scenario 2)", async () => {
  const { charterRuntimeApps, mcpServerCaller } = await signedInMcpOrigins();
  const mcpOriginAnswer = {
    content: [{ type: "text", text: "3 issues" }],
    isError: false,
    structuredContent: { count: 3 },
  };
  mcpServerCaller.mcpServerByAddress.set(LINEAR, {
    tools: [toolNamed("list_issues")],
    answerCall: () => mcpOriginAnswer,
  });

  const toolAnswer = answerOf(await charterRuntimeApps.callTool(servedName("linear", "list_issues"), { team: "core" }));

  assert.deepEqual(mcpServerCaller.calls, [
    { address: LINEAR, toolName: "list_issues", toolArguments: { team: "core" }, accessToken: `${LINEAR} token` },
  ]);
  assert.deepEqual(toolAnswer.data, mcpOriginAnswer);
});

test("a call to an mcp origin not signed in to answers why, naming the command, and reaches it not (FR-154, SC-039, CORE Story 19 scenario 4)", async () => {
  const { charterRuntimeApps, mcpServerCaller, credentialsRepository } = mcpOriginsServed();
  await signIn(credentialsRepository, GITHUB);

  const servedTools = answerOf(await charterRuntimeApps.listServedTools());
  const toolFault = faultOf(await charterRuntimeApps.callTool(servedName("linear", "list_issues"), {}));

  assert.match(`${toolFault.message} ${toolFault.fix}`, /cw mcp auth linear/);
  assert.ok(mcpServerCaller.calls.every(({ address }) => address !== LINEAR));
  assert.ok(
    servedTools.data.tools.some(
      ({ data: servedTool }) => servedTool.name === servedName("github/billing", "search_code"),
    ),
  );
});

test("a call to an mcp origin that cannot be reached answers why, and every other mcp origin answers (FR-154, SC-039, CORE Story 19 scenario 9)", async () => {
  const { charterRuntimeApps, mcpServerCaller } = await signedInMcpOrigins();
  mcpServerCaller.mcpServerByAddress.delete(GITHUB);

  const unreachableFault = faultOf(await charterRuntimeApps.callTool(servedName("github/billing", "search_code"), {}));
  const reachableAnswer = answerOf(await charterRuntimeApps.callTool(servedName("linear", "list_issues"), {}));

  assert.match(unreachableFault.message, /could not be reached/);
  assert.equal(reachableAnswer.data.isError, undefined);
});

test("an expired credential is renewed before the call, asking nobody, and the renewal is kept (FR-151)", async () => {
  const { charterRuntimeApps, mcpServerCaller, credentialsRepository, oauthAuthorizer } = mcpOriginsServed();
  await signIn(credentialsRepository, GITHUB);
  await signIn(credentialsRepository, LINEAR, {
    method: "oauth",
    refreshToken: "refresh",
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
    client: { clientId: "cw", issuer: LINEAR },
  });
  oauthAuthorizer.renewedGrant = {
    accessToken: "renewed",
    refreshToken: "refresh-2",
    client: { clientId: "cw", issuer: LINEAR },
  };

  await charterRuntimeApps.callTool(servedName("linear", "list_issues"), {});

  assert.equal(mcpServerCaller.calls.at(-1)?.accessToken, "renewed");
  assert.equal(JSON.parse(credentialsRepository.secretByAddress.get(LINEAR) ?? "").accessToken, "renewed");
});

test("a call the mcp origin refuses with 401 is tried once more after a renewal (FR-151)", async () => {
  const { charterRuntimeApps, mcpServerCaller, credentialsRepository, oauthAuthorizer } = mcpOriginsServed();
  await signIn(credentialsRepository, GITHUB);
  await signIn(credentialsRepository, LINEAR, {
    method: "oauth",
    refreshToken: "refresh",
    client: { clientId: "cw", issuer: LINEAR },
  });
  oauthAuthorizer.renewedGrant = { accessToken: "renewed", client: { clientId: "cw", issuer: LINEAR } };
  mcpServerCaller.mcpServerByAddress.set(LINEAR, {
    tools: [toolNamed("list_issues")],
    acceptsToken: (accessToken) => accessToken === "renewed",
  });

  const toolAnswer = answerOf(await charterRuntimeApps.callTool(servedName("linear", "list_issues"), {}));

  assert.deepEqual(
    mcpServerCaller.calls.map(({ accessToken }) => accessToken),
    [`${LINEAR} token`, "renewed"],
  );
  assert.equal(toolAnswer.data.isError, undefined);
});

test("a 401 that no renewal gets past answers to sign in again, naming the command (FR-151)", async () => {
  const { charterRuntimeApps, mcpServerCaller } = await signedInMcpOrigins();
  mcpServerCaller.mcpServerByAddress.set(LINEAR, { tools: [toolNamed("list_issues")], acceptsToken: () => false });

  const toolFault = faultOf(await charterRuntimeApps.callTool(servedName("linear", "list_issues"), {}));

  assert.match(`${toolFault.message} ${toolFault.fix}`, /cw mcp auth linear/);
  assert.equal(mcpServerCaller.calls.length, 1);
});

test("no token appears in anything served, said or answered (SC-036)", async () => {
  const { charterRuntimeApps, mcpServerCaller } = await signedInMcpOrigins();
  mcpServerCaller.mcpServerByAddress.set(LINEAR, { tools: [toolNamed("list_issues")], acceptsToken: () => false });

  const servedTools = answerOf(await charterRuntimeApps.listServedTools());
  const toolAnswer = await charterRuntimeApps.callTool(servedName("linear", "list_issues"), {});

  const everythingShown = JSON.stringify([servedTools, toolAnswer]);
  assert.ok(!everythingShown.includes(`${LINEAR} token`) && !everythingShown.includes(`${GITHUB} token`));
});

test("with no list of mcp origins, serving stops saying to build (FR-152)", async () => {
  const { charterRuntimeApps } = mcpOriginsServed({ origins: null });

  assert.match(faultOf(await charterRuntimeApps.listServedTools()).fix, /cw build/);
});

test("a list of mcp origins written without names serves nothing of it, saying to build again (FR-145)", async () => {
  const { charterRuntimeApps, credentialsRepository } = mcpOriginsServed({
    origins: ORIGINS.map(({ names, ...origin }) => origin) as unknown as McpOrigin[],
  });
  await signIn(credentialsRepository, GITHUB);
  await signIn(credentialsRepository, LINEAR);

  const servedTools = answerOf(await charterRuntimeApps.listServedTools());

  assert.deepEqual(servedTools.data.tools, []);
  assert.ok(servedTools.data.problems.some((problem) => problem.includes("linear") && problem.includes("cw build")));
});

test("an mcp origin reached for a call is let go once it has answered (CORE Story 19 scenario 8)", async () => {
  const { charterRuntimeApps, mcpServerCaller } = await signedInMcpOrigins();

  await charterRuntimeApps.callTool(servedName("linear", "list_issues"), {});

  assert.deepEqual(mcpServerCaller.closedServerAddresses, [LINEAR]);
});

test("MCP reads only the shared catalogue, since its primitives are shared", async () => {
  const { held, charterRuntimeApps } = await signedInMcpOrigins();
  held.writeFile(new URL(`${OUT}catalogue.claude.json`), "not json");
  held.writeFile(new URL(`${OUT}catalogue.codex.json`), "not json");
  held.calls.length = 0;
  const servedTools = answerOf(await charterRuntimeApps.listServedTools());
  assert.equal(servedTools.data.tools.length, 3);
  assert.ok(
    !held.calls.some((file) => file.includes("catalogue.claude.json") || file.includes("catalogue.codex.json")),
  );
});

test("a list of mcp origins whose origin has no ids or no address does not read, and is refused saying to build again (FR-145)", async () => {
  const compiledOutputReader = {
    describeItemPlace: (outputFileName: string) => `.cw/out/${outputFileName}`,
    readCompiledOutputItem: async () => JSON.stringify({ origins: [{ names: {}, auth: [] }] }),
  };

  await assert.rejects(loadMcpOriginsService.loadMcpOrigins(compiledOutputReader), (raisedValue: Error) => {
    assert.equal(raisedValue.name, "UnreadableMcpOriginsFault");
    return true;
  });
});

test("the repository and a vendor declaring one address under two ids are listed once, under both, and every tool either declares is served there (CORE Story 17 scenario 5, FR-145, CORE Story 55 scenario 8)", async () => {
  const mcpText = (id: string, tools: string) =>
    `---\nkind: mcp\nid: ${id}\ndescription: Billing's code.\nendpoint: ${GITHUB}\nauth: [token]\ntools: [${tools}]\n---\n\nRead it.\n`;
  const held = new InMemoryFileReaders({
    "file:///repo/.cw/settings.json": `${JSON.stringify({ agents: ["claude"] })}\n`,
    "file:///repo/.cw/charter/team/primitive/guide/no-any/index.md":
      '---\nkind: guide\nid: no-any\ndescription: No any.\nglobs: ["src/**/*.ts"]\n---\n\nRead [[billing]] and [[acme/code]].\n',
    "file:///repo/.cw/charter/team/primitive/mcp/billing/index.md": mcpText("billing", "search_code"),
    "file:///repo/.cw/charter/acme/primitive/mcp/acme/code/index.md": mcpText("acme/code", "get_file_contents"),
    "file:///repo/.cw/charter/acme/cw-vendor.json": JSON.stringify({
      charter: "acme",
      source: "acme/tools",
      version: "HEAD",
    }),
  });
  const credentialsRepository = new InMemoryCredentialsRepository();
  await signIn(credentialsRepository, GITHUB);
  const mcpServerCaller = new InMemoryMcpServers();
  mcpServerCaller.mcpServerByAddress.set(GITHUB, { tools: ["get_file_contents", "search_code"].map(toolNamed) });
  const charterRuntimeApps = buildingCharterOf(
    held,
    new InMemoryFileOutput(held),
    new InMemoryTokenCounter(),
    {},
    new InMemoryReporter(),
    { mcpServerCaller, credentialsRepository, oauthAuthorizer: new InMemoryOAuthAuthorizer() },
  );

  const planSummaryDTO = await charterRuntimeApps.buildCharter();
  assert.equal(planSummaryDTO.type, "ProjectionPlanSummary", JSON.stringify(planSummaryDTO));

  const { origins: builtOrigins } = JSON.parse(await held.readFile(new URL(`${OUT}mcp-origins.json`)));
  assert.equal(builtOrigins.length, 1);
  assert.equal(builtOrigins[0].address, GITHUB);
  assert.deepEqual(builtOrigins[0].ids, ["acme/code", "billing"]);
  const servedTools = answerOf(await charterRuntimeApps.listServedTools());
  assert.deepEqual(
    servedTools.data.tools.map(({ data: servedTool }) => servedTool.name).sort(),
    [
      `${builtOrigins[0].names["acme/code"]}__get_file_contents`,
      `${builtOrigins[0].names.billing}__search_code`,
    ].sort(),
  );
});
