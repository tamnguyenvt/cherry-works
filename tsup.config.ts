import { copyFile, readFile } from "node:fs/promises";
import { defineConfig, type Options } from "tsup";

type Plugin = NonNullable<Options["esbuildPlugins"]>[number];

import packageJson from "./package.json" with { type: "json" };

const page = "src/presentation/portal/page";

/** A `.mjs` under the engine's own layer is an asset it puts down, taken as its
 *  text (scripts/moduleLoader.mjs does the same under tsx). Only there: a
 *  dependency's `.mjs` is code. */
const builtinAssetText: Plugin = {
  name: "builtin-asset-text",
  setup(build) {
    build.onLoad({ filter: /\/src\/module\/charter\/domain\/builtin\/.+\.mjs$/ }, async ({ path }) => ({
      contents: await readFile(path, "utf8"),
      loader: "text",
    }));
  },
};

// Four entries in one package: the launcher that checks the Node it runs on,
// the cw binary it hands over to, the portal's page that binary serves, and
// the library a tool imports from "cherry-works".
export default defineConfig([
  {
    entry: { cw: "bin.ts" },
    format: ["esm"],
    // Old syntax, so the launcher parses on the Node it is there to refuse.
    target: "es2017",
    outDir: "dist",
    clean: false,
  },
  {
    entry: { main: "main.ts" },
    format: ["esm"],
    target: "node22",
    // A fault is named by its class in what a caller is answered (SDK-FR-018),
    // so the bundle keeps the names it would otherwise rename on a clash.
    keepNames: true,
    esbuildPlugins: [builtinAssetText],
    // Every dependency is bundled in, of each only what cw reaches: installing
    // cw then adds this file and nothing else (SC-029). Some of them are
    // CommonJS and require Node's own modules, which an ES module cannot do
    // unless handed a require.
    noExternal: [/./],
    banner: {
      js: 'import { createRequire as createBannerRequire } from "node:module"; const require = createBannerRequire(import.meta.url);',
    },
    outDir: "dist",
    // The page, the launcher and the library write dist/ alongside; cleaning
    // them here would race them.
    clean: ["!portal/**", "!cw.js", "!index.js", "!index.d.ts"],
  },
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    target: "node22",
    // A fault is named by its class in what a caller is answered (SDK-FR-018).
    keepNames: true,
    esbuildPlugins: [builtinAssetText],
    // Bundled as cw is, so importing it adds nothing else either (SC-029);
    // its declarations take in the types of every library they name, so a
    // tool type-checks with this package alone (SDK-FR-006).
    noExternal: [/./],
    banner: {
      js: 'import { createRequire as createBannerRequire } from "node:module"; const require = createBannerRequire(import.meta.url);',
    },
    dts: true,
    define: { ENGINE_VERSION: JSON.stringify(packageJson.version) },
    outDir: "dist",
    // cw's own entry cleans dist/ and leaves this one's files be.
    clean: false,
  },
  {
    entry: { main: `${page}/main.tsx` },
    format: ["esm"],
    platform: "browser",
    target: "es2022",
    tsconfig: `${page}/tsconfig.json`,
    // A browser reads no node_modules: react and the rest are bundled in, the
    // production build of each.
    noExternal: [/./],
    // The page imports nothing of the package's own, so the version cw names
    // is written into it here, from the package.json main.ts reads (FR-132).
    define: { "process.env.NODE_ENV": '"production"', CW_VERSION: JSON.stringify(packageJson.version) },
    minify: true,
    outDir: "dist/portal",
    clean: true,
    onSuccess: async () => {
      await copyFile(`${page}/index.html`, "dist/portal/index.html");
      await copyFile(`${page}/logo.png`, "dist/portal/logo.png");
    },
  },
]);
