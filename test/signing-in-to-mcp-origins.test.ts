import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import prompts from "prompts";
import { McpOrigin } from "../src/module/charter/domain/models/charter-output/mcp-origin.js";
import { McpAuthMethod } from "../src/module/charter/domain/models/mcp/mcp-auth-method.value-object.js";
import { InMemoryCredentialsRepository } from "../src/module/charter/infra/in-memory/in-memory-credentials.repository.js";
import { InMemoryOAuthAuthorizer } from "../src/module/charter/infra/in-memory/in-memory-oauth-authorizer.adapter.js";
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
  new McpOrigin({
    ids: ["github/billing"],
    names: { "github/billing": "github_0000" },
    address: GITHUB,
    endpoint: GITHUB,
    path: "acme/billing",
    auth: [McpAuthMethod.OAUTH, McpAuthMethod.TOKEN],
  }),
  new McpOrigin({
    ids: ["github/web"],
    names: { "github/web": "github_0000" },
    address: GITHUB,
    endpoint: GITHUB,
    path: "acme/web",
    auth: [McpAuthMethod.TOKEN],
  }),
  new McpOrigin({
    ids: ["linear"],
    names: { linear: "linear_0000" },
    address: LINEAR,
    endpoint: LINEAR,
    auth: [McpAuthMethod.TOKEN],
  }),
  new McpOrigin({
    ids: ["local"],
    names: { local: "local_0000" },
    address: "npx -y some-server",
    command: { command: "npx", args: ["-y", "some-server"] },
    auth: [],
  }),
];

/** Every mcp origin the command line is driven through over one list of mcp origins, the
 *  store held in memory, and a repository whose files are watched for change. */
const mcpOriginsOver = (origins: readonly McpOrigin[] | null = ORIGINS) => {
  const held = new InMemoryFileReaders(
    origins === null ? {} : { ...charterFilesOf(origins), [ORIGINS_FILE]: JSON.stringify({ origins }) },
  );
  const credentialsRepository = new InMemoryCredentialsRepository();
  const oauthAuthorizer = new InMemoryOAuthAuthorizer();
  const charterAuthoringApp = authoringCharterOf(held, new InMemoryFileOutput(held), new InMemoryReporter(), {
    credentialsRepository,
    oauthAuthorizer,
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
          { mcpServerCaller: new InMemoryMcpServers(), credentialsRepository, oauthAuthorizer },
        ),
      },
      "/repo",
    ),
    COMMANDS,
  );
  return { held, credentialsRepository, oauthAuthorizer, charterAuthoringApp, cli };
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
    const code = await cli.runCommandLine(argv);
    return { code, results: results.join(""), problems: problems.join("") };
  } finally {
    process.stdout.write = kept.out;
    process.stderr.write = kept.err;
    process.stdin.isTTY = kept.isTTY;
  }
};

test("listSignInStatuses() answers one row per address taking a sign-in, its ids whatever their path, and asks nothing (FR-150, CORE Story 18 scenario 2)", async () => {
  const { charterAuthoringApp, credentialsRepository } = mcpOriginsOver();
  await credentialsRepository.secretByAddress.set(
    LINEAR,
    JSON.stringify({ address: LINEAR, method: "token", accessToken: "t" }),
  );

  assert.deepEqual(
    answerOf(await charterAuthoringApp.listSignInStatuses()).data.signInStatuses.map(
      (signInStatus) => signInStatus.data,
    ),
    [
      { address: GITHUB, ids: ["github/billing", "github/web"], auth: ["oauth", "token"], signedIn: false },
      { address: LINEAR, ids: ["linear"], auth: ["token"], signedIn: true, method: "token" },
    ],
  );
});

test("a charter with no mcp has no address to sign in to (FR-148)", async () => {
  const { charterAuthoringApp } = mcpOriginsOver(null);
  assert.deepEqual(answerOf(await charterAuthoringApp.listSignInStatuses()).data.signInStatuses, []);
});

