import assert from "node:assert/strict";
import { test } from "node:test";
import { Primitives } from "../src/module/charter/domain/models/primitive/primitive.js";
import { SensorPrimitive } from "../src/module/charter/domain/models/primitive/sensor-primitive.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { Commander } from "../src/presentation/cli/cli.commander.js";
import { EXIT_FAILURE, EXIT_OK } from "../src/presentation/cli/commands/command.interface.js";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { authoringCharterOf, buildingCharterOf, commandLineOf, readPrimitive } from "./use-cases-of.js";

const repo = "/repo";
const repoPath = new URL("file:///repo/");

/** The command line as an author meets it, over a repository held in memory:
 *  the real command, the real service behind it, and what the terminal read. */
const asking = async (argv: readonly string[]) => {
  const held = new InMemoryFileReaders({});
  const charterAuthoringApp = authoringCharterOf(held, new InMemoryFileOutput(held), new InMemoryReporter());
  const charterRuntimeApp = buildingCharterOf(
    held,
    new InMemoryFileOutput(held),
    new InMemoryTokenCounter(),
    { claude: new InMemoryAgentCli() },
    new InMemoryReporter(),
  );
  const results: string[] = [];
  const problems: string[] = [];
  const kept = { out: process.stdout.write, err: process.stderr.write };
  process.stdout.write = ((text: string) => (results.push(text), true)) as typeof kept.out;
  process.stderr.write = ((text: string) => (problems.push(text), true)) as typeof kept.err;
  try {
    const code = await new Commander(
      commandLineOf(held, new InMemoryFileOutput(held), { charterAuthoringApp, charterRuntimeApp }, repo),
      COMMANDS,
    ).run(argv);
    return { code, held, results: results.join(""), problems: problems.join("") };
  } finally {
    process.stdout.write = kept.out;
    process.stderr.write = kept.err;
  }
};

/** Every header `cw kinds <kind>` named, read back off the answer the way an
 *  author reads it: one indented line per header, its name and its shape, and
 *  the values it may hold where the set is closed. */
const headersNamedIn = (answer: string) =>
  answer.split("\n").flatMap((line) => {
    const named = /^ {2}(\S+)\s+(line|list)(?:, one of .+)?$/.exec(line);
    return named === null ? [] : [{ field: named[1]!, shape: named[2]! }];
  });

/** The frontmatter block of the sample the answer showed, as an author would
 *  copy it into a file. */
const sampleShownIn = (answer: string) => answer.slice(answer.indexOf("kind: ")).trim();

test("the set is exactly the kinds the charter format defines", () => {
  assert.deepEqual([...Primitives.kinds].sort(), [
    "agent",
    "corpus",
    "guide",
    "mcp",
    "mixin",
    "playbook",
    "posture",
    "script",
    "sensor",
    "skill",
    "template",
  ]);
});

test("a command is refused as a kind the charter does not have: a skill is what is asked for by name (FR-001)", () => {
  assert.throws(
    () =>
      readPrimitive(
        ["---", "kind: command", "id: release", "description: Cut a release.", "---", "", "Cut it."].join("\n"),
      ),
    (raised: AggregateError) => /"command" is not a kind the charter knows/.test(String(raised.errors[0]?.message)),
  );
});

test("Primitives.isKind accepts only the closed set", () => {
  for (const kind of Primitives.kinds) assert.ok(Primitives.isKind(kind));
  for (const other of ["concern", "guides", "", "Guide", 7, null, undefined]) {
    assert.equal(Primitives.isKind(other), false, String(other));
  }
});

test("cw kinds <kind> names what that kind's contract requires, and no more (FR-001, FR-004)", async () => {
  for (const kind of Primitives.kinds) {
    const { code, results } = await asking(["kinds", kind]);

    assert.equal(code, EXIT_OK, kind);
    assert.deepEqual(
      headersNamedIn(results),
      Primitives.headersOf(kind)
        .filter(({ required }) => required)
        .map(({ field, shape }) => ({ field, shape })),
      kind,
    );
  }
});

