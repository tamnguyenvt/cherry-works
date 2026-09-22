import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import packageJson from "../package.json" with { type: "json" };

const root = new URL("../", import.meta.url);

/** Every package a built file imports, by its name: a subpath counts as its
 *  package, and what Node itself provides is left out. `pnpm test` builds
 *  first, so the file read is this working tree's. */
async function importedPackagesOf(builtFile: string): Promise<Set<string>> {
  const builtSource = await readFile(new URL(builtFile, root), "utf8");
  const importSpecifiers = [...builtSource.matchAll(/^import\s[^;]*?\sfrom\s+"([^"]+)";/gm), ...builtSource.matchAll(/^import\s+"([^"]+)";/gm)].map(
    ([, specifier]) => specifier!,
  );
  return new Set(
    importSpecifiers
      .filter((specifier) => !specifier.startsWith(".") && !specifier.startsWith("node:") && !builtinModules.includes(specifier.split("/")[0]!))
      .map((specifier) => specifier.split("/").slice(0, specifier.startsWith("@") ? 2 : 1).join("/")),
  );
}

test("what the engine imports is exactly what the package depends on (FR-129)", async () => {
  assert.deepEqual([...(await importedPackagesOf("dist/main.js"))].sort(), Object.keys(packageJson.dependencies).sort());
});

test("the launcher imports no package, so it loads on any Node (FR-128)", async () => {
  assert.deepEqual([...(await importedPackagesOf("dist/cw.js"))], []);
});

test("the package holds the program, the page, the README and the license, and nothing else of the repository (FR-130)", () => {
  const packDryRun = spawnSync("npm", ["pack", "--dry-run", "--json"], { cwd: root, encoding: "utf8" });
  assert.equal(packDryRun.status, 0, packDryRun.stderr);
  const packedPaths: string[] = JSON.parse(packDryRun.stdout)[0].files.map(({ path }: { path: string }) => path);

  assert.deepEqual(packedPaths.filter((path) => !path.startsWith("dist/")).sort(), ["LICENSE", "README.md", "package.json"]);
  assert.ok(packedPaths.includes("dist/cw.js") && packedPaths.includes("dist/main.js") && packedPaths.includes("dist/portal/index.html"));
});

test("the package declares the MIT license it ships (FR-133)", async () => {
  assert.equal(packageJson.license, "MIT");
  assert.match(await readFile(new URL("LICENSE", root), "utf8"), /^MIT License\n/);
});

test("on a Node older than the one it needs, cw names that version and does nothing (FR-128)", async () => {
  // Node reports the version it is through `process.versions`, which a module
  // loaded first can answer for it: the launcher reads what an old Node says.
  const oldNodeFolder = await mkdtemp(join(tmpdir(), "cw-old-node-"));
  const oldNode = pathToFileURL(join(oldNodeFolder, "old-node.mjs"));
  await writeFile(oldNode, 'Object.defineProperty(process, "versions", { value: { ...process.versions, node: "18.20.0" } });\n');
  try {
    const launcherRun = spawnSync(process.execPath, ["--import", oldNode.href, "dist/cw.js", "--help"], { cwd: root, encoding: "utf8" });

    assert.equal(launcherRun.status, 1);
    assert.equal(launcherRun.stdout, "");
    assert.match(launcherRun.stderr, /cw needs Node\.js 22 or later, and this is Node\.js 18\.20\.0\./);
  } finally {
    await rm(oldNodeFolder, { recursive: true });
  }
});

test("on the Node it needs, the launcher hands over to cw", () => {
  const launcherRun = spawnSync(process.execPath, ["dist/cw.js", "--help"], { cwd: root, encoding: "utf8" });

  assert.equal(launcherRun.status, 0, launcherRun.stderr);
  assert.match(launcherRun.stdout, /^Usage: cw <command> \[options\]/);
});
