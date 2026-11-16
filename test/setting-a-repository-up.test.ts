import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { Primitives } from "../src/module/charter/domain/models/primitive/primitive.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { FileWorkspaceSettingsRepository, ManagingWorkspace } from "../src/module/workspace/module.js";
import { Commander } from "../src/presentation/cli/cli.commander.js";
import { EXIT_FAILURE } from "../src/presentation/cli/commands/command.interface.js";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { authoringCharterOf, buildingCharterOf, commandLineOf } from "./use-cases-of.js";

const repo = "/repo";

const repoPath = new URL("file:///repo/");

/** The command line as a user meets it, over a repository held in memory: the
 *  real `cw init`, the real service behind it, and files a test can read back
 *  out of; for the agents `agentProviderNames` names where a test gives them. */
const setUp = async (
  files: Readonly<Record<string, string>> = {},
  argv: readonly string[] = ["init"],
  agentProviderNames?: readonly string[],
) => {
  const held = new InMemoryFileReaders(files);
  const charterAuthoringApp = authoringCharterOf(held, new InMemoryFileOutput(held), new InMemoryReporter());
  const charterRuntimeApps = buildingCharterOf(
    held,
    new InMemoryFileOutput(held),
    new InMemoryTokenCounter(),
    { claude: new InMemoryAgentCli() },
    new InMemoryReporter(),
    {},
  );
  const results: string[] = [];
  const problems: string[] = [];
  const kept = { out: process.stdout.write, err: process.stderr.write };
  process.stdout.write = ((text: string) => (results.push(text), true)) as typeof kept.out;
  process.stderr.write = ((text: string) => (problems.push(text), true)) as typeof kept.err;
  try {
    const commandLine = commandLineOf(
      held,
      new InMemoryFileOutput(held),
      { charterAuthoringApp, charterRuntimeApp: charterRuntimeApps },
      repo,
    );
    const code = await new Commander(
      agentProviderNames === undefined
        ? commandLine
        : {
            ...commandLine,
            composeApplications: async () => ({
              ...(await commandLine.composeApplications()),
              workspaceApp: new ManagingWorkspace(
                new FileWorkspaceSettingsRepository(held, new InMemoryFileOutput(held)),
                agentProviderNames,
                new InMemoryReporter(),
              ),
            }),
          },
      COMMANDS,
    ).runCommandLine(argv);
    return { code, held, results: results.join(""), problems: problems.join("") };
  } finally {
    process.stdout.write = kept.out;
    process.stderr.write = kept.err;
  }
};

/** What one file of the set-up repository holds, or nothing where it was never
 *  written. */
const held = (files: InMemoryFileReaders, path: string) => files.readIfThere(new URL(path, repoPath));

test("setting up writes a directory per kind, so a charter has somewhere to be authored (FR-037, CORE Story 1 scenario 1)", async () => {
  const { code, held: files } = await setUp({}, ["init", "--agent", "claude"]);

  assert.equal(code, 0);
  for (const kind of Primitives.kinds)
    assert.notEqual(await held(files, `.cw/charter/primitive/${kind}/.gitkeep`), undefined);
});

test("setting up writes the workspace's README, naming Cherry Works, the cw that set it up and how to author it, and keeps one already there", async () => {
  const { code, held: files } = await setUp({}, ["init", "--agent", "claude"]);

  assert.equal(code, 0);
  const readmeText = (await held(files, ".cw/README.md")) ?? "";
  assert.match(readmeText, /https:\/\/github\.com\/tamnguyenvt\/cherry-works/);
  assert.match(readmeText, /set up with `cw` 0\.0\.0/);
  assert.match(readmeText, /`\/cw-author`/);
  assert.match(readmeText, /`cw run portal`/);

  const { held: keptFiles } = await setUp({ "file:///repo/.cw/README.md": "# Ours\n" }, ["init", "--agent", "claude"]);
  assert.equal(await held(keptFiles, ".cw/README.md"), "# Ours\n");
});

test("what the repository answered is what its settings keep (FR-033, FR-037, CORE Story 1 scenario 1)", async () => {
  const { held: files } = await setUp({}, ["init", "--agent", "claude"]);

  assert.deepEqual(JSON.parse((await held(files, ".cw/settings.json")) ?? ""), { agents: ["claude"] });
});

test("an agent this engine does not compile for is refused, naming the ones it does", async () => {
  const { code, problems } = await setUp({}, ["init", "--agent", "cursor"]);

  assert.equal(code, 1);
  assert.match(problems, /no agent called "cursor"/);
});

