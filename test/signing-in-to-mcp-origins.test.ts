import assert from "node:assert/strict";
import { test } from "node:test";
import prompts from "prompts";
import type { McpOrigin } from "../src/module/charter/domain/models/projection/mcp-origin.js";
import { InMemoryAuthorizing } from "../src/module/charter/infra/in-memory/in-memory-authorizing.adapter.js";
import { InMemoryCredentialsRepository } from "../src/module/charter/infra/in-memory/in-memory-credentials.repository.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryMcpServers } from "../src/module/shared/infra/in-memory/in-memory-mcp-servers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { Commander } from "../src/presentation/cli/cli.commander.js";
import { EXIT_FAILURE, EXIT_OK } from "../src/presentation/cli/commands/command.interface.js";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { answerOf, faultTextOf } from "./answer-of.js";
import { charterFilesOf } from "./charter-of-mcp-origins.js";
import { authoringCharterOf, buildingCharterOf, commandLineOf } from "./use-cases-of.js";

const repoPath = new URL("file:///repo/");
const ORIGINS_FILE = "file:///repo/.cw/out/mcp-origins.json";
const GITHUB = "https://api.githubcopilot.com/mcp/";
const LINEAR = "https://mcp.linear.app/mcp";

/** Four mcp origins at three addresses: two at one address under two paths, one
 *  signed in to by token alone, and a local command taking no token, which
 *  signs in to nothing. */
const ORIGINS: readonly McpOrigin[] = [
  {
    ids: ["github/billing"],
    names: { "github/billing": "github_0000" },
    address: GITHUB,
    endpoint: GITHUB,
    path: "acme/billing",
    auth: ["oauth", "token"],
  },
  {
    ids: ["github/web"],
    names: { "github/web": "github_0000" },
    address: GITHUB,
    endpoint: GITHUB,
    path: "acme/web",
    auth: ["token"],
  },
  { ids: ["linear"], names: { linear: "linear_0000" }, address: LINEAR, endpoint: LINEAR, auth: ["token"] },
  {
    ids: ["local"],
    names: { local: "local_0000" },
    address: "npx -y some-server",
    command: { command: "npx", args: ["-y", "some-server"] },
    auth: [],
  },
];

/** Every mcp origin the command line is driven through over one list of mcp origins, the
 *  store held in memory, and a repository whose files are watched for change. */
const mcpOriginsOver = (origins: readonly McpOrigin[] | null = ORIGINS) => {
  const held = new InMemoryFileReaders(
    origins === null ? {} : { ...charterFilesOf(origins), [ORIGINS_FILE]: JSON.stringify({ origins }) },
  );
  const credentialsRepository = new InMemoryCredentialsRepository();
  const authorizing = new InMemoryAuthorizing();
  const charterAuthoringApp = authoringCharterOf(held, new InMemoryFileOutput(held), new InMemoryReporter(), {
    credentialsRepository,
    authorizing,
  });
  const cli = new Commander(
    commandLineOf(
      held,
      new InMemoryFileOutput(held),
      {
        charterAuthoringApp,
        charterRuntimeApp: buildingCharterOf(
          held,
          new InMemoryFileOutput(held),
          new InMemoryTokenCounter(),
          { claude: new InMemoryAgentCli() },
          new InMemoryReporter(),
          { mcpServers: new InMemoryMcpServers(), credentialsRepository, authorizing },
        ),
      },
      "/repo",
    ),
    COMMANDS,
  );
  return { held, credentialsRepository, authorizing, charterAuthoringApp, cli };
};

/** One run of the command line, at a terminal or not, with what the terminal
 *  read, and each prompt answered in turn. */
const running = async (
  cli: Commander,
  argv: readonly string[],
  { atTerminal, answers = [] }: { atTerminal: boolean; answers?: readonly unknown[] },
) => {
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
  const { charterAuthoringApp, credentialsRepository } = mcpOriginsOver();
  await credentialsRepository.secrets.set(
    LINEAR,
    JSON.stringify({ address: LINEAR, method: "token", accessToken: "t" }),
  );

  assert.deepEqual(
    answerOf(await charterAuthoringApp.signInStatus()).data.signInStatuses.map((one) => one.data),
    [
      { address: GITHUB, ids: ["github/billing", "github/web"], auth: ["oauth", "token"], signedIn: false },
      { address: LINEAR, ids: ["linear"], auth: ["token"], signedIn: true, method: "token" },
    ],
  );
});

