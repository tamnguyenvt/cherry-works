import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export interface ReleaseFixture {
  /** The version package.json holds before the release. */
  currentVersion: string;
  /** The version asked for. */
  nextVersion: string;
  /** What the fake commands do: `dry-run`, `publish` and `unpublished`
   *  pass, the last with the package never published; `stable` marks a
   *  published version stable, and `stable-unpublished`, `stable-dry-run`,
   *  `stable-push-fails` and `dist-tag-fails` fail where they say;
   *  `tests-fail`,
   *  `uncommitted`, `install-fails`, `cw-build-fails`, `cw-version-wrong`, `library-version-wrong`, `maintainer-denied`,
   *  `already-published`, `commit-fails`, `publish-fails` and `push-fails`
   *  fail where they say. */
  releaseMode: string;
  /** The library's declarations the build leaves in `dist/index.d.ts`. */
  builtContractText: string;
  /** The contract the last release recorded, all of it in the entry file
   *  `contract/index.d.ts`; none where the library was never released. */
  lastContractText?: string;
  /** The contract the last release recorded as several files of
   *  `contract/`, by file name, in place of `lastContractText`. */
  lastContractTextByFileName?: Readonly<Record<string, string>>;
  changelogText?: string;
  /** The stable version the README names; the current one where none. */
  stableVersion?: string;
}

/** A release run by `scripts/release.ts` itself in a folder of its own, with
 *  git, npm and pnpm put in place by fakes: no registry, remote or real
 *  release is reached. Each fake command it ran is in `release-commands.jsonl`,
 *  the package.json it packed in `packed-package.json`, the contract the
 *  suite was run against in `tested-contract.json`, and the files the
 *  release commit recorded in `recorded-release.json`. The
 *  folder is taken away whatever `readReleaseRun` does. */
