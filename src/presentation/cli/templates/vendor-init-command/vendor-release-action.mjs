#!/usr/bin/env node
// The steps of /vendor-release a script takes, run from the root of a charter
// repository `cw vendor init` set up, one publishing its charters from
// charters/<name>/:
//
//   node vendor-release-action.mjs check [--branch <name>]       the release branch ready, each charter under charters/ built
//   node vendor-release-action.mjs readme                        README.md's install and charters section composed from what each charter holds
//   node vendor-release-action.mjs draft                         the last release, the versions after it, what landed since
//   node vendor-release-action.mjs publish <version> <entry-file> [--date yyyy-mm-dd] [--branch <name>]
//                                                         the entry written, committed, the release branch pushed, the tag made and pushed
//
// Which version, and what the entry says, are the agent's to judge and the
// user's to confirm: this script decides neither. It never force-pushes, and
// never moves or deletes a tag.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CHANGELOG_FILE = "CHANGELOG.md";
const CHANGELOG_HEADING = "# Changelog";
const CHARTERS_FOLDER = "charters";
const README_FILE = "README.md";
const README_START_MARKER = "<!-- vendor-release-action: charters -->";
const README_END_MARKER = "<!-- /vendor-release-action: charters -->";
const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

/** One run of a command, never through a shell. */
function runCommand(command, args, cwd) {
  const commandRun = spawnSync(command, args, { cwd, encoding: "utf8" });
  return {
    isMissing: commandRun.error?.code === "ENOENT",
    status: commandRun.status ?? 1,
    stdout: commandRun.stdout ?? "",
    stderr: commandRun.stderr ?? "",
  };
}

/** What a failed command said last, the line that decides why it failed. */
function decisiveLineOf(commandRun) {
  const outputLines = `${commandRun.stdout}\n${commandRun.stderr}`.split("\n").filter((line) => line.trim() !== "");
  return outputLines.at(-1)?.trim() ?? `exit ${commandRun.status}`;
}

function stopRelease(...lines) {
  process.stderr.write(`${lines.join("\n")}\n`);
  process.exit(1);
}

function runGit(args) {
  const gitRun = runCommand("git", args, process.cwd());
  if (gitRun.isMissing) stopRelease("git is not installed here: install it, then ask /vendor-release again.");
  return gitRun;
}

function todayDate() {
  const currentDate = new Date();
  return [currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate()].map((datePart) => String(datePart).padStart(2, "0")).join("-");
}

function parseVersion(versionText) {
  const versionMatch = VERSION_PATTERN.exec(versionText);
  return versionMatch === null ? undefined : versionMatch.slice(1).map(Number);
}

function compareVersions(leftParts, rightParts) {
  for (const [partIndex, leftPart] of leftParts.entries())
    if (leftPart !== rightParts[partIndex]) return leftPart - rightParts[partIndex];
  return 0;
}

/** The highest `v<version>` tag, or none. */
function findLastVersion() {
  const tagVersions = runGit(["tag", "--list", "v*"])
    .stdout.split("\n")
    .map((tagName) => tagName.trim().slice(1))
    .filter((tagVersion) => parseVersion(tagVersion) !== undefined)
    .sort((leftVersion, rightVersion) => compareVersions(parseVersion(leftVersion), parseVersion(rightVersion)));
  return tagVersions.at(-1);
}

function readChangelog() {
  if (!existsSync(CHANGELOG_FILE)) stopRelease(`There is no ${CHANGELOG_FILE} at the repository's root.`);
  return readFileSync(CHANGELOG_FILE, "utf8");
}

/** Each folder under charters/ holding a charter, by name. */
function listCharterNames() {
  return existsSync(CHARTERS_FOLDER)
    ? readdirSync(CHARTERS_FOLDER, { withFileTypes: true })
        .filter((folderEntry) => folderEntry.isDirectory())
        .map((folderEntry) => folderEntry.name)
        .filter((charterName) => existsSync(join(CHARTERS_FOLDER, charterName, ".cw", "charter")))
        .sort()
    : [];
}

