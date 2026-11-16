import {
  type AdapterFault,
  AssetFile,
  BasePrimitive,
  charterPath,
  type ForReadingFiles,
  OldLayoutFault,
  OldVendorLayoutFault,
  outputPath,
  type PrimitiveLayer,
  Primitives,
  RawPrimitive,
  type ReadFile,
  vendorSourcePath,
} from "../app/port/out/managing-charter.port.js";
import {
  McpAuthMethod,
  type McpAuthMethodName,
  McpClientRegistration,
  McpCredential,
} from "../app/port/out/storing-credentials.port.js";

/** How many folders under `skills/` a skill's folder may sit, as `npx skills`
 *  walks it: `skills/<name>/`, `skills/<group>/<name>/`, and one group more
 *  (CORE-FR-185). */
const SKILLS_FOLDER_DEPTH = 3;

/** Where a skills repository keeps what it depends on, never a skill of its
 *  own (CORE-FR-185). */
const DEPENDENCIES_FOLDER_NAME = "node_modules";

/** The parts a repository laid out the old way keeps right under its
 *  workspace, beside the charter, as their paths from the repository. */
const OLD_LAYOUT_FOLDER_PATHS = ["test", "eval", "vendor"].map(
  (folderName) => `${charterPath.workspaceFolderPath}/${folderName}`,
);

/** What a repository, or a source, laid out the old way is refused with,
 *  naming the skill that moves it (CORE-FR-226, CORE-FR-227). */
export function createOldLayoutFault(layoutOwner: string, oldPaths: readonly string[]): AdapterFault {
  return new OldLayoutFault(
    `${layoutOwner} is laid out the old way: ${oldPaths.join(", ")} ${oldPaths.length === 1 ? "sits" : "sit"} where the charter now keeps its primitives, tests, eval cases and vendors under ${charterPath.charterFolderPath}/.`,
    `Have your agent follow the cw-author skill to move it: each kind's folder under ${charterPath.charterFolderPath}/ into ${charterPath.charterFolderPath}/primitive/, and .cw/test/, .cw/eval/ and .cw/vendor/ into ${charterPath.charterFolderPath}/test/, ${charterPath.charterFolderPath}/eval/ and ${charterPath.charterFolderPath}/vendor/.`,
    { internal: false },
  );
}

/** Each path a layout of the old way keeps, among these paths of a
 *  repository or a source, each folder named once: a part right under the
 *  workspace beside the charter, or a kind's folder right under the charter
 *  (CORE-FR-226). */
export function findOldLayoutPaths(paths: readonly string[], sourcePrefix = ""): readonly string[] {
  const oldPaths = paths.flatMap((path) => {
    if (!path.startsWith(sourcePrefix)) return [];
    const repoPath = path.slice(sourcePrefix.length);
    const oldFolderPath = OLD_LAYOUT_FOLDER_PATHS.find(
      (folderPath) => repoPath === folderPath || repoPath.startsWith(`${folderPath}/`),
    );
    if (oldFolderPath !== undefined) return [`${sourcePrefix}${oldFolderPath}/`];
    const [kindName] = repoPath.startsWith(`${charterPath.charterFolderPath}/`)
      ? repoPath.slice(`${charterPath.charterFolderPath}/`.length).split("/")
      : [];
    return kindName !== undefined && Primitives.isKind(kindName)
      ? [`${sourcePrefix}${charterPath.charterFolderPath}/${kindName}/`]
      : [];
  });
  return [...new Set(oldPaths)].sort();
}

/** Refused where the repository is laid out the old way (CORE-FR-226). */
export async function assertNewLayout(fileReader: ForReadingFiles): Promise<void> {
  const [workspaceFolderPaths, charterFolderPaths] = await Promise.all([
    fileReader.listFolders(charterPath.workspaceFolderPath),
    fileReader.listFolders(charterPath.charterFolderPath),
  ]);
  const oldPaths = findOldLayoutPaths(
    [...workspaceFolderPaths, ...charterFolderPaths].map((folderPath) => `${folderPath}/`),
  );
  if (oldPaths.length > 0) throw createOldLayoutFault("This repository", oldPaths);
}

