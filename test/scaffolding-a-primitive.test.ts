import { test } from "node:test";
import assert from "node:assert/strict";
import prompts from "prompts";
import { Commander } from "../src/driver/cli/Commander.js";
import { COMMANDS } from "../src/driver/cli/commands/index.js";
import { EXIT_FAILURE } from "../src/driver/cli/commands/Command.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import {
  primitiveOf,
  primitiveHeadersOf,
  KINDS,
  PRIMITIVE_CLASSES,
} from "../src/hexagon/domain/models/charter/primitive/Primitive.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";

const repo = "/repo";
const repoPath = new URL("file:///repo/");

/** What vendoring is driven through: a context always carries every use case,
 *  and nothing here asks this one for anything. */
const charterVendoringApp = new CharterVendoring(repoPath, new InMemoryVCS());

/** The command line as a user meets it, over a repository held in memory: the
 *  real `cw add`, the real service behind it, and the answers whoever is at the
 *  terminal would have typed. */
const adding = async (
  argv: readonly string[],
  answers: readonly unknown[] | undefined = undefined,
  files: Readonly<Record<string, string>> = {},
) => {
  const held = new InMemoryFileReaders(files);
  const charterAuthoringApp = new CharterAuthoring(repoPath, held, new YamlParser(), new InMemoryFileOutput(held), new InMemoryVCS());
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
    const code = await new Commander({ cwd: repo, charterAuthoringApp, charterVendoringApp }, COMMANDS).run(argv);
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
const answering = (kind: (typeof KINDS)[number]) =>
  primitiveHeadersOf(kind)
    .filter(({ required }) => required)
    .map(({ field, shape }) => (shape === "line" ? valued(field) : [valued(field)]));

/** The same answers, typed as one flag per header: what an author with no
 *  terminal to answer at gives instead. */
const flagging = (kind: (typeof KINDS)[number]) =>
  primitiveHeadersOf(kind)
    .filter(({ required }) => required)
    .flatMap(({ field }) => ["--header", `${field}=${valued(field)}`]);

/** A value the kind will accept wherever the field is one it checks the worth
 *  of, and a plain word everywhere else. */
const valued = (field: string) => (field === "signal" ? "SessionStart" : `what ${field} holds`);

test("a kind is asked what it requires, and nothing else (FR-004, FR-039)", () => {
  for (const one of PRIMITIVE_CLASSES)
    assert.deepEqual(
      primitiveHeadersOf(one.kind)
        .filter(({ required }) => required)
        .map(({ field }) => field),
      ["description", ...Object.keys(one.requires)],
    );
});

test("what a kind says a header holds is what its schema reads it as (FR-004)", () => {
  for (const one of PRIMITIVE_CLASSES)
    for (const [field, shape] of Object.entries({ description: "line", ...one.requires }))
      assert.equal(primitiveHeadersOf(one.kind).find((taken) => taken.field === field)?.shape, shape);
});

test("what is answered is what the file holds, read back as the same primitive (FR-039)", async () => {
  for (const kind of KINDS) {
    const { code, held: files } = await adding(["add", kind, "something"], answering(kind));
    const written = (await held(files, `.cw/charter/${kind}/something.md`)) ?? "";

    assert.equal(code, 0);
    const read = primitiveOf(written, new YamlParser());
    assert.equal(read.kind, kind);
    assert.equal(read.headers.id, "something");
    assert.equal(read.headers.description, "what description holds");
  }
});

test("a word that is no kind is refused, naming every kind there is (FR-001, FR-039)", async () => {
  const { code, problems } = await adding(["add", "rule", "no-any"], []);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problems, /"rule" is not a kind/);
  for (const kind of KINDS) assert.match(problems, new RegExp(kind));
});

test("an answer its kind refuses is said before any file is written (FR-004, FR-039)", async () => {
  const { code, problems, held: files } = await adding(["add", "sensor", "on-stop"], [
    "what description holds",
    "NotAnEvent",
    "pnpm test",
  ]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problems, /not what a sensor holds/);
  assert.match(problems, /signal: Stop/);
  assert.equal(await held(files, ".cw/charter/sensor/on-stop.md"), undefined);
});

test("a list answer holds the names typed, each trimmed and a blank one dropped (FR-039)", async () => {
  const { code, held: files } = await adding(["add", "skill", "refactoring"], [
    "what description holds",
    [" refactor ", "", "  "],
  ]);
  const read = primitiveOf((await held(files, ".cw/charter/skill/refactoring.md")) ?? "", new YamlParser());

  assert.equal(code, 0);
  assert.deepEqual("triggers" in read.headers ? read.headers.triggers : undefined, ["refactor"]);
});

