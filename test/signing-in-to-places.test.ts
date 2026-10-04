import { test } from "node:test";
import assert from "node:assert/strict";
import prompts from "prompts";
import { noSessionsKept } from "./no-sessions.js";
import { Commander } from "../src/driver/cli/Commander.js";
import { COMMANDS } from "../src/driver/cli/commands/index.js";
import { EXIT_FAILURE, EXIT_OK } from "../src/driver/cli/commands/Command.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { McpConnecting } from "../src/hexagon/application/McpConnecting.js";
import { TestAuthoring } from "../src/hexagon/application/TestAuthoring.js";
import type { McpOrigin } from "../src/hexagon/domain/models/output/common/McpOrigin.js";
import { InMemoryAuthorizing } from "../src/zdriven/InMemoryAuthorizing.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryMcpServers } from "../src/zdriven/InMemoryMcpServers.js";
import { InMemorySecrets } from "../src/zdriven/InMemorySecrets.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import { InMemoryTokenCounter } from "../src/zdriven/InMemoryTokenCounter.js";
import { InMemoryAgentCli } from "../src/zdriven/InMemoryAgentCli.js";

const repoPath = new URL("file:///repo/");
const ORIGINS_FILE = "file:///repo/.cw/out/mcp-origins.json";
const GITHUB = "https://api.githubcopilot.com/mcp/";
const LINEAR = "https://mcp.linear.app/mcp";

/** Four places at three addresses: two at one address under two paths, one
 *  signed in to by token alone, and a local command taking no token, which
 *  signs in to nothing. */
const ORIGINS: readonly McpOrigin[] = [
  { ids: ["github/billing"], names: { "github/billing": "github_0000" }, address: GITHUB, endpoint: GITHUB, path: "acme/billing", auth: ["oauth", "token"] },
  { ids: ["github/web"], names: { "github/web": "github_0000" }, address: GITHUB, endpoint: GITHUB, path: "acme/web", auth: ["token"] },
  { ids: ["linear"], names: { "linear": "linear_0000" }, address: LINEAR, endpoint: LINEAR, auth: ["token"] },
  { ids: ["local"], names: { "local": "local_0000" }, address: "npx -y some-server", command: { command: "npx", args: ["-y", "some-server"] }, auth: [] },
];

/** Every place the command line is driven through over one list of places, the
 *  store held in memory, and a repository whose files are watched for change. */
const placesOver = (origins: readonly McpOrigin[] | null = ORIGINS) => {
  const held = new InMemoryFileReaders(origins === null ? {} : { [ORIGINS_FILE]: JSON.stringify({ origins }) });
  const secrets = new InMemorySecrets();
  const authorizing = new InMemoryAuthorizing();
  const mcpConnectingApp = new McpConnecting(repoPath, held, secrets, authorizing, new YamlParser(), new InMemoryMcpServers());
  const noFiles = new InMemoryFileReaders({});
  const cli = new Commander({
    cwd: "/repo",
    version: "0.0.0",
    charterAuthoringApp: new CharterAuthoring(repoPath, held, new YamlParser(), new InMemoryFileOutput(held), new InMemoryVCS(), new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() }),
    charterVendoringApp: new CharterVendoring(repoPath, noFiles, new InMemoryVCS()),
    testAuthoringApp: new TestAuthoring(repoPath, noFiles, new InMemoryFileOutput(noFiles)),
    mcpConnectingApp,
    sessionReviewingApp: noSessionsKept,
  }, COMMANDS);
  return { held, secrets, authorizing, mcpConnectingApp, cli };
};

/** One run of the command line, at a terminal or not, with what the terminal
 *  read, and each prompt answered in turn. */
