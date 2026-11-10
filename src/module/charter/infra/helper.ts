import { McpClientRegistration, McpCredential } from "../app/port/out/storing-credentials.port.js";
import { AdapterFault, BasePrimitive, CharterFolder, Primitives, RawPrimitive, VendorSource, type ForReadingFiles, OutputPart, type PrimitiveLayer, type ReadFile } from "../app/port/out/managing-charter.port.js";

/** How many folders under `skills/` a skill's folder may sit, as `npx skills`
 *  walks it: `skills/<name>/`, `skills/<group>/<name>/`, and one group more
 *  (CORE-FR-185). */
const SKILLS_FOLDER_DEPTH = 3;

/** Where a skills repository keeps what it depends on, never a skill of its
 *  own (CORE-FR-185). */
const DEPENDENCIES_FOLDER = "node_modules";

/** The parts a repository laid out the old way keeps right under its
 *  workspace, beside the charter, as their paths from the repository. */
const OLD_LAYOUT_FOLDER_PATHS = [".cw/test", ".cw/eval", ".cw/vendor"];

/** What a repository, or a source, laid out the old way is refused with,
 *  naming the skill that moves it (CORE-FR-226, CORE-FR-227). */
export function createOldLayoutFault(layoutOwner: string, oldPaths: readonly string[]): AdapterFault {
  return new AdapterFault(
    `${layoutOwner} is laid out the old way: ${oldPaths.join(", ")} ${oldPaths.length === 1 ? "sits" : "sit"} where the charter now keeps its primitives, tests, eval cases and vendors under ${CharterFolder.path}/.`,
    `Have your agent follow the cw-author skill to move it: each kind's folder under ${CharterFolder.path}/ into ${CharterFolder.path}/primitive/, and .cw/test/, .cw/eval/ and .cw/vendor/ into ${CharterFolder.path}/test/, ${CharterFolder.path}/eval/ and ${CharterFolder.path}/vendor/.`,
    { internal: false },
  );
}

/** Each path a layout of the old way keeps, among these paths of a
 *  repository or a source, each folder named once: a part right under the
 *  workspace beside the charter, or a kind's folder right under the charter
 *  (CORE-FR-226). */
export function oldLayoutPathsOf(paths: readonly string[], sourcePrefix = ""): readonly string[] {
  const oldPaths = paths.flatMap((path) => {
    if (!path.startsWith(sourcePrefix)) return [];
    const repoPath = path.slice(sourcePrefix.length);
    const oldFolderPath = OLD_LAYOUT_FOLDER_PATHS.find((folderPath) => repoPath === folderPath || repoPath.startsWith(`${folderPath}/`));
    if (oldFolderPath !== undefined) return [`${sourcePrefix}${oldFolderPath}/`];
    const [kindName] = repoPath.startsWith(`${CharterFolder.path}/`) ? repoPath.slice(`${CharterFolder.path}/`.length).split("/") : [];
    return kindName !== undefined && Primitives.isKind(kindName) ? [`${sourcePrefix}${CharterFolder.path}/${kindName}/`] : [];
  });
  return [...new Set(oldPaths)].sort();
}

/** Refused where the repository, or the checkout of it under
 *  `checkoutFolderPath`, is laid out the old way (CORE-FR-226). */
export async function assertNewLayout(fileReader: ForReadingFiles, checkoutFolderPath = ""): Promise<void> {
  const [workspaceFolderPaths, charterFolderPaths] = await Promise.all([
    fileReader.listFolders(`${checkoutFolderPath}.cw`),
    fileReader.listFolders(`${checkoutFolderPath}${CharterFolder.path}`),
  ]);
  const oldPaths = oldLayoutPathsOf([...workspaceFolderPaths, ...charterFolderPaths].map((folderPath) => `${folderPath}/`), checkoutFolderPath);
  if (oldPaths.length > 0) throw createOldLayoutFault("This repository", oldPaths);
}