test("a charter with no mcp has no address to sign in to (FR-148)", async () => {
  const { charterAuthoringApp } = mcpOriginsOver(null);
  assert.deepEqual(answerOf(await charterAuthoringApp.signInStatus()).data.signInStatuses, []);
});

test("an mcp the charter holds is signed in to before any build has listed it (FR-148, EVAL-FR-031)", async () => {
  const [githubOrigin] = ORIGINS as [McpOrigin];
  const { held, charterAuthoringApp, credentialsRepository } = mcpOriginsOver(null);
  for (const [href, text] of Object.entries(charterFilesOf([githubOrigin]))) held.write(new URL(href), text);

  assert.deepEqual(
    answerOf(await charterAuthoringApp.signInStatus()).data.signInStatuses.map((one) => one.data.ids),
    [["github/billing"]],
  );
  await charterAuthoringApp.signInWithToken(GITHUB, "gh-token");
  assert.deepEqual(JSON.parse(credentialsRepository.secrets.get(GITHUB) ?? ""), {
    address: GITHUB,
    method: "token",
    accessToken: "gh-token",
  });
});

test("a token is kept under its address; one for no mcp origin, a way the address does not allow, or an empty token keeps nothing (FR-148)", async () => {
  const { charterAuthoringApp, credentialsRepository } = mcpOriginsOver();

  await charterAuthoringApp.signInWithToken(LINEAR, "lin-token");
  assert.deepEqual(JSON.parse(credentialsRepository.secrets.get(LINEAR) ?? ""), {
    address: LINEAR,
    method: "token",
    accessToken: "lin-token",
  });

  assert.match(
    faultTextOf(await charterAuthoringApp.signInWithToken("https://nowhere.example/mcp", "t")),
    /No mcp in the charter/,
  );
  assert.match(faultTextOf(await charterAuthoringApp.signInWithOAuth(LINEAR, () => undefined)), /allows token/);
  assert.match(faultTextOf(await charterAuthoringApp.signInWithToken(GITHUB, "  ")), /No token/);
  assert.deepEqual([...credentialsRepository.secrets.keys()], [LINEAR]);
});

test("an OAuth sign-in keeps what the mcp origin issued, with its registration (FR-148)", async () => {
  const { charterAuthoringApp, credentialsRepository, authorizing } = mcpOriginsOver();
  authorizing.oauthGrant = {
    accessToken: "a",
    refreshToken: "r",
    expiresAt: "2030-01-01T00:00:00.000Z",
    client: { clientId: "c", issuer: "https://github.com/" },
  };
  const shown: string[] = [];

  await charterAuthoringApp.signInWithOAuth(GITHUB, (authorizationUrl) => shown.push(authorizationUrl));

  assert.equal(shown.length, 1);
  assert.deepEqual(JSON.parse(credentialsRepository.secrets.get(GITHUB) ?? ""), {
    address: GITHUB,
    method: "oauth",
    ...authorizing.oauthGrant,
  });
});

test("cw mcp auth at a terminal asks about each address not signed in, then asks nothing the next time, and no file changes (Story 18, 1 – 3, 5)", async () => {
  const { cli, credentialsRepository, held } = mcpOriginsOver();
  const filesBefore = await held.readFilesRecursively(repoPath);

  const firstRun = await running(cli, ["mcp", "auth"], {
    atTerminal: true,
    answers: ["token", "gh-secret", "lin-secret"],
  });
  assert.equal(firstRun.code, EXIT_OK, firstRun.problems);
  assert.deepEqual([...credentialsRepository.secrets.keys()].sort(), [LINEAR, GITHUB].sort());
  assert.match(firstRun.results, /Signed in at/);
  for (const token of ["gh-secret", "lin-secret"])
    assert.doesNotMatch(firstRun.results + firstRun.problems, new RegExp(token));

  const secondRun = await running(cli, ["mcp", "auth"], { atTerminal: true });
  assert.equal(secondRun.code, EXIT_OK);
  assert.match(secondRun.results, /signed in at every address: 2/);

  assert.deepEqual(await held.readFilesRecursively(repoPath), filesBefore);
});