const running = async (cli: Commander, argv: readonly string[], { atTerminal, answers = [] }: { atTerminal: boolean; answers?: readonly unknown[] }) => {
  const results: string[] = [];
  const problems: string[] = [];
  const kept = { out: process.stdout.write, err: process.stderr.write, isTTY: process.stdin.isTTY };
  process.stdout.write = ((text: string) => (results.push(text), true)) as typeof kept.out;
  process.stderr.write = ((text: string) => (problems.push(text), true)) as typeof kept.err;
  process.stdin.isTTY = atTerminal;
  prompts.inject([...answers]);
  try {
    const code = await cli.run(argv);
    return { code, results: results.join(""), problems: problems.join("") };
  } finally {
    process.stdout.write = kept.out;
    process.stderr.write = kept.err;
    process.stdin.isTTY = kept.isTTY;
  }
};

test("signInStatus() answers one row per address taking a sign-in, its ids whatever their path, and asks nothing (FR-150)", async () => {
  const { mcpConnectingApp, secrets } = placesOver();
  await secrets.writeSecret(LINEAR, JSON.stringify({ address: LINEAR, method: "token", accessToken: "t" }));

  assert.deepEqual((await mcpConnectingApp.signInStatus()).map((one) => one.data), [
    { address: GITHUB, ids: ["github/billing", "github/web"], auth: ["oauth", "token"], signedIn: false },
    { address: LINEAR, ids: ["linear"], auth: ["token"], signedIn: true, method: "token" },
  ]);
});

test("no list of places is refused, saying to build (FR-152)", async () => {
  const { mcpConnectingApp } = placesOver(null);
  await assert.rejects(mcpConnectingApp.signInStatus(), (raised: Error & { fix?: string }) => {
    assert.match(raised.message, /mcp-origins\.json/);
    assert.match(raised.fix ?? "", /cw build/);
    return true;
  });
});

test("a token is kept under its address; one for no place, a way the address does not allow, or an empty token keeps nothing (FR-148)", async () => {
  const { mcpConnectingApp, secrets } = placesOver();

  await mcpConnectingApp.signInWithToken(LINEAR, "lin-token");
  assert.deepEqual(JSON.parse(secrets.secrets.get(LINEAR) ?? ""), { address: LINEAR, method: "token", accessToken: "lin-token" });

  await assert.rejects(mcpConnectingApp.signInWithToken("https://nowhere.example/mcp", "t"), /No place/);
  await assert.rejects(mcpConnectingApp.signInWithOAuth(LINEAR, () => undefined), /allows token/);
  await assert.rejects(mcpConnectingApp.signInWithToken(GITHUB, "  "), /No token/);
  assert.deepEqual([...secrets.secrets.keys()], [LINEAR]);
});

test("an OAuth sign-in keeps what the place issued, with its registration (FR-148)", async () => {
  const { mcpConnectingApp, secrets, authorizing } = placesOver();
  authorizing.oauthGrant = { accessToken: "a", refreshToken: "r", expiresAt: "2030-01-01T00:00:00.000Z", client: { clientId: "c", issuer: "https://github.com/" } };
  const shown: string[] = [];

  await mcpConnectingApp.signInWithOAuth(GITHUB, (authorizationUrl) => shown.push(authorizationUrl));

  assert.equal(shown.length, 1);
  assert.deepEqual(JSON.parse(secrets.secrets.get(GITHUB) ?? ""), { address: GITHUB, method: "oauth", ...authorizing.oauthGrant });
});

test("cw mcp auth at a terminal asks about each address not signed in, then asks nothing the next time, and no file changes (Story 18, 1 – 3, 5)", async () => {
  const { cli, secrets, held } = placesOver();
  const filesBefore = await held.readFilesRecursively(repoPath);

  const firstRun = await running(cli, ["mcp", "auth"], { atTerminal: true, answers: ["token", "gh-secret", "lin-secret"] });
  assert.equal(firstRun.code, EXIT_OK, firstRun.problems);
  assert.deepEqual([...secrets.secrets.keys()].sort(), [LINEAR, GITHUB].sort());
  assert.match(firstRun.results, /Signed in at/);
  for (const token of ["gh-secret", "lin-secret"]) assert.doesNotMatch(firstRun.results + firstRun.problems, new RegExp(token));

  const secondRun = await running(cli, ["mcp", "auth"], { atTerminal: true });
  assert.equal(secondRun.code, EXIT_OK);
  assert.match(secondRun.results, /signed in at every address: 2/);

  assert.deepEqual(await held.readFilesRecursively(repoPath), filesBefore);
});

