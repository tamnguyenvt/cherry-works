#!/usr/bin/env node
// The steps of /charter-release a script takes, run from the root of any
// repository publishing the charters it authored under .cw/charter/<name>/:
//
//   node charter-release-action.mjs check [--branch <name>]       the release branch ready, every charter built at the root
//   node charter-release-action.mjs readme                        README.md's install and charters section composed from what each charter holds
//   node charter-release-action.mjs draft [--version x.y.z] [--date yyyy-mm-dd]
//                                                         the last release, the versions after it, what landed since; a version or date given refused as publish would
//   node charter-release-action.mjs publish <version> <entry-file> [--date yyyy-mm-dd] [--branch <name>]
//                                                         the entry written, committed, the release branch pushed, the tag made and pushed
//
// Which version, and what the entry says, are the agent's to judge and the
// user's to confirm: this script decides neither. It never force-pushes, and
// never moves or deletes a tag.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Kept with the charters, apart from a changelog the repository keeps of its
// own at its root, which a release never reads (VENDOR-FR-007).
const CHANGELOG_FILE = ".cw/CHANGELOG.md";
// A branch name holding no space and no character a shell reads as more than
// a word.
const BRANCH_PATTERN = /^[^\s;&|$`'"\\<>(){}*?!~#]+$/;
const CHANGELOG_HEADING = "# Changelog";
const CHARTER_FOLDER = ".cw/charter";
const CATALOGUE_FILE = ".cw/out/catalogue.json";
const README_FILE = "README.md";
const README_START_MARKER = "<!-- charter-release-action: charters -->";
const README_END_MARKER = "<!-- /charter-release-action: charters -->";
const INSTALLED_CHARTER_RECORD_FILE = "cw-package.json";
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
  if (gitRun.isMissing) stopRelease("git is not installed here: install it, then ask /charter-release again.");
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

/** The changelog's text; one holding no release where there is none yet,
 *  which publish writes (VENDOR-FR-007). */
function readChangelog() {
  return existsSync(CHANGELOG_FILE) ? readFileSync(CHANGELOG_FILE, "utf8") : `${CHANGELOG_HEADING}\n`;
}

/** Each charter the repository authored, by name: a folder under
 *  .cw/charter/ that git holds, with no cw-package.json, which one installed
 *  holds. What git does not hold is in no commit an install takes. */
function listCharterNames() {
  const trackedPaths = runGit(["ls-files", "--", CHARTER_FOLDER])
    .stdout.split("\n")
    // A file inside a charter's folder, never one beside them, as `.gitkeep`.
    .filter((trackedPath) => trackedPath.startsWith(`${CHARTER_FOLDER}/`) && trackedPath.split("/").length > 3);
  const charterNames = new Set(trackedPaths.map((trackedPath) => trackedPath.split("/")[2]));
  return [...charterNames]
    .filter((charterName) => !trackedPaths.includes(`${CHARTER_FOLDER}/${charterName}/${INSTALLED_CHARTER_RECORD_FILE}`))
    .sort();
}

/** The branch a release is made from: origin's default branch, the one its
 *  HEAD names, whatever it is called — main, develop or another. Where origin
 *  names none — it holds no commit yet — it is never guessed: the user
 *  confirms one, passed as --branch. An origin that cannot be reached is said
 *  as it is. */
function findReleaseBranch(confirmedBranch) {
  const originHeadRun = runGit(["ls-remote", "--symref", "origin", "HEAD"]);
  if (originHeadRun.status !== 0) stopRelease(`origin could not be reached: ${decisiveLineOf(originHeadRun)}`);
  const defaultBranch = /^ref: refs\/heads\/(\S+)\tHEAD$/m.exec(originHeadRun.stdout)?.[1];
  if (defaultBranch !== undefined) {
    if (confirmedBranch !== undefined && confirmedBranch !== defaultBranch)
      stopRelease(
        `origin's default branch is "${defaultBranch}", not "${confirmedBranch}": a release is made from ${defaultBranch} alone.`,
      );
  } else if (confirmedBranch === undefined || confirmedBranch === "")
    stopRelease(
      `Unsure which branch to release from: origin names no default branch yet. The branch stood on is "${runGit(["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim()}".`,
      "Ask the user which branch releases are made from, then run this again with --branch <name>.",
    );
  const releaseBranch = defaultBranch ?? confirmedBranch;
  // The lines printed to finish a release name it as it is: a name a shell
  // would read as more than a branch never reaches them.
  if (!BRANCH_PATTERN.test(releaseBranch))
    stopRelease(`"${releaseBranch}" is no branch a release is made from: name one with no space and none of ; & | $ \` ' " \\ < > ( ) { } * ? ! ~ #.`);
  return releaseBranch;
}