test("cw mcp auth signs in by OAuth where chosen, printing the address to open", async () => {
  const { cli, credentialsRepository, authorizing } = mcpOriginsOver();

  const run = await running(cli, ["mcp", "auth"], { atTerminal: true, answers: ["oauth", "lin-secret"] });

  assert.equal(run.code, EXIT_OK, run.problems);
  assert.deepEqual(authorizing.authorized, [GITHUB]);
  assert.match(run.problems, new RegExp(`${GITHUB}/authorize`));
  assert.equal(JSON.parse(credentialsRepository.secrets.get(GITHUB) ?? "").method, "oauth");
});

test("cw mcp auth without a terminal asks nothing, names each address not signed in, and fails (Story 18, 4)", async () => {
  const { cli, credentialsRepository } = mcpOriginsOver();

  const run = await running(cli, ["mcp", "auth"], { atTerminal: false });

  assert.equal(run.code, EXIT_FAILURE);
  assert.match(run.problems, new RegExp(GITHUB));
  assert.match(run.problems, new RegExp(LINEAR));
  assert.match(run.problems, /at a terminal/);
  assert.equal(credentialsRepository.secrets.size, 0);
});

test("cw mcp auth --status lists each address, its ids and whether signed in, and changes nothing (Story 18, 6)", async () => {
  const { cli, credentialsRepository } = mcpOriginsOver();
  await credentialsRepository.secrets.set(
    LINEAR,
    JSON.stringify({ address: LINEAR, method: "token", accessToken: "lin-secret" }),
  );

  const run = await running(cli, ["mcp", "auth", "--status"], { atTerminal: true });

  assert.equal(run.code, EXIT_OK);
  assert.equal(
    run.results,
    [GITHUB, "  github/billing, github/web", "  not signed in", LINEAR, "  linear", "  signed in by token", ""].join(
      "\n",
    ),
  );
  assert.doesNotMatch(run.results, /lin-secret/);
  assert.equal(credentialsRepository.secrets.size, 1);
});

test("cw mcp auth <id> signs in again at that id's address alone, whatever was kept (Story 18, 7)", async () => {
  const { cli, credentialsRepository } = mcpOriginsOver();
  await credentialsRepository.secrets.set(
    GITHUB,
    JSON.stringify({ address: GITHUB, method: "token", accessToken: "old" }),
  );

  const run = await running(cli, ["mcp", "auth", "github/web"], { atTerminal: true, answers: ["token", "new"] });

  assert.equal(run.code, EXIT_OK, run.problems);
  assert.equal(JSON.parse(credentialsRepository.secrets.get(GITHUB) ?? "").accessToken, "new");
  assert.equal(credentialsRepository.secrets.has(LINEAR), false);

  const unknown = await running(cli, ["mcp", "auth", "nowhere"], { atTerminal: true });
  assert.equal(unknown.code, EXIT_FAILURE);
  assert.match(unknown.problems, /nowhere/);
});

test("an mcp origin at plain http on another machine is signed in to by no way, and keeps nothing: the charter does not hold it (FR-149)", async () => {
  const CLEARTEXT = "http://mcp.example/mcp";
  const { charterAuthoringApp, credentialsRepository } = mcpOriginsOver([
    {
      ids: ["cleartext"],
      names: { cleartext: "cleartext_0000" },
      address: CLEARTEXT,
      endpoint: CLEARTEXT,
      auth: ["oauth", "token"],
    },
  ]);

  assert.match(
    faultTextOf(await charterAuthoringApp.signInWithToken(CLEARTEXT, "t")),
    /No mcp in the charter is at http:\/\/mcp\.example\/mcp/,
  );
  assert.match(
    faultTextOf(await charterAuthoringApp.signInWithOAuth(CLEARTEXT, () => undefined)),
    /No mcp in the charter/,
  );
  assert.equal(credentialsRepository.secrets.size, 0);
});
