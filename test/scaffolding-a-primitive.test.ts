import assert from "node:assert/strict";
import { test } from "node:test";
import prompts from "prompts";
import { Primitives } from "../src/module/charter/domain/models/primitive/primitive.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { Commander } from "../src/presentation/cli/cli.commander.js";
import { EXIT_FAILURE } from "../src/presentation/cli/commands/command.interface.js";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { authoringCharterOf, buildingCharterOf, commandLineOf, readPrimitive } from "./use-cases-of.js";

const repo = "/repo";
const repoPath = new URL("file:///repo/");

/** The command line as a user meets it, over a repository held in memory: the
 *  real `cw add`, the real service behind it, and the answers whoever is at the
 *  terminal would have typed. */
const adding = async (
  argv: readonly string[],
  answers: readonly unknown[] | undefined = undefined,
  files: Readonly<Record<string, string>> = {},
) => {
  const held = new InMemoryFileReaders(files);
  const charterAuthoringApp = authoringCharterOf(held, new InMemoryFileOutput(held), new InMemoryReporter());
  const charterRuntimeApps = buildingCharterOf(
    held,
    new InMemoryFileOutput(held),
    new InMemoryTokenCounter(),
    { claude: new InMemoryAgentCli() },
    new InMemoryReporter(),
  );
  const results: string[] = [];
  const problems: string[] = [];
  const kept = { out: process.stdout.write, err: process.stderr.write, tty: process.stdin.isTTY };
  process.stdout.write = ((text: string) => (results.push(text), true)) as typeof kept.out;
  process.stderr.write = ((text: string) => (problems.push(text), true)) as typeof kept.err;
  // Somebody at the terminal, and what they typed: `prompts` answers from what
  // is injected rather than from a keyboard, so the real questions are asked.
  process.stdin.isTTY = answers !== undefined;
  if (answers !== undefined) prompts.inject(answers);
  try {
    const code = await new Commander(
      commandLineOf(
        held,
        new InMemoryFileOutput(held),
        { charterAuthoringApp, charterRuntimeApp: charterRuntimeApps },
        repo,
      ),
      COMMANDS,
    ).runCommandLine(argv);
    return { code, held, results: results.join(""), problems: problems.join("") };
  } finally {
    process.stdout.write = kept.out;
    process.stderr.write = kept.err;
    process.stdin.isTTY = kept.tty;
  }
};

/** What one file of the repository holds, or nothing where it was never
 *  written. */
const held = (files: InMemoryFileReaders, path: string) => files.readIfThere(new URL(path, repoPath));

/** One answer per header the kind requires, in the order it is asked. */
const answering = (kind: (typeof Primitives.kinds)[number]) =>
  Primitives.headersOf(kind)
    .filter(({ isRequired }) => isRequired)
    .map(({ field, shape }) => (shape === "line" ? valued(field) : [valued(field)]));

/** The same answers, typed as one flag per header: what an author with no
 *  terminal to answer at gives instead. */
const flagging = (kind: (typeof Primitives.kinds)[number]) =>
  Primitives.headersOf(kind)
    .filter(({ isRequired }) => isRequired)
    .flatMap(({ field }) => ["--header", `${field}=${valued(field)}`]);

/** A value the kind will accept wherever the field is one it checks the worth
 *  of, and a plain word everywhere else. */
const valued = (field: string) =>
  field === "signal"
    ? "SessionStart"
    : field === "extension"
      ? "sh"
      : field === "executionPath"
        ? "./something/run.sh"
        : `what ${field} holds`;

test("a kind is asked what it requires, and nothing else (FR-004, FR-039, CORE Story 4 scenario 1)", () => {
  for (const primitiveClass of Primitives.classes)
    assert.deepEqual(
      Primitives.headersOf(primitiveClass.kind)
        .filter(({ isRequired }) => isRequired)
        .map(({ field }) => field),
      ["description", ...Object.keys(primitiveClass.requires)],
    );
});

test("what a kind says a header holds is what its schema reads it as (FR-004)", () => {
  for (const primitiveClass of Primitives.classes)
    for (const [field, shape] of Object.entries({ description: "line", ...primitiveClass.requires }))
      assert.equal(Primitives.headersOf(primitiveClass.kind).find((taken) => taken.field === field)?.shape, shape);
});

