import { copyFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "tsup";
import packageJson from "../../package.json" with { type: "json" };

export default defineConfig({
  entry: { index: "packages/engine/index.ts" },
  format: ["esm"],
  target: "node22",
  // A fault is named by its class in what a caller is answered (SDK-FR-018),
  // so the bundle keeps the names it would otherwise rename on a clash.
  keepNames: true,
  outDir: "packages/engine/dist",
  clean: true,
  dts: true,
  external: ["picomatch", "smol-toml", "yaml", "zod"],
  define: { ENGINE_VERSION: JSON.stringify(packageJson.version) },
  esbuildPlugins: [
    {
      // Each module's module.ts names its adapters too, and the engine ships
      // none of them (CORE-FR-228): an adapter is marked free of side effects,
      // so what the engine does not use of it is left out of the bundle.
      name: "adapters-left-out",
      setup(build) {
        build.onResolve({ filter: /^\.\/infra\/.+\.js$/ }, ({ path, resolveDir }) => ({
          path: resolve(resolveDir, path.replace(/\.js$/, ".ts")),
          sideEffects: false,
        }));
      },
    },
    {
      name: "builtin-asset-text",
      setup(build) {
        build.onLoad({ filter: /\/src\/module\/charter\/domain\/builtin\/.+\.mjs$/ }, async ({ path }) => ({
          contents: await readFile(path, "utf8"),
          loader: "text",
        }));
      },
    },
  ],
  onSuccess: async () => {
    await copyFile("LICENSE", "packages/engine/dist/LICENSE");
    await copyFile("packages/engine/README.md", "packages/engine/dist/README.md");
    await writeFile("packages/engine/dist/package.json", JSON.stringify({
      name: "@cherry-works/engine",
      version: packageJson.version,
      description: "The Cherry Works engine and its ports for tools with adapters of their own.",
      license: packageJson.license,
      type: "module",
      engines: { node: packageJson.engines.node },
      exports: { ".": { types: "./index.d.ts", import: "./index.js" } },
      types: "./index.d.ts",
      files: ["index.js", "index.d.ts"],
      scripts: { prepublishOnly: packageJson.scripts.prepublishOnly },
      dependencies: { picomatch: packageJson.devDependencies.picomatch, "smol-toml": packageJson.devDependencies["smol-toml"], yaml: packageJson.devDependencies.yaml, zod: packageJson.devDependencies.zod },
    }, undefined, 2) + "\n");
  },
});
