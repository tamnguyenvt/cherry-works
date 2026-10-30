import { loadCharterRoot } from "./charterRepo.js";
import { ensureVCSReady, loadFetchedVendors, type VendorInstall } from "./vendorRepo.js";
import { primitiveOf } from "../domain/models/charter/primitive/Primitive.js";
import { assertInjectablePrimitives } from "../domain/models/vendor/VendorPrimitive.js";
import { vendorSourceOf } from "../domain/models/vendor/VendorSource.js";
import { CHARTER_DIRECTORY } from "../domain/path.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";
import type { ForWritingFiles } from "../port/zdriven/ForWritingFiles.js";
import type { ForVCS } from "../port/zdriven/ForVCS.js";
import type { ForParsingYaml } from "../port/zdriven/ForParsingYaml.js";

/** Take the same source as vendor add, preflight every primitive and file,
 *  then write into the repository's own charter without keeping provenance. */
export async function injectVendor(
  repoPath: URL,
  fileReader: ForReadingFiles,
  fileWriter: ForWritingFiles,
  vcs: ForVCS,
  yamlParser: ForParsingYaml,
  source: string,
  version?: string,
  skillIds: readonly string[] = [],
  charterNames: readonly string[] = [],
): Promise<readonly VendorInstall[]> {
  await ensureVCSReady(repoPath, vcs);
  vendorSourceOf(source);
  const fetchedCommit = await vcs.fetchCommit(source, repoPath, version);
  const fetchedVendors = await loadFetchedVendors(repoPath, fileReader, vcs, yamlParser, source, fetchedCommit, skillIds, charterNames);
  const sourcePaths = await vcs.listFilesAt(repoPath, fetchedCommit);
  const charterRoot = await loadCharterRoot(repoPath, fileReader, yamlParser);
  const incomingPrimitives: { id: string; file: string; sourceFile: string }[] = [];
  const pendingFiles: { file: URL; contents: string }[] = [];
  const vendorInstalls: VendorInstall[] = [];
  for (const fetchedVendor of fetchedVendors) {
    for (const vendorPrimitive of fetchedVendor.vendorPrimitives) {
      const sourceFile = `${vendorPrimitive.sourceFolder}/${vendorPrimitive.convertedSkill === undefined ? "index.md" : "SKILL.md"}`;
      const primitive = vendorPrimitive.convertedSkill ?? primitiveOf(await vcs.readFileAt(repoPath, fetchedCommit, sourceFile), yamlParser);
      incomingPrimitives.push({ id: primitive.headers.id, file: primitive.file, sourceFile });
      const primitiveFolder = primitive.file.slice(0, -primitive.index.length);
      const sourcePrefix = `${vendorPrimitive.sourceFolder}/`;
      for (const sourcePath of sourcePaths.filter((sourcePath) => sourcePath.startsWith(sourcePrefix))) {
        if (sourcePath === sourceFile) continue;
        pendingFiles.push({ file: new URL(`${primitiveFolder}${sourcePath.slice(sourcePrefix.length)}`, repoPath), contents: await vcs.readFileAt(repoPath, fetchedCommit, sourcePath) });
      }
      pendingFiles.push({ file: new URL(primitive.file, repoPath), contents: vendorPrimitive.convertedSkill === undefined ? await vcs.readFileAt(repoPath, fetchedCommit, sourceFile) : primitive.toMarkdown() });
    }
    vendorInstalls.push({ folder: CHARTER_DIRECTORY, vendorPrimitives: fetchedVendor.vendorPrimitives });
  }
  const existingFiles = await fileReader.readFilesRecursively(new URL(`${CHARTER_DIRECTORY}/`, repoPath));
  assertInjectablePrimitives(
    incomingPrimitives,
    charterRoot.primitives.map((primitive) => ({ id: primitive.headers.id, file: primitive.file })),
    existingFiles.map(({ file }) => decodeURIComponent(file.href.slice(repoPath.href.length))),
  );
  for (const pendingFile of pendingFiles) await fileWriter.write(pendingFile.file, pendingFile.contents);
  return vendorInstalls;
}