/** How deep a vendor's name goes under the vendor folder:
 *  `<owner>/<repository>/<name>` (FR-050, CORE-FR-196). */
const VENDOR_NAME_DEPTH = 3;

/**
 * The name of each vendor these files under the vendor folder keep, each file
 * by its path from that folder: every vendor at
 * `<owner>/<repository>/<name>/<primitives folder>/`, named by those three
 * folders. A file kept anywhere else is a vendor installed the way an earlier
 * version laid one, refused naming the folder to take away before it is
 * installed again: nothing of it is read as a vendor (FR-180).
 */
export function findVendorNames(
  vendorFilePaths: readonly string[],
  findFileAddress: (path: string) => string,
): readonly string[] {
  // A file kept right in the vendor folder, its `.gitkeep`, is no vendor's.
  const nestedVendorFilePaths = vendorFilePaths.filter((filePath) => filePath.includes("/"));
  const oldFolderNames = [
    ...new Set(
      nestedVendorFilePaths
        .filter(
          (filePath) =>
            filePath.split("/")[VENDOR_NAME_DEPTH] !== charterPath.primitivesFolderName ||
            filePath.split("/").length <= VENDOR_NAME_DEPTH + 1,
        )
        // A kind's folder right under the first is a vendor named by that
        // one folder alone; otherwise the owner and the repository name it.
        .map((filePath) =>
          filePath
            .split("/")
            .slice(0, Primitives.isKind(filePath.split("/")[1]) ? 1 : 2)
            .join("/"),
        ),
    ),
  ].sort();
  if (oldFolderNames.length > 0)
    throw new OldVendorLayoutFault(
      `${oldFolderNames.map((oldFolderName) => findFileAddress(`${charterPath.vendorsFolderPath}/${oldFolderName}`)).join(", ")} ${oldFolderNames.length === 1 ? "is" : "are"} laid out the way an earlier version installed a vendor, not as <owner>/<repository>/<name>/${charterPath.primitivesFolderName}/.`,
      `Delete ${oldFolderNames.length === 1 ? "it" : "them"}, then install each source again with "cw vendor add".`,
      { internal: false },
    );
  return [
    ...new Set(nestedVendorFilePaths.map((filePath) => filePath.split("/").slice(0, VENDOR_NAME_DEPTH).join("/"))),
  ].sort();
}

export function readRawPrimitives(
  keptFiles: readonly ReadFile<Uint8Array>[],
  layerFolderPath: string,
  primitiveLayer: PrimitiveLayer,
  findFileAddress: (path: string) => string,
): readonly RawPrimitive[] {
  const filesInKindFolders = keptFiles.filter(({ path }) =>
    Primitives.kinds.some((kind) => path.startsWith(`${layerFolderPath}${kind}/`)),
  );
  const findPrimitiveFolderPath = (indexPath: string) => indexPath.slice(0, -BasePrimitive.indexFileName.length);
  const indexFiles = filesInKindFolders.filter(({ path }) => path.endsWith(`/${BasePrimitive.indexFileName}`));
  const primitiveIndexFiles = indexFiles.filter(
    ({ path }) =>
      !indexFiles.some(
        (otherIndexFile) =>
          otherIndexFile.path !== path && path.startsWith(findPrimitiveFolderPath(otherIndexFile.path)),
      ),
  );
  const isUnderAPrimitive = (path: string) =>
    primitiveIndexFiles.some((indexFile) => path.startsWith(findPrimitiveFolderPath(indexFile.path)));
  const readKind = (pathInLayer: string) => pathInLayer.slice(0, pathInLayer.indexOf("/"));
  const readId = (pathInLayer: string) => pathInLayer.slice(pathInLayer.indexOf("/") + 1);
  const findFolderUri = (kind: string, id: string) => findFileAddress(`${layerFolderPath}${kind}/${id}/`);
  // Read as bytes, so an asset, and an index.md, reach the charter as they are
  // (CORE-FR-207).
  return [
    ...primitiveIndexFiles.map(({ path, contents }) => {
      const pathInLayer = findPrimitiveFolderPath(path).slice(layerFolderPath.length, -1);
      const assets = filesInKindFolders
        .filter((assetFile) => assetFile.path !== path && assetFile.path.startsWith(findPrimitiveFolderPath(path)))
        .map(
          (assetFile) => new AssetFile(assetFile.path.slice(findPrimitiveFolderPath(path).length), assetFile.contents),
        );
      return new RawPrimitive(
        primitiveLayer,
        readKind(pathInLayer),
        readId(pathInLayer),
        contents,
        assets,
        findFileAddress(path),
        true,
        findFolderUri,
      );
    }),
    ...filesInKindFolders
      .filter(({ path }) => path.endsWith(".md") && !isUnderAPrimitive(path))
      .map(({ path, contents }) => {
        const pathInLayer = path.slice(layerFolderPath.length, -".md".length);
        return new RawPrimitive(
          primitiveLayer,
          readKind(pathInLayer),
          readId(pathInLayer),
          contents,
          [],
          findFileAddress(path),
          false,
          findFolderUri,
        );
      }),
  ];
}

