import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export interface ReleaseFixture {
  /** The version package.json holds before the release. */
  currentVersion: string;
  /** The version asked for. */
  nextVersion: string;
  /** What the fake commands do: `dry-run`, `publish` and
   *  `engine-unpublished` pass, the last with the engine never published and
   *  the account in its scope; `tests-fail`, `cw-install-fails`,
   *  `engine-install-fails`, `engine-version-wrong`, `engine-scope-denied`,
   *  `engine-maintainer-denied`, `engine-already-published`,
   *  `engine-scope-unreachable`, `commit-fails`, `publish-fails`,
   *  `engine-publish-fails` and `push-fails` fail where they say. */
  releaseMode: string;
  /** The engine declarations the build leaves in `packages/engine/dist`. */
  builtContractText: string;
  /** The contract the last release recorded; none where the engine was never
   *  released. */
  lastContractText?: string;
  changelogText?: string;
}

/** A release run by `scripts/release.ts` itself in a folder of its own, with
 *  git, npm and pnpm put in place by fakes: no registry, remote or real
 *  release is reached. Each fake command it ran is in `release-commands.jsonl`,
 *  and the files the release commit recorded in `recorded-release.json`. The
 *  folder is taken away whatever `readReleaseRun` does. */
export async function inARelease(
  releaseFixture: ReleaseFixture,
  readReleaseRun: (releaseRun: SpawnSyncReturns<string>, fixtureFolder: string) => Promise<void>,
): Promise<void> {
  const fixtureFolder = await mkdtemp(join(tmpdir(), "cw-release-"));
  try {
    await mkdir(join(fixtureFolder, "scripts"));
    await mkdir(join(fixtureFolder, "bin"));
    await mkdir(join(fixtureFolder, "packages/engine"), { recursive: true });
    await writeFile(join(fixtureFolder, "bin/package.json"), '{"type":"commonjs"}');
    await copyFile(new URL("../scripts/release.ts", import.meta.url), join(fixtureFolder, "scripts/release.ts"));
    // The packages the script imports, as the repository installed them.
    await symlink(fileURLToPath(new URL("../node_modules", import.meta.url)), join(fixtureFolder, "node_modules"));
    await writeFile(join(fixtureFolder, "package.json"), `{"name": "cherry-works", "version": "${releaseFixture.currentVersion}", "type": "module"}\n`);
    await writeFile(join(fixtureFolder, "README.md"), `# Fixture\n\nCurrent version: **${releaseFixture.currentVersion}**\n\nKeep this text.\n`);
    await writeFile(join(fixtureFolder, "built-contract.d.ts"), releaseFixture.builtContractText);
    if (releaseFixture.lastContractText !== undefined) await writeFile(join(fixtureFolder, "packages/engine/contract.d.ts"), releaseFixture.lastContractText);
    if (releaseFixture.changelogText !== undefined) await writeFile(join(fixtureFolder, "CHANGELOG.md"), releaseFixture.changelogText);
    const commandScript = `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const fixtureFolder = path.join(__dirname, '..');
const commandName = path.basename(process.argv[1]);
const commandArguments = process.argv.slice(2);
fs.appendFileSync(path.join(fixtureFolder, 'release-commands.jsonl'), JSON.stringify([commandName, ...commandArguments]) + '\\n');
const releaseMode = process.env.CW_RELEASE_TEST_MODE;
const packageVersion = JSON.parse(fs.readFileSync(path.join(fixtureFolder, 'package.json'), 'utf8')).version;
if (commandName === 'pnpm') {
  fs.writeFileSync('checked-readme.txt', fs.readFileSync('README.md', 'utf8'));
  fs.mkdirSync('packages/engine/dist', { recursive: true });
  fs.copyFileSync('built-contract.d.ts', 'packages/engine/dist/index.d.ts');
  if (releaseMode === 'tests-fail') process.exit(1);
} else if (commandName === 'npm') {
  if (commandArguments[0] === 'whoami') console.info('maintainer');
  if (commandArguments[0] === 'view' && commandArguments[2] === 'maintainers') {
    if (commandArguments[1] === '@cherry-works/engine' && ['engine-unpublished', 'engine-scope-denied', 'engine-scope-unreachable'].includes(releaseMode)) {
      console.error('npm error code E404');
      process.exit(1);
    }
    console.info(JSON.stringify([commandArguments[1] === '@cherry-works/engine' && releaseMode === 'engine-maintainer-denied' ? 'someone <someone@example.test>' : 'maintainer <fixture@example.test>']));
  }
  if (commandArguments[0] === 'view' && commandArguments[2] === 'version' && commandArguments[1].startsWith('@cherry-works/engine@') && releaseMode === 'engine-already-published') {
    console.info(commandArguments[1].split('@').at(-1));
  }
  if (commandArguments[0] === 'org' && commandArguments[1] === 'ls' && releaseMode === 'engine-scope-unreachable') {
    console.error('npm error code ECONNREFUSED');
    process.exit(1);
  }
  if (commandArguments[0] === 'org' && commandArguments[1] === 'ls') console.info(JSON.stringify(releaseMode === 'engine-scope-denied' ? { someone: 'owner' } : { maintainer: 'owner' }));
  if (commandArguments[0] === 'pack') console.info(JSON.stringify([{ filename: path.basename(process.cwd()) === 'dist' ? 'engine.tgz' : 'fixture.tgz' }]));
  if (commandArguments[0] === 'install') {
    const installFolder = commandArguments[commandArguments.indexOf('--prefix') + 1];
    if (commandArguments.at(-1).endsWith('engine.tgz')) {
      if (releaseMode === 'engine-install-fails') process.exit(1);
      const engineFolder = path.join(installFolder, 'node_modules/@cherry-works/engine');
      fs.mkdirSync(engineFolder, { recursive: true });
      fs.writeFileSync(path.join(engineFolder, 'package.json'), JSON.stringify({ name: '@cherry-works/engine', type: 'module', exports: './index.js' }));
      fs.writeFileSync(path.join(engineFolder, 'index.js'), 'export const VERSION = "' + (releaseMode === 'engine-version-wrong' ? '0.0.0' : packageVersion) + '";\\n');
    } else {
      if (releaseMode === 'cw-install-fails') process.exit(1);
      const installedCw = path.join(installFolder, 'node_modules/.bin/cw');
      fs.mkdirSync(path.dirname(installedCw), { recursive: true });
      fs.writeFileSync(installedCw, '#!${process.execPath}\\nif (process.argv[2] === "--version") console.info("' + packageVersion + '");\\n');
      fs.chmodSync(installedCw, 0o755);
    }
  }
  if (commandArguments[0] === 'publish') {
    const isEngine = commandArguments[1].endsWith('engine.tgz');
    if (releaseMode === (isEngine ? 'engine-publish-fails' : 'publish-fails')) process.exit(1);
  }
} else if (commandName === 'git') {
  if (commandArguments[0] === 'push' && releaseMode === 'push-fails') process.exit(1);
  if (commandArguments[0] === 'rev-parse' && commandArguments.includes('--verify')) process.exit(1);
  if (commandArguments[0] === 'rev-parse') console.info('fixture-commit');
  if (commandArguments[0] === 'branch') console.info('develop');
  if (commandArguments[0] === 'commit') {
    if (releaseMode === 'commit-fails') process.exit(1);
    const contractFile = 'packages/engine/contract.d.ts';
    fs.writeFileSync('recorded-release.json', JSON.stringify({
      arguments: commandArguments,
      readme: fs.readFileSync('README.md', 'utf8'),
      contract: fs.existsSync(contractFile) ? fs.readFileSync(contractFile, 'utf8') : null,
    }));
  }
}
`;
    for (const commandName of ["git", "npm", "pnpm"]) {
      const commandPath = join(fixtureFolder, "bin", commandName);
      await writeFile(commandPath, commandScript);
      await chmod(commandPath, 0o755);
    }
    const releaseRun = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), join(fixtureFolder, "scripts/release.ts"), releaseFixture.nextVersion, ...(releaseFixture.releaseMode === "dry-run" ? ["--dry-run"] : [])], {
      cwd: fixtureFolder,
      encoding: "utf8",
      env: { ...process.env, PATH: `${join(fixtureFolder, "bin")}:${process.env.PATH}`, CW_RELEASE_TEST_MODE: releaseFixture.releaseMode },
    });
    await readReleaseRun(releaseRun, fixtureFolder);
  } finally {
    await rm(fixtureFolder, { recursive: true, force: true });
  }
}
