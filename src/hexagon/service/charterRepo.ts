import { charterRootOf, type CharterRoot } from "../domain/models/charter/CharterRoot.js";
import { REPO_LAYER } from "../domain/models/charter/PrimitiveLayer.js";
import { BUILTIN_PRIMITIVES } from "../domain/models/charter/builtin/index.js";
import { KINDS, type Primitive } from "../domain/models/charter/primitive/Primitive.js";
import { ScriptPrimitive } from "../domain/models/charter/primitive/ScriptPrimitive.js";
import { DomainFault } from "../domain/models/DomainFault.js";
import { charterFolderIn, CHARTER_DIRECTORY, vendorFolderIn } from "../domain/path.js";
import type { ForParsingYaml } from "../port/zdriven/ForParsingYaml.js";
import { BasePrimitive, type AssetFile } from "../domain/models/charter/primitive/BasePrimitive.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";
import type { ForWritingFiles } from "../port/zdriven/ForWritingFiles.js";

/**
 * One repository's charter, read off wherever its files are kept.
 *
 * Two folders, read the same way: what this repository authored under
 * `.cw/charter/`, and what it installed under `.cw/vendor/<name>/`. Which layer
 * a file belongs to is settled here, where the folders are — the charter is
 * handed the layers apart and works nothing out from a path (FR-008, FR-023).
 *
 * The third layer is no folder: what the engine brings is handed in as files
 * written out in memory, on every read, and nothing is read or written on disk
 * for it (FR-015, FR-016).
 *
 * A file outside a kind's folder never reaches the charter: the catalogues and
 * the lockfile sit beside them, and a repository may keep a README of its own
 * there (FR-002). Inside one, a primitive is a folder holding its index.md, and
 * every other file under that folder is one of its assets (FR-141, FR-168); a
 * markdown file under no primitive's folder is handed over with where it sits,
 * and the charter says where to move it.
 */
export async function loadCharterRoot(
  repo: URL,
  fileReaders: ForReadingFiles,
  yamlParser: ForParsingYaml,
): Promise<CharterRoot> {
  const repoHref = repo.href.endsWith("/") ? repo.href : `${repo.href}/`;

  // One layer's primitives: what it keeps in the folder of one of the
  // kinds, which is where a layer keeps them and nowhere else — the lockfile
  // and a README of the repository's own sit beside those folders (FR-002).
  // Going down from a kind's folder, the first index.md found is a primitive,
  // and every other file under its folder is one of its assets, another
  // index.md included (FR-141, FR-168). A markdown file under no primitive's
  // folder is handed over too, for the charter to say where it belongs.
  const read = async (layerFolder: URL) => {
    const filesInKindFolders = (await fileReaders.readFilesRecursively(layerFolder)).filter(({ file }) =>
      KINDS.some((kind) => file.href.startsWith(`${layerFolder.href}${kind}/`)),
    );
    const folderOf = (indexHref: string) => indexHref.slice(0, -BasePrimitive.index.length);
    const indexFiles = filesInKindFolders.filter(({ file }) => file.href.endsWith(`/${BasePrimitive.index}`));
    const primitiveIndexFiles = indexFiles.filter(
      ({ file }) => !indexFiles.some((other) => other.file.href !== file.href && file.href.startsWith(folderOf(other.file.href))),
    );
    const isUnderAPrimitive = (href: string) => primitiveIndexFiles.some(({ file }) => href.startsWith(folderOf(file.href)));
    const authoredFileOf = (file: URL, contents: string, assets: readonly AssetFile[]) => ({
      path: decodeURIComponent(file.href.slice(repoHref.length)),
      pathInLayer: decodeURIComponent(file.href.slice(layerFolder.href.length)),
      contents,
      assets,
    });
    return [
      ...primitiveIndexFiles.map(({ file, contents }) =>
        authoredFileOf(
          file,
          contents,
          filesInKindFolders
            .filter((assetFile) => assetFile.file.href !== file.href && assetFile.file.href.startsWith(folderOf(file.href)))
            .map((assetFile) => ({ file: decodeURIComponent(assetFile.file.href.slice(folderOf(file.href).length)), contents: assetFile.contents })),
        ),
      ),
      ...filesInKindFolders
        .filter(({ file }) => file.href.endsWith(".md") && !isUnderAPrimitive(file.href))
        .map(({ file, contents }) => authoredFileOf(file, contents, [])),
    ];
  };

  const authoredFiles = await read(charterFolderIn(repo));

  // One vendor per folder installed, named by the folder it was installed as.
  const vendors = await fileReaders.listFolders(vendorFolderIn(repo));
  const vendorFiles  = await Promise.all(
    vendors.map(async (folder) => {
      const vendor = decodeURIComponent(folder.href.split("/").at(-2) ?? "");
      return (await read(folder)).map((one) => ({ ...one, vendor }));
    }),
  );

  const builtinFiles = BUILTIN_PRIMITIVES.map((primitive) => ({
    path: primitive.file,
    pathInLayer: `${primitive.primitiveFolder}/${primitive.index}`,
    contents: primitive.toMarkdown(),
    assets: primitive.assets,
  }));

  return charterRootOf({ repo: authoredFiles, vendor: vendorFiles.flat(), builtin: builtinFiles }, yamlParser);
}

