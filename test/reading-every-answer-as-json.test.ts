import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { StderrReporter } from "../src/module/shared/infra.js";
import { Commander } from "../src/presentation/cli/cli.commander.js";
import {
  type AnyCommand,
  type CommandLine,
  EXIT_FAILURE,
  EXIT_OK,
  EXIT_USAGE,
} from "../src/presentation/cli/commands/command.interface.js";
import { isLaidOutCommand, showPathsInApps } from "../src/presentation/cli/commands/helper.js";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { type AnswersOfEveryCommand, answersOfEveryCommand } from "./every-command-in-turn.js";
import { authoringCharterOf, buildingCharterOf, commandLineOf } from "./use-cases-of.js";

const repo = "/repo";
const root = new URL("file:///repo/.cw/charter/team/primitive/");
const at = (path: string) => new URL(path, root).href;
const inRepo = (path: string) => new URL(path, "file:///repo/").href;

// `pnpm test` builds this tree first: dist/ is what its source builds to.
const cwFilePath = fileURLToPath(new URL("../dist/cw.js", import.meta.url));

/** Clear of the default port, and of the other tests' portals. */
const PORT = 47394;

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

/** One run's two streams, written as a terminal or as a file receives them:
 *  `isTerminal` is what `isTTY` says of all three while it runs. */
const printedOutputOf = async (
  runCommandLine: () => Promise<number>,
  isTerminal: boolean,
): Promise<{ code: number; resultText: string; problemText: string }> => {
  const resultChunks: string[] = [];
  const problemChunks: string[] = [];
  const keptNoColour = process.env.NO_COLOR;
  const keptStdinIsTTY = process.stdin.isTTY;
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
  process.stdin.isTTY = isTerminal;
  delete process.env.NO_COLOR;
  try {
    const code = await runCommandLine();
    return { code, resultText: resultChunks.join(""), problemText: problemChunks.join("") };
  } finally {
    for (const { stream, keptWrite, keptIsTTY } of streams) {
      stream.write = keptWrite;
      stream.isTTY = keptIsTTY;
    }
    process.stdin.isTTY = keptStdinIsTTY;
    if (keptNoColour !== undefined) process.env.NO_COLOR = keptNoColour;
  }
};

/** The command line over one repository held in memory, and the engine it
 *  composes, every address said as the command line says it: what a command
 *  answers is compared with what the engine answers it. */
const commandLine = (files: Readonly<Record<string, string>>, cwd = repo) => {
  const fileReaders = new InMemoryFileReaders(files);
  const heldCommandLine: CommandLine = commandLineOf(
    fileReaders,
    new InMemoryFileOutput(fileReaders),
    {
      charterAuthoringApp: authoringCharterOf(
        fileReaders,
        new InMemoryFileOutput(fileReaders),
        new InMemoryReporter(),
        {
          sourceFetcher: new InMemorySources(),
        },
      ),
      charterRuntimeApp: buildingCharterOf(
        fileReaders,
        new InMemoryFileOutput(fileReaders),
        new InMemoryTokenCounter(),
        { claude: new InMemoryAgentCli() },
        new InMemoryReporter(),
      ),
    },
    cwd,
    "1.2.3",
  );
  const cli = new Commander(heldCommandLine, COMMANDS);
  return {
    run: (argv: readonly string[], isTerminal = false) => printedOutputOf(() => cli.runCommandLine(argv), isTerminal),
    engineApps: async () => showPathsInApps((await heldCommandLine.composeApplications(true)).engineApp, repo),
  };
};

/** What JSON says of an answer: what a script reads back. */
const parsedAnswerOf = (answerDTO: unknown) => JSON.parse(JSON.stringify(answerDTO));

const ESCAPE_CODE = "\x1b[";

/** A repository whose charter holds, built. */
const builtCharterFiles = {
  ...settingsOf("claude"),
  [at("guide/no-any/index.md")]: guide("no-any"),
  [at("guide/plain-words/index.md")]: guide("plain-words"),
};

