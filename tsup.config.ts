import { copyFile } from "node:fs/promises";
import { defineConfig } from "tsup";
import packageJson from "./package.json" with { type: "json" };

const page = "src/driver/portal/page";

// Three entries in one package: the launcher that checks the Node it runs on,
// the cw binary it hands over to, and the portal's page that binary serves.
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
    // A `.mjs` under the engine's own layer is an asset it puts down, taken
    // as its text (scripts/moduleLoader.mjs does the same under tsx).
    loader: { ".mjs": "text" },
    outDir: "dist",
    // The page and the launcher write dist/ alongside; cleaning them here
    // would race them.
    clean: ["!portal/**", "!cw.js"],
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
