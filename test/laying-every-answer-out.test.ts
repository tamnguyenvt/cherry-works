import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { stripVTControlCharacters } from "node:util";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { Commander } from "../src/presentation/cli/cli.commander.js";
import { printFaultsByFile } from "../src/presentation/cli/commands/helper.js";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import type { AnswersOfEveryCommand } from "./every-command-in-turn.js";
import { authoringCharterOf, buildingCharterOf, commandLineOf } from "./use-cases-of.js";

const repo = "/repo";
const root = new URL("file:///repo/.cw/charter/primitive/");
const at = (path: string) => new URL(path, root).href;
const inRepo = (path: string) => new URL(path, "file:///repo/").href;

const guide = (id: string, headers: readonly string[] = ['globs: ["src/**/*.ts"]']) =>
  [
    "---",
    "kind: guide",
    `id: ${id}`,
    `description: About ${id}.`,
    ...headers,
    "---",
    "",
    `The body of ${id}.`,
    "",
  ].join("\n");

const settingsOf = (...agents: readonly string[]) => ({
  [inRepo(".cw/settings.json")]: `${JSON.stringify({ agents }, undefined, 2)}\n`,
});

/** A test file naming one guide, so no warning says nothing pins it down. */
const pinningDown = (id: string) => ({
  [inRepo(`.cw/charter/test/${id}.json`)]: JSON.stringify({
    cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: id } }],
  }),
});

/** One run's two streams, written as a terminal or as a file receives them:
 *  `isTerminal` is what `isTTY` says of both while it runs, and
 *  `isNoColourSet` whether `NO_COLOR` is set. */
