import { copyFile, readFile, writeFile } from "node:fs/promises";
import { defineConfig } from "tsup";
import packageJson from "../../package.json" with { type: "json" };

export default defineConfig({
  entry: { index: "packages/engine/index.ts" },
  format: ["esm"],
  target: "node22",
  outDir: "packages/engine/dist",
  clean: true,
  dts: true,
  external: ["picomatch", "zod"],
  define: { ENGINE_VERSION: JSON.stringify(packageJson.version) },
  esbuildPlugins: [
    {
      name: "builtin-asset-text",
      setup(build) {
        build.onLoad({ filter: /\/src\/hexagon\/domain\/models\/charter\/builtin\/.+\.mjs$/ }, async ({ path }) => ({
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
      dependencies: { picomatch: packageJson.devDependencies.picomatch, zod: packageJson.devDependencies.zod },
    }, undefined, 2) + "\n");
  },
});