test("any command but the three cw run commands, run with --json, prints exactly one JSON document, the answer the engine makes for the caller as it is (CORE Story 68 scenario 1)", async () => {
  const { run, engineApps } = commandLine(builtCharterFiles);
  await run(["build"]);
  const { charterAuthoringApp, charterBuildingApp } = await engineApps();

  for (const [argv, engineAnswer] of [
    [["list"], () => charterAuthoringApp.listCatalogue()],
    [["list", "--min"], () => charterAuthoringApp.listCatalogue()],
    [["kinds"], () => charterAuthoringApp.listKinds()],
    [["kinds", "guide"], () => charterAuthoringApp.listPrimitiveRequirements("guide")],
    [["explain", "no-any"], () => charterAuthoringApp.explainPrimitive("no-any")],
    [["doctor"], () => charterBuildingApp.diagnoseCharter()],
    [["build", "--preview"], () => charterBuildingApp.previewCharterBuild()],
    [["context"], () => charterBuildingApp.predictMainContext()],
    [["test"], () => charterAuthoringApp.testCharter()],
    [["charter"], () => charterAuthoringApp.listCharters()],
  ] as const) {
    const { code, resultText, problemText } = await run([...argv, "--json"]);
    assert.equal(code, (await run(argv)).code, `cw ${argv.join(" ")}`);
    assert.deepEqual(JSON.parse(resultText), parsedAnswerOf(await engineAnswer()), `cw ${argv.join(" ")}`);
    assert.equal(problemText, "", `cw ${argv.join(" ")}`);
  }

  // A command that writes answers what it wrote: the build, its plan.
  const { resultText: builtText } = await run(["build", "--json"]);
  assert.equal(JSON.parse(builtText).type, "ProjectionPlanSummary");
});

test("every command but the three cw run commands, run in turn with --json, prints one JSON document on standard output, on success and on failure (CORE Story 68 scenario 1, CORE-SC-075)", async () => {
  const { commandAnswers } = await answersOfEveryCommand(cwFilePath, PORT, {}, ["--json"]);
  const { commandAnswers: recordedAnswers }: AnswersOfEveryCommand = JSON.parse(
    await readFile(new URL("answered-by-every-command.json", import.meta.url), "utf8"),
  );
  const answeredAsData = commandAnswers.flatMap((commandAnswer, commandIndex) =>
    commandAnswer.args.startsWith("-") || commandAnswer.args.startsWith("run ")
      ? []
      : [{ ...commandAnswer, commandIndex }],
  );
  assert.ok(answeredAsData.length >= 25);
  for (const { args, status, stdout, commandIndex } of answeredAsData) {
    const answerDTO = JSON.parse(stdout);
    assert.equal(typeof answerDTO.type, "string", `cw ${args}`);
    assert.ok("data" in answerDTO, `cw ${args}`);
    assert.equal(stdout, `${JSON.stringify(answerDTO, null, 2)}\n`, `cw ${args}: one document and nothing else`);
    // Each exits as it did without the flag, run over the same repository.
    assert.equal(status, recordedAnswers[commandIndex]?.status, `cw ${args}`);
  }
});

test("with --json at a terminal, an answer holds no colour code and none of the layout (CORE Story 68 scenario 2)", async () => {
  const { run } = commandLine(builtCharterFiles);
  await run(["build"]);

  for (const argv of [["doctor"], ["list"], ["explain", "no-any"], ["build", "--preview"], ["explain", "nope"]]) {
    const { resultText, problemText } = await run([...argv, "--json"], true);
    assert.ok(!resultText.includes(ESCAPE_CODE), `cw ${argv.join(" ")} holds a colour code`);
    assert.equal(resultText, `${JSON.stringify(JSON.parse(resultText), null, 2)}\n`, `cw ${argv.join(" ")}`);
    assert.doesNotMatch(resultText, /[✔⚠✘]/);
    assert.equal(problemText, "");
  }
});

