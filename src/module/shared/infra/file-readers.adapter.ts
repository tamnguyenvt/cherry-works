import { readFile, stat } from "node:fs/promises";
import { FolderAddress, type FolderURL } from "../app/port/out/folder-address.port.js";
import {
  type ForReadingFiles,
  type ListedFile,
  type ReadFile,
  UnreadableFileFault,
} from "../app/port/out/reading-files.port.js";
import { findRelativePath, readFolderEntries, resolveFileUrl, resolveSubfolderUrl } from "./helper.js";

/** DRIVEN ADAPTER: the filesystem. The charter as it was authored, on a disk.
 *
 *  A directory that is not there is no files rather than a failure: a charter
 *  holding some of the kind directories and not the rest is a charter, and the
 *  rest are authored the day someone needs them. Anything else the disk refuses — a
 *  permission, a broken link — is raised, since that is a repository to fix and
 *  not a charter to report on.
 *
 *  Set up on one folder, the repository's root, and every path it is asked
 *  is from there (CORE-FR-217). */
export class FileReaders implements ForReadingFiles {
  readonly #rootFolder: FolderURL;

  constructor(
    /** The folder every path is from: refused here unless it names one
     *  (SDK-FR-010). */
    rootFolder: URL,
  ) {
    this.#rootFolder = FolderAddress.parseFolderUrl(rootFolder);
  }

  async readFilesRecursively(folderPath: string): Promise<readonly ReadFile[]> {
    return Promise.all(
      (await this.#listFilesUnder(this.#resolveFolderUrl(folderPath))).map(async (fileUrl) => ({
        path: findRelativePath(this.#rootFolder, fileUrl),
        contents: await readFile(fileUrl, "utf8"),
      })),
    );
  }

  async readBytesRecursively(folderPath: string): Promise<readonly ReadFile<Uint8Array>[]> {
    return Promise.all(
      (await this.#listFilesUnder(this.#resolveFolderUrl(folderPath))).map(async (fileUrl) => ({
        path: findRelativePath(this.#rootFolder, fileUrl),
        contents: new Uint8Array(await readFile(fileUrl)),
      })),
    );
  }

  async listFiles(folderPath: string): Promise<readonly ListedFile[]> {
    const folderUrl = this.#resolveFolderUrl(folderPath);
    return Promise.all(
      (await readFolderEntries(folderUrl))
        .filter((folderEntry) => folderEntry.isFile())
        .map(async (folderEntry) => {
          const fileUrl = new URL(encodeURIComponent(folderEntry.name), folderUrl);
          return { path: findRelativePath(this.#rootFolder, fileUrl), modifiedAt: (await stat(fileUrl)).mtime };
        }),
    );
  }

  async listFolders(folderPath: string): Promise<readonly string[]> {
    const folderUrl = this.#resolveFolderUrl(folderPath);
    return (await readFolderEntries(folderUrl))
      .filter((folderEntry) => folderEntry.isDirectory())
      .map((folderEntry) => findRelativePath(this.#rootFolder, resolveSubfolderUrl(folderUrl, folderEntry.name)));
  }

  findFileAddress(filePath: string): string {
    return resolveFileUrl(this.#rootFolder, filePath).href;
  }

  async readIfThere(filePath: string): Promise<string | undefined> {
    try {
      return await readFile(resolveFileUrl(this.#rootFolder, filePath), "utf8");
    } catch (readError) {
      if ((readError as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw new UnreadableFileFault(
        `"${resolveFileUrl(this.#rootFolder, filePath).pathname}" could not be read.`,
        "Check that the file can be read, and run this again.",
        { cause: readError },
      );
    }
  }

  async readBytesIfThere(filePath: string): Promise<Uint8Array | undefined> {
    try {
      return new Uint8Array(await readFile(resolveFileUrl(this.#rootFolder, filePath)));
    } catch (readError) {
      if ((readError as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw new UnreadableFileFault(
        `"${resolveFileUrl(this.#rootFolder, filePath).pathname}" could not be read.`,
        "Check that the file can be read, and run this again.",
        { cause: readError },
      );
    }
  }

  /** The folder at a path, as an address a directory is read at. */
  #resolveFolderUrl(folderPath: string): URL {
    return folderPath === "" ? this.#rootFolder : resolveFileUrl(this.#rootFolder, `${folderPath}/`);
  }

  /** Every file under one folder, at any depth. */
  async #listFilesUnder(folderUrl: URL): Promise<readonly URL[]> {
    const fileLists = await Promise.all(
      (await readFolderEntries(folderUrl)).map(async (folderEntry) =>
        folderEntry.isDirectory()
          ? this.#listFilesUnder(resolveSubfolderUrl(folderUrl, folderEntry.name))
          : [new URL(encodeURIComponent(folderEntry.name), folderUrl)],
      ),
    );
    return fileLists.flat();
  }
}
