import { readdir, readFile, stat } from "node:fs/promises";
import type { Dirent } from "node:fs";
import type { ForReadingFiles, ListedFile, ReadFile } from "../app/port/out/reading-files.port.js";
import { FolderAddress, type FolderURL } from "../app/port/out/folder-address.port.js";
import { pathFrom, urlAt } from "./helper.js";

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
    this.#rootFolder = FolderAddress.urlOf(rootFolder);
  }

  async readFilesRecursively(folderPath: string): Promise<readonly ReadFile[]> {
    return Promise.all((await this.#filesUnder(this.#folderUrlOf(folderPath))).map(async (file) => ({ path: pathFrom(this.#rootFolder, file), contents: await readFile(file, "utf8") })));
  }

  async readBytesRecursively(folderPath: string): Promise<readonly ReadFile<Uint8Array>[]> {
    return Promise.all((await this.#filesUnder(this.#folderUrlOf(folderPath))).map(async (file) => ({ path: pathFrom(this.#rootFolder, file), contents: new Uint8Array(await readFile(file)) })));
  }

  async listFiles(folderPath: string): Promise<readonly ListedFile[]> {
    const folder = this.#folderUrlOf(folderPath);
    return Promise.all(
      (await entriesOf(folder))
        .filter((entry) => entry.isFile())
        .map(async (entry) => {
          const file = new URL(encodeURIComponent(entry.name), folder);
          return { path: pathFrom(this.#rootFolder, file), modifiedAt: (await stat(file)).mtime };
        }),
    );
  }

  async listFolders(folderPath: string): Promise<readonly string[]> {
    const folder = this.#folderUrlOf(folderPath);
    return (await entriesOf(folder)).filter((entry) => entry.isDirectory()).map((entry) => pathFrom(this.#rootFolder, under(folder, entry.name)));
  }

  findFileAddress(filePath: string): string {
    return urlAt(this.#rootFolder, filePath).href;
  }

  async readIfThere(filePath: string): Promise<string | undefined> {
    try {
      return await readFile(urlAt(this.#rootFolder, filePath), "utf8");
    } catch (raised) {
      if ((raised as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw raised;
    }
  }

  async readBytesIfThere(filePath: string): Promise<Uint8Array | undefined> {
    try {
      return new Uint8Array(await readFile(urlAt(this.#rootFolder, filePath)));
    } catch (readError) {
      if ((readError as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw readError;
    }
  }

  /** The folder at a path, as an address a directory is read at. */
  #folderUrlOf(folderPath: string): URL {
    return folderPath === "" ? this.#rootFolder : urlAt(this.#rootFolder, `${folderPath}/`);
  }

  /** Every file under one folder, at any depth. */
  async #filesUnder(folder: URL): Promise<readonly URL[]> {
    const fileLists = await Promise.all(
      (await entriesOf(folder)).map(async (entry) => (entry.isDirectory() ? this.#filesUnder(under(folder, entry.name)) : [new URL(encodeURIComponent(entry.name), folder)])),
    );
    return fileLists.flat();
  }
}

/** What one directory holds, and nothing where there is no such directory. */
async function entriesOf(at: URL): Promise<readonly Dirent[]> {
  try {
    return await readdir(at, { withFileTypes: true });
  } catch (raised) {
    if ((raised as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw raised;
  }
}

/** One directory inside another. */
function under(at: URL, directory: string): URL {
  return new URL(`${encodeURIComponent(directory)}/`, at);
}