export async function inARelease(
  releaseFixture: ReleaseFixture,
  readReleaseRun: (releaseRun: SpawnSyncReturns<string>, fixtureFolder: string) => Promise<void>,
): Promise<void> {
  const fixtureFolder = await mkdtemp(join(tmpdir(), "cw-release-"));
  try {
    await mkdir(join(fixtureFolder, "scripts"));
    await mkdir(join(fixtureFolder, "bin"));
    await writeFile(join(fixtureFolder, "bin/package.json"), '{"type":"commonjs"}');
    await copyFile(new URL("../scripts/release.ts", import.meta.url), join(fixtureFolder, "scripts/release.ts"));
    await copyFile(
      new URL("../scripts/bundle-contract.ts", import.meta.url),
      join(fixtureFolder, "scripts/bundle-contract.ts"),
    );
    // The packages the script imports, as the repository installed them.
    await symlink(fileURLToPath(new URL("../node_modules", import.meta.url)), join(fixtureFolder, "node_modules"));
    await writeFile(
      join(fixtureFolder, "package.json"),
      `{"name": "cherry-works", "version": "${releaseFixture.currentVersion}", "type": "module"}\n`,
    );
    await writeFile(
      join(fixtureFolder, "README.md"),
      `# Fixture\n\nCurrent version: **${releaseFixture.currentVersion}**\n\nStable version: **${releaseFixture.stableVersion ?? releaseFixture.currentVersion}**\n\nKeep this text.\n`,
    );
    await writeFile(join(fixtureFolder, "built-contract.d.ts"), releaseFixture.builtContractText);
    const lastContractTextByFileName =
      releaseFixture.lastContractTextByFileName ??
      (releaseFixture.lastContractText === undefined ? undefined : { "index.d.ts": releaseFixture.lastContractText });
    if (lastContractTextByFileName !== undefined) {
      await mkdir(join(fixtureFolder, "contract"));
      for (const [contractFileName, contractText] of Object.entries(lastContractTextByFileName))
        await writeFile(join(fixtureFolder, "contract", contractFileName), contractText);
    }
    if (releaseFixture.changelogText !== undefined)
      await writeFile(join(fixtureFolder, "CHANGELOG.md"), releaseFixture.changelogText);
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
  fs.mkdirSync('dist', { recursive: true });
  fs.copyFileSync('built-contract.d.ts', 'dist/index.d.ts');
  if (commandArguments[0] === 'test')
    fs.writeFileSync('tested-contract.json', JSON.stringify(fs.existsSync('contract') ? Object.fromEntries(fs.readdirSync('contract').sort().map((contractFileName) => [contractFileName, fs.readFileSync(path.join('contract', contractFileName), 'utf8')])) : null));
  if (releaseMode === 'tests-fail' && commandArguments[0] === 'test') process.exit(1);
} else if (commandName === 'npm') {
  if (commandArguments[0] === 'whoami') console.info('maintainer');
  if (commandArguments[0] === 'view' && commandArguments[2] === 'maintainers') {
    if (releaseMode === 'unpublished') {
      console.error('npm error code E404');
      process.exit(1);
    }
    console.info(JSON.stringify([releaseMode === 'maintainer-denied' ? 'someone <someone@example.test>' : 'maintainer <fixture@example.test>']));
  }
  if (commandArguments[0] === 'view' && commandArguments[2] === 'version' && ['already-published', 'stable', 'stable-dry-run', 'stable-push-fails', 'dist-tag-fails'].includes(releaseMode)) {
    console.info(commandArguments[1].split('@').at(-1));
  }
  if (commandArguments[0] === 'pack') {
    fs.copyFileSync(path.join(fixtureFolder, 'package.json'), path.join(fixtureFolder, 'packed-package.json'));
    console.info(JSON.stringify([{ filename: 'fixture.tgz' }]));
  }
  if (commandArguments[0] === 'install') {
    if (releaseMode === 'install-fails') process.exit(1);
    const installFolder = commandArguments[commandArguments.indexOf('--prefix') + 1];
    const installedCw = path.join(installFolder, 'node_modules/.bin/cw');
    fs.mkdirSync(path.dirname(installedCw), { recursive: true });
    fs.writeFileSync(installedCw, '#!${process.execPath}\\nif (process.argv[2] === "--version") console.info("' + (releaseMode === 'cw-version-wrong' ? '0.0.0' : packageVersion) + '");\\n' + (releaseMode === 'cw-build-fails' ? 'if (process.argv[2] === "build") process.exit(1);\\n' : ''));
    fs.chmodSync(installedCw, 0o755);
    const libraryFolder = path.join(installFolder, 'node_modules/cherry-works');
    fs.mkdirSync(libraryFolder, { recursive: true });
    fs.writeFileSync(path.join(libraryFolder, 'package.json'), JSON.stringify({ name: 'cherry-works', type: 'module', exports: './index.js' }));
    fs.writeFileSync(path.join(libraryFolder, 'index.js'), 'export const VERSION = "' + (releaseMode === 'library-version-wrong' ? '0.0.0' : packageVersion) + '";\\n');
  }
  if (commandArguments[0] === 'publish' && releaseMode === 'publish-fails') process.exit(1);
  if (commandArguments[0] === 'dist-tag' && releaseMode === 'dist-tag-fails') process.exit(1);
} else if (commandName === 'git') {
  if (commandArguments[0] === 'status' && releaseMode === 'uncommitted') console.info(' M README.md');
  if (commandArguments[0] === 'push' && ['push-fails', 'stable-push-fails'].includes(releaseMode)) process.exit(1);
  if (commandArguments[0] === 'rev-parse' && commandArguments.includes('--verify')) process.exit(1);
  if (commandArguments[0] === 'rev-parse') console.info('fixture-commit');
  if (commandArguments[0] === 'branch') console.info('develop');
  if (commandArguments[0] === 'commit') {
    if (releaseMode === 'commit-fails') process.exit(1);
    const contractFolder = 'contract';
    fs.writeFileSync('recorded-release.json', JSON.stringify({
      arguments: commandArguments,
      readme: fs.readFileSync('README.md', 'utf8'),
      packageJson: fs.readFileSync('package.json', 'utf8'),
      contract: fs.existsSync(contractFolder)
        ? Object.fromEntries(fs.readdirSync(contractFolder).sort().map((contractFileName) => [contractFileName, fs.readFileSync(path.join(contractFolder, contractFileName), 'utf8')]))
        : null,
    }));
  }
}
`;
    for (const commandName of ["git", "npm", "pnpm"]) {
      const commandPath = join(fixtureFolder, "bin", commandName);
      await writeFile(commandPath, commandScript);
      await chmod(commandPath, 0o755);
    }
    const releaseRun = spawnSync(
      process.execPath,
      [
        "--import",
        import.meta.resolve("tsx"),
        join(fixtureFolder, "scripts/release.ts"),
        releaseFixture.nextVersion,
        ...(["dry-run", "stable-dry-run"].includes(releaseFixture.releaseMode) ? ["--dry-run"] : []),
        ...(releaseFixture.releaseMode.startsWith("stable") || releaseFixture.releaseMode === "dist-tag-fails"
          ? ["--stable"]
          : []),
      ],
      {
        cwd: fixtureFolder,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${join(fixtureFolder, "bin")}:${process.env.PATH}`,
          CW_RELEASE_TEST_MODE: releaseFixture.releaseMode,
        },
      },
    );
    await readReleaseRun(releaseRun, fixtureFolder);
  } finally {
    await rm(fixtureFolder, { recursive: true, force: true });
  }
}