function checkRelease(confirmedBranch) {
  const branchName = runGit(["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
  // No origin is said as it is, before any branch is asked of the user.
  if (runGit(["remote", "get-url", "origin"]).status !== 0)
    stopRelease(`${branchName} has no origin to push to: add one with "git remote add origin <address>".`);
  const releaseBranch = findReleaseBranch(confirmedBranch);
  if (branchName !== releaseBranch)
    stopRelease(`On branch "${branchName}", not "${releaseBranch}": a release is made from ${releaseBranch} alone, origin's default branch.`);
  const changedPaths = runGit(["status", "--porcelain"]).stdout.split("\n").filter((line) => line.trim() !== "");
  if (changedPaths.length > 0)
    stopRelease(
      "The working tree is not clean: commit or put away what is changed first.",
      ...changedPaths.slice(0, 10).map((line) => `  ${line}`),
    );
  // A file the repository keeps off git builds here and is in no commit an
  // install takes. What this machine alone ignores, a desktop's leftovers, is
  // none of the repository's.
  const excludeFilePath = runGit(["rev-parse", "--git-path", "info/exclude"]).stdout.trim();
  const ignoredPaths = runGit([
    "ls-files",
    "--others",
    "--ignored",
    "--exclude-per-directory=.gitignore",
    ...(existsSync(excludeFilePath) ? [`--exclude-from=${excludeFilePath}`] : []),
    "--",
    CHARTER_FOLDER,
  ])
    .stdout.split("\n")
    .filter((line) => line.trim() !== "");
  if (ignoredPaths.length > 0)
    stopRelease(
      `git ignores these files under ${CHARTER_FOLDER}/, and no install would hold them: commit them, or take them away.`,
      ...ignoredPaths.slice(0, 10).map((ignoredPath) => `  ${ignoredPath}`),
    );
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
  if (charterNames.length === 0) stopRelease(`There is no charter under ${CHARTER_FOLDER}/ to release.`);
  // Built at the root: no primitive may hold or name what cw builds into every
  // repository to release charters, so a charter building here builds with the
  // charters it includes alone, wherever it is installed.
  const buildRun = runCommand("cw", ["build"], process.cwd());
  if (buildRun.isMissing) stopRelease("cw is not installed here: install it, then ask /charter-release again.");
  if (buildRun.status !== 0) {
    const buildOutputLines = `${buildRun.stdout}\n${buildRun.stderr}`.split("\n").filter((line) => line.trim() !== "");
    // Every charter held, installed ones too, is named where the build names
    // its files (VENDOR-FR-005).
    const heldCharterNames = readdirSync(CHARTER_FOLDER, { withFileTypes: true })
      .filter((charterEntry) => charterEntry.isDirectory())
      .map((charterEntry) => charterEntry.name);
    const brokenCharterNames = heldCharterNames.filter((charterName) =>
      buildOutputLines.some((line) => line.includes(`${CHARTER_FOLDER}/${charterName}/`)),
    );
    stopRelease(
      brokenCharterNames.length === 0
        ? "The charters do not build:"
        : `${brokenCharterNames.map((charterName) => `"${charterName}"`).join(", ")} ${brokenCharterNames.length === 1 ? "does not build with the charters it includes" : "do not build with the charters they include"} alone:`,
      ...buildOutputLines.map((line) => `  ${line}`),
    );
  }
  // A build that changes what is committed would leave the release to refuse
  // after the README is written: it is refused here (VENDOR-FR-005).
  const builtPaths = runGit(["status", "--porcelain"]).stdout.split("\n").filter((line) => line.trim() !== "");
  if (builtPaths.length > 0)
    stopRelease(
      "The build changed what is committed: commit what cw build writes, or have git ignore it, first.",
      ...builtPaths.slice(0, 10).map((line) => `  ${line}`),
    );
  process.stdout.write(
    `Ready: ${releaseBranch} is clean and not behind origin/${releaseBranch}; built ${charterNames.join(", ")}.\n`,
  );
}

/** Rewrites the section of README.md between its markers: how to install
 *  every charter, then per charter, how to install it alone and the skills it
 *  holds, cw's own skills left out. The source is read off origin. A skill is
 *  the charter's when it is kept under the charter's primitive/skill/; its
 *  description is the one the build at check put in the catalogue. Where
 *  there is no README.md, it is written holding that section alone; where it
 *  holds no section, the section is put at its end (VENDOR-FR-006). */
function composeReadme() {
  const heldReadmeText = existsSync(README_FILE) ? readFileSync(README_FILE, "utf8") : "";
  // A README /vendor-release wrote, before 1.4.0, holds the section under
  // the markers of its day.
  if (!heldReadmeText.includes(README_START_MARKER) && heldReadmeText.includes("<!-- vendor-release-action: charters -->"))
    stopRelease(
      `${README_FILE} holds its section under "<!-- vendor-release-action: charters -->" … "<!-- /vendor-release-action: charters -->": rename them "${README_START_MARKER}" … "${README_END_MARKER}", then ask /charter-release again.`,
    );
  const readmeText =
    heldReadmeText.includes(README_START_MARKER) || heldReadmeText.includes(README_END_MARKER)
      ? heldReadmeText
      : `${heldReadmeText.trimEnd()}${heldReadmeText.trim() === "" ? "" : "\n\n"}${README_START_MARKER}\n${README_END_MARKER}\n`;
  const startIndex = readmeText.indexOf(README_START_MARKER);
  const endIndex = readmeText.indexOf(README_END_MARKER);
  // One marker alone, or the two out of order: which was meant is not known.
  if (startIndex === -1 || endIndex < startIndex)
    stopRelease(
      `${README_FILE} holds only one of "${README_START_MARKER}" and "${README_END_MARKER}", or the two out of order: put both lines, in that order, where the install and the charters are listed.`,
    );
  // The address git fetches, as origin names it, so each line installs as it
  // is written (VENDOR-SC-002); a credential an https address carries never
  // reaches the README.
  const sourceAddress = runGit(["remote", "get-url", "origin"])
    .stdout.trim()
    .replace(/^(https?:\/\/)[^@/]+@/, "$1");
  if (!existsSync(CATALOGUE_FILE)) stopRelease(`The charters are not built: run "charter-release-action.mjs check" first.`);
  const catalogueEntries = JSON.parse(readFileSync(CATALOGUE_FILE, "utf8"));
  const charterNames = listCharterNames();
  const charterSections = charterNames.map((charterName) => {
    const skillFolderPath = join(CHARTER_FOLDER, charterName, "primitive", "skill");
    const sourceSkillIds = new Set(
      existsSync(skillFolderPath)
        ? readdirSync(skillFolderPath).filter((skillId) => existsSync(join(skillFolderPath, skillId, "index.md")))
        : [],
    );
    const charterSkills = catalogueEntries
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
      `cw charter pull ${sourceAddress} --charter=${charterName}`,
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
    // Each charter authored named, so a charter this repository installed is
    // never taken with them but one an authored charter includes
    // (VENDOR-FR-005, VENDOR-FR-018).
    `cw charter pull ${sourceAddress} ${charterNames.map((charterName) => `--charter=${charterName}`).join(" ")}`,
    "cw build",
    "```",
    "",
    "Or pick the charters you want with `--charter=<name>`, once for each.",
    "",
    "## Charters",
    "",
    ...(charterSections.length === 0 ? ["None yet."] : [charterSections.join("\n\n")]),
    "",
    `What changed in each release: [the changelog of these charters](${CHANGELOG_FILE}), kept by Cherry Works.`,
  ].join("\n");
  const composedText = `${readmeText.slice(0, startIndex + README_START_MARKER.length)}\n${sectionText}\n${readmeText.slice(endIndex)}`;
  if (composedText !== readmeText || !existsSync(README_FILE)) writeFileSync(README_FILE, composedText);
  process.stdout.write(
    `${README_FILE} ${composedText === readmeText ? "already lists" : "now lists"} ${charterNames.length === 0 ? "no charter" : charterNames.join(", ")}.\n`,
  );
}

/** The version and date a release is made under, refused as publish refuses
 *  them, so draft can refuse them before the README is written; one not
 *  given is not asked about. */
function checkReleaseVersionAndDate(versionText, dateText, lastVersion) {
  if (dateText !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(dateText))
    stopRelease(`"${dateText}" is no date: name one as yyyy-mm-dd.`);
  if (versionText === undefined) return;
  if (parseVersion(versionText) === undefined) stopRelease(`"${versionText}" is no version: name one as 1.2.3.`);
  if (runGit(["rev-parse", "--quiet", "--verify", `refs/tags/v${versionText}`]).status === 0)
    stopRelease(`v${versionText} is already a tag, and a tag is never moved.`);
  if (lastVersion !== undefined && compareVersions(parseVersion(versionText), parseVersion(lastVersion)) <= 0)
    stopRelease(`${versionText} is not after the last release, v${lastVersion}.`);
}

function draftRelease(versionText, dateText) {
  const lastVersion = findLastVersion();
  // A version the user named, or corrected at the gate, refused before
  // anything is written (VENDOR-FR-005).
  checkReleaseVersionAndDate(versionText, dateText, lastVersion);
  // The changelog's top `## ` heading as written, and the version it names.
  const changelogTopHeading = /^## .*$/m.exec(readChangelog())?.[0];
  const changelogVersion = /^## v?(\d+\.\d+\.\d+)(?:\s|$)/.exec(changelogTopHeading ?? "")?.[1];
  // Refused here, before the README is written, as publish would refuse it.
  if (existsSync(CHANGELOG_FILE) && !readChangelog().startsWith(`${CHANGELOG_HEADING}\n`))
    stopRelease(`${CHANGELOG_FILE} does not open with "${CHANGELOG_HEADING}".`);
  // A changelog not written yet starts with this release, whatever was tagged
  // before it.
  if (existsSync(CHANGELOG_FILE) && changelogVersion !== lastVersion)
    stopRelease(
      `The last tag is ${lastVersion === undefined ? "none" : `v${lastVersion}`}, and the top heading of ${CHANGELOG_FILE} is ${changelogTopHeading === undefined ? "none" : `"${changelogTopHeading}"`}: they must name the same release.`,
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
    const changedPaths = runGit(["diff", "--name-status", `v${lastVersion}..HEAD`, "--", CHARTER_FOLDER])
      .stdout.split("\n")
      .filter((line) => /^(D|R)/.test(line));
    if (changedPaths.length > 0)
      draftLines.push(
        `Removed or renamed under ${CHARTER_FOLDER}/:`,
        ...changedPaths.map((line) => `  ${line.replace(/\t/g, " ")}`),
      );
  }
  draftLines.push(`Date: ${todayDate()}`, "Landed:", ...landedCommits.map((line) => `  ${line}`));
  process.stdout.write(`${draftLines.join("\n")}\n`);
}

function publishRelease(versionText, entryFilePath, dateText, confirmedBranch) {
  const releaseBranch = findReleaseBranch(confirmedBranch);
  if (entryFilePath === undefined || !existsSync(entryFilePath)) stopRelease("Name the file holding the entry.");
  const lastVersion = findLastVersion();
  checkReleaseVersionAndDate(versionText ?? "", dateText, lastVersion);
  const tagName = `v${versionText}`;
  const branchName = runGit(["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
  if (branchName !== releaseBranch)
    stopRelease(`On branch "${branchName}", not "${releaseBranch}": a release is made from ${releaseBranch} alone, origin's default branch.`);
  const changelogText = readChangelog();
  if (!changelogText.startsWith(`${CHANGELOG_HEADING}\n`))
    stopRelease(`${CHANGELOG_FILE} does not open with "${CHANGELOG_HEADING}".`);

  // The release commits the entry and the README readme composed, and
  // nothing else changed since: what a build writes is never committed.
  const strayPaths = runGit(["status", "--porcelain"])
    .stdout.split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => line.slice(3))
    .filter((changedPath) => changedPath !== CHANGELOG_FILE && changedPath !== README_FILE);
  if (strayPaths.length > 0)
    stopRelease(
      `Changed since check, outside ${README_FILE} and ${CHANGELOG_FILE}: commit or put them away first.`,
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
      finishCommand: `git add -- ${CHANGELOG_FILE} ${README_FILE} && git commit -m "${releaseMessage}"`,
      runStep: () => {
        const addRun = runGit(["add", "--", CHANGELOG_FILE, README_FILE]);
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
else if (actionName === "draft") draftRelease(flagValueByName.version, flagValueByName.date);
else if (actionName === "publish")
  publishRelease(positionalArgs[0], positionalArgs[1], flagValueByName.date ?? todayDate(), flagValueByName.branch);
else
  stopRelease(
    "Run it as: charter-release-action.mjs check [--branch <name>] | readme | draft [--version x.y.z] [--date yyyy-mm-dd] | publish <version> <entry-file> [--date yyyy-mm-dd] [--branch <name>]",
  );
