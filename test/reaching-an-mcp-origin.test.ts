import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { DrivenFault, UnauthorizedMcpFault } from "../src/hexagon/port/zdriven/ForCallingMcpServers.js";
import { McpClients } from "../src/zdriven/McpClients.js";
import { anMcpServer } from "./an-mcp-server.js";

const STDIO_SERVER = fileURLToPath(new URL("./an-mcp-server-over-stdio.ts", import.meta.url));

/** The test mcp origin over stdio, as an mcp declaring a command names it. */
const aLocalMcpOrigin = (tokenEnv?: string) => ({
  address: `node --import tsx ${STDIO_SERVER}`,
  command: { command: process.execPath, args: ["--import", "tsx", STDIO_SERVER], ...(tokenEnv !== undefined && { tokenEnv }) },
});

const textOf = (toolAnswer: Readonly<Record<string, unknown>>) => (toolAnswer.content as { text: string }[])[0]?.text;

test("an mcp origin at an endpoint lists its tools, and a call reaches it with the token as a bearer credential", async (t) => {
  const mcpTestServer = await anMcpServer("dev-token");
  t.after(() => mcpTestServer.server.close());

  const connection = await new McpClients().connect({ address: mcpTestServer.endpoint, endpoint: mcpTestServer.endpoint }, "dev-token", 5_000);
  t.after(() => connection.close());
  const toolAnswer = await connection.callTool("echo", { text: "hello" }, "dev-token");

  assert.deepEqual(connection.tools.map(({ name }) => name), ["echo", "fail"]);
  assert.equal(connection.tools[0]?.description, "Answers what it was handed.");
  assert.equal(textOf(toolAnswer), "echo: hello");
  assert.ok(mcpTestServer.authorizations.length > 0 && mcpTestServer.authorizations.every((one) => one === "Bearer dev-token"));
});

test("an mcp origin's own error answer comes back as an answer, not a fault", async (t) => {
  const mcpTestServer = await anMcpServer("dev-token");
  t.after(() => mcpTestServer.server.close());
  const connection = await new McpClients().connect({ address: mcpTestServer.endpoint, endpoint: mcpTestServer.endpoint }, "dev-token", 5_000);
  t.after(() => connection.close());

  const toolAnswer = await connection.callTool("fail", {}, "dev-token");

  assert.equal(toolAnswer.isError, true);
  assert.equal(textOf(toolAnswer), "it failed at the mcp origin");
});

test("each call carries the token it is handed, so a renewed one is sent from then on", async (t) => {
  const mcpTestServer = await anMcpServer("renewed-token");
  t.after(() => mcpTestServer.server.close());
  const connection = await new McpClients().connect({ address: mcpTestServer.endpoint, endpoint: mcpTestServer.endpoint }, "renewed-token", 5_000);
  t.after(() => connection.close());

  await assert.rejects(connection.callTool("echo", {}, "old-token"), UnauthorizedMcpFault);
  const toolAnswer = await connection.callTool("echo", { text: "again" }, "renewed-token");

  assert.equal(textOf(toolAnswer), "echo: again");
});

test("an mcp origin refusing the credential when it is reached is an UnauthorizedMcpFault", async (t) => {
  const mcpTestServer = await anMcpServer("dev-token");
  t.after(() => mcpTestServer.server.close());

  await assert.rejects(
    new McpClients().connect({ address: mcpTestServer.endpoint, endpoint: mcpTestServer.endpoint }, "someone-else", 5_000),
    UnauthorizedMcpFault,
  );
});

test("an mcp origin nobody answers at is a DrivenFault naming its address", async () => {
  const closedServer = createServer();
  await new Promise<void>((resolve) => closedServer.listen(0, "127.0.0.1", resolve));
  const endpoint = `http://127.0.0.1:${(closedServer.address() as AddressInfo).port}/mcp`;
  await new Promise((resolve) => closedServer.close(resolve));

  await assert.rejects(
    new McpClients().connect({ address: endpoint, endpoint }, "dev-token", 5_000),
    (raised: DrivenFault) => raised instanceof DrivenFault && raised.message.includes(endpoint),
  );
});

test("an mcp origin that does not answer in time is a DrivenFault, and the wait ends at the limit", async (t) => {
  const silentServer = createServer(() => undefined);
  await new Promise<void>((resolve) => silentServer.listen(0, "127.0.0.1", resolve));
  t.after(() => (silentServer.closeAllConnections(), silentServer.close()));
  const endpoint = `http://127.0.0.1:${(silentServer.address() as AddressInfo).port}/mcp`;
  const startedAt = Date.now();

  await assert.rejects(new McpClients().connect({ address: endpoint, endpoint }, "dev-token", 300), DrivenFault);

  assert.ok(Date.now() - startedAt < 3_000);
});

test("an mcp origin declared by a command is started, lists its tools, and reads its token from the variable named", async (t) => {
  const localMcpOrigin = aLocalMcpOrigin("PLACE_TOKEN");

  const connection = await new McpClients().connect(localMcpOrigin, "local-token", 10_000);
  t.after(() => connection.close());
  const toolAnswer = await connection.callTool("read_token", {}, undefined);

  assert.ok(connection.tools.some(({ name }) => name === "read_token"));
  assert.equal(textOf(toolAnswer), "local-token");
  assert.ok(!localMcpOrigin.command.args.some((arg) => arg.includes("local-token")));
});

test("a command's process is stopped when its mcp origin is let go", async () => {
  const connection = await new McpClients().connect(aLocalMcpOrigin(), undefined, 10_000);
  const processId = Number(textOf(await connection.callTool("process_id", {}, undefined)));

  await connection.close();

  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.throws(() => process.kill(processId, 0));
});

test("a command that does not exist is a DrivenFault naming its address", async () => {
  const missingMcpOrigin = { address: "no-such-command-anywhere --serve", command: { command: "no-such-command-anywhere", args: ["--serve"] } };

  await assert.rejects(
    new McpClients().connect(missingMcpOrigin, undefined, 5_000),
    (raised: DrivenFault) => raised instanceof DrivenFault && raised.message.includes("no-such-command-anywhere --serve"),
  );
});