/**
 * One primitive put where its kind's primitives are authored (FR-039).
 *
 * Beside `loadCharterRoot`, and the other direction of it: where a primitive of
 * this kind is read from is where one is written to. Where that is, is the
 * primitive's own to say (FR-141); what is settled here is that nothing is
 * written over, and no folder is put inside another primitive's.
 *
 * Not a domain service: it is the ports either side of the writing that are
 * here, and what the file says is the primitive's own (`toMarkdown`).
 *
 * A file already there is refused rather than written over: what somebody
 * authored is theirs, and a scaffolded file over the top of it would take the
 * body with it. Raised rather than given back, for the reason an unknown kind
 * is — there is no file to report a fault under that is not the one already
 * standing there.
 *
 * What comes back is the primitive as the charter will hold it once read: its
 * id, this repository's layer, and the file it was written into, from
 * the repository — so a caller can say what it wrote without going and
 * looking.
 */
export async function writeCharter(
  repo: URL,
  primitive: Primitive,
  fileReader: ForReadingFiles,
  fileWriter: ForWritingFiles,
): Promise<Primitive> {
  const file = new URL(primitive.file, repo.href.endsWith("/") ? repo : new URL(`${repo.href}/`));

  if ((await fileReader.readIfThere(file)) !== undefined)
    throw new DomainFault(
      `${primitive.file} is already there, and writing this one would write over what it holds.`,
      `Open it, or run this again with an id this charter has not got.`,
    );

  // Going down from a kind's folder the first index.md is the primitive, so a
  // folder inside another primitive's would be one of its assets, and one
  // holding a primitive would take it for one of its own (FR-167).
  const folder = new URL(".", file).href;
  const primitiveInTheWay = (await fileReader.readFilesRecursively(new URL(`${primitive.kind}/`, charterFolderIn(repo))))
    .map((readFile) => readFile.file.href)
    .find((href) => href.endsWith(`/${BasePrimitive.index}`) && (folder.startsWith(new URL(".", href).href) || href.startsWith(folder)));
  if (primitiveInTheWay !== undefined)
    throw new DomainFault(
      `${CHARTER_DIRECTORY}/${decodeURIComponent(primitiveInTheWay.slice(charterFolderIn(repo).href.length))} is a primitive, and ${primitive.file} would sit inside its folder or hold it. Every file under a primitive's folder is one of its assets.`,
      `Run this again with an id whose folder is apart from it.`,
    );

  await fileWriter.write(file, primitive.toMarkdown());
  // The asset a script runs, empty, so its author knows where to write it; one
  // already standing there is theirs and is left as it is (FR-167).
  if (primitive instanceof ScriptPrimitive) {
    const executionFile = new URL(primitive.executionPathInFolder, file);
    if ((await fileReader.readIfThere(executionFile)) === undefined) await fileWriter.write(executionFile, "");
  }
  return primitive;
}