test("a header read from a closed set carries its values, and no other header does (FR-118)", async () => {
  for (const kind of Primitives.kinds)
    for (const { field, allowedValues } of Primitives.headersOf(kind))
      assert.deepEqual(
        allowedValues,
        kind === "sensor" && field === "signal"
          ? SensorPrimitive.signals
          : kind === "mixin" && field === "position"
            ? ["start", "end"]
            : field === "disable-user-invocation" || field === "disable-model-invocation"
              ? ["true", "false"]
              : undefined,
        `${kind} ${field}`,
      );

  const { results } = await asking(["kinds", "sensor"]);
  assert.match(results, new RegExp(`signal\\s+line, one of ${SensorPrimitive.signals.join(", ")}\n`));
});

test("the sample it shows is a primitive of that kind, as an author writes one (FR-001)", async () => {
  for (const kind of Primitives.kinds) {
    const { results } = await asking(["kinds", kind]);
    const samplePrimitive = readPrimitive(["---", sampleShownIn(results), "---", "", "What it has to say."].join("\n"));

    assert.equal(samplePrimitive.kind, kind);
  }
});

test("an agent is shown holding an mcp origin under its tools, in the charter's own words (FR-156)", async () => {
  const { results: kindLines } = await asking(["kinds"]);
  const { results: agentKind } = await asking(["kinds", "agent"]);

  assert.match(kindLines, /agent .*`\[\[<id>\]\]`.*`\[\[<id>\]\]:<tool>`/);
  assert.match(sampleShownIn(agentKind), /tools: .*"\[\[mfbs\/billing\]\]:search_code"/);
});

test("the headers it names are the ones cw add takes, one flag apiece (FR-004, spec Story 2 scenario 4)", async () => {
  for (const kind of Primitives.kinds) {
    const { results } = await asking(["kinds", kind]);
    const flags = headersNamedIn(results).flatMap(({ field }) => [
      "--header",
      `${field}=${field === "signal" ? "SessionStart" : field === "extension" ? "sh" : field === "executionPath" ? "./something/run.sh" : `what ${field} holds`}`,
    ]);
    // An mcp is told which server it is beside what it requires: which shape
    // it takes is its author's choice, so neither is required (plan §19.1).
    const shapeFlags =
      kind === "mcp" ? ["--header", "endpoint=https://mcp.example.com/", "--header", "auth=oauth"] : [];
    const { code, held: files, problems } = await asking(["add", kind, "something", ...flags, ...shapeFlags]);

    assert.equal(code, EXIT_OK, `${kind}: ${problems}`);
    assert.notEqual(
      await files.readIfThere(new URL(`.cw/charter/primitive/${kind}/something/index.md`, repoPath)),
      undefined,
      kind,
    );
  }
});

test("cw kinds with no kind answers as it does today: one line per kind (FR-002)", async () => {
  const { code, results } = await asking(["kinds"]);

  assert.equal(code, EXIT_OK);
  assert.deepEqual(
    results
      .trim()
      .split("\n")
      .map((line) => line.split("  ")[0]),
    [...Primitives.kinds],
  );
});