const printedOutputOf = async (
  runCommandLine: () => Promise<number>,
  { isTerminal, isNoColourSet }: { readonly isTerminal: boolean; readonly isNoColourSet: boolean },
): Promise<{ code: number; resultText: string; problemText: string }> => {
  const resultChunks: string[] = [];
  const problemChunks: string[] = [];
  const keptNoColour = process.env.NO_COLOR;
  const streams = [
    { stream: process.stdout, keptWrite: process.stdout.write, keptIsTTY: process.stdout.isTTY, into: resultChunks },
    { stream: process.stderr, keptWrite: process.stderr.write, keptIsTTY: process.stderr.isTTY, into: problemChunks },
  ];
  for (const { stream, into } of streams) {
    stream.isTTY = isTerminal;
    stream.write = ((text: string | Uint8Array) => {
      into.push(String(text));
      return true;
    }) as typeof stream.write;
  }
  if (isNoColourSet) process.env.NO_COLOR = "1";
  else delete process.env.NO_COLOR;
  try {
    const code = await runCommandLine();
    return { code, resultText: resultChunks.join(""), problemText: problemChunks.join("") };
  } finally {
    for (const { stream, keptWrite, keptIsTTY } of streams) {
      stream.write = keptWrite;
      stream.isTTY = keptIsTTY;
    }
    if (keptNoColour === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = keptNoColour;
  }
};

/** The command line over one repository held in memory. */
const commandLine = (files: Readonly<Record<string, string>>) => {
  const fileReaders = new InMemoryFileReaders(files);
  const cli = new Commander(
    commandLineOf(
      fileReaders,
      new InMemoryFileOutput(fileReaders),
      {
        charterAuthoringApp: authoringCharterOf(
          fileReaders,
          new InMemoryFileOutput(fileReaders),
          new InMemoryReporter(),
          { sourceFetcher: new InMemorySources() },
        ),
        charterRuntimeApp: buildingCharterOf(
          fileReaders,
          new InMemoryFileOutput(fileReaders),
          new InMemoryTokenCounter(),
          { claude: new InMemoryAgentCli() },
          new InMemoryReporter(),
        ),
      },
      repo,
      "1.2.3",
    ),
    COMMANDS,
  );
  return {
    run: (argv: readonly string[], printingStreams = { isTerminal: false, isNoColourSet: false }) =>
      printedOutputOf(() => cli.runCommandLine(argv), printingStreams),
  };
};

/** A repository whose doctor says a good and a fault status: the agents
 *  good, and a charter with an error. */
const faultyCharterFiles = {
  ...settingsOf("claude"),
  [at("guide/no-any/index.md")]: guide("no-any"),
  ...pinningDown("no-any"),
  [at("guide/broken/index.md")]: guide("broken", ["globs: nope"]),
};

/** The column every value of these lines starts at, past the label before it
 *  and the spaces after it. */
const valueColumnOf = (lines: readonly string[], labelPattern: RegExp) =>
  lines.map((line) => line.match(labelPattern)?.[0].length);

const ESCAPE_CODE = "\x1b[";
const BOLD_CODE = "\x1b[1m";
const MENTION_CODE = "\x1b[36m";
const RESET_CODE = "\x1b[0m";

test("an answer has a heading over each part, each label and its value in one aligned column, and every status with its mark (CORE Story 67 scenario 1)", async () => {
  const { run } = commandLine({ ...settingsOf("claude"), [at("guide/no-any/index.md")]: guide("no-any") });
  await run(["build"]);

  const { resultText: doctorText } = await run(["doctor"]);
  const doctorLines = doctorText.split("\n");
  assert.equal(doctorLines[0], "cw 1.2.3");
  const statusLines = doctorLines.filter((line) => /^[✔⚠✘] \S+:/.test(line));
  assert.ok(statusLines.length >= 4);
  assert.equal(new Set(valueColumnOf(statusLines, /^[✔⚠✘] \S+:\s+/)).size, 1);
  assert.match(doctorText, /^[✔⚠✘] Nothing to fix\.$/m);

  const { resultText: listText } = await run(["list"]);
  const listLines = listText.split("\n").filter((line) => line !== "");
  assert.equal(listLines[0], "Primitives");
  const idLines = listLines.filter((line) => /^ {2}\S/.test(line));
  assert.ok(idLines.length >= 2);
  assert.equal(new Set(valueColumnOf(idLines, /^ {2}\S+\s+/)).size, 1);
  assert.match(listText, /\n {2}no-any +About no-any\.\n +\.cw\/charter\/primitive\/guide\/no-any\/index\.md\n/);

  // At a terminal, every heading is bold, and every id and path is set apart
  // in a colour of its own.
  const atTerminal = { isTerminal: true, isNoColourSet: false };
  const { resultText: colouredDoctorText } = await run(["doctor"], atTerminal);
  assert.ok(colouredDoctorText.startsWith(`${BOLD_CODE}cw 1.2.3`));
  const { resultText: colouredListText } = await run(["list"], atTerminal);
  assert.ok(colouredListText.startsWith(`${BOLD_CODE}Primitives`));
  assert.ok(colouredListText.includes(`${MENTION_CODE}no-any${RESET_CODE}`));
  assert.ok(colouredListText.includes(`${MENTION_CODE}.cw/charter/primitive/guide/no-any/index.md${RESET_CODE}`));
});

test("a path an answer names in its words, not in a row, is set apart as well (CORE Story 67 scenario 1)", async () => {
  const atTerminal = { isTerminal: true, isNoColourSet: false };

  const { resultText: initText } = await commandLine({}).run(["init", "--agent", "claude"], atTerminal);
  assert.ok(initText.includes(`under ${MENTION_CODE}.cw/charter/primitive/guide/${RESET_CODE}`), initText);

  const { run } = commandLine(settingsOf("claude"));
  await run(["build"]);
  const { resultText: testText } = await run(["test"], atTerminal);
  assert.ok(testText.includes(`No tests: ${MENTION_CODE}.cw/charter/test/${RESET_CODE} holds no case.`), testText);
  assert.ok(testText.includes(`Write one as ${MENTION_CODE}.cw/charter/test/<name>.json${RESET_CODE}`), testText);
  const { resultText: evalText } = await run(["eval"], atTerminal);
  assert.ok(evalText.includes(`No evaluation: ${MENTION_CODE}.cw/charter/eval/${RESET_CODE} holds no case.`), evalText);
  assert.ok(evalText.includes(`Write one as ${MENTION_CODE}.cw/charter/eval/<name>.json${RESET_CODE}`), evalText);
});

test("faults and warnings in two files are each printed under the file that has to change (CORE Story 67 scenario 2)", async () => {
  const faultyFilePaths = [
    ".cw/charter/primitive/guide/broken/index.md",
    ".cw/charter/primitive/guide/cracked/index.md",
  ];
  const { run: runFaulty } = commandLine({
    ...settingsOf("claude"),
    [at("guide/broken/index.md")]: guide("broken", ["globs: nope"]),
    [at("guide/cracked/index.md")]: guide("cracked", ["globs: nope"]),
  });
  const warnedFilePaths = [
    ".cw/charter/primitive/guide/unpinned/index.md",
    ".cw/charter/primitive/guide/unsure/index.md",
  ];
  const { run: runWarned } = commandLine({
    ...settingsOf("claude"),
    [at("guide/unpinned/index.md")]: guide("unpinned"),
    [at("guide/unsure/index.md")]: guide("unsure"),
  });

  for (const [{ resultText }, filePaths, faultPattern] of [
    [await runFaulty(["doctor"]), faultyFilePaths, /^ {2}✘ error: /m],
    [await runWarned(["doctor"]), warnedFilePaths, /^ {2}⚠ warn: /m],
  ] as const) {
    const [firstFileIndex, secondFileIndex] = filePaths.map((filePath) => resultText.indexOf(`\n${filePath}\n`));
    assert.ok(
      firstFileIndex !== undefined &&
        secondFileIndex !== undefined &&
        firstFileIndex > 0 &&
        secondFileIndex > firstFileIndex,
    );
    assert.match(resultText.slice(firstFileIndex, secondFileIndex), faultPattern);
    assert.match(resultText.slice(secondFileIndex), faultPattern);
  }

  // The engine says no warning while the charter has an error, so one file
  // holding both is read as the command line prints any faults by file.
  const faultOf = (severity: "error" | "warn", message: string) => ({
    type: "Fault" as const,
    data: { name: "SomeFault", message, fix: `Fix ${message}`, severity },
  });
  const faultsByFileText = stripVTControlCharacters(
    printFaultsByFile({
      type: "FaultsByFile",
      data: {
        files: {
          "b.md": [faultOf("warn", "b warned"), faultOf("error", "b broken")],
          "a.md": [faultOf("error", "a broken"), faultOf("warn", "a warned")],
        },
      },
    }),
  );
  assert.equal(
    faultsByFileText,
    [
      "a.md",
      "  ✘ error:  a broken",
      "            Fix a broken",
      "  ⚠ warn:   a warned",
      "            Fix a warned",
      "b.md",
      "  ⚠ warn:   b warned",
      "            Fix b warned",
      "  ✘ error:  b broken",
      "            Fix b broken",
      "",
    ].join("\n"),
  );
});

test("at a terminal a good, a to-do and a fault status each have a colour of their own, and each is told apart by its mark alone (CORE Story 67 scenario 3)", async () => {
  const atTerminal = { isTerminal: true, isNoColourSet: false };
  const { run: runFaulty } = commandLine(faultyCharterFiles);
  const { run: runWarned } = commandLine({
    ...settingsOf("claude"),
    [at("guide/unpinned/index.md")]: guide("unpinned"),
  });

  const colouredText =
    (await runFaulty(["doctor"], atTerminal)).resultText + (await runWarned(["doctor"], atTerminal)).resultText;
  const plainText = (await runFaulty(["doctor"])).resultText + (await runWarned(["doctor"])).resultText;

  const colourOfMark = (mark: string) => colouredText.match(new RegExp(`\\x1b\\[(\\d+)m${mark}`))?.[1];
  const markColours = ["✔", "⚠", "✘"].map(colourOfMark);
  assert.ok(markColours.every((markColour) => markColour !== undefined));
  assert.equal(new Set(markColours).size, 3);
  for (const mark of ["✔", "⚠", "✘"]) assert.ok(plainText.includes(`${mark} `));
});

test("an answer written to a file, or with NO_COLOR set, is laid out as at a terminal and holds no colour code (CORE Story 67 scenario 4)", async () => {
  const { run } = commandLine(faultyCharterFiles);

  for (const argv of [["doctor"], ["list"], ["build", "--preview"], ["explain", "no-any"], ["kinds"]]) {
    const terminalAnswer = await run(argv, { isTerminal: true, isNoColourSet: false });
    const fileAnswer = await run(argv, { isTerminal: false, isNoColourSet: false });
    const noColourAnswer = await run(argv, { isTerminal: true, isNoColourSet: true });

    for (const plainAnswer of [fileAnswer, noColourAnswer]) {
      assert.ok(!plainAnswer.resultText.includes(ESCAPE_CODE), `cw ${argv.join(" ")} holds a colour code`);
      assert.ok(!plainAnswer.problemText.includes(ESCAPE_CODE), `cw ${argv.join(" ")} holds a colour code`);
      assert.equal(plainAnswer.code, terminalAnswer.code);
      assert.equal(plainAnswer.resultText, stripVTControlCharacters(terminalAnswer.resultText));
      assert.equal(plainAnswer.problemText, stripVTControlCharacters(terminalAnswer.problemText));
    }
  }
});

/** The headings the layout adds over a part of an answer that had none: every
 *  other line of an answer says what it said before this story. */
const LAYOUT_HEADINGS: readonly string[] = ["Primitives", "Kinds", "Vendors", "To fix, by file"];

/** What one answer says, word by word, its marks left out: a mark is how a
 *  status is shown, not a word of it. */
const wordLinesOf = (answerText: string): string[][] =>
  answerText.split("\n").map((line) => line.split(/\s+/).filter((word) => word !== "" && !/^[✔⚠✘]$/.test(word)));

test("every command but the three cw run commands says what it said before this story, nothing added but headings and nothing left out, with the same exit status (CORE Story 67 scenario 5)", async () => {
  const answersBefore: AnswersOfEveryCommand["commandAnswers"] = JSON.parse(
    await readFile(new URL("answered-before-the-layout.json", import.meta.url), "utf8"),
  );
  const { commandAnswers: answersNow }: AnswersOfEveryCommand = JSON.parse(
    await readFile(new URL("answered-by-every-command.json", import.meta.url), "utf8"),
  );

  assert.deepEqual(
    answersNow.map(({ args }) => args),
    answersBefore.map(({ args }) => args),
  );
  answersNow.forEach((answerNow, answerIndex) => {
    const answerBefore = answersBefore[answerIndex];
    assert.ok(answerBefore !== undefined);
    assert.equal(answerNow.status, answerBefore.status, `cw ${answerNow.args}`);
    // The help is yargs' own and laid out by CORE Story 69.
    if (answerNow.args.includes("--help")) return;
    for (const streamName of ["stdout", "stderr"] as const) {
      const wordsBefore: readonly string[] = wordLinesOf(answerBefore[streamName]).flat();
      let matchedWordCount = 0;
      for (const lineWords of wordLinesOf(answerNow[streamName])) {
        // A line is the words said before, in their order, or one of the
        // headings the layout adds: never anything else.
        const mismatchedWordIndex = lineWords.findIndex(
          (word, wordIndex) => word !== wordsBefore[matchedWordCount + wordIndex],
        );
        const isSaidBefore = mismatchedWordIndex === -1;
        assert.ok(
          isSaidBefore || LAYOUT_HEADINGS.includes(lineWords.join(" ")),
          `cw ${answerNow.args} ${streamName}: "${lineWords.join(" ")}" is neither said before nor a heading`,
        );
        if (isSaidBefore) matchedWordCount += lineWords.length;
      }
      assert.equal(matchedWordCount, wordsBefore.length, `cw ${answerNow.args} ${streamName} leaves words out`);
    }
  });
});

test("cw run mcp, cw run sensor and cw run portal print as before, with no layout and no colour, even at a terminal (CORE Story 67 scenario 6)", async () => {
  const atTerminal = { isTerminal: true, isNoColourSet: false };

  const portalAnswer = await commandLine({}).run(["run", "portal"], atTerminal);
  assert.equal(portalAnswer.code, 1);
  assert.equal(portalAnswer.resultText, "");
  assert.equal(portalAnswer.problemText, 'This repository was never set up under a charter.\n  Run "cw init" first.\n');

  // Never built, so nothing is served: the fault, as it always read.
  const mcpAnswer = await commandLine(settingsOf("claude")).run(["run", "mcp"], atTerminal);
  assert.equal(mcpAnswer.code, 1);
  assert.match(mcpAnswer.problemText, /^[^\s✔⚠✘][^\n]*\n {2}\S[^\n]*\n$/);
  assert.ok(!mcpAnswer.problemText.includes(ESCAPE_CODE));

  const sensorAnswer = await commandLine(settingsOf("claude")).run(
    ["run", "sensor", "Stop", "--agent", "nope"],
    atTerminal,
  );
  assert.equal(sensorAnswer.code, 1);
  assert.match(sensorAnswer.problemText, /^Unknown sensor agent "nope"\.\n {2}Name any of: [^\n]+\.\n$/);
  assert.ok(!sensorAnswer.problemText.includes(ESCAPE_CODE));
});