export function rawPrimitivesOf(keptFiles: readonly ReadFile<Uint8Array>[], layerFolder: string, primitiveLayer: PrimitiveLayer, findFileAddress: (path: string) => string): readonly RawPrimitive[] {
  const filesInKindFolders = keptFiles.filter(({ path }) => Primitives.kinds.some((kind) => path.startsWith(`${layerFolder}${kind}/`)));
  const primitiveFolderOf = (indexPath: string) => indexPath.slice(0, -BasePrimitive.index.length);
  const indexFiles = filesInKindFolders.filter(({ path }) => path.endsWith(`/${BasePrimitive.index}`));
  const primitiveIndexFiles = indexFiles.filter(({ path }) => !indexFiles.some((otherIndexFile) => otherIndexFile.path !== path && path.startsWith(primitiveFolderOf(otherIndexFile.path))));
  const isUnderAPrimitive = (path: string) => primitiveIndexFiles.some((indexFile) => path.startsWith(primitiveFolderOf(indexFile.path)));
  const kindOf = (pathInLayer: string) => pathInLayer.slice(0, pathInLayer.indexOf("/"));
  const idOf = (pathInLayer: string) => pathInLayer.slice(pathInLayer.indexOf("/") + 1);
  const folderUriOf = (kind: string, id: string) => findFileAddress(`${layerFolder}${kind}/${id}/`);
  // Read as bytes, so an asset, and an index.md, reach the charter as they are
  // (CORE-FR-207).
  return [
    ...primitiveIndexFiles.map(({ path, contents }) => {
      const pathInLayer = primitiveFolderOf(path).slice(layerFolder.length, -1);
      const assets = filesInKindFolders
        .filter((assetFile) => assetFile.path !== path && assetFile.path.startsWith(primitiveFolderOf(path)))
        .map((assetFile) => ({ file: assetFile.path.slice(primitiveFolderOf(path).length), contents: assetFile.contents }));
      return new RawPrimitive(primitiveLayer, kindOf(pathInLayer), idOf(pathInLayer), contents, assets, findFileAddress(path), true, folderUriOf);
    }),
    ...filesInKindFolders
      .filter(({ path }) => path.endsWith(".md") && !isUnderAPrimitive(path))
      .map(({ path, contents }) => {
        const pathInLayer = path.slice(layerFolder.length, -".md".length);
        return new RawPrimitive(primitiveLayer, kindOf(pathInLayer), idOf(pathInLayer), contents, [], findFileAddress(path), false, folderUriOf);
      }),
  ];
}

export function skillFilesOf(sourcePaths: readonly string[]): readonly string[] {
  const skillFolders = sourcePaths
    .filter((sourcePath) => sourcePath.startsWith(`${VendorSource.skillsFolder}/`) && sourcePath.endsWith(`/${VendorSource.skillFile}`))
    .map((skillFile) => skillFile.slice(0, -`/${VendorSource.skillFile}`.length))
    .filter((skillFolder) => {
      const folderNames = skillFolder.split("/");
      return folderNames.length - 1 <= SKILLS_FOLDER_DEPTH && !folderNames.includes(DEPENDENCIES_FOLDER);
    });
  return skillFolders
    .filter((skillFolder) => !skillFolders.some((outerFolder) => skillFolder.startsWith(`${outerFolder}/`)))
    .map((skillFolder) => `${skillFolder}/${VendorSource.skillFile}`);
}

/** The folder a build's own output is laid in, from the repository's root:
 *  what `$CW_OUT` stands for (CORE-FR-221). */
export const OUT_FOLDER = ".cw/out";

/**
 * A text as it is laid at `textPlace`, each path into the build's output in
 * it, `$CW_OUT/…`, written from there: from the output's own folder where
 * the text is in the output, and up to the repository's root and down
 * otherwise; from the repository's root where it names no place.
 */
export function laidTextOf(text: string, textPlace?: string): string {
  let outFolderPath = `${OUT_FOLDER}/`;
  if (textPlace !== undefined) {
    const isInOutFolder = textPlace.startsWith(`${OUT_FOLDER}/`);
    const upCount = textPlace.slice(isInOutFolder ? OUT_FOLDER.length + 1 : 0).split("/").length - 1;
    outFolderPath = `${upCount === 0 ? "./" : "../".repeat(upCount)}${isInOutFolder ? "" : `${OUT_FOLDER}/`}`;
  }
  return text.replaceAll(`${OutputPart.outFolderToken}/`, outFolderPath);
}

/** Where one part of a build's output is laid, from the repository's root:
 *  what the output writer lays it at and the charter repository reads it back
 *  from. */
export function placeOfPart(outputPart: OutputPart): string {
  return `${OUT_FOLDER}/${outputPart.path}`;
}

/** The credential one kept secret holds; none where it does not read as one,
 *  so signing in again replaces it. */
export function credentialOfSecret(secret: string): McpCredential | undefined {
  try {
    const keptCredential: unknown = JSON.parse(secret);
    if (keptCredential === null || typeof keptCredential !== "object" || typeof (keptCredential as { accessToken?: unknown }).accessToken !== "string") return undefined;
    const { client: keptClient, ...keptFields } = keptCredential as McpCredential;
    return new McpCredential({ ...keptFields, ...(keptClient === undefined ? {} : { client: new McpClientRegistration(keptClient) }) });
  } catch {
    return undefined;
  }
}