/** Every kind a terminal can answer whole. An mcp needs `endpoint` or
 *  `command` beside what it requires, which of the two being its author's
 *  choice, so it is written from flags alone (plan §19.1). */
const answerableKinds = Primitives.kinds.filter((kind) => kind !== "mcp");

test("what is answered is what the file holds, read back as the same primitive (FR-039, CORE Story 4 scenario 1)", async () => {
  for (const kind of answerableKinds) {
    const { code, held: files } = await adding(["add", kind, "something"], answering(kind));
    const keptText = (await held(files, `.cw/charter/primitive/${kind}/something/index.md`)) ?? "";

    assert.equal(code, 0);
    const keptPrimitive = readPrimitive(keptText);
    assert.equal(keptPrimitive.kind, kind);
    assert.equal(keptPrimitive.headers.id, "something");
    assert.equal(keptPrimitive.headers.description, "what description holds");
  }
});

test("an id holding / is written as one file in its kind's folder, each / as - (FR-141, CORE Story 23 scenario 1)", async () => {
  const { code, held: files } = await adding(["add", "guide", "mfbs/no-any"], ["what description holds"]);
  const keptPrimitive = readPrimitive((await held(files, ".cw/charter/primitive/guide/mfbs/no-any/index.md")) ?? "");

  assert.equal(code, 0);
  assert.equal(keptPrimitive.headers.id, "mfbs/no-any");
});

test("a successful add compiles nothing: its file alone is written, for its author to write the body into and build (CORE Story 10 scenario 7, FR-074, FR-079, CORE Story 55 scenario 8, CORE Story 10 scenario 1)", async () => {
  const settingsText = `${JSON.stringify({ agents: ["claude"] })}\n`;
  const {
    code,
    held: files,
    results,
  } = await adding(["add", "guide", "no-any"], ["what description holds"], {
    "file:///repo/.cw/settings.json": settingsText,
  });

  assert.equal(code, 0);
  assert.deepEqual((await files.readFilesRecursively(repoPath)).map(({ fileUrl }) => fileUrl.href).sort(), [
    "file:///repo/.cw/charter/primitive/guide/no-any/index.md",
    "file:///repo/.cw/settings.json",
  ]);
  assert.match(results, /Write what it has to say in the body, then run "cw build"\./);
});

test("cw add mcp mfbs/billing, its address, ways to sign in and tools given, writes its file, and mfbs/billing is an id of the charter (CORE Story 17 scenario 1, FR-142, FR-064, CORE Story 55 scenario 8)", async () => {
  const { code, held: files } = await adding([
    "add",
    "mcp",
    "mfbs/billing",
    "--header",
    "description=Billing's code.",
    "--header",
    "endpoint=https://api.githubcopilot.com/mcp/",
    "--header",
    "auth=oauth",
    "--header",
    "auth=token",
    "--header",
    "tools=search_code",
  ]);

  assert.equal(code, 0);
  const mcpPrimitive = readPrimitive((await held(files, ".cw/charter/primitive/mcp/mfbs/billing/index.md")) ?? "");
  assert.equal(mcpPrimitive.kind, "mcp");
  assert.equal(mcpPrimitive.headers.id, "mfbs/billing");
  const charterAuthoringApp = authoringCharterOf(files, new InMemoryFileOutput(files), new InMemoryReporter());
  const explanationDTO = await charterAuthoringApp.explainPrimitive("mfbs/billing");
  assert.ok(explanationDTO.type === "ExplanationOutcome", JSON.stringify(explanationDTO));
  const { data: explainedPrimitive } = explanationDTO.data.primitive;
  assert.equal(explainedPrimitive.kind, "mcp");
  assert.equal(explainedPrimitive.id, "mfbs/billing");
  assert.equal(explainedPrimitive.layerName, "repo");
});

test("an id with an empty segment is refused with the kind's sample, and nothing is written (FR-141)", async () => {
  for (const id of ["a//b", "/a", "a/"]) {
    const { code, problems, held: files } = await adding(["add", "guide", id], ["what description holds"]);

    assert.equal(code, EXIT_FAILURE, id);
    assert.match(problems, /not what a guide holds/, id);
    assert.equal(await held(files, `.cw/charter/primitive/guide/${id}/index.md`), undefined, id);
  }
});

