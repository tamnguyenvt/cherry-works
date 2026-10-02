import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { startMcpServer } from "../src/driver/mcp/server.js";
import type { ForConnectingMcps } from "../src/hexagon/port/driver/ForConnectingMcps.js";

const MAIN = fileURLToPath(new URL("../main.ts", import.meta.url));
const STDIO_SERVER = fileURLToPath(new URL("./an-mcp-server-over-stdio.ts", import.meta.url));
const TSX = import.meta.resolve("tsx");

/** The places reached through a port a test answers: one served tool, and a
 *  record of every call forwarded. */
const onePlaceServed = () => {
  const calls: { name: string; args: unknown }[] = [];
  const mcpConnectingApp: ForConnectingMcps = {
    signInStatus: async () => [],
    signInWithToken: async () => undefined,
    signInWithOAuth: async () => undefined,
    served: async () => ({
      type: "ServedTools",
      data: {
        tools: [{ type: "ServedTool", data: { name: "linear_1a2b__list_issues", description: "[linear] Lists issues.", inputSchema: { type: "object" } } }],
        problems: [],
      },
    }),
    call: async (name, args) => {
      calls.push({ name, args });
      return { type: "ToolAnswer", data: { content: [{ type: "text", text: "3 issues" }], structuredContent: { count: 3 } } };
    },
    stopServing: async () => undefined,
  };
  return { mcpConnectingApp, calls };
};

test("the server lists what the places serve, and forwards a call to them, its answer returned as it came (FR-152, FR-153)", async (t) => {
  const { mcpConnectingApp, calls } = onePlaceServed();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await startMcpServer(mcpConnectingApp, serverTransport);
  const client = new Client({ name: "an-agent", version: "0.0.0" });
  await client.connect(clientTransport);
  t.after(() => client.close());

  const { tools } = await client.listTools();
  const toolAnswer = await client.callTool({ name: "linear_1a2b__list_issues", arguments: { team: "core" } });

  assert.deepEqual(tools, [{ name: "linear_1a2b__list_issues", description: "[linear] Lists issues.", inputSchema: { type: "object" } }]);
  assert.deepEqual(calls, [{ name: "linear_1a2b__list_issues", args: { team: "core" } }]);
  assert.deepEqual(toolAnswer, { content: [{ type: "text", text: "3 issues" }], structuredContent: { count: 3 } });
});

/** A built repository whose one place is the test server started as a local
 *  command, declaring `echo` and a tool the place does not have. */
const aBuiltRepository = async () => {
  const repo = await mkdtemp(join(tmpdir(), "cw-serve-"));
  const command = { command: process.execPath, args: ["--import", TSX, STDIO_SERVER] };
  const address = [command.command, ...command.args].join(" ");
  await mkdir(join(repo, ".cw", "out", "mcp", "local"), { recursive: true });
  await writeFile(join(repo, ".cw", "out", "mcp-origins.json"), JSON.stringify({ origins: [{ ids: ["local"], names: { "local": "local_0a1b" }, address, command, auth: [] }] }));
  await writeFile(
    join(repo, ".cw", "out", "catalog.json"),
    JSON.stringify([{ kind: "mcp", id: "local", description: "A local place.", file: ".cw/out/mcp/local/index.md" }]),
  );
  await writeFile(
    join(repo, ".cw", "out", "mcp", "local", "index.md"),
    `---\nkind: mcp\nid: local\ndescription: A local place.\ncommand: ${process.execPath}\ntools: [echo, missing_tool]\n---\n`,
  );
  return repo;
};

test("cw mcp serve, started by an agent, serves a built repository's places over stdio and stops them with it (FR-152, FR-153)", async (t) => {
  const repo = await aBuiltRepository();
  t.after(() => rm(repo, { recursive: true, force: true }));
  const transport = new StdioClientTransport({ command: process.execPath, args: ["--import", TSX, MAIN, "mcp", "serve"], cwd: repo, stderr: "pipe" });
  const said: string[] = [];
  transport.stderr?.on("data", (chunk: Buffer) => said.push(chunk.toString()));
  const client = new Client({ name: "an-agent", version: "0.0.0" });
  await client.connect(transport);

  const { tools } = await client.listTools();
  const toolAnswer = await client.callTool({ name: "local_0a1b__echo", arguments: { text: "hi" } });
  const undeclaredAnswer = await client.callTool({ name: "read_token", arguments: {} });
  await client.close();

  assert.deepEqual(tools.map(({ name }) => name), ["local_0a1b__echo"]);
  assert.deepEqual(toolAnswer.content, [{ type: "text", text: "echo: hi" }]);
  assert.equal(undeclaredAnswer.isError, true);
  assert.match(said.join(""), /local declares "missing_tool"/);
});

test("cw mcp serve in a repository never built stops, saying to build (FR-152)", async (t) => {
  const repo = await mkdtemp(join(tmpdir(), "cw-serve-"));
  t.after(() => rm(repo, { recursive: true, force: true }));

  const serveRun = spawnSync(process.execPath, ["--import", TSX, MAIN, "mcp", "serve"], { cwd: repo, encoding: "utf8", input: "" });

  assert.equal(serveRun.status, 1);
  assert.equal(serveRun.stdout, "");
  assert.match(serveRun.stderr, /cw build/);
});
