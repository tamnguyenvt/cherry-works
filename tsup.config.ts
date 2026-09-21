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
    // A browser reads no node_modules: preact and the rest are bundled in.
    noExternal: [/./],
    outDir: "dist/portal",
    clean: true,
    onSuccess: () => copyFile(`${page}/index.html`, "dist/portal/index.html"),
  },
]);