test("a command that fails with --json prints its faults as one JSON document, and exits as it does without the flag (CORE Story 68 scenario 3)", async () => {
  const { run, engineApps } = commandLine(builtCharterFiles);
  const { charterAuthoringApp } = await engineApps();

  const plainAnswer = await run(["explain", "nope"]);
  const jsonAnswer = await run(["explain", "nope", "--json"]);
  assert.equal(plainAnswer.code, EXIT_FAILURE);
  assert.equal(jsonAnswer.code, plainAnswer.code);
  assert.deepEqual(
    JSON.parse(jsonAnswer.resultText),
    parsedAnswerOf(await charterAuthoringApp.explainPrimitive("nope")),
  );
  assert.equal(JSON.parse(jsonAnswer.resultText).type, "Fault");
  assert.equal(jsonAnswer.problemText, "");

  // A charter with an error: its faults under each file, as the engine answers.
  const { run: runFaulty } = commandLine({
    ...settingsOf("claude"),
    [at("guide/broken/index.md")]: guide("broken", ["globs: nope"]),
  });
  for (const argv of [["list"], ["explain", "broken"], ["build"], ["test"]]) {
    const faultyAnswer = await runFaulty([...argv, "--json"]);
    assert.equal(faultyAnswer.code, (await runFaulty(argv)).code);
    assert.equal(JSON.parse(faultyAnswer.resultText).type, "FaultsByFile", `cw ${argv.join(" ")}`);
  }

  // A fault the command line finds itself is answered as a use case's is, in
  // the words it prints.
  const repeatedAnswer = await run([
    "add",
    "guide",
    "twice",
    "--header",
    "description=One.",
    "--header",
    "description=Two.",
    "--json",
  ]);
  assert.equal(repeatedAnswer.code, EXIT_FAILURE);
  const repeatedFaultDTO = JSON.parse(repeatedAnswer.resultText);
  assert.equal(repeatedFaultDTO.type, "Fault");
  assert.equal(repeatedFaultDTO.data.message, '"description" holds one line, and was typed 2 times.');

  // Settings that do not read refuse every command but setup.
  // Every command taking --json fails so, once, its fault the one document
  // (CORE-SC-075).
  const { run: runUnreadable } = commandLine({ [inRepo(".cw/settings.json")]: "{" });
  for (const command of COMMANDS.filter((command) => isLaidOutCommand(command) && command.name !== "init")) {
    const typedArgs = command.name
      .split(" ")
      .filter((nameWord) => !nameWord.startsWith("["))
      .map((nameWord) => (nameWord.startsWith("<") ? "nope" : nameWord));
    const unreadableAnswer = await runUnreadable([...typedArgs, "--json"]);
    assert.equal(unreadableAnswer.code, (await runUnreadable(typedArgs)).code, `cw ${typedArgs.join(" ")}`);
    assert.equal(unreadableAnswer.code, EXIT_FAILURE, `cw ${typedArgs.join(" ")}`);
    assert.equal(JSON.parse(unreadableAnswer.resultText).type, "Fault", `cw ${typedArgs.join(" ")}`);
  }

  // Each fails too on what it was given, answered as the engine answers it.
  const { run: runGiven } = commandLine(builtCharterFiles);
  for (const argv of [
    ["kinds", "nope"],
    ["sessions", "--since", "nope"],
    ["eval-analyze", "--log", "/nope.json"],
    ["charter", "remove", "--charter=nope"],
    ["suite", "remove", "nope.json"],
    ["suite", "edit", "nope.json"],
    ["edit", "nope"],
    ["mcp", "auth", "nope"],
  ]) {
    const givenAnswer = await runGiven([...argv, "--json"]);
    assert.equal(givenAnswer.code, (await runGiven(argv)).code, `cw ${argv.join(" ")}`);
    assert.equal(givenAnswer.code, EXIT_FAILURE, `cw ${argv.join(" ")}`);
    assert.equal(JSON.parse(givenAnswer.resultText).type, "Fault", `cw ${argv.join(" ")}`);
    assert.equal(givenAnswer.problemText, "", `cw ${argv.join(" ")}`);
  }

  // What the parser refuses is a fault too, and exits as it always did.
  for (const jsonArgs of [["--json"], ["--json=true"], ["--json", "true"]]) {
    const jsonArg = jsonArgs.join(" ");
    const usageAnswer = await run(["explain", ...jsonArgs]);
    assert.equal(usageAnswer.code, EXIT_USAGE, jsonArg);
    assert.equal(JSON.parse(usageAnswer.resultText).type, "Fault", jsonArg);
    assert.equal(usageAnswer.problemText, "", jsonArg);
  }
  // Turned off, the flag leaves the refusal in words.
  const wordedUsageAnswer = await run(["explain", "--json=false"]);
  assert.equal(wordedUsageAnswer.code, EXIT_USAGE);
  assert.equal(wordedUsageAnswer.resultText, "");
  assert.match(wordedUsageAnswer.problemText, /Not enough non-option arguments/);
});