export function findSkillFilePaths(sourcePaths: readonly string[]): readonly string[] {
  const skillFolderPaths = sourcePaths
    .filter(
      (sourcePath) =>
        sourcePath.startsWith(`${vendorSourcePath.skillsFolderPath}/`) &&
        sourcePath.endsWith(`/${vendorSourcePath.skillFileName}`),
    )
    .map((skillFilePath) => skillFilePath.slice(0, -`/${vendorSourcePath.skillFileName}`.length))
    .filter((skillFolderPath) => {
      const folderNames = skillFolderPath.split("/");
      return folderNames.length - 1 <= SKILLS_FOLDER_DEPTH && !folderNames.includes(DEPENDENCIES_FOLDER_NAME);
    });
  return skillFolderPaths
    .filter(
      (skillFolderPath) =>
        !skillFolderPaths.some((outerFolderPath) => skillFolderPath.startsWith(`${outerFolderPath}/`)),
    )
    .map((skillFolderPath) => `${skillFolderPath}/${vendorSourcePath.skillFileName}`);
}

/** The folder a build's own output is laid in, from the repository's root:
 *  what `$CW_OUT` stands for (CORE-FR-221). */
export const OUT_FOLDER = `${charterPath.workspaceFolderPath}/out`;

/**
 * A text as it is laid at `textPlace`, each path into the compiled output in
 * it, `$CW_OUT/…`, written from there: from the output's own folder where
 * the text is in the output, and up to the repository's root and down
 * otherwise; from the repository's root where it names no place.
 */
export function resolveLaidText(text: string, textPlace?: string): string {
  let outFolderPath = `${OUT_FOLDER}/`;
  if (textPlace !== undefined) {
    const isInOutFolder = textPlace.startsWith(`${OUT_FOLDER}/`);
    const upCount = textPlace.slice(isInOutFolder ? OUT_FOLDER.length + 1 : 0).split("/").length - 1;
    outFolderPath = `${upCount === 0 ? "./" : "../".repeat(upCount)}${isInOutFolder ? "" : `${OUT_FOLDER}/`}`;
  }
  return text.replaceAll(`${outputPath.cwOutFolderPlaceholder}/`, outFolderPath);
}

/** Where the item at this path inside the compiled output is laid, from the
 *  repository's root: what the output writer lays it at and the charter
 *  repository reads it back from. */
export function findItemPlace(itemPath: string): string {
  return `${OUT_FOLDER}/${itemPath}`;
}

/** The credential one kept secret holds; none where it does not read as one,
 *  so signing in again replaces it. */