test("an mcp the charter holds is signed in to before any build has listed it (FR-148, EVAL-FR-031)", async () => {
  const [githubOrigin] = ORIGINS as [McpOrigin];
  const { held, charterAuthoringApp, credentialsRepository } = mcpOriginsOver(null);
  for (const [href, text] of Object.entries(charterFilesOf([githubOrigin]))) held.writeFile(new URL(href), text);

  assert.deepEqual(
    answerOf(await charterAuthoringApp.listSignInStatuses()).data.signInStatuses.map(
      (signInStatus) => signInStatus.data.ids,
    ),
    [["github/billing"]],
  );
  await charterAuthoringApp.signInWithToken(GITHUB, "gh-token");
  assert.deepEqual(JSON.parse(credentialsRepository.secretByAddress.get(GITHUB) ?? ""), {
    address: GITHUB,
    method: "token",
    accessToken: "gh-token",
  });
});

test("a token is kept under its address; one for no mcp origin, a way the address does not allow, or an empty token keeps nothing (FR-148)", async () => {
  const { charterAuthoringApp, credentialsRepository } = mcpOriginsOver();

  await charterAuthoringApp.signInWithToken(LINEAR, "lin-token");
  assert.deepEqual(JSON.parse(credentialsRepository.secretByAddress.get(LINEAR) ?? ""), {
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
  assert.deepEqual([...credentialsRepository.secretByAddress.keys()], [LINEAR]);
});

test("an OAuth sign-in keeps what the mcp origin issued, with its registration (FR-148)", async () => {
  const { charterAuthoringApp, credentialsRepository, oauthAuthorizer } = mcpOriginsOver();
  oauthAuthorizer.oauthGrant = {
    accessToken: "a",
    refreshToken: "r",
    expiresAt: "2030-01-01T00:00:00.000Z",
    client: { clientId: "c", issuer: "https://github.com/" },
  };
  const shown: string[] = [];

  await charterAuthoringApp.signInWithOAuth(GITHUB, (authorizationUrl) => shown.push(authorizationUrl));

  assert.equal(shown.length, 1);
  assert.deepEqual(JSON.parse(credentialsRepository.secretByAddress.get(GITHUB) ?? ""), {
    address: GITHUB,
    method: "oauth",
    ...oauthAuthorizer.oauthGrant,
  });
});

test("cw mcp auth at a terminal asks about each address not signed in, then asks nothing the next time, and no file changes (CORE Story 18 scenarios 1 – 3, 5, CORE Story 55 scenario 8)", async () => {
  const { cli, credentialsRepository, held } = mcpOriginsOver();
  const filesBefore = await held.readFilesRecursively(repoPath);

  // GitHub, allowing OAuth by one mcp and a token by both, is asked how; Linear,
  // allowing a token alone, is asked for the token straight away.
  const firstRun = await running(cli, ["mcp", "auth"], {
    atTerminal: true,
    answers: ["token", "gh-secret", "lin-secret"],
  });
  assert.equal(firstRun.code, EXIT_OK, firstRun.problems);
  assert.deepEqual([...credentialsRepository.secretByAddress.keys()].sort(), [LINEAR, GITHUB].sort());
  // Each address in turn, with every id declaring it.
  assert.match(
    firstRun.problems,
    new RegExp(`${GITHUB}\\n {2}github/billing, github/web\\n[\\s\\S]*${LINEAR}\\n {2}linear\\n`),
  );
  assert.doesNotMatch(firstRun.problems, /npx -y some-server/);
  assert.deepEqual(
    [GITHUB, LINEAR].map(
      (address) => JSON.parse(credentialsRepository.secretByAddress.get(address) ?? "{}").accessToken,
    ),
    ["gh-secret", "lin-secret"],
  );
  // The token typed reaches no file under the repository.
  for (const { contents } of await held.readFilesRecursively(repoPath))
    assert.doesNotMatch(String(contents), /gh-secret|lin-secret/);
  assert.match(firstRun.results, /Signed in at/);
  for (const token of ["gh-secret", "lin-secret"])
    assert.doesNotMatch(firstRun.results + firstRun.problems, new RegExp(token));

  const secondRun = await running(cli, ["mcp", "auth"], { atTerminal: true });
  assert.equal(secondRun.code, EXIT_OK);
  assert.match(secondRun.results, /signed in at every address: 2/);

  assert.deepEqual(await held.readFilesRecursively(repoPath), filesBefore);
});

test("cw mcp auth at a terminal offers each way an address allows to sign in, and reads the token typed without showing it (CORE Story 18 scenario 1, CORE Story 18 scenario 5, CORE Story 55 scenario 8)", {
  timeout: 30_000,
}, async (t) => {
  const { cli, credentialsRepository } = mcpOriginsOver();
  // A terminal of a test's own: each key is pressed once the prompt it
  // answers is shown, as a person would. Answers another test handed prompts
  // are taken away, even none: an injected list, empty or not, is read
  // before any terminal is.
  Object.assign(prompts, { _injected: undefined });
  const terminalInput = Object.assign(new PassThrough(), { isTTY: true, setRawMode: () => terminalInput });
  const processStdinDescriptor = Object.getOwnPropertyDescriptor(process, "stdin");
  Object.defineProperty(process, "stdin", { value: terminalInput, configurable: true });
  const shownTexts: string[] = [];
  const originalWriteByStream = { out: process.stdout.write, err: process.stderr.write };
  t.after(() => {
    if (processStdinDescriptor !== undefined) Object.defineProperty(process, "stdin", processStdinDescriptor);
    process.stdout.write = originalWriteByStream.out;
    process.stderr.write = originalWriteByStream.err;
  });
  // GitHub allows OAuth and a token: the arrow moves to the token, which is
  // then typed; Linear allows a token alone, typed straight away.
  const pressedKeysByPrompt: [RegExp, string][] = [
    [/Sign in how\?/, "\x1b[B\r"],
    [/Token\?/, "gh-secret\r"],
    [/Token\?[\s\S]*Token\?/, "lin-secret\r"],
  ];
  const showText = (text: string) => {
    shownTexts.push(text);
    const nextPromptKeys = pressedKeysByPrompt[0];
    if (nextPromptKeys?.[0].test(shownTexts.join(""))) {
      pressedKeysByPrompt.shift();
      setTimeout(() => terminalInput.write(nextPromptKeys[1]), 20);
    }
    return true;
  };
  // What the terminal is shown is text; the bytes the test runner reports in
  // meanwhile go on where they were going.
  process.stdout.write = ((text: string | Uint8Array, ...writeArguments: unknown[]) =>
    typeof text === "string"
      ? showText(text)
      : Reflect.apply(originalWriteByStream.out, process.stdout, [
          text,
          ...writeArguments,
        ])) as typeof originalWriteByStream.out;
  process.stderr.write = ((text: string | Uint8Array, ...writeArguments: unknown[]) =>
    typeof text === "string"
      ? showText(text)
      : Reflect.apply(originalWriteByStream.err, process.stderr, [
          text,
          ...writeArguments,
        ])) as typeof originalWriteByStream.err;

  const exitCode = await cli.runCommandLine(["mcp", "auth"]);

  // What the terminal showed, its colours and cursor moves taken out.
  const shownText = shownTexts.join("").replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[A-Za-z]`, "g"), "");
  assert.equal(exitCode, EXIT_OK, shownText);
  // Each way GitHub allows is offered by name.
  assert.match(shownText, /Sign in how\?/);
  assert.match(shownText, /in the browser \(OAuth\)/);
  assert.match(shownText, /with a token/);
  // The token is asked for and typed without a character of it shown.
  assert.match(shownText, /Token\?/);
  for (const token of ["gh-secret", "lin-secret"]) assert.doesNotMatch(shownText, new RegExp(token));
  assert.deepEqual(
    [GITHUB, LINEAR].map(
      (address) => JSON.parse(credentialsRepository.secretByAddress.get(address) ?? "{}").accessToken,
    ),
    ["gh-secret", "lin-secret"],
  );
});

test("cw mcp auth signs in by OAuth where chosen, printing the address to open", async () => {
  const { cli, credentialsRepository, oauthAuthorizer } = mcpOriginsOver();

  const run = await running(cli, ["mcp", "auth"], { atTerminal: true, answers: ["oauth", "lin-secret"] });

  assert.equal(run.code, EXIT_OK, run.problems);
  assert.deepEqual(oauthAuthorizer.authorizedEndpoints, [GITHUB]);
  assert.match(run.problems, new RegExp(`${GITHUB}/authorize`));
  assert.equal(JSON.parse(credentialsRepository.secretByAddress.get(GITHUB) ?? "").method, "oauth");
});

test("cw mcp auth without a terminal asks nothing, names each address not signed in, and fails (CORE Story 18 scenario 4)", async () => {
  const { cli, credentialsRepository } = mcpOriginsOver();

  const run = await running(cli, ["mcp", "auth"], { atTerminal: false });

  assert.equal(run.code, EXIT_FAILURE);
  assert.match(run.problems, new RegExp(GITHUB));
  assert.match(run.problems, new RegExp(LINEAR));
  assert.match(run.problems, /at a terminal/);
  assert.equal(credentialsRepository.secretByAddress.size, 0);
});

test("cw mcp auth --status lists each address, its ids and whether signed in, and changes nothing (CORE Story 18 scenario 6)", async () => {
  const { cli, credentialsRepository } = mcpOriginsOver();
  await credentialsRepository.secretByAddress.set(
    LINEAR,
    JSON.stringify({ address: LINEAR, method: "token", accessToken: "lin-secret" }),
  );

  const run = await running(cli, ["mcp", "auth", "--status"], { atTerminal: true });

  assert.equal(run.code, EXIT_OK);
  assert.equal(
    run.results,
    [
      GITHUB,
      "  github/billing, github/web",
      "  ⚠ not signed in",
      LINEAR,
      "  linear",
      "  ✔ signed in by token",
      "",
    ].join("\n"),
  );
  assert.doesNotMatch(run.results, /lin-secret/);
  assert.equal(credentialsRepository.secretByAddress.size, 1);
});

test("cw mcp auth <id> signs in again at that id's address alone, whatever was kept (CORE Story 18 scenario 7)", async () => {
  const { cli, credentialsRepository } = mcpOriginsOver();
  await credentialsRepository.secretByAddress.set(
    GITHUB,
    JSON.stringify({ address: GITHUB, method: "token", accessToken: "old" }),
  );

  const run = await running(cli, ["mcp", "auth", "github/web"], { atTerminal: true, answers: ["token", "new"] });

  assert.equal(run.code, EXIT_OK, run.problems);
  assert.equal(JSON.parse(credentialsRepository.secretByAddress.get(GITHUB) ?? "").accessToken, "new");
  assert.equal(credentialsRepository.secretByAddress.has(LINEAR), false);

  const unknown = await running(cli, ["mcp", "auth", "nowhere"], { atTerminal: true });
  assert.equal(unknown.code, EXIT_FAILURE);
  assert.match(unknown.problems, /nowhere/);
});

test("an mcp origin at plain http on another machine is signed in to by no way, and keeps nothing: the charter does not hold it (FR-149)", async () => {
  const CLEARTEXT = "http://mcp.example/mcp";
  const { charterAuthoringApp, credentialsRepository } = mcpOriginsOver([
    new McpOrigin({
      ids: ["cleartext"],
      names: { cleartext: "cleartext_0000" },
      address: CLEARTEXT,
      endpoint: CLEARTEXT,
      auth: [McpAuthMethod.OAUTH, McpAuthMethod.TOKEN],
    }),
  ]);

  assert.match(
    faultTextOf(await charterAuthoringApp.signInWithToken(CLEARTEXT, "t")),
    /No mcp in the charter is at http:\/\/mcp\.example\/mcp/,
  );
  assert.match(
    faultTextOf(await charterAuthoringApp.signInWithOAuth(CLEARTEXT, () => undefined)),
    /No mcp in the charter/,
  );
  assert.equal(credentialsRepository.secretByAddress.size, 0);
});
