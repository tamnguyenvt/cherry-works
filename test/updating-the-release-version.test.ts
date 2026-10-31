import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

for (const releaseMode of ["dry-run", "publish", "tests-fail", "publish-fails", "push-fails"]) {
  test(`release keeps the README version in sync: ${releaseMode}`, async () => {
    const fixtureFolder = await mkdtemp(join(tmpdir(), "cw-release-version-"));
    try {
      await mkdir(join(fixtureFolder, "scripts"));
      await mkdir(join(fixtureFolder, "bin"));
      await writeFile(join(fixtureFolder, "bin/package.json"), '{"type":"commonjs"}');
      await copyFile(new URL("../scripts/release.ts", import.meta.url), join(fixtureFolder, "scripts/release.ts"));
      const originalPackageText = '{"name": "fixture", "version": "0.8.0", "type": "module"}\n';
      const originalReadmeText = '# Fixture\n\nCurrent version: **0.8.0**\n\nKeep this text.\n';
      await writeFile(join(fixtureFolder, "package.json"), originalPackageText);
      await writeFile(join(fixtureFolder, "README.md"), originalReadmeText);
      // External commands are isolated fixtures: no registry, git remote or
      // real release is reached. The release script itself runs unchanged.
      const commandScript = `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const commandName = path.basename(process.argv[1]);
const commandArguments = process.argv.slice(2);
fs.appendFileSync('release-commands.jsonl', JSON.stringify([commandName, ...commandArguments]) + '\\n');
const releaseMode = process.env.CW_RELEASE_TEST_MODE;
const packageVersion = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
if (commandName === 'pnpm') {
  const readmeText = fs.readFileSync('README.md', 'utf8');
  fs.writeFileSync('checked-readme.txt', readmeText);
  if (releaseMode === 'tests-fail') process.exit(1);
} else if (commandName === 'npm') {
  if (commandArguments[0] === 'whoami') console.log('maintainer');
  if (commandArguments[0] === 'view' && commandArguments[2] === 'maintainers') console.log(JSON.stringify(['maintainer <fixture@example.test>']));
  if (commandArguments[0] === 'pack') console.log(JSON.stringify([{ filename: 'fixture.tgz' }]));
  if (commandArguments[0] === 'install') {
    const installFolder = commandArguments[commandArguments.indexOf('--prefix') + 1];
    const installedCw = path.join(installFolder, 'node_modules/.bin/cw');
    fs.mkdirSync(path.dirname(installedCw), { recursive: true });
    fs.writeFileSync(installedCw, '#!${process.execPath}\\nif (process.argv[2] === "--version") console.log("' + packageVersion + '");\\n');
    fs.chmodSync(installedCw, 0o755);
  }
  if (commandArguments[0] === 'publish' && releaseMode === 'publish-fails') process.exit(1);
} else if (commandName === 'git') {
  if (commandArguments[0] === 'push' && releaseMode === 'push-fails') process.exit(1);
  if (commandArguments[0] === 'rev-parse' && commandArguments.includes('--verify')) process.exit(1);
  if (commandArguments[0] === 'rev-parse') console.log('fixture-commit');
  if (commandArguments[0] === 'branch') console.log('develop');
  if (commandArguments[0] === 'commit') fs.writeFileSync('recorded-release.json', JSON.stringify({ arguments: commandArguments, readme: fs.readFileSync('README.md', 'utf8') }));
}
`;
      for (const commandName of ["git", "npm", "pnpm"]) {
        const commandPath = join(fixtureFolder, "bin", commandName);
        await writeFile(commandPath, commandScript);
        await chmod(commandPath, 0o755);
      }
      const releaseRun = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), join(fixtureFolder, "scripts/release.ts"), "0.9.0", ...(releaseMode === "dry-run" ? ["--dry-run"] : [])], {
        cwd: fixtureFolder,
        encoding: "utf8",
        env: { ...process.env, PATH: `${join(fixtureFolder, "bin")}:${process.env.PATH}`, CW_RELEASE_TEST_MODE: releaseMode },
      });
      assert.equal(releaseRun.status, releaseMode.includes("fail") ? 1 : 0, releaseRun.stderr);
      assert.match(await readFile(join(fixtureFolder, "checked-readme.txt"), "utf8"), /Current version: \*\*0\.9\.0\*\*/);
      const finalReadmeText = await readFile(join(fixtureFolder, "README.md"), "utf8");
      const finalPackageText = await readFile(join(fixtureFolder, "package.json"), "utf8");
      if (["publish", "publish-fails", "push-fails"].includes(releaseMode)) {
        assert.match(finalReadmeText, /Current version: \*\*0\.9\.0\*\*/);
        assert.equal(JSON.parse(finalPackageText).version, "0.9.0");
      } else {
        assert.equal(finalReadmeText, originalReadmeText);
        assert.equal(finalPackageText, originalPackageText);
      }
      if (releaseMode.startsWith("publish")) {
        const recordedRelease = JSON.parse(await readFile(join(fixtureFolder, "recorded-release.json"), "utf8"));
        assert.ok(recordedRelease.arguments.includes("README.md"));
        assert.match(recordedRelease.readme, /Current version: \*\*0\.9\.0\*\*/);
      }
      const releaseCommands: string[][] = (await readFile(join(fixtureFolder, "release-commands.jsonl"), "utf8")).trim().split("\n").map((commandLine) => JSON.parse(commandLine));
      const pushIndex = releaseCommands.findIndex(([commandName, action]) => commandName === "git" && action === "push");
      const publishIndex = releaseCommands.findIndex(([commandName, action]) => commandName === "npm" && action === "publish");
      if (releaseMode === "publish" || releaseMode === "publish-fails") {
        assert.ok(pushIndex >= 0 && publishIndex > pushIndex, "push must precede publish");
      } else {
        assert.equal(publishIndex, -1, "a failed push or check must never publish");
      }
      if (releaseMode === "push-fails" || releaseMode === "publish-fails") {
        assert.equal(releaseCommands.some(([commandName, action]) => commandName === "git" && action === "reset"), false);
        assert.match(releaseRun.stderr, /not published|publish failed/);
      }
      assert.match(finalReadmeText, /Keep this text\./);
    } finally {
      await rm(fixtureFolder, { recursive: true, force: true });
    }
  });
}