export function parseCredentialSecret(secret: string): McpCredential | undefined {
  try {
    const keptCredential: unknown = JSON.parse(secret);
    if (
      keptCredential === null ||
      typeof keptCredential !== "object" ||
      typeof (keptCredential as { accessToken?: unknown }).accessToken !== "string"
    )
      return undefined;
    const {
      client: keptClient,
      method: keptMethodName,
      ...keptFields
    } = keptCredential as Omit<McpCredential, "method"> & { readonly method: McpAuthMethodName };
    return new McpCredential({
      ...keptFields,
      method: McpAuthMethod.of(keptMethodName),
      ...(keptClient === undefined ? {} : { client: new McpClientRegistration(keptClient) }),
    });
  } catch {
    return undefined;
  }
}

/**
 * An agent's settings, JSON the charter shares with the repository, with the
 * fields this charter speaks for put over the top of what is there now
 * (FR-018): every other one is the repository's and comes through untouched.
 * Field by field at every depth, so an entry of the repository's beside the
 * charter's under one key — a server of its own under `mcpServers` — stays
 * (FR-146); a list or a value is the charter's whole, so what it no longer
 * asks for goes.
 */
export function mergeSettingsText(currentText: string | undefined, charterText: string): string {
  const isPlainObject = (jsonValue: unknown): jsonValue is Record<string, unknown> =>
    typeof jsonValue === "object" && jsonValue !== null && !Array.isArray(jsonValue);
  const mergeJSONValues = (heldValue: unknown, charterValue: unknown): unknown =>
    isPlainObject(heldValue) && isPlainObject(charterValue)
      ? Object.fromEntries(
          [...new Set([...Object.keys(heldValue), ...Object.keys(charterValue)])].map((field) => [
            field,
            field in charterValue ? mergeJSONValues(heldValue[field], charterValue[field]) : heldValue[field],
          ]),
        )
      : charterValue;
  return `${JSON.stringify(mergeJSONValues(JSON.parse(currentText?.trim() || "{}"), JSON.parse(charterText)), undefined, 2)}\n`;
}

/**
 * An agent's settings with every hook a build wrote under the old name of
 * `cw run sensor` moved to it (CORE-FR-244): a signal that has lost its last
 * sensor keeps the command the last build wrote (CORE-FR-175), so a hook a
 * build before the rename wrote would otherwise name the old one for good
 * (CORE-SC-076).
 */
export function rewriteDeprecatedSensorHooks(settingsText: string): string {
  return settingsText.replaceAll("cw sensor run ", "cw run sensor ");
}

/**
 * An agent's entry file, the repository's, with the charter's section written
 * in place between its first line and its last, or put at the end (FR-051).
 * A section says where it starts and ends itself, so nothing here knows what
 * a marker of the engine's looks like.
 */
export function mergeEntryFileText(currentText: string | undefined, sectionText: string): string {
  const heldText = currentText ?? "";
  const sectionLines = sectionText.trimEnd().split("\n");
  // Escaped, because a marker is a comment and a comment holds characters
  // a regular expression reads as its own.
  const [startPattern, endPattern] = [sectionLines.at(0) ?? "", sectionLines.at(-1) ?? ""].map((line) =>
    line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const sectionPattern = new RegExp(`${startPattern}[\\s\\S]*?${endPattern}\\n?`, "g");

  // Nothing of this build's is in that file yet: the section goes after
  // whatever is there, and an empty file is the section alone.
  if (heldText.match(sectionPattern) === null)
    return heldText === "" ? sectionText : `${heldText.replace(/\n*$/, "\n")}\n${sectionText}`;

  // A file carrying the marker more than once — a merge conflict resolved
  // by keeping both sides — comes back with one, so a second build over it
  // changes nothing (SC-007).
  let isSectionWritten = false;
  return heldText.replace(sectionPattern, () => {
    if (isSectionWritten) return "";
    isSectionWritten = true;
    return sectionText;
  });
}
