import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, relative } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { answersOfEveryCommand } from "./every-command-in-turn.js";

const repositoryPath = fileURLToPath(new URL("../", import.meta.url));
let installFolderPath: string;
let tarballPath: string;

/** `cw` as `npm install -g` leaves it: the package this working tree packs,
 *  installed globally under a prefix of its own, so the machine's own is left
 *  alone. `pnpm test` builds first, so the package packed is this tree's. */
before(async () => {
  installFolderPath = await mkdtemp(join(tmpdir(), "cw-install-"));
  const packRun = spawnSync("npm", ["pack", "--json", "--pack-destination", installFolderPath], {
    cwd: repositoryPath,
    encoding: "utf8",
  });
  assert.equal(packRun.status, 0, packRun.stderr || packRun.error?.message);
  tarballPath = join(installFolderPath, JSON.parse(packRun.stdout)[0].filename);
  const installRun = spawnSync(
    "npm",
    ["install", "--global", "--prefix", join(installFolderPath, "global"), "--no-audit", "--no-fund", tarballPath],
    { cwd: installFolderPath, encoding: "utf8" },
  );
  assert.equal(installRun.status, 0, installRun.stderr);
});

after(async () => {
  if (installFolderPath !== undefined) await rm(installFolderPath, { recursive: true, force: true });
});

/** A PATH where the globally installed `cw` is found first. */
const installedPath = () => [join(installFolderPath, "global", "bin"), process.env.PATH].join(delimiter);

/** Loaded first into every process it is handed to, it makes every attempt to
 *  reach the network fail, as on a machine with none: this machine itself, at
 *  its loopback address, stays reachable, as it does offline. */
const OFFLINE_MODULE = `
import dns from "node:dns";
import net from "node:net";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", undefined]);
const refusedNetworkReach = () => { throw Object.assign(new Error("no network"), { code: "ENETUNREACH" }); };
const connectOnMachine = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...connectArgs) {
  const connectOptions = typeof connectArgs[0] === "object" ? connectArgs[0] : { host: connectArgs[1] };
  if (connectOptions.path === undefined && !LOOPBACK_HOSTS.has(connectOptions.host)) refusedNetworkReach();
  return connectOnMachine.apply(this, connectArgs);
};
const lookupOnMachine = dns.lookup;
dns.lookup = (hostname, ...lookupArgs) =>
  LOOPBACK_HOSTS.has(hostname) ? lookupOnMachine(hostname, ...lookupArgs) : refusedNetworkReach();
const promisesLookupOnMachine = dns.promises.lookup;
dns.promises.lookup = async (hostname, ...lookupArgs) =>
  LOOPBACK_HOSTS.has(hostname) ? promisesLookupOnMachine(hostname, ...lookupArgs) : refusedNetworkReach();
globalThis.fetch = async () => refusedNetworkReach();
`;

/** The `cw` `npm install -g` put under the prefix, its program as installed. */
const installedCwFilePath = () => join(installFolderPath, "global/lib/node_modules/cherry-works/dist/cw.js");