/** The branch a release is made from: origin's default branch, the one its
 *  HEAD names, whatever it is called — main, develop or another. Where origin
 *  names none — there is no origin, or it holds no commit yet — it is never
 *  guessed: the user confirms one, passed as --branch. */
function findReleaseBranch(confirmedBranch) {
  const defaultBranch = /^ref: refs\/heads\/(\S+)\tHEAD$/m.exec(
    runGit(["ls-remote", "--symref", "origin", "HEAD"]).stdout,
  )?.[1];
  if (defaultBranch !== undefined) {
    if (confirmedBranch !== undefined && confirmedBranch !== defaultBranch)
      stopRelease(
        `origin's default branch is "${defaultBranch}", not "${confirmedBranch}": a release is made from ${defaultBranch} alone.`,
      );
    return defaultBranch;
  }
  if (confirmedBranch === undefined || confirmedBranch === "")
    stopRelease(
      `Unsure which branch to release from: origin names no default branch yet. The branch stood on is "${runGit(["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim()}".`,
      "Ask the user which branch releases are made from, then run this again with --branch <name>.",
    );
  return confirmedBranch;
}

function checkRelease(confirmedBranch) {
  const releaseBranch = findReleaseBranch(confirmedBranch);
  const branchName = runGit(["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
  if (branchName !== releaseBranch)
    stopRelease(`On branch "${branchName}", not "${releaseBranch}": a release is made from ${releaseBranch} alone, origin's default branch.`);
  const changedPaths = runGit(["status", "--porcelain"]).stdout.split("\n").filter((line) => line.trim() !== "");
  if (changedPaths.length > 0)
    stopRelease(
      "The working tree is not clean: commit or put away what is changed first.",
      ...changedPaths.slice(0, 10).map((line) => `  ${line}`),
    );
  if (runGit(["remote", "get-url", "origin"]).status !== 0)
    stopRelease(`${releaseBranch} has no origin to push to: add one with "git remote add origin <address>".`);
  const remoteBranchRun = runGit(["ls-remote", "--heads", "origin", releaseBranch]);
  if (remoteBranchRun.status !== 0) stopRelease(`origin could not be reached: ${decisiveLineOf(remoteBranchRun)}`);
  if (remoteBranchRun.stdout.trim() !== "") {
    const fetchRun = runGit(["fetch", "--quiet", "origin", releaseBranch]);
    if (fetchRun.status !== 0) stopRelease(`origin/${releaseBranch} could not be fetched: ${decisiveLineOf(fetchRun)}`);
    const [aheadCount, behindCount] = runGit([
      "rev-list",
      "--left-right",
      "--count",
      `${releaseBranch}...origin/${releaseBranch}`,
    ])
      .stdout.trim()
      .split(/\s+/)
      .map(Number);
    if (behindCount > 0 && aheadCount > 0)
      stopRelease(`${releaseBranch} has diverged from origin/${releaseBranch}: bring them together first.`);
    if (behindCount > 0)
      stopRelease(`${releaseBranch} is ${behindCount} commit(s) behind origin/${releaseBranch}: pull first.`);
  }
  const charterNames = listCharterNames();
  if (charterNames.length === 0) stopRelease(`There is no charter under ${CHARTERS_FOLDER}/ to release.`);
  // Each charter in its own folder, never the root, whose charter is the
  // authors' own.
  for (const charterName of charterNames) {
    const buildRun = runCommand("cw", ["build"], join(CHARTERS_FOLDER, charterName));
    if (buildRun.isMissing) stopRelease("cw is not installed here: install it, then ask /vendor-release again.");
    if (buildRun.status !== 0)
      stopRelease(`${CHARTERS_FOLDER}/${charterName} does not build: ${decisiveLineOf(buildRun)}`);
  }
  process.stdout.write(
    `Ready: ${releaseBranch} is clean and not behind origin/${releaseBranch}; built ${charterNames.map((charterName) => `${CHARTERS_FOLDER}/${charterName}`).join(", ")}.\n`,
  );
}

/** Rewrites the section of README.md between its markers: how to install
 *  every charter, then per charter, how to install it alone and the skills it
 *  holds, cw's own skills left out. The source is read off origin. A skill is
 *  the charter's when its source is under the charter's `.cw/charter/`,
 *  authored there or vendored; cw's own are built into `.cw/out/` alone. */
function composeReadme() {
  if (!existsSync(README_FILE)) stopRelease(`There is no ${README_FILE} at the repository's root.`);
  const readmeText = readFileSync(README_FILE, "utf8");
  const startIndex = readmeText.indexOf(README_START_MARKER);
  const endIndex = readmeText.indexOf(README_END_MARKER);
  if (startIndex === -1 || endIndex < startIndex)
    stopRelease(
      `${README_FILE} holds no "${README_START_MARKER}" … "${README_END_MARKER}" section: put both lines where the install and the charters are listed.`,
    );
  const originUrl = runGit(["remote", "get-url", "origin"]).stdout.trim();
  const sourceName =
    /[:/]([^/:]+\/[^/]+?)(?:\.git)?\/?$/.exec(originUrl)?.[1] ?? "<owner>/<repository>";
  const charterNames = listCharterNames();
  const charterSections = charterNames.map((charterName) => {
    const charterFolderPath = join(CHARTERS_FOLDER, charterName, ".cw");
    const cataloguePath = join(charterFolderPath, "out", "catalogue.json");
    if (!existsSync(cataloguePath))
      stopRelease(`${CHARTERS_FOLDER}/${charterName} is not built: run "vendor-release-action.mjs check" first.`);
    const sourceSkillIds = new Set(
      readdirSync(join(charterFolderPath, "charter"), { recursive: true })
        .map((sourcePath) => /(?:^|[\\/])skill[\\/]([^\\/]+)[\\/]index\.md$/.exec(String(sourcePath))?.[1])
        .filter((skillId) => skillId !== undefined),
    );
    const charterSkills = JSON.parse(readFileSync(cataloguePath, "utf8"))
      .filter((catalogueEntry) => catalogueEntry.kind === "skill" && sourceSkillIds.has(catalogueEntry.id))
      .sort((leftSkill, rightSkill) => leftSkill.id.localeCompare(rightSkill.id));
    const skillLines =
      charterSkills.length === 0
        ? ["It holds no skill: what it brings applies without being asked for."]
        : [
            "| Ask your agent | What it does |",
            "|---|---|",
            ...charterSkills.map(({ id, description }) => `| \`/${id}\` | ${description.replace(/\|/g, "\\|")} |`),
          ];
    return [
      `### ${charterName}`,
      "",
      "```bash",
      `cw vendor add ${sourceName} --charter ${charterName}`,
      "cw build",
      "```",
      "",
      ...skillLines,
    ].join("\n");
  });
  const sectionText = [
    "## Install",
    "",
    "```bash",
    `cw vendor add ${sourceName}`,
    "cw build",
    "```",
    "",
    "Or pick the charters you want with `--charter <name>`, once for each.",
    "",
    "## Charters",
    "",
    ...(charterSections.length === 0 ? ["None yet."] : [charterSections.join("\n\n")]),
  ].join("\n");
  const composedText = `${readmeText.slice(0, startIndex + README_START_MARKER.length)}\n${sectionText}\n${readmeText.slice(endIndex)}`;
  if (composedText !== readmeText) writeFileSync(README_FILE, composedText);
  process.stdout.write(
    `${README_FILE} ${composedText === readmeText ? "already lists" : "now lists"} ${charterNames.length === 0 ? "no charter" : charterNames.map((charterName) => `${CHARTERS_FOLDER}/${charterName}`).join(", ")}.\n`,
  );
}

function draftRelease() {
  const lastVersion = findLastVersion();
  // The version of the changelog's first `## <version> — <date>` heading.
  const changelogVersion = /^## (\d+\.\d+\.\d+) — /m.exec(readChangelog())?.[1];
  if (changelogVersion !== lastVersion)
    stopRelease(
      `The last tag is ${lastVersion === undefined ? "none" : `v${lastVersion}`}, and the top heading of ${CHANGELOG_FILE} is ${changelogVersion ?? "none"}: they must name the same release.`,
    );
  const logRange = lastVersion === undefined ? ["HEAD"] : [`v${lastVersion}..HEAD`];
  const landedCommits = runGit(["log", "--format=%h %s", ...logRange])
    .stdout.split("\n")
    .filter((line) => line.trim() !== "");
  if (landedCommits.length === 0) {
    process.stdout.write(
      lastVersion === undefined
        ? "Nothing to release: no commit yet.\n"
        : `Nothing to release: no commit since v${lastVersion}.\n`,
    );
    return;
  }
  const draftLines = [`Last release: ${lastVersion === undefined ? "none" : `v${lastVersion}`}`];
  if (lastVersion === undefined) draftLines.push("Version: 0.1.0");
  else {
    const [majorPart, minorPart, patchPart] = parseVersion(lastVersion);
    draftLines.push(
      `Patch: ${majorPart}.${minorPart}.${patchPart + 1}`,
      `Minor, where what landed breaks a repository already installing a charter: ${majorPart}.${minorPart + 1}.0`,
    );
    const changedPaths = runGit(["diff", "--name-status", `v${lastVersion}..HEAD`, "--", CHARTERS_FOLDER])
      .stdout.split("\n")
      .filter((line) => /^(D|R)/.test(line));
    if (changedPaths.length > 0)
      draftLines.push(
        "Removed or renamed under charters/:",
        ...changedPaths.map((line) => `  ${line.replace(/\t/g, " ")}`),
      );
  }
  draftLines.push(`Date: ${todayDate()}`, "Landed:", ...landedCommits.map((line) => `  ${line}`));
  process.stdout.write(`${draftLines.join("\n")}\n`);
}

function publishRelease(versionText, entryFilePath, dateText, confirmedBranch) {
  const releaseBranch = findReleaseBranch(confirmedBranch);
  if (parseVersion(versionText ?? "") === undefined) stopRelease(`"${versionText}" is no version: name one as 1.2.3.`);
  if (entryFilePath === undefined || !existsSync(entryFilePath)) stopRelease("Name the file holding the entry.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) stopRelease(`"${dateText}" is no date: name one as yyyy-mm-dd.`);
  const tagName = `v${versionText}`;
  if (runGit(["rev-parse", "--quiet", "--verify", `refs/tags/${tagName}`]).status === 0)
    stopRelease(`${tagName} is already a tag, and a tag is never moved.`);
  const lastVersion = findLastVersion();
  if (lastVersion !== undefined && compareVersions(parseVersion(versionText), parseVersion(lastVersion)) <= 0)
    stopRelease(`${versionText} is not after the last release, v${lastVersion}.`);
  const branchName = runGit(["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
  if (branchName !== releaseBranch)
    stopRelease(`On branch "${branchName}", not "${releaseBranch}": a release is made from ${releaseBranch} alone, origin's default branch.`);
  const changelogText = readChangelog();
  if (!changelogText.startsWith(`${CHANGELOG_HEADING}\n`))
    stopRelease(`${CHANGELOG_FILE} does not open with "${CHANGELOG_HEADING}".`);

  // The release commits the entry, what the builds of check changed and the
  // README readme composed, and nothing else changed since.
  const strayPaths = runGit(["status", "--porcelain"])
    .stdout.split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => line.slice(3))
    .filter(
      (changedPath) =>
        changedPath !== CHANGELOG_FILE &&
        changedPath !== README_FILE &&
        !changedPath.startsWith(`${CHARTERS_FOLDER}/`),
    );
  if (strayPaths.length > 0)
    stopRelease(
      `Changed since check, outside ${CHARTERS_FOLDER}/, ${README_FILE} and ${CHANGELOG_FILE}: commit or put them away first.`,
      ...strayPaths.slice(0, 10).map((strayPath) => `  ${strayPath}`),
    );
  const entryText = readFileSync(entryFilePath, "utf8").trim();
  const releaseMessage = `release ${tagName}`;
  const releaseSteps = [
    {
      name: `write the entry into ${CHANGELOG_FILE}`,
      finishCommand: `edit ${CHANGELOG_FILE}`,
      runStep: () => {
        const restText = changelogText.slice(CHANGELOG_HEADING.length).replace(/^\n+/, "");
        writeFileSync(
          CHANGELOG_FILE,
          `${CHANGELOG_HEADING}\n\n## ${versionText} — ${dateText}\n\n${entryText}\n${restText === "" ? "" : `\n${restText}`}`,
        );
        return { status: 0, stdout: "", stderr: "" };
      },
    },
    {
      name: "commit",
      finishCommand: `git add -A -- ${CHANGELOG_FILE} ${README_FILE} ${CHARTERS_FOLDER}/ && git commit -m "${releaseMessage}"`,
      runStep: () => {
        const addRun = runGit(["add", "-A", "--", CHANGELOG_FILE, README_FILE, `${CHARTERS_FOLDER}/`]);
        return addRun.status === 0 ? runGit(["commit", "--quiet", "-m", releaseMessage]) : addRun;
      },
    },
    {
      name: `push ${releaseBranch}`,
      finishCommand: `git push origin ${releaseBranch}`,
      runStep: () => runGit(["push", "--quiet", "origin", releaseBranch]),
    },
    {
      name: `tag ${tagName}`,
      finishCommand: `git tag -a ${tagName} -m "${releaseMessage}"`,
      runStep: () => runGit(["tag", "-a", tagName, "-m", releaseMessage]),
    },
    {
      name: `push ${tagName}`,
      finishCommand: `git push origin ${tagName}`,
      runStep: () => runGit(["push", "--quiet", "origin", tagName]),
    },
  ];
  for (const [stepIndex, releaseStep] of releaseSteps.entries()) {
    const stepRun = releaseStep.runStep();
    if (stepRun.status !== 0) {
      const ranSteps = releaseSteps.slice(0, stepIndex).map(({ name }) => name);
      stopRelease(
        `Stopped at "${releaseStep.name}": ${decisiveLineOf(stepRun)}`,
        `Ran: ${ranSteps.length === 0 ? "nothing" : ranSteps.join(", ")}.`,
        `To finish: ${releaseSteps
          .slice(stepIndex)
          .map(({ finishCommand }) => finishCommand)
          .join(" && ")}`,
      );
    }
  }
  process.stdout.write(`Released ${tagName}: ${releaseMessage} committed, ${releaseBranch} and ${tagName} pushed.\n`);
}

const topLevelRun = runGit(["rev-parse", "--show-toplevel"]);
if (topLevelRun.status !== 0) stopRelease("This is not a git repository.");
process.chdir(topLevelRun.stdout.trim());

const [actionName, ...actionArgs] = process.argv.slice(2);
// Each --<flag> <value> pair taken out, the rest left in order.
const flagValueByName = {};
const positionalArgs = [];
for (let argIndex = 0; argIndex < actionArgs.length; argIndex++) {
  const actionArg = actionArgs[argIndex];
  if (actionArg.startsWith("--")) flagValueByName[actionArg.slice(2)] = actionArgs[++argIndex] ?? "";
  else positionalArgs.push(actionArg);
}
if (actionName === "check") checkRelease(flagValueByName.branch);
else if (actionName === "readme") composeReadme();
else if (actionName === "draft") draftRelease();
else if (actionName === "publish")
  publishRelease(positionalArgs[0], positionalArgs[1], flagValueByName.date ?? todayDate(), flagValueByName.branch);
else
  stopRelease(
    "Run it as: vendor-release-action.mjs check [--branch <name>] | readme | draft | publish <version> <entry-file> [--date yyyy-mm-dd] [--branch <name>]",
  );