test("a command that asks at a terminal, run with --json at one, asks nothing and answers as with no terminal to ask at (CORE Story 68 scenario 4)", async () => {
  for (const [files, argv, cwd] of [
    [{}, ["init"], repo],
    [builtCharterFiles, ["remove", "no-any"], repo],
    [builtCharterFiles, ["add", "guide", "short-lines"], repo],
  ] as const) {
    // Nothing is typed at the terminal: a question asked would wait forever.
    const answerAtTerminal = await commandLine(files, cwd).run([...argv, "--json"], true);
    const answerWithNoTerminal = await commandLine(files, cwd).run([...argv, "--json"], false);
    assert.equal(answerAtTerminal.code, answerWithNoTerminal.code, `cw ${argv.join(" ")}`);
    assert.equal(answerAtTerminal.resultText, answerWithNoTerminal.resultText, `cw ${argv.join(" ")}`);
    assert.equal(JSON.parse(answerAtTerminal.resultText).type, "Fault", `cw ${argv.join(" ")}`);
  }
});

test("cw run mcp, cw run sensor and cw run portal, by every name they are typed by, refuse --json, naming the flag, and run nothing (CORE Story 68 scenario 5)", async () => {
  for (const argv of [
    ["run", "mcp"],
    ["run", "sensor", "Stop"],
    ["run", "portal"],
    ["mcp", "serve"],
    ["sensor", "run", "Stop"],
    ["portal"],
  ]) {
    // Typed after the command or before it, the flag is refused alike.
    for (const typedArgs of [
      [...argv, "--json"],
      ["--json", ...argv],
    ]) {
      const { code, resultText, problemText } = await commandLine(builtCharterFiles).run(typedArgs);
      assert.equal(code, EXIT_USAGE, `cw ${typedArgs.join(" ")}`);
      assert.equal(resultText, "", `cw ${typedArgs.join(" ")}`);
      assert.match(problemText, /Unknown argument: json/, `cw ${typedArgs.join(" ")}`);
    }
  }
});

test("what the engine reports as it goes with --json is written to standard error, never to standard output (CORE-FR-241)", async () => {
  const { resultText, problemText } = await printedOutputOf(async () => {
    new StderrReporter().reportProgress("Installing promptfoo once...\n");
    return 0;
  }, false);
  assert.equal(resultText, "");
  assert.equal(problemText, "Installing promptfoo once...\n");
});

test("a command that ends on no answer of the engine's still prints one JSON document with --json, a fault, and fails (CORE-FR-241, CORE-SC-075)", async () => {
  const silentCommand: AnyCommand = {
    name: "silent",
    summary: "Answer nothing as data",
    runCommand: () => ({ exitCode: EXIT_OK, resultText: "Said in words alone.\n" }),
  };

  const fileReaders = new InMemoryFileReaders(settingsOf("claude"));
  const cli = new Commander(
    commandLineOf(fileReaders, new InMemoryFileOutput(fileReaders), {
      charterAuthoringApp: authoringCharterOf(fileReaders, new InMemoryFileOutput(fileReaders), new InMemoryReporter()),
      charterRuntimeApp: buildingCharterOf(
        fileReaders,
        new InMemoryFileOutput(fileReaders),
        new InMemoryTokenCounter(),
        { claude: new InMemoryAgentCli() },
        new InMemoryReporter(),
      ),
    }),
    [silentCommand],
  );
  const { code, resultText } = await printedOutputOf(() => cli.runCommandLine(["silent", "--json"]), false);
  assert.equal(code, EXIT_FAILURE);
  assert.equal(JSON.parse(resultText).type, "Fault");

  // `cw run` with no command after it is no command taking --json.
  const runAnswer = await commandLine(builtCharterFiles).run(["run", "--json"]);
  assert.equal(runAnswer.resultText, "");
});

