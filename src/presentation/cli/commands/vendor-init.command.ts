import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import prompts from "prompts";
import changelogMd from "../templates/vendor-init-command/CHANGELOG.md";
import gitignoreTxt from "../templates/vendor-init-command/gitignore.txt";
import readmeMd from "../templates/vendor-init-command/README.md";
import vendorReleaseSkillMd from "../templates/vendor-init-command/vendor-release.skill.md";
import vendorReleaseActionMjs from "../templates/vendor-init-command/vendor-release-action.mjs";
import vendorReleaseActionScriptMd from "../templates/vendor-init-command/vendor-release-action.script.md";
import { type Command, type Context, EXIT_FAILURE, EXIT_OK, type Outcome } from "./command.interface.js";
import { formatHeading, formatMention, formatStatusLine, printProblem, refuseCommand, reportFault } from "./helper.js";

/** Every file `cw vendor init` writes, by its path from the folder's root, as
 *  its template holds it: README.md's `{{name}}` and `{{description}}` are
 *  the author's answers. */
const TEMPLATE_TEXT_BY_PATH: Readonly<Record<string, string>> = {
  "README.md": readmeMd,
  "CHANGELOG.md": changelogMd,
  ".gitignore": gitignoreTxt,
  "charters/.gitkeep": "",
  ".cw/charter/primitive/skill/vendor-release/index.md": vendorReleaseSkillMd,
  ".cw/charter/primitive/script/vendor-release-action/index.md": vendorReleaseActionScriptMd,
  ".cw/charter/primitive/script/vendor-release-action/vendor-release-action.mjs": vendorReleaseActionMjs,
};

/** What a stop after `cw init` ran ends on: the folder holds what was
 *  written, so a second run would be refused as not empty. */
const HALF_SET_UP_LINE = 'The folder is left half set up: empty it, then run "cw vendor init" again.';

/**
 * `cw vendor init`: set a charter repository up in an empty folder, every
 * step of it fixed, none of it an agent's.
 *
 * The folder must hold nothing but, at most, a `.git` with no commit, and
 * someone must be at the terminal: every answer is asked there, and none is
 * taken from a flag. The README's name, the folder's by default, and its
 * description are asked first. Then `cw init` runs here, asking the agent as
 * it always does; the folder is made a git repository on
 * `main` where it has no `.git`; the template is copied in — README,
 * changelog, `.gitignore`, `charters/`, and `/vendor-release` with the script
 * it runs in the root's charter — and `cw build` runs. Nothing is committed.
 */
export class VendorInitCommand implements Command {
  readonly name = "vendor init";
  readonly summary = "Set a charter vendor repository up in an empty folder, to publish charters from";

  async runCommand({ cwd, isAtTerminal }: Context): Promise<Outcome> {
    // Git, run here and never through a shell: `isMissing` where it is not
    // installed.
    const runGit = (gitArgs: readonly string[]) => {
      const gitRun = spawnSync("git", gitArgs, { cwd, encoding: "utf8" });
      return { isMissing: gitRun.error !== undefined, status: gitRun.status ?? 1, stdout: gitRun.stdout ?? "" };
    };

    const folderEntryNames = readdirSync(cwd);
    const heldEntryNames = folderEntryNames.filter((entryName) => entryName !== ".git").sort();
    if (heldEntryNames.length > 0)
      return reportFault(
        refuseCommand(
          "OccupiedFolderFault",
          `This folder holds ${heldEntryNames.join(", ")}, and a charter repository is set up in an empty one.`,
          `Run "cw vendor init" in an empty folder.`,
        ),
      );
    const hasGit = folderEntryNames.includes(".git");
    if (hasGit && runGit(["rev-list", "-n", "1", "--all"]).stdout.trim() !== "")
      return reportFault(
        refuseCommand(
          "CommittedFolderFault",
          "This folder is a git repository with a commit, and a charter repository is set up in one with none.",
          'Run "cw vendor init" in an empty folder.',
        ),
      );

    // Past this, nothing runs with `--json`: nobody is at the terminal to
    // answer, so what follows answers in words alone (CORE-FR-242).
    if (!isAtTerminal)
      return reportFault(
        refuseCommand(
          "NoTerminalFault",
          "Nobody is at the terminal to answer what a charter repository is set up with.",
          'Run "cw vendor init" at a terminal.',
        ),
      );

    // The README's answers, before anything is written: a stop here leaves
    // the folder as it was.
    const { repositoryName, repositoryDescription } = await prompts(
      [
        { type: "text", name: "repositoryName", message: "What is the repository called?", initial: basename(cwd) },
        {
          type: "text",
          name: "repositoryDescription",
          message: "What do its charters give a repository, and why would a team install them?",
        },
      ],
      // Stopped at either question, nothing is asked after it.
      { onCancel: () => false },
    );
    if (typeof repositoryName !== "string" || typeof repositoryDescription !== "string")
      return {
        exitCode: EXIT_FAILURE,
        problemText: printProblem("Setup was stopped before it had its answers.", 'Run "cw vendor init" again.'),
      };
    for (const [answerLabel, answerText] of [
      ["name", repositoryName.trim()],
      ["description", repositoryDescription.trim()],
    ] as const)
      if (answerText === "" || answerText.includes("\n"))
        return {
          exitCode: EXIT_FAILURE,
          problemText: printProblem(
            `The repository's ${answerLabel} is ${answerText === "" ? "empty" : "more than one line"}, and the README is filled with one line of it.`,
            `Run "cw vendor init" again, giving its ${answerLabel} as one line.`,
          ),
        };

    // cw itself, run here as the developer would run it, so `cw init` asks
    // the agent as it always does.
    const runCw = (cwArgs: readonly string[]) =>
      spawnSync(process.execPath, [...process.execArgv, process.argv[1] ?? "", ...cwArgs], { cwd, stdio: "inherit" })
        .status ?? 1;
    if (runCw(["init"]) !== 0) return { exitCode: EXIT_FAILURE, problemText: printProblem(HALF_SET_UP_LINE) };

    if (!hasGit) {
      const initRun = runGit(["init", "--quiet"]);
      if (initRun.isMissing)
        return {
          exitCode: EXIT_FAILURE,
          problemText: printProblem("git is not installed here: install it.", HALF_SET_UP_LINE),
        };
      if (initRun.status !== 0 || runGit(["symbolic-ref", "HEAD", "refs/heads/main"]).status !== 0)
        return {
          exitCode: EXIT_FAILURE,
          problemText: printProblem("git could not make this folder a repository.", HALF_SET_UP_LINE),
        };
    }

    for (const [templatePath, templateText] of Object.entries(TEMPLATE_TEXT_BY_PATH)) {
      const filePath = join(cwd, templatePath);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(
        filePath,
        templateText
          .replaceAll("{{name}}", repositoryName.trim())
          .replaceAll("{{description}}", repositoryDescription.trim()),
      );
    }
    if (runCw(["build"]) !== 0) return { exitCode: EXIT_FAILURE, problemText: printProblem(HALF_SET_UP_LINE) };

    return {
      exitCode: EXIT_OK,
      resultText: [
        formatHeading(
          formatStatusLine("good", `Set up ${repositoryName.trim()} as a charter repository, with nothing committed.`),
        ),
        `Set each charter up under ${formatMention("charters/<name>/")} with "cw init" there, commit, push, then ask your agent "/vendor-release" at the root.`,
        "",
      ].join("\n"),
    };
  }
}
