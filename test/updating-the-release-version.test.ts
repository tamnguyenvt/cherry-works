import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { inARelease } from "./a-release.js";

for (const releaseMode of ["dry-run", "publish", "tests-fail", "publish-fails", "push-fails"]) {
  test(`release keeps the README version in sync: ${releaseMode}`, async () => {
    await inARelease(
      { currentVersion: "1.0.0", nextVersion: "1.1.0", releaseMode, builtContractText: "", lastContractText: "" },
      async (releaseRun, fixtureFolder) => {
        const originalPackageText = '{"name": "cherry-works", "version": "1.0.0", "type": "module"}\n';
        const originalReadmeText =
          "# Fixture\n\nCurrent version: **1.0.0**\n\nStable version: **1.0.0**\n\nKeep this text.\n";
        assert.equal(releaseRun.status, releaseMode.includes("fail") ? 1 : 0, releaseRun.stderr);
        assert.match(
          await readFile(join(fixtureFolder, "checked-readme.txt"), "utf8"),
          /Current version: \*\*1\.1\.0\*\*/,
        );
        const finalReadmeText = await readFile(join(fixtureFolder, "README.md"), "utf8");
        const finalPackageText = await readFile(join(fixtureFolder, "package.json"), "utf8");
        if (["publish", "publish-fails", "push-fails"].includes(releaseMode)) {
          assert.match(finalReadmeText, /Current version: \*\*1\.1\.0\*\*/);
          assert.equal(JSON.parse(finalPackageText).version, "1.1.0");
        } else {
          assert.equal(finalReadmeText, originalReadmeText);
          assert.equal(finalPackageText, originalPackageText);
        }
        if (releaseMode.startsWith("publish")) {
          const recordedRelease = JSON.parse(await readFile(join(fixtureFolder, "recorded-release.json"), "utf8"));
          assert.ok(recordedRelease.arguments.includes("README.md"));
          assert.match(recordedRelease.readme, /Current version: \*\*1\.1\.0\*\*/);
        }
        const releaseCommands: string[][] = (await readFile(join(fixtureFolder, "release-commands.jsonl"), "utf8"))
          .trim()
          .split("\n")
          .map((commandLine) => JSON.parse(commandLine));
        const pushIndex = releaseCommands.findIndex(
          ([commandName, action]) => commandName === "git" && action === "push",
        );
        const publishIndex = releaseCommands.findIndex(
          ([commandName, action]) => commandName === "npm" && action === "publish",
        );
        if (releaseMode === "publish" || releaseMode === "publish-fails") {
          assert.ok(pushIndex >= 0 && publishIndex > pushIndex, "push must precede publish");
        } else {
          assert.equal(publishIndex, -1, "a failed push or check must never publish");
        }
        if (releaseMode === "push-fails" || releaseMode === "publish-fails") {
          assert.equal(
            releaseCommands.some(([commandName, action]) => commandName === "git" && action === "reset"),
            false,
          );
          assert.match(releaseRun.stderr, /not published|could not be published/);
        }
        assert.match(finalReadmeText, /Keep this text\./);
      },
    );
  });
}