test("cw edit with --json opens the editor and holds standard output to the answer, what the editor prints going to standard error (CORE-FR-241)", async (t) => {
  const folderPath = await mkdtemp(join(tmpdir(), "cw-json-"));
  t.after(() => rm(folderPath, { recursive: true, force: true }));
  const runCw = (cwArgs: readonly string[]) =>
    spawnSync(process.execPath, [cwFilePath, ...cwArgs], {
      cwd: folderPath,
      env: { ...process.env, HOME: join(folderPath, ".home"), EDITOR: "echo opened", VISUAL: "" },
      input: "",
      encoding: "utf8",
    });
  assert.equal(runCw(["init", "--agent", "claude"]).status, 0);
  assert.equal(runCw(["add", "guide", "no-any", "--charter=team", "--header", "description=No any."]).status, 0);

  const editRun = runCw(["edit", "no-any", "--json"]);
  assert.equal(editRun.status, 0, editRun.stderr);
  assert.equal(JSON.parse(editRun.stdout).type, "Primitive");
  assert.match(editRun.stderr, /^opened .*no-any\/index\.md\n$/);
});

test("cw eval with --json reports installing promptfoo on standard error, standard output holding its answer alone (CORE-FR-241)", async (t) => {
  const folderPath = await mkdtemp(join(tmpdir(), "cw-json-"));
  t.after(() => rm(folderPath, { recursive: true, force: true }));
  // An agent that answers it is installed, and an npm that fails at once:
  // promptfoo is not installed under this home, so the run installs it first.
  const binFolderPath = join(folderPath, ".bin");
  await mkdir(binFolderPath);
  for (const [commandName, commandText] of [
    ["claude", '#!/bin/sh\necho "2.0.0 (Claude Code)"\n'],
    ["npm", "#!/bin/sh\nexit 1\n"],
  ] as const) {
    await writeFile(join(binFolderPath, commandName), commandText);
    await chmod(join(binFolderPath, commandName), 0o755);
  }
  const commandEnv = {
    ...process.env,
    HOME: join(folderPath, ".home"),
    PATH: [binFolderPath, process.env.PATH].join(delimiter),
    GIT_CONFIG_GLOBAL: join(folderPath, ".gitconfig"),
    GIT_AUTHOR_NAME: "Someone",
    GIT_AUTHOR_EMAIL: "someone@example.com",
    GIT_COMMITTER_NAME: "Someone",
    GIT_COMMITTER_EMAIL: "someone@example.com",
  };
  await writeFile(join(folderPath, ".gitconfig"), "");
  await writeFile(join(folderPath, ".gitignore"), ".bin/\n.home/\n.gitconfig\n");
  const runIn = (commandFile: string, commandArgs: readonly string[]) =>
    spawnSync(commandFile, commandArgs, { cwd: folderPath, env: commandEnv, input: "", encoding: "utf8" });
  assert.equal(runIn("git", ["init", "--quiet"]).status, 0);
  assert.equal(runIn(process.execPath, [cwFilePath, "init", "--agent", "claude"]).status, 0);
  assert.equal(
    runIn(process.execPath, [
      cwFilePath,
      "add",
      "skill",
      "ask-first",
      "--charter=team",
      "--header",
      "description=Ask before guessing.",
      "--header",
      "triggers=ask first",
    ]).status,
    0,
  );
  await mkdir(join(folderPath, ".cw/charter/team/eval"), { recursive: true });
  await writeFile(
    join(folderPath, ".cw/charter/team/eval/asking.json"),
    '{"cases":[{"prompt":"ask first, then plan","expect":{"invoke":"ask-first"}}]}\n',
  );
  assert.equal(runIn("git", ["add", "."]).status, 0);
  assert.equal(runIn("git", ["commit", "--quiet", "-m", "The charter and its case"]).status, 0);

  const evalRun = runIn(process.execPath, [cwFilePath, "eval", "--json"]);
  assert.equal(evalRun.status, EXIT_FAILURE, evalRun.stderr);
  assert.equal(JSON.parse(evalRun.stdout).type, "Fault");
  assert.match(evalRun.stderr, /Installing promptfoo once/);
  assert.doesNotMatch(evalRun.stdout, /Installing promptfoo once/);
});