test("installed globally, cw is on the path and its help lists every command (CORE Story 13 scenario 1)", () => {
  const helpRun = spawnSync("cw", ["--help"], { env: { ...process.env, PATH: installedPath() }, encoding: "utf8" });

  assert.equal(helpRun.status, 0, helpRun.stderr);
  // A group lists its subcommands on its own line: `cw vendor  add, inject, …`.
  const helpLines = helpRun.stdout.split("\n");
  for (const command of COMMANDS) {
    const [groupName, ...nameWords] = command.name.split(" ").filter((nameWord) => !/^[<[]/.test(nameWord));
    const commandLine = helpLines.find((helpLine) => helpLine.startsWith(`  cw ${groupName} `));
    assert.ok(commandLine !== undefined, `cw ${groupName} is not listed`);
    for (const nameWord of nameWords) assert.match(commandLine, new RegExp(`\\b${nameWord}\\b`), command.name);
  }
});

test("the installed cw, in any repository, answers every command and serves the portal as the source build does, and needs nothing of this repository (CORE Story 13 scenario 2)", async () => {
  // `pnpm test` builds this tree first: dist/ is what its source builds to.
  const installedAnswers = await answersOfEveryCommand(installedCwFilePath(), 47393);
  const sourceBuildAnswers = await answersOfEveryCommand(join(repositoryPath, "dist/cw.js"), 47394);

  assert.deepEqual(installedAnswers, sourceBuildAnswers);
  assert.equal(installedAnswers.portalAnswers.find(({ request }) => request === "GET /")?.status, 200);
  // Nothing installed reaches back into this repository: no file of the
  // install names where its source is.
  const installedPackagePath = join(installFolderPath, "global/lib/node_modules/cherry-works");
  for (const installedDirent of await readdir(installedPackagePath, { recursive: true, withFileTypes: true })) {
    if (!installedDirent.isFile()) continue;
    const installedFilePath = join(installedDirent.parentPath, installedDirent.name);
    assert.ok(
      !(await readFile(installedFilePath, "utf8")).includes(repositoryPath.replace(/\/$/, "")),
      `${relative(installedPackagePath, installedFilePath)} names ${repositoryPath}`,
    );
  }
});

test("run once through npm exec, cw works and nothing is left installed (CORE Story 13 scenario 3)", async () => {
  const workFolderPath = await mkdtemp(join(tmpdir(), "cw-run-once-"));
  const prefixFolderPath = join(workFolderPath, "prefix");
  try {
    const npmExecRun = spawnSync("npm", ["exec", "--yes", `--package=${tarballPath}`, "--", "cw", "--version"], {
      cwd: workFolderPath,
      env: {
        ...process.env,
        npm_config_prefix: prefixFolderPath,
        npm_config_cache: join(workFolderPath, "cache"),
      },
      encoding: "utf8",
    });

    assert.equal(npmExecRun.status, 0, npmExecRun.stderr);
    assert.equal(
      npmExecRun.stdout.trim(),
      JSON.parse(await readFile(join(repositoryPath, "package.json"), "utf8")).version,
    );
    // Neither a global install under the prefix nor a local one in the folder
    // it ran in: what npm exec fetched stays in its cache, which it may clear.
    assert.equal(existsSync(prefixFolderPath), false, `npm exec installed under ${prefixFolderPath}`);
    assert.deepEqual((await readdir(workFolderPath)).sort(), ["cache"]);
  } finally {
    await rm(workFolderPath, { recursive: true, force: true });
  }
});

test("on a Node older than the one it needs, the installed cw names that version and does nothing (CORE Story 13 scenario 4)", async () => {
  const oldNodeModulePath = join(installFolderPath, "old-node.mjs");
  await writeFile(
    oldNodeModulePath,
    'Object.defineProperty(process, "versions", { value: { ...process.versions, node: "18.20.0" } });\n',
  );
  const repoFolderPath = await mkdtemp(join(tmpdir(), "cw-old-node-repo-"));
  try {
    const oldNodeRun = spawnSync("cw", ["init", "--agent", "claude"], {
      cwd: repoFolderPath,
      env: { ...process.env, PATH: installedPath(), NODE_OPTIONS: `--import ${oldNodeModulePath}` },
      encoding: "utf8",
    });

    assert.equal(oldNodeRun.status, 1);
    assert.equal(oldNodeRun.stdout, "");
    assert.match(oldNodeRun.stderr, /cw needs Node\.js 22 or later, and this is Node\.js 18\.20\.0\./);
    assert.deepEqual(await readdir(repoFolderPath), []);
  } finally {
    await rm(repoFolderPath, { recursive: true, force: true });
  }
});

test("the installed cw with no network answers every command that reaches no source, mcp origin or agent as it does with one (CORE Story 13 scenario 5)", async () => {
  const offlineModulePath = join(installFolderPath, "offline.mjs");
  await writeFile(offlineModulePath, OFFLINE_MODULE);
  // The module refuses what it should: a reach for the network fails under it.
  const reachRun = spawnSync(
    process.execPath,
    [
      "--import",
      offlineModulePath,
      "--eval",
      "fetch('https://registry.npmjs.org/').then(() => process.exit(0), () => process.exit(3))",
    ],
    { encoding: "utf8" },
  );
  assert.equal(reachRun.status, 3);

  const offlineAnswers = await answersOfEveryCommand(installedCwFilePath(), 47395, {
    NODE_OPTIONS: `--import ${offlineModulePath}`,
  });
  const onlineAnswers = await answersOfEveryCommand(installedCwFilePath(), 47396);

  assert.deepEqual(offlineAnswers, onlineAnswers);
});

test("the install holds only what cw runs on, nothing that exists only to build, bundle or test it (CORE Story 13 scenario 6)", async () => {
  const globalModulesPath = join(installFolderPath, "global/lib/node_modules");
  assert.deepEqual(await readdir(globalModulesPath), ["cherry-works"]);
  const installedFilePaths = (
    await readdir(join(globalModulesPath, "cherry-works"), { recursive: true, withFileTypes: true })
  )
    .filter((installedDirent) => installedDirent.isFile())
    .map((installedDirent) =>
      relative(join(globalModulesPath, "cherry-works"), join(installedDirent.parentPath, installedDirent.name)),
    );

  assert.deepEqual(installedFilePaths.filter((filePath) => !filePath.startsWith("dist/")).sort(), [
    "LICENSE",
    "README.md",
    "package.json",
  ]);
  assert.deepEqual(
    installedFilePaths.filter(
      (filePath) =>
        /\.(test|spec)\.|\.map$|\.ts$|(^|\/)(test|src|scripts)\//.test(filePath) && !filePath.endsWith(".d.ts"),
    ),
    [],
  );
});

/** The text the builtin skill opens with, and what a newer version says there
 *  instead: what tells one version's builtin layer from the other's. */
const BUILTIN_SKILL_TEXT = "This skill is cw's own.";
const NEWER_BUILTIN_SKILL_TEXT = "This skill is cw's own, as the newer version brings it.";

/** The package as a newer version would publish it: this tree's, under the
 *  next patch version, its builtin skill saying so. Packed into a folder of its
 *  own, with the version it was published as. */
async function newerTarballOf(folderPath: string): Promise<{ newerTarballPath: string; newerVersion: string }> {
  const untarRun = spawnSync("tar", ["-xzf", tarballPath, "-C", folderPath], { encoding: "utf8" });
  assert.equal(untarRun.status, 0, untarRun.stderr);
  const packagePath = join(folderPath, "package");
  const packageJson = JSON.parse(await readFile(join(packagePath, "package.json"), "utf8"));
  const [major, minor, patch] = String(packageJson.version).split(".").map(Number);
  const newerVersion = `${major}.${minor}.${(patch ?? 0) + 1}`;
  await writeFile(join(packagePath, "package.json"), JSON.stringify({ ...packageJson, version: newerVersion }));
  // What `cw` runs: the program its bin starts imports this bundle.
  const bundlePath = join(packagePath, "dist", "main.js");
  const bundleText = await readFile(bundlePath, "utf8");
  assert.ok(bundleText.includes(`version: "${packageJson.version}"`) && bundleText.includes(BUILTIN_SKILL_TEXT));
  await writeFile(
    bundlePath,
    bundleText
      .replaceAll(`version: "${packageJson.version}"`, `version: "${newerVersion}"`)
      .replaceAll(BUILTIN_SKILL_TEXT, NEWER_BUILTIN_SKILL_TEXT),
  );
  const packRun = spawnSync("npm", ["pack", "--json", "--pack-destination", folderPath], {
    cwd: packagePath,
    encoding: "utf8",
  });
  assert.equal(packRun.status, 0, packRun.stderr);
  return { newerTarballPath: join(folderPath, JSON.parse(packRun.stdout)[0].filename), newerVersion };
}

/** A PATH holding the `cw` installed under this prefix, and node, npm and the
 *  system's own tools, but no other `cw` this machine may have. */
const pathOfPrefix = (prefixPath: string) =>
  [join(prefixPath, "bin"), dirname(process.execPath), "/usr/bin", "/bin"].join(delimiter);

/** `npm install -g` of one tarball under this prefix. */
const installGlobally = (prefixPath: string, packageTarballPath: string) =>
  spawnSync("npm", ["install", "--global", "--prefix", prefixPath, "--no-audit", "--no-fund", packageTarballPath], {
    encoding: "utf8",
  });

test("upgraded with the package manager, the next run is the newer version, and the builtin layer it builds is the newer one's, with nothing to migrate (CORE Story 14 scenario 2, CORE-SC-021, CORE Story 55 scenario 4)", async () => {
  const workFolderPath = await mkdtemp(join(tmpdir(), "cw-upgrade-"));
  try {
    const prefixPath = join(workFolderPath, "prefix");
    const runningPath = pathOfPrefix(prefixPath);
    const repoFolderPath = join(workFolderPath, "repo");
    await mkdir(repoFolderPath);
    assert.equal(installGlobally(prefixPath, tarballPath).status, 0);
    const initRun = spawnSync("cw", ["init", "--agent", "claude"], {
      cwd: repoFolderPath,
      env: { ...process.env, PATH: runningPath },
      encoding: "utf8",
    });
    assert.equal(initRun.status, 0, initRun.stderr);
    const builtSkillPath = join(repoFolderPath, ".cw/out/skill/cw-author/index.md");
    assert.ok((await readFile(builtSkillPath, "utf8")).includes(BUILTIN_SKILL_TEXT));
    const { newerTarballPath, newerVersion } = await newerTarballOf(workFolderPath);

    const upgradeRun = installGlobally(prefixPath, newerTarballPath);

    assert.equal(upgradeRun.status, 0, upgradeRun.stderr);
    const versionRun = spawnSync("cw", ["--version"], { env: { ...process.env, PATH: runningPath }, encoding: "utf8" });
    assert.equal(versionRun.stdout.trim(), newerVersion);
    const buildRun = spawnSync("cw", ["build"], {
      cwd: repoFolderPath,
      env: { ...process.env, PATH: runningPath },
      encoding: "utf8",
    });
    assert.equal(buildRun.status, 0, buildRun.stderr);
    assert.ok((await readFile(builtSkillPath, "utf8")).includes(NEWER_BUILTIN_SKILL_TEXT));
  } finally {
    await rm(workFolderPath, { recursive: true, force: true });
  }
});

test("a repository declaring one version as a development dependency runs that version through its own scripts, whatever version is installed globally (CORE Story 14 scenario 3, CORE-FR-210, CORE Story 55 scenario 4)", async () => {
  const workFolderPath = await mkdtemp(join(tmpdir(), "cw-pinned-"));
  try {
    const prefixPath = join(workFolderPath, "prefix");
    const runningPath = pathOfPrefix(prefixPath);
    const { newerTarballPath, newerVersion } = await newerTarballOf(workFolderPath);
    assert.equal(installGlobally(prefixPath, newerTarballPath).status, 0);
    const pinnedVersion = JSON.parse(await readFile(join(repositoryPath, "package.json"), "utf8")).version;
    const repoFolderPath = join(workFolderPath, "repo");
    await mkdir(repoFolderPath);
    await writeFile(
      join(repoFolderPath, "package.json"),
      JSON.stringify({
        name: "pinned-repository",
        private: true,
        scripts: { cw: "cw" },
        devDependencies: { "cherry-works": `file:${tarballPath}` },
      }),
    );
    const installRun = spawnSync("npm", ["install", "--no-audit", "--no-fund"], {
      cwd: repoFolderPath,
      encoding: "utf8",
    });
    assert.equal(installRun.status, 0, installRun.stderr);

    const globalRun = spawnSync("cw", ["--version"], {
      cwd: repoFolderPath,
      env: { ...process.env, PATH: runningPath },
      encoding: "utf8",
    });
    const scriptRun = spawnSync("npm", ["run", "--silent", "cw", "--", "--version"], {
      cwd: repoFolderPath,
      env: { ...process.env, PATH: runningPath },
      encoding: "utf8",
    });

    assert.equal(globalRun.stdout.trim(), newerVersion);
    assert.equal(scriptRun.status, 0, scriptRun.stderr);
    assert.equal(scriptRun.stdout.trim(), pinnedVersion);
  } finally {
    await rm(workFolderPath, { recursive: true, force: true });
  }
});
