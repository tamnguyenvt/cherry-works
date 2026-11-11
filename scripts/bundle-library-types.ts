/**
 * Makes the declarations of the library `cherry-works` exports stand on that
 * package alone (SDK-FR-006): the build leaves `dist/index.d.ts` importing
 * zod, the library the values crossing the ports are made of, which a tool
 * importing `cherry-works` has not installed, since every dependency is
 * bundled in (SC-029). Zod's own declarations, which import nothing else, are
 * copied beside it under `dist/zod/`, with zod's license, and the import is
 * pointed at them. Any other library the declarations name fails the build.
 *
 *   node --import tsx scripts/bundle-library-types.ts   run by "pnpm build"
 */
import { cp, readFile, realpath, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const LIBRARY_D_TS = join(ROOT, "dist/index.d.ts");
const ZOD_TYPES_FOLDER = join(ROOT, "dist/zod");

const zodFolder = await realpath(join(ROOT, "node_modules/zod"));
await cp(zodFolder, ZOD_TYPES_FOLDER, {
  recursive: true,
  // Zod's sources are not its declarations, and its code is in the bundle.
  filter: (sourcePath) => {
    const zodPath = relative(zodFolder, sourcePath);
    return (
      zodPath === "" ||
      zodPath === "LICENSE" ||
      (zodPath !== "src" && !zodPath.startsWith(`src${sep}`) && (!zodPath.includes(".") || zodPath.endsWith(".d.ts")))
    );
  },
});

const libraryTypesText = await readFile(LIBRARY_D_TS, "utf8");
const importedPackageNames = [...libraryTypesText.matchAll(/^import [^;]* from '([^.'][^']*)';$/gm)].map(
  ([, packageName]) => packageName!,
);
const foreignPackageNames = importedPackageNames.filter((packageName) => packageName !== "zod");
if (foreignPackageNames.length > 0)
  throw new Error(
    `dist/index.d.ts imports ${foreignPackageNames.join(", ")}, which a tool importing cherry-works has not installed.`,
  );
await writeFile(LIBRARY_D_TS, libraryTypesText.replaceAll(/^(import [^;]* from )'zod';$/gm, "$1'./zod/index.js';"));
