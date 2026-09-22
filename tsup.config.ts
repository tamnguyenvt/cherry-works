import { copyFile } from "node:fs/promises";
import { defineConfig } from "tsup";

const page = "src/driver/portal/page";

// Two entries in one package: the cw binary, and the portal's page it serves.
export default defineConfig([
  {
    entry: { main: "main.ts" },
    format: ["esm"],
    target: "node20",
    outDir: "dist",
    // The page entry writes dist/portal/ alongside; cleaning it here would race it.
    clean: ["!portal/**"],
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
    define: { "process.env.NODE_ENV": '"production"' },
    minify: true,
    outDir: "dist/portal",
    clean: true,
    onSuccess: async () => {
      await copyFile(`${page}/index.html`, "dist/portal/index.html");
      await copyFile(`${page}/logo.png`, "dist/portal/logo.png");
    },
  },
]);