test("a word that is no kind is answered with every kind there is (FR-003)", async () => {
  const { code, problems } = await asking(["kinds", "rule"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problems, /"rule" is not a kind/);
  for (const kind of Primitives.kinds) assert.match(problems, new RegExp(kind));
});

/** One mcp file with these headers beside its id, description and tools, read
 *  the way a file of the charter is. */
const mcpOf = (...headers: readonly string[]) =>
  readPrimitive(
    [
      "---",
      "kind: mcp",
      "id: mfbs/billing",
      "description: Billing.",
      "tools: [search_code]",
      ...headers,
      "---",
      "",
    ].join("\n"),
  );

/** The one fault a refused file raised: what is wrong, and the sample it is
 *  fixed with. */
const refusalOf = (read: () => unknown) => {
  try {
    read();
  } catch (raised) {
    assert.ok(raised instanceof AggregateError);
    const [fault] = raised.errors as Error[];
    return { message: fault!.message, fix: (fault as Error & { fix: string }).fix };
  }
  return assert.fail("the file was read");
};

test("an mcp is read in either shape the data model writes (FR-142)", () => {
  assert.equal(
    mcpOf("endpoint: https://api.githubcopilot.com/mcp/", "auth: [oauth, token]", "path: moneyforward/billing").kind,
    "mcp",
  );
  assert.equal(
    mcpOf(
      "command: npx",
      'args: ["-y", "@modelcontextprotocol/server-github"]',
      "tokenEnv: GITHUB_TOKEN",
      "auth: [token]",
    ).kind,
    "mcp",
  );
  assert.equal(mcpOf("command: ./local-server").kind, "mcp");
  assert.equal(mcpOf("endpoint: http://127.0.0.1:8080/mcp", "auth: [token]").kind, "mcp");
});

test("an mcp declaring both shapes, or neither, is refused with the sample of the one it was nearer (FR-142)", () => {
  const bothShapesRefusal = refusalOf(() =>
    mcpOf("endpoint: https://mcp.example.com/", "command: npx", "auth: [token]"),
  );
  assert.match(bothShapesRefusal.message, /both "endpoint" and "command"/);
  assert.match(bothShapesRefusal.fix, /command: npx/);

  const noShapeRefusal = refusalOf(() => mcpOf());
  assert.match(noShapeRefusal.message, /neither "endpoint" nor "command"/);
  assert.match(noShapeRefusal.fix, /endpoint: https:\/\/api\.githubcopilot\.com\/mcp\//);
});

test("a command taking a token without naming where it reads it is refused with the command's sample (FR-142)", () => {
  const tokenEnvRefusal = refusalOf(() => mcpOf("command: npx", "auth: [token]"));

  assert.match(tokenEnvRefusal.message, /"tokenEnv"/);
  assert.match(tokenEnvRefusal.fix, /tokenEnv: GITHUB_PERSONAL_ACCESS_TOKEN/);
});

test("an mcp is refused a way of signing in its shape does not take (FR-142)", () => {
  assert.match(refusalOf(() => mcpOf("command: npx", "auth: [oauth]", "tokenEnv: TOKEN")).message, /by token alone/);
  assert.match(refusalOf(() => mcpOf("endpoint: https://mcp.example.com/")).message, /"auth"/);
  assert.match(
    refusalOf(() => mcpOf("endpoint: https://mcp.example.com/", "auth: [password]")).message,
    /not what a mcp holds/,
  );
});

test("an id longer than 40 characters is refused, so a host's names for it stay within what it takes (FR-157)", () => {
  const guideWithId = (id: string) =>
    readPrimitive(["---", "kind: guide", `id: ${id}`, "description: About it.", "---", ""].join("\n"));

  assert.equal(guideWithId(`team/${"a".repeat(35)}`).kind, "guide");
  assert.match(refusalOf(() => guideWithId(`team/${"a".repeat(36)}`)).message, /"id" is at most 40 characters/);
});

test("an endpoint in the clear is refused unless it is this machine (FR-142)", () => {
  assert.match(refusalOf(() => mcpOf("endpoint: http://mcp.example.com/", "auth: [oauth]")).message, /https:\/\/ URL/);
  // What is reached is the host the URL names, not the text it opens with.
  assert.match(
    refusalOf(() => mcpOf('endpoint: "http://localhost:1@mcp.example.com/"', "auth: [oauth]")).message,
    /https:\/\/ URL/,
  );
  assert.match(refusalOf(() => mcpOf("endpoint: not a url", "auth: [oauth]")).message, /https:\/\/ URL/);
});
