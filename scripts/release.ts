/**
 * Releases one version of the package to npm (FR-134 – FR-137, plan §18.4).
 * Everything that can fail runs before anything reaches the registry or the
 * remote, so a refused release leaves both, and this repository, as they were
 * (SC-032).
 *
 *   pnpm release <version>            check, then commit, tag, publish and push
 *   pnpm release <version> --dry-run  check only; package.json is put back
 */
import { spawnSync } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const PACKAGE_JSON = join(ROOT, "package.json");
const RELEASE_BRANCH = "develop";
/** What installing cw may add to a machine (SC-029). */
const INSTALLED_SIZE_LIMIT = 20 * 1024 * 1024;

/** A check the release did not pass: said to the maintainer, and nothing is
 *  left changed behind it. */
class ReleaseError extends Error {}

const releaseArguments = process.argv.slice(2);
const version = releaseArguments.find((argument) => !argument.startsWith("--"));
const isDryRun = releaseArguments.includes("--dry-run");
const inRoot = { cwd: ROOT, encoding: "utf8" } as const;

try {
  const packageJsonText = await readFile(PACKAGE_JSON, "utf8");
  const { name: packageName, version: currentVersion } = JSON.parse(packageJsonText) as { name: string; version: string };

  // Refusals that change nothing (FR-134).
  if (version === undefined || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new ReleaseError(`"${version ?? ""}" is not a version of the form MAJOR.MINOR.PATCH, such as 0.1.0.`);
  }
  const [nextParts, currentParts] = [version, currentVersion].map((text) => text.split(".").map(Number)) as [number[], number[]];
  const firstDifference = nextParts.findIndex((part, index) => part !== currentParts[index]);
  if (firstDifference === -1 || nextParts[firstDifference]! < currentParts[firstDifference]!) {
    throw new ReleaseError(`${version} is not above ${currentVersion}, the version package.json holds.`);
  }

  // Signed in to the registry, as an account that may publish this package:
  // without it, npm publish answers a misleading E404 only after the release
  // commit and tag are made. At a terminal, the maintainer is signed in here.
  let npmAccount = spawnSync("npm", ["whoami"], inRoot).stdout.trim();
  if (npmAccount === "" && !isDryRun && process.stdin.isTTY) {
    console.log("Not signed in to npm. Signing in now.");
    spawnSync("npm", ["login"], { cwd: ROOT, stdio: "inherit" });
    npmAccount = spawnSync("npm", ["whoami"], inRoot).stdout.trim();
  }
  if (npmAccount === "") throw new ReleaseError('npm has no account signed in. Run "npm login", then release again.');
  const maintainersView = spawnSync("npm", ["view", packageName, "maintainers", "--json"], inRoot);
  if (maintainersView.status === 0) {
    const maintainers = [JSON.parse(maintainersView.stdout) as string | string[]].flat();
    if (!maintainers.some((maintainer) => maintainer.split(" ")[0] === npmAccount)) {
      throw new ReleaseError(`npm is signed in as ${npmAccount}, who does not maintain ${packageName}: ${maintainers.join(", ")}. Run "npm login" as one of them.`);
    }
  }

  // A package never published answers E404; a published one without this
  // version answers nothing.
  const registryView = spawnSync("npm", ["view", `${packageName}@${version}`, "version"], inRoot);
  if (registryView.status !== 0 && !registryView.stderr.includes("E404")) {
    throw new ReleaseError(`the registry could not be asked whether ${version} is published.\n${registryView.stderr}`);
  }
  if (registryView.stdout.trim() !== "") throw new ReleaseError(`${version} is already published.`);
  if (spawnSync("git", ["rev-parse", "--quiet", "--verify", `refs/tags/v${version}`], inRoot).status === 0) {
    throw new ReleaseError(`the tag v${version} already exists.`);
  }

  if (spawnSync("git", ["status", "--porcelain"], inRoot).stdout !== "") {
    throw new ReleaseError('the working tree holds uncommitted changes. Commit or stash them, then release again.');
  }
  const currentBranch = spawnSync("git", ["branch", "--show-current"], inRoot).stdout.trim();
  if (currentBranch !== RELEASE_BRANCH) throw new ReleaseError(`releases are made from ${RELEASE_BRANCH}, and this is ${currentBranch || "a detached HEAD"}.`);
  if (spawnSync("git", ["fetch", "--quiet", "origin", RELEASE_BRANCH], inRoot).status !== 0) {
    throw new ReleaseError(`origin/${RELEASE_BRANCH} could not be fetched.`);
  }
  const [localCommit, remoteCommit] = ["HEAD", `origin/${RELEASE_BRANCH}`].map((ref) => spawnSync("git", ["rev-parse", ref], inRoot).stdout.trim());
  if (localCommit !== remoteCommit) throw new ReleaseError(`${RELEASE_BRANCH} is not level with origin/${RELEASE_BRANCH}. Pull or push first.`);

  const workFolder = await mkdtemp(join(tmpdir(), "cw-release-"));
  let isRecorded = false;
  try {
    // The version written, and the suite run, which builds.
    await writeFile(PACKAGE_JSON, packageJsonText.replace(`"version": "${currentVersion}"`, `"version": "${version}"`));
    if (spawnSync("pnpm", ["test"], { cwd: ROOT, stdio: "inherit" }).status !== 0) throw new ReleaseError("the tests fail.");

    // The install check (FR-135): the one tarball that will be published,
    // installed apart from this repository and used on a fresh one.
    const packResult = spawnSync("npm", ["pack", "--json", "--pack-destination", workFolder], inRoot);
    if (packResult.status !== 0) throw new ReleaseError(`npm pack failed.\n${packResult.stderr}`);
    const tarball = join(workFolder, (JSON.parse(packResult.stdout) as { filename: string }[])[0]!.filename);

    const installFolder = join(workFolder, "install");
    const freshRepo = join(workFolder, "repo");
    await mkdir(installFolder);
    await mkdir(freshRepo);
    const installResult = spawnSync("npm", ["install", "--prefix", installFolder, tarball], inRoot);
    if (installResult.status !== 0) throw new ReleaseError(`the package does not install.\n${installResult.stderr}`);
    spawnSync("git", ["init", "--quiet"], { cwd: freshRepo });

    const installedCw = join(installFolder, "node_modules", ".bin", "cw");
    const versionRun = spawnSync(installedCw, ["--version"], { cwd: freshRepo, encoding: "utf8" });
    if (versionRun.stdout !== `${version}\n`) throw new ReleaseError(`the installed cw --version prints "${versionRun.stdout.trim()}", not ${version}.`);
    for (const cwArguments of [["init", "--agent", "claude"], ["build"], ["doctor"]]) {
      const cwRun = spawnSync(installedCw, cwArguments, { cwd: freshRepo, encoding: "utf8" });
      if (cwRun.status !== 0) throw new ReleaseError(`the installed "cw ${cwArguments.join(" ")}" fails on a fresh repository.\n${cwRun.stdout}${cwRun.stderr}`);
    }

    const installedEntries = await readdir(installFolder, { recursive: true, withFileTypes: true });
    const installedFileSizes = await Promise.all(
      installedEntries.filter((entry) => entry.isFile()).map(async (entry) => (await lstat(join(entry.parentPath, entry.name))).size),
    );
    const installedSize = installedFileSizes.reduce((total, size) => total + size, 0);
    if (installedSize >= INSTALLED_SIZE_LIMIT) {
      throw new ReleaseError(`the install adds ${(installedSize / 1024 / 1024).toFixed(1)} MB, over the ${INSTALLED_SIZE_LIMIT / 1024 / 1024} MB it may (SC-029).`);
    }

    if (isDryRun) {
      console.log(`Dry run: ${version} passes every check, installed at ${(installedSize / 1024 / 1024).toFixed(1)} MB. Nothing was recorded, published or pushed.`);
    } else {
      // Recorded (FR-136), then published: the tarball checked above, byte for
      // byte. npm asks for the account's second factor here.
      if (spawnSync("git", ["commit", "--quiet", "--message", `Release ${version}`, "--", "package.json"], { cwd: ROOT, stdio: "inherit" }).status !== 0) {
        throw new ReleaseError("the release commit could not be made.");
      }
      isRecorded = true;
      // With a message, so a repository that signs its tags can make this one.
      if (spawnSync("git", ["tag", "--annotate", "--message", `Release ${version}`, `v${version}`], { cwd: ROOT, stdio: "inherit" }).status !== 0) {
        spawnSync("git", ["reset", "--hard", "--quiet", "HEAD~1"], inRoot);
        throw new ReleaseError(`the tag v${version} could not be made. The release commit is undone.`);
      }
      if (spawnSync("npm", ["publish", tarball], { cwd: ROOT, stdio: "inherit" }).status !== 0) {
        spawnSync("git", ["tag", "--delete", `v${version}`], inRoot);
        spawnSync("git", ["reset", "--hard", "--quiet", "HEAD~1"], inRoot);
        throw new ReleaseError("npm publish failed. The tag and the release commit are undone.");
      }

      // Published cannot be taken back, so a failed push is said, not undone.
      if (spawnSync("git", ["push", "origin", RELEASE_BRANCH, `v${version}`], { cwd: ROOT, stdio: "inherit" }).status !== 0) {
        console.error(`${version} is published and tagged, but the push failed. Run: git push origin ${RELEASE_BRANCH} v${version}`);
        process.exitCode = 1;
      } else {
        console.log(`Released ${version}: published, and tagged v${version} at the commit it was built from.`);
      }
    }
  } finally {
    if (!isRecorded) await writeFile(PACKAGE_JSON, packageJsonText);
    await rm(workFolder, { recursive: true, force: true });
  }
} catch (raised) {
  if (!(raised instanceof ReleaseError)) throw raised;
  console.error(`Release refused: ${raised.message}`);
  process.exitCode = 1;
}
