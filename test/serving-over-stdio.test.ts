import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { ForBuildingCharter } from "../src/module/charter/app/port/in/building-charter.port.js";
import type { ForRunningCharter } from "../src/module/runtime/app/port/in/running-charter.port.js";
import { startMcpServer } from "../src/presentation/mcp/mcp.server.js";

const MAIN = fileURLToPath(new URL("../main.ts", import.meta.url));
const STDIO_SERVER = fileURLToPath(new URL("./an-mcp-server-over-stdio.ts", import.meta.url));
const TSX = import.meta.resolve("tsx");
const MODULE_LOADER = import.meta.resolve("../scripts/module-loader.mjs");

/** The mcp origins reached through a port a test answers: one served tool, and a
 *  record of every call forwarded. */
const oneMcpOriginServed = () => {
  const calls: { name: string; args: unknown }[] = [];
  // The mcp server asks building the charter for its tools and its calls, and
  // for nothing else.
  const servingApp: Pick<ForBuildingCharter, "listServedTools"> & Pick<ForRunningCharter, "callTool"> = {
    listServedTools: async () => ({
      type: "ServedTools",
      data: {
        tools: [
          {
            type: "ServedTool",
            data: {
              name: "linear_1a2b__list_issues",
              description: "[linear] Lists issues.",
              inputSchema: { type: "object" },
            },
          },
        ],
        problems: [],
      },
    }),
    callTool: async (name, args) => {
      calls.push({ name, args });
      return {
        type: "ToolAnswer",
        data: { content: [{ type: "text", text: "3 issues" }], structuredContent: { count: 3 } },
      };
    },
  };
  return { charterRuntimeApp: servingApp, calls };
};

test("a tool listing the charter refuses is answered as the protocol's internal error, its message and fix said once (CORE Story 53 scenario 4)", async (t) => {
  const refusingApp: Pick<ForBuildingCharter, "listServedTools"> & Pick<ForRunningCharter, "callTool"> = {
    listServedTools: async () => ({
      type: "Fault",
      data: {
        name: "MissingMcpOriginsFault",
        message: "No build lists the mcp origins.",
        fix: 'Run "cw build".',
        severity: "error",
      },
    }),
    callTool: async () => assert.fail("no call is made"),
  };
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await startMcpServer(refusingApp, refusingApp, serverTransport);
  const client = new Client({ name: "an-agent", version: "0.0.0" });
  await client.connect(clientTransport);
  t.after(() => client.close());

  await assert.rejects(client.listTools(), (raisedValue: { code?: number; message?: string }) => {
    assert.equal(raisedValue.code, -32603);
    assert.equal(raisedValue.message, 'MCP error -32603: No build lists the mcp origins. Run "cw build".');
    return true;
  });
});

test("the server lists what the mcp origins serve, and forwards a call to them, its answer returned as it came (FR-152, FR-153)", async (t) => {
  const { charterRuntimeApp, calls } = oneMcpOriginServed();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await startMcpServer(charterRuntimeApp, charterRuntimeApp, serverTransport);
  const client = new Client({ name: "an-agent", version: "0.0.0" });
  await client.connect(clientTransport);
  t.after(() => client.close());

  const { tools } = await client.listTools();
  const toolAnswer = await client.callTool({ name: "linear_1a2b__list_issues", arguments: { team: "core" } });

  assert.deepEqual(tools, [
    { name: "linear_1a2b__list_issues", description: "[linear] Lists issues.", inputSchema: { type: "object" } },
  ]);
  assert.deepEqual(calls, [{ name: "linear_1a2b__list_issues", args: { team: "core" } }]);
  assert.deepEqual(toolAnswer, { content: [{ type: "text", text: "3 issues" }], structuredContent: { count: 3 } });
});

/** A built repository whose one mcp origin is the test server started as a local
 *  command, declaring `echo` and a tool the mcp origin does not have. */
const aBuiltRepository = async () => {
  const repo = await mkdtemp(join(tmpdir(), "cw-serve-"));
  const command = { command: process.execPath, args: ["--import", TSX, STDIO_SERVER] };
  const address = [command.command, ...command.args].join(" ");
  await mkdir(join(repo, ".cw", "out", "mcp", "local"), { recursive: true });
  await writeFile(
    join(repo, ".cw", "out", "mcp-origins.json"),
    JSON.stringify({
      origins: [
        {
          ids: ["local"],
          names: { local: "local_0a1b" },
          address,
          command,
          auth: [],
          tools: [
            {
              name: "echo",
              description: "Echo the text back.",
              inputSchema: { type: "object", properties: { text: { type: "string" } } },
            },
          ],
        },
      ],
    }),
  );
  await writeFile(
    join(repo, ".cw", "out", "catalogue.json"),
    JSON.stringify([
      { kind: "mcp", id: "local", description: "A local mcp origin.", file: ".cw/out/mcp/local/index.md" },
    ]),
  );
  await writeFile(
    join(repo, ".cw", "out", "mcp", "local", "index.md"),
    `---\nkind: mcp\nid: local\ndescription: A local mcp origin.\ncommand: ${process.execPath}\ntools: [echo, missing_tool]\n---\n`,
  );
  return repo;
};

test("cw mcp serve, started by an agent, serves a built repository's mcp origins over stdio and stops them with it (FR-152, FR-153, CORE Story 19 scenario 1)", async (t) => {
  const repo = await aBuiltRepository();
  t.after(() => rm(repo, { recursive: true, force: true }));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", TSX, "--import", MODULE_LOADER, MAIN, "mcp", "serve"],
    cwd: repo,
    stderr: "pipe",
  });
  const said: string[] = [];
  transport.stderr?.on("data", (chunk: Buffer) => said.push(chunk.toString()));
  const client = new Client({ name: "an-agent", version: "0.0.0" });
  await client.connect(transport);

  const { tools } = await client.listTools();
  const toolAnswer = await client.callTool({ name: "local_0a1b__echo", arguments: { text: "hi" } });
  const undeclaredAnswer = await client.callTool({ name: "read_token", arguments: {} });
  await client.close();

  assert.deepEqual(
    tools.map(({ name }) => name),
    ["local_0a1b__echo"],
  );
  assert.deepEqual(toolAnswer.content, [{ type: "text", text: "echo: hi" }]);
  assert.equal(undeclaredAnswer.isError, true);
  assert.match(said.join(""), /local declares "missing_tool"/);
});

test("cw mcp serve in a repository never built stops, saying to build (FR-152, CORE Story 19 scenario 7)", async (t) => {
  const repo = await mkdtemp(join(tmpdir(), "cw-serve-"));
  t.after(() => rm(repo, { recursive: true, force: true }));

  const serveRun = spawnSync(process.execPath, ["--import", TSX, "--import", MODULE_LOADER, MAIN, "mcp", "serve"], {
    cwd: repo,
    encoding: "utf8",
    input: "",
  });

  assert.equal(serveRun.status, 1);
  assert.equal(serveRun.stdout, "");
  assert.match(serveRun.stderr, /cw build/);
});
