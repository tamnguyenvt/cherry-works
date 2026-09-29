import {
  BUILTIN_PATH_PREFIX,
  charterRootOf,
  REPO_SCOPE,
  ScopedPrimitive,
  type CharterRoot,
} from "../domain/models/charter/CharterRoot.js";
import { BUILTIN_PRIMITIVES } from "../domain/models/charter/builtin/index.js";
import { identityOf, KINDS, type Primitive } from "../domain/models/charter/primitive/Primitive.js";
import { DomainFault } from "../domain/models/DomainFault.js";
import { charterFolderIn, CHARTER_DIRECTORY, vendorFolderIn } from "../domain/path.js";
import type { ForParsingYaml } from "../port/zdriven/ForParsingYaml.js";
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
 * there (FR-002). Nor does a file inside one that is not markdown — a primitive
 * is one markdown file, so what a kind's folder keeps of the filesystem's or
 * git's own is not read as one.
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
  // Each at the path a user would name it by.
  const read = async (layer: URL) =>
    (await fileReaders.readFilesRecursively(layer))
      .filter(
        ({ file }) =>
          file.href.endsWith(".md") && KINDS.some((kind) => file.href.startsWith(`${layer.href}${kind}/`)),
      )
      .map(({ file, contents }) => ({ path: decodeURIComponent(file.href.slice(repoHref.length)), contents }));

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
    path: `${BUILTIN_PATH_PREFIX}/${primitive.kind}/${primitive.headers.id}.md`,
    contents: primitive.toMarkdown(),
  }));

  return charterRootOf({ repo: authoredFiles, vendor: vendorFiles.flat(), builtin: builtinFiles }, yamlParser);
}

/**
 * One primitive put where its kind's primitives are authored (FR-039).
 *
 * Beside `loadCharterRoot`, and the other direction of it: where a primitive of
 * this kind is read from is where one is written to, so the convention — a
 * directory per kind, since nothing reads the directory (FR-002) — is settled
 * in the two modules that act on it and nowhere else.
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
 * identity, this repository's layer, and the file it was written into, from
 * the repository — so a caller can say what it wrote without going and
 * looking.
 */
export async function writeCharter(
  repo: URL,
  primitive: Primitive,
  fileReader: ForReadingFiles,
  fileWriter: ForWritingFiles,
): Promise<ScopedPrimitive> {
  const under = `${primitive.kind}/${primitive.headers.id}.md`;
  const path = `${CHARTER_DIRECTORY}/${under}`;
  const file = new URL(under, charterFolderIn(repo));

  if ((await fileReader.readIfThere(file)) !== undefined)
    throw new DomainFault(
      `${path} is already there, and writing this one would write over what it holds.`,
      `Open it, or run this again with an identity this charter has not got.`,
    );

  await fileWriter.write(file, primitive.toMarkdown());
  return new ScopedPrimitive(identityOf({ kind: primitive.kind, id: primitive.headers.id }), REPO_SCOPE, path, primitive);
}