test("a word that is no kind is refused, naming every kind there is (FR-001, FR-039, CORE Story 4 scenario 2)", async () => {
  const { code, problems } = await adding(["add", "rule", "no-any"], []);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problems, /"rule" is not a kind/);
  for (const kind of Primitives.kinds) assert.match(problems, new RegExp(kind));
});

test("an answer its kind refuses is said before any file is written (FR-004, FR-039)", async () => {
  const {
    code,
    problems,
    held: files,
  } = await adding(["add", "sensor", "on-stop"], ["what description holds", "NotAnEvent", "pnpm test"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problems, /not what a sensor holds/);
  assert.match(problems, /signal: Stop/);
  assert.equal(await held(files, ".cw/charter/primitive/sensor/on-stop/index.md"), undefined);
});

test("a list answer holds the names typed, each trimmed and a blank one dropped (FR-039)", async () => {
  const { code, held: files } = await adding(
    ["add", "skill", "refactoring"],
    ["what description holds", [" refactor ", "", "  "]],
  );
  const keptPrimitive = readPrimitive((await held(files, ".cw/charter/primitive/skill/refactoring/index.md")) ?? "");

  assert.equal(code, 0);
  assert.deepEqual("triggers" in keptPrimitive.headers ? keptPrimitive.headers.triggers : undefined, ["refactor"]);
});

test("a list answer left empty is refused once, as the list it should hold (FR-004, FR-039)", async () => {
  const {
    code,
    problems,
    held: files,
  } = await adding(["add", "skill", "refactoring"], ["what description holds", [""]]);

  assert.equal(code, EXIT_FAILURE);
  assert.equal(problems.match(/not what a skill holds/g)?.length, 1);
  assert.equal(await held(files, ".cw/charter/primitive/skill/refactoring/index.md"), undefined);
});

test("nobody at the terminal is told what the kind requires, and nothing is written (FR-039)", async () => {
  const { code, problems, held: files } = await adding(["add", "skill", "refactoring"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problems, /"description".*"triggers"/);
  assert.equal(await held(files, ".cw/charter/primitive/skill/refactoring/index.md"), undefined);
});

test("a file that is already there is never written over (FR-039, CORE Story 4 scenario 3)", async () => {
  const authoredText = readPrimitive({
    headers: { kind: "guide", id: "no-any", description: "Authored.", globs: ["src/**/*.ts"] },
    body: "BODY",
  }).writeMarkdown();
  const {
    code,
    problems,
    held: files,
  } = await adding(["add", "guide", "no-any"], answering("guide"), {
    "file:///repo/.cw/charter/primitive/guide/no-any/index.md": authoredText,
  });

  assert.equal(code, EXIT_FAILURE);
  assert.match(problems, /already there/);
  assert.equal(await held(files, ".cw/charter/primitive/guide/no-any/index.md"), authoredText);
});

test("what is typed as flags is the file that is written from answers, word for word (FR-014, SC-005, CORE Story 10 scenario 1)", async () => {
  for (const kind of answerableKinds) {
    const typed = await adding(["add", kind, "something", ...flagging(kind)]);
    const answered = await adding(["add", kind, "something"], answering(kind));

    assert.equal(typed.code, 0);
    assert.equal(
      await held(typed.held, `.cw/charter/primitive/${kind}/something/index.md`),
      await held(answered.held, `.cw/charter/primitive/${kind}/something/index.md`),
    );
  }
});

test("a header typed as a flag is an answer, so nothing is asked at a terminal either (FR-009, CORE Story 10 scenario 6)", async () => {
  // Somebody is at the terminal and has typed nothing to be asked with: a
  // question would be answered with nothing and refuse the run, so a run that
  // writes the file is a run that asked none.
  const { code, held: files } = await adding(["add", "skill", "refactoring", ...flagging("skill")], []);

  assert.equal(code, 0);
  assert.match((await held(files, ".cw/charter/primitive/skill/refactoring/index.md")) ?? "", /triggers:/);
});

test("a list header typed twice holds both, in the order they were typed (FR-007, CORE Story 10 scenario 2)", async () => {
  const { code, held: files } = await adding([
    "add",
    "skill",
    "refactoring",
    "--header",
    "description=what description holds",
    "--header",
    "triggers=extract",
    "--header",
    "triggers=inline",
  ]);
  const keptPrimitive = readPrimitive((await held(files, ".cw/charter/primitive/skill/refactoring/index.md")) ?? "");

  assert.equal(code, 0);
  assert.deepEqual("triggers" in keptPrimitive.headers ? keptPrimitive.headers.triggers : undefined, [
    "extract",
    "inline",
  ]);
});

test("a header holding one line is refused where it was typed twice, naming it (FR-007)", async () => {
  const {
    code,
    problems,
    held: files,
  } = await adding(["add", "guide", "no-any", "--header", "description=one", "--header", "description=another"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problems, /"description" holds one line, and was typed 2 times/);
  assert.equal(await held(files, ".cw/charter/primitive/guide/no-any/index.md"), undefined);
});

test("a flag naming nothing to put a value under is refused, quoting it (FR-008, CORE Story 10 scenario 8)", async () => {
  const { code, problems, held: files } = await adding(["add", "guide", "no-any", "--header", "description"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problems, /"--header description" names nothing to put a value under/);
  assert.equal(await held(files, ".cw/charter/primitive/guide/no-any/index.md"), undefined);
});

test("a value holding an = is kept whole, everything after the first one (FR-008, CORE Story 10 scenario 8)", async () => {
  const { code, held: files } = await adding([
    "add",
    "guide",
    "no-any",
    "--header",
    "description=Reject a = where an == was meant.",
  ]);
  const keptPrimitive = readPrimitive((await held(files, ".cw/charter/primitive/guide/no-any/index.md")) ?? "");

  assert.equal(code, 0);
  assert.equal(keptPrimitive.headers.description, "Reject a = where an == was meant.");
});

test("a header the kind does not take is named, and nothing is written (FR-011, CORE Story 10 scenario 4)", async () => {
  const {
    code,
    problems,
    held: files,
  } = await adding([
    "add",
    "guide",
    "no-any",
    "--header",
    "description=what description holds",
    "--header",
    "signal=SessionStart",
  ]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problems, /A guide holds no "signal"/);
  assert.equal(await held(files, ".cw/charter/primitive/guide/no-any/index.md"), undefined);
});

test("a header the kind requires and nobody answered is refused in the same words either way, and in the words reading the charter refuses it with, naming what it takes (FR-010, FR-012, SC-004, CORE Story 10 scenario 3, FR-071, FR-073, CORE Story 55 scenario 8)", async () => {
  const typed = await adding(["add", "skill", "refactoring", "--header", "triggers=refactor"]);
  const answered = await adding(["add", "skill", "refactoring"], ["", ["refactor"]]);

  assert.equal(typed.code, EXIT_FAILURE);
  assert.equal(answered.code, EXIT_FAILURE);
  assert.equal(typed.problems, answered.problems);
  assert.match(typed.problems, /not what a skill holds/);
  assert.equal(await held(typed.held, ".cw/charter/primitive/skill/refactoring/index.md"), undefined);
  assert.deepEqual(await typed.held.readFilesRecursively(repoPath), [], "nothing is written");
  // The same file missing the same header, as reading the charter refuses it.
  const readFaults = (() => {
    try {
      readPrimitive('---\nkind: skill\nid: refactoring\ntriggers: ["refactor"]\n---\n');
    } catch (readFault) {
      return (readFault as { faults: readonly { message: string; fix: string }[] }).faults;
    }
    return assert.fail("the file missing its description was read");
  })();
  assert.ok(readFaults.length > 0);
  for (const { message, fix } of readFaults) {
    assert.ok(typed.problems.includes(message), message);
    assert.ok(typed.problems.includes(fix.split("\n")[0] ?? fix), fix);
    // What the missing header takes, shown in the kind's sample.
    assert.match(fix, /\ndescription: \S/);
  }
});

test("adding a script says the file it runs was written too, so its author knows where to write it (FR-167, CORE Story 24 scenario 2)", async () => {
  const { code, results } = await adding([
    "add",
    "script",
    "release/check",
    "--header",
    "description=Check the changelog.",
    "--header",
    "executionPath=./run.sh",
  ]);

  assert.equal(code, 0);
  assert.deepEqual(results.split("\n").slice(0, 2), [
    "Wrote .cw/charter/primitive/script/release/check/index.md.",
    "Wrote ./run.sh beside it, the file it runs: write the script there.",
  ]);
});