test("cw mcp auth signs in by OAuth where chosen, printing the address to open", async () => {
  const { cli, secrets, authorizing } = placesOver();

  const run = await running(cli, ["mcp", "auth"], { atTerminal: true, answers: ["oauth", "lin-secret"] });

  assert.equal(run.code, EXIT_OK, run.problems);
  assert.deepEqual(authorizing.authorized, [GITHUB]);
  assert.match(run.problems, new RegExp(`${GITHUB}/authorize`));
  assert.equal(JSON.parse(secrets.secrets.get(GITHUB) ?? "").method, "oauth");
});

test("cw mcp auth without a terminal asks nothing, names each address not signed in, and fails (Story 18, 4)", async () => {
  const { cli, secrets } = placesOver();

  const run = await running(cli, ["mcp", "auth"], { atTerminal: false });

  assert.equal(run.code, EXIT_FAILURE);
  assert.match(run.problems, new RegExp(GITHUB));
  assert.match(run.problems, new RegExp(LINEAR));
  assert.match(run.problems, /at a terminal/);
  assert.equal(secrets.secrets.size, 0);
});

test("cw mcp auth --status lists each address, its ids and whether signed in, and changes nothing (Story 18, 6)", async () => {
  const { cli, secrets } = placesOver();
  await secrets.writeSecret(LINEAR, JSON.stringify({ address: LINEAR, method: "token", accessToken: "lin-secret" }));

  const run = await running(cli, ["mcp", "auth", "--status"], { atTerminal: true });

  assert.equal(run.code, EXIT_OK);
  assert.equal(
    run.results,
    [GITHUB, "  github/billing, github/web", "  not signed in", LINEAR, "  linear", "  signed in by token", ""].join("\n"),
  );
  assert.doesNotMatch(run.results, /lin-secret/);
  assert.equal(secrets.secrets.size, 1);
});

test("cw mcp auth <id> signs in again at that id's address alone, whatever was kept (Story 18, 7)", async () => {
  const { cli, secrets } = placesOver();
  await secrets.writeSecret(GITHUB, JSON.stringify({ address: GITHUB, method: "token", accessToken: "old" }));

  const run = await running(cli, ["mcp", "auth", "github/web"], { atTerminal: true, answers: ["token", "new"] });

  assert.equal(run.code, EXIT_OK, run.problems);
  assert.equal(JSON.parse(secrets.secrets.get(GITHUB) ?? "").accessToken, "new");
  assert.equal(secrets.secrets.has(LINEAR), false);

  const unknown = await running(cli, ["mcp", "auth", "nowhere"], { atTerminal: true });
  assert.equal(unknown.code, EXIT_FAILURE);
  assert.match(unknown.problems, /nowhere/);
});

test("a place at plain http on another machine is signed in to by no way, and keeps nothing, whatever the list says (FR-149)", async () => {
  const CLEARTEXT = "http://mcp.example/mcp";
  const { mcpConnectingApp, secrets } = placesOver([{ ids: ["cleartext"], names: { "cleartext": "cleartext_0000" }, address: CLEARTEXT, endpoint: CLEARTEXT, auth: ["oauth", "token"] }]);

  await assert.rejects(mcpConnectingApp.signInWithToken(CLEARTEXT, "t"), { message: /plain http/, fix: /https:\/\// });
  await assert.rejects(mcpConnectingApp.signInWithOAuth(CLEARTEXT, () => undefined), /plain http/);
  assert.equal(secrets.secrets.size, 0);
});