test("setup can choose Codex without it being installed on this machine (CORE Story 1 scenario 12)", async () => {
  const { code, held: files, results } = await setUp({}, ["init", "--agent", "codex"]);
  assert.doesNotMatch(results, /Warning: Codex sensor.*cw-session-tokens-counter-on-stop/);
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse((await held(files, ".cw/settings.json"))!), { agents: ["codex"] });
  assert.match((await held(files, "AGENTS.md"))!, /CHERRYWORKS START/);
  assert.match((await held(files, ".agents/skills/cw-author/SKILL.md"))!, /name: cw-author/);
  assert.equal(await held(files, "CLAUDE.md"), undefined);
});

test("with nobody to ask and no agent chosen, setup stops naming the flag that answers it (CORE Story 56 scenario 2)", async () => {
  const { code, held: files, problems } = await setUp();

  assert.equal(code, EXIT_FAILURE);
  assert.match(problems, /Run "cw init --agent <name>", naming one of: claude, codex\./);
  assert.equal(await held(files, ".cw/settings.json"), undefined);
});

test("with nobody to ask and no agent chosen, setup stops even where the engine compiles for one agent only (CORE Story 56 scenario 2)", async () => {
  const { code, held: files, problems } = await setUp({}, ["init"], ["claude"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problems, /Run "cw init --agent <name>", naming one of: claude\./);
  assert.equal(await held(files, ".cw/settings.json"), undefined);
});

test("with nobody to ask, every other prompt takes its flag (CORE Story 56 scenario 2)", async () => {
  const { code, held: files, results } = await setUp({}, ["init", "--agent", "codex", "--mainContextCeiling", "30000"]);

  assert.equal(code, 0);
  assert.deepEqual(JSON.parse((await held(files, ".cw/settings.json")) ?? ""), {
    agents: ["codex"],
    mainContextCeiling: 30000,
  });
  assert.match(results, /^Agents chosen: {2}codex\.$/m);
});

test("setup given an agent this engine does not compile for is refused, and keeps nothing (FR-033)", async () => {
  const { code, held: files, problems } = await setUp({}, ["init", "--agent", "gemini"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problems, /no agent called "gemini"/);
  assert.equal(await held(files, ".cw/settings.json"), undefined);
});

test("what this repository already chose is the default the next run keeps (FR-038)", async () => {
  const { held: files } = await setUp({
    [new URL(".cw/settings.json", repoPath).href]: `${JSON.stringify({ agents: ["claude"] }, undefined, 2)}\n`,
  });

  assert.deepEqual(JSON.parse((await held(files, ".cw/settings.json")) ?? ""), { agents: ["claude"] });
});

test("setting up builds the charter, so the agent can author with the skill the engine brings (FR-057, CORE Story 1 scenario 1)", async () => {
  const { code, held: files, results } = await setUp({}, ["init", "--agent", "claude"]);

  assert.equal(code, 0);
  assert.notEqual(await held(files, ".claude/skills/cw-author/SKILL.md"), undefined);
  assert.notEqual(await held(files, ".cw/out/CHARTER.md"), undefined);
  assert.match(results, /Built \d+ files/);
});

test("setting up again builds what is already authored (FR-057, FR-058)", async () => {
  const {
    code,
    held: files,
    results,
  } = await setUp(
    {
      [new URL(".cw/charter/primitive/guide/no-any/index.md", repoPath).href]:
        '---\nkind: guide\nid: no-any\ndescription: No any.\nglobs: ["src/**/*.ts"]\n---\n\nBody.\n',
    },
    ["init", "--agent", "claude"],
  );

  assert.equal(code, 0);
  assert.notEqual(await held(files, ".claude/rules/no-any.md"), undefined);
  assert.match(results, /Built \d+ files/);
});

test("setting up over a charter that does not hold keeps what it configured, builds nothing and says so (FR-057)", async () => {
  const {
    code,
    held: files,
    problems,
  } = await setUp(
    {
      [new URL(".cw/charter/primitive/guide/broken/index.md", repoPath).href]:
        "---\nkind: guide\nid: broken\n---\n\nNo description.\n",
    },
    ["init", "--agent", "claude"],
  );

  assert.equal(code, 1);
  assert.deepEqual(JSON.parse((await held(files, ".cw/settings.json")) ?? ""), { agents: ["claude"] });
  assert.equal(await held(files, ".cw/out/CHARTER.md"), undefined);
  assert.match(problems, /Nothing was built/);
  assert.match(problems, /\.cw\/charter\/primitive\/guide\/broken\/index\.md/);
});

test("setting up authors nothing for what the engine brings: it is supplied on every read (FR-016, FR-020, CORE Story 12 scenario 7)", async () => {
  const { code, held: files } = await setUp({}, ["init", "--agent", "claude"]);

  assert.equal(code, 0);
  const repositoryFiles = await files.readFilesRecursively(new URL(".cw/charter/", repoPath));
  assert.deepEqual(
    repositoryFiles.map(({ fileUrl }) => fileUrl.href).filter((href) => href.includes("cw-author")),
    [],
  );
});

test("setting up again discards nothing authored (FR-038)", async () => {
  const authored = new URL(".cw/charter/primitive/guide/no-any/index.md", repoPath).href;
  const { code, held: files } = await setUp(
    { [authored]: '---\nkind: guide\nid: no-any\ndescription: No any.\nglobs: ["src/**/*.ts"]\n---\n\nBody.\n' },
    ["init", "--agent", "claude"],
  );

  assert.equal(code, 0);
  assert.equal(
    await files.readIfThere(new URL(authored)),
    '---\nkind: guide\nid: no-any\ndescription: No any.\nglobs: ["src/**/*.ts"]\n---\n\nBody.\n',
  );
});

test("setting up has version control ignore the log, where an evaluation runs each case, in the workspace's own ignore file (EVAL-FR-021, CORE-FR-225)", async () => {
  const { code, held: files } = await setUp({}, ["init", "--agent", "claude"]);

  assert.equal(code, 0);
  assert.equal(await held(files, ".cw/.gitignore"), "log/\n");
});

test("setting up again keeps what the workspace's ignore file holds, and adds its line once (EVAL-FR-021, FR-038)", async () => {
  const { held: files } = await setUp({ [new URL(".cw/.gitignore", repoPath).href]: "vendor/*.log" }, [
    "init",
    "--agent",
    "claude",
  ]);
  assert.equal(await held(files, ".cw/.gitignore"), "vendor/*.log\nlog/\n");

  const { held: filesAgain } = await setUp({ [new URL(".cw/.gitignore", repoPath).href]: "vendor/*.log\nlog/\n" }, [
    "init",
    "--agent",
    "claude",
  ]);
  assert.equal(await held(filesAgain, ".cw/.gitignore"), "vendor/*.log\nlog/\n");
});

test("a build writes no ignore file: the workspace's is written once, at setup (EVAL-FR-021)", async () => {
  const { held: files } = await setUp({ [new URL(".cw/settings.json", repoPath).href]: '{ "agents": ["claude"] }\n' }, [
    "build",
  ]);

  assert.equal(await held(files, ".cw/.gitignore"), undefined);
});

test("the repository's own ignore file is left alone: what a vendor installed is committed too", async () => {
  const { held: files } = await setUp({ [new URL(".gitignore", repoPath).href]: "node_modules/\n" }, [
    "init",
    "--agent",
    "claude",
  ]);

  assert.equal(await held(files, ".gitignore"), "node_modules/\n");
});

test("a folder under no repository is set up and built as a git repository is (CORE-FR-054)", async () => {
  const plainSetupOutcome = await setUp({}, ["init", "--agent", "claude"]);

  assert.equal(plainSetupOutcome.code, 0);
  assert.equal(plainSetupOutcome.problems, "");
  assert.notEqual(await held(plainSetupOutcome.held, ".cw/settings.json"), undefined);
});

test("cw init in a folder with no version control sets the charter up and builds it as in a git repository, file for file (CORE Story 35 scenario 1, CORE-FR-054, CORE Story 55 scenario 8)", async (t) => {
  const workFolderPath = await mkdtemp(join(tmpdir(), "cw-init-anywhere-"));
  t.after(() => rm(workFolderPath, { recursive: true, force: true }));
  // `pnpm test` builds this tree first: dist/ is what its source builds to.
  const cwFilePath = fileURLToPath(new URL("../dist/cw.js", import.meta.url));
  const commandEnv = { ...process.env, HOME: join(workFolderPath, "home"), NO_COLOR: "1" };
  const setUpIn = async (folderName: string, isUnderGit: boolean) => {
    const folderPath = join(workFolderPath, folderName);
    await mkdir(folderPath, { recursive: true });
    if (isUnderGit) assert.equal(spawnSync("git", ["init", "--quiet"], { cwd: folderPath }).status, 0);
    const initRun = spawnSync(process.execPath, [cwFilePath, "init", "--agent", "claude"], {
      cwd: folderPath,
      env: commandEnv,
      input: "",
      encoding: "utf8",
    });
    const setUpFiles = (await readdir(folderPath, { recursive: true, withFileTypes: true }))
      .filter((dirent) => dirent.isFile())
      .map((dirent) => relative(folderPath, join(dirent.parentPath, dirent.name)))
      .filter((setUpFilePath) => !setUpFilePath.startsWith(".git/"))
      .sort();
    const setUpTextByPath = Object.fromEntries(
      await Promise.all(
        setUpFiles.map(async (setUpFilePath) => [
          setUpFilePath,
          await readFile(join(folderPath, setUpFilePath), "utf8"),
        ]),
      ),
    );
    return { status: initRun.status, stdout: initRun.stdout, stderr: initRun.stderr, setUpTextByPath };
  };

  const plainSetUp = await setUpIn("plain", false);
  const gitSetUp = await setUpIn("git", true);

  assert.equal(plainSetUp.status, 0, plainSetUp.stderr);
  assert.equal(plainSetUp.stderr, "");
  assert.match(plainSetUp.stdout, /Built \d+ files/);
  assert.ok(".cw/out/catalogue.json" in plainSetUp.setUpTextByPath, "the charter is built");
  assert.ok(".claude/skills/cw-author/SKILL.md" in plainSetUp.setUpTextByPath, "the agent can already author");
  assert.deepEqual(plainSetUp, gitSetUp);
});

test("setting up at a terminal with no agent chosen yet offers every agent, none of them ticked (CORE-FR-055, CORE Story 55 scenario 9)", async (t) => {
  // A terminal of a test's own, where a person presses return with nothing
  // ticked, then stops setup.
  const terminalInput = Object.assign(new PassThrough(), { isTTY: true, setRawMode: () => terminalInput });
  const processStdinDescriptor = Object.getOwnPropertyDescriptor(process, "stdin");
  Object.defineProperty(process, "stdin", { value: terminalInput, configurable: true });
  t.after(() => {
    if (processStdinDescriptor !== undefined) Object.defineProperty(process, "stdin", processStdinDescriptor);
  });
  terminalInput.write("\r\x03");

  const { code, held: files, results } = await setUp({}, ["init"], ["claude", "codex"]);

  // What the terminal showed, its colours and cursor moves taken out: an
  // unticked agent is drawn ◯, a ticked one ◉.
  const shownText = results.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[A-Za-z]`, "g"), "");
  assert.match(shownText, /Which agents does this repository choose\?/);
  for (const agentProviderName of ["claude", "codex"])
    assert.match(shownText, new RegExp(`^◯ +${agentProviderName}\\b`, "m"), agentProviderName);
  assert.doesNotMatch(shownText, /◉/);
  // A return with nothing ticked is no answer.
  assert.match(shownText, /You must select a minimum of 1 choices/);
  assert.equal(code, EXIT_FAILURE);
  assert.equal(await held(files, ".cw/settings.json"), undefined);
});

test("setting up again at a terminal offers what the repository chose before as the default, and a return keeps it with nothing authored discarded (CORE Story 1 scenario 5, FR-038, CORE-FR-055, CORE Story 55 scenario 8)", async (t) => {
  // A terminal of a test's own: the prompt reads keys from it as from a
  // person, who here only presses return.
  const terminalInput = Object.assign(new PassThrough(), { isTTY: true, setRawMode: () => terminalInput });
  const processStdinDescriptor = Object.getOwnPropertyDescriptor(process, "stdin");
  Object.defineProperty(process, "stdin", { value: terminalInput, configurable: true });
  t.after(() => {
    if (processStdinDescriptor !== undefined) Object.defineProperty(process, "stdin", processStdinDescriptor);
  });
  terminalInput.write("\r");
  const authoredGuidePath = ".cw/charter/primitive/guide/no-any/index.md";
  const authoredGuideText =
    '---\nkind: guide\nid: no-any\ndescription: No any.\nglobs: ["src/**/*.ts"]\n---\n\nBody.\n';

  const {
    code,
    held: files,
    results,
  } = await setUp({
    [new URL(".cw/settings.json", repoPath).href]: `${JSON.stringify({ agents: ["codex"] }, undefined, 2)}\n`,
    [new URL(authoredGuidePath, repoPath).href]: authoredGuideText,
  });

  assert.equal(code, 0);
  assert.match(results, /Which agents does this repository choose\?/, "the agent was asked at the terminal");
  assert.deepEqual(JSON.parse((await held(files, ".cw/settings.json")) ?? ""), { agents: ["codex"] });
  assert.match(results, /^Agents chosen: {2}codex\.$/m);
  assert.equal(await held(files, authoredGuidePath), authoredGuideText);
});