test("a list answer left empty is refused once, as the list it should hold (FR-004, FR-039)", async () => {
  const { code, problems, held: files } = await adding(["add", "skill", "refactoring"], ["what description holds", [""]]);

  assert.equal(code, EXIT_FAILURE);
  assert.equal(problems.match(/not what a skill holds/g)?.length, 1);
  assert.equal(await held(files, ".cw/charter/skill/refactoring.md"), undefined);
});

test("nobody at the terminal is told what the kind requires, and nothing is written (FR-039)", async () => {
  const { code, problems, held: files } = await adding(["add", "skill", "refactoring"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problems, /"description".*"triggers"/);
  assert.equal(await held(files, ".cw/charter/skill/refactoring.md"), undefined);
});

test("a file that is already there is never written over (FR-039)", async () => {
  const authored = primitiveOf({
    headers: { kind: "guide", id: "no-any", description: "Authored.", globs: ["src/**/*.ts"] },
    body: "BODY",
  }).toMarkdown();
  const { code, problems, held: files } = await adding(["add", "guide", "no-any"], answering("guide"), {
    "file:///repo/.cw/charter/guide/no-any.md": authored,
  });

  assert.equal(code, EXIT_FAILURE);
  assert.match(problems, /already there/);
  assert.equal(await held(files, ".cw/charter/guide/no-any.md"), authored);
});

test("what is typed as flags is the file that is written from answers, word for word (FR-014, SC-005)", async () => {
  for (const kind of KINDS) {
    const typed = await adding(["add", kind, "something", ...flagging(kind)]);
    const answered = await adding(["add", kind, "something"], answering(kind));

    assert.equal(typed.code, 0);
    assert.equal(await held(typed.held, `.cw/charter/${kind}/something.md`), await held(answered.held, `.cw/charter/${kind}/something.md`));
  }
});

test("a header typed as a flag is an answer, so nothing is asked at a terminal either (FR-009)", async () => {
  // Somebody is at the terminal and has typed nothing to be asked with: a
  // question would be answered with nothing and refuse the run, so a run that
  // writes the file is a run that asked none.
  const { code, held: files } = await adding(["add", "skill", "refactoring", ...flagging("skill")], []);

  assert.equal(code, 0);
  assert.match((await held(files, ".cw/charter/skill/refactoring.md")) ?? "", /triggers:/);
});

test("a list header typed twice holds both, in the order they were typed (FR-007)", async () => {
  const { code, held: files } = await adding([
    "add", "skill", "refactoring",
    "--header", "description=what description holds",
    "--header", "triggers=extract",
    "--header", "triggers=inline",
  ]);
  const read = primitiveOf((await held(files, ".cw/charter/skill/refactoring.md")) ?? "", new YamlParser());

  assert.equal(code, 0);
  assert.deepEqual("triggers" in read.headers ? read.headers.triggers : undefined, ["extract", "inline"]);
});

test("a header holding one line is refused where it was typed twice, naming it (FR-007)", async () => {
  const { code, problems, held: files } = await adding([
    "add", "guide", "no-any",
    "--header", "description=one",
    "--header", "description=another",
  ]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problems, /"description" holds one line, and was typed 2 times/);
  assert.equal(await held(files, ".cw/charter/guide/no-any.md"), undefined);
});

test("a flag naming nothing to put a value under is refused, quoting it (FR-008)", async () => {
  const { code, problems, held: files } = await adding(["add", "guide", "no-any", "--header", "description"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problems, /"--header description" names nothing to put a value under/);
  assert.equal(await held(files, ".cw/charter/guide/no-any.md"), undefined);
});

test("a value holding an = is kept whole, everything after the first one (FR-008)", async () => {
  const { code, held: files } = await adding([
    "add", "guide", "no-any",
    "--header", "description=Reject a = where an == was meant.",
  ]);
  const read = primitiveOf((await held(files, ".cw/charter/guide/no-any.md")) ?? "", new YamlParser());

  assert.equal(code, 0);
  assert.equal(read.headers.description, "Reject a = where an == was meant.");
});

test("a header the kind does not take is named, and nothing is written (FR-011)", async () => {
  const { code, problems, held: files } = await adding([
    "add", "guide", "no-any",
    "--header", "description=what description holds",
    "--header", "signal=SessionStart",
  ]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problems, /A guide holds no "signal"/);
  assert.equal(await held(files, ".cw/charter/guide/no-any.md"), undefined);
});

test("a header the kind requires and nobody answered is refused in the same words either way (FR-010, FR-012, SC-004)", async () => {
  const typed = await adding(["add", "skill", "refactoring", "--header", "triggers=refactor"]);
  const answered = await adding(["add", "skill", "refactoring"], ["", ["refactor"]]);

  assert.equal(typed.code, EXIT_FAILURE);
  assert.equal(answered.code, EXIT_FAILURE);
  assert.equal(typed.problems, answered.problems);
  assert.match(typed.problems, /not what a skill holds/);
  assert.equal(await held(typed.held, ".cw/charter/skill/refactoring.md"), undefined);
});
