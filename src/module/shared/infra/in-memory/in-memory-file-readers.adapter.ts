import { FolderAddress, type FolderURL } from "../../app/port/out/folder-address.port.js";
import {
  type ForReadingFiles,
  type ListedFile,
  MissingHeldFileFault,
  type ReadFile,
} from "../../app/port/out/reading-files.port.js";
import { decodeContents, encodeContents, findRelativePath, resolveFileUrl } from "../helper.js";

/** Files held in memory: the text or the bytes of each, keyed by its URL, as
 *  it was written, and read back as either. What a test
 *  authors a charter in without touching a disk, and the second implementation
 *  that earns the port its place (plan §2.4).
 *
 *  Set up on one folder, the repository's root, every path it is asked from
 *  there. A test may still name a file or a folder by its whole address, and
 *  is answered each file's address beside its path, wider than the port. */
export class InMemoryFileReaders implements ForReadingFiles {
  /** The folder every path is from (SDK-FR-010). */
  readonly rootFolder: FolderURL;

  private readonly contentsByFile = new Map<string, string | Uint8Array>();
  private readonly modifiedAtByFile = new Map<string, Date>();

  /** Every listing and every read served, in order, for a test that cares how
   *  often it was asked. */
  readonly calls: string[] = [];

  constructor(
    contentsByFileAddress: Readonly<Record<string, string | Uint8Array>> = {},
    rootFolder: URL = new URL("file:///repo/"),
  ) {
    this.rootFolder = FolderAddress.parseFolderUrl(rootFolder);
    for (const [filePath, contents] of Object.entries(contentsByFileAddress))
      this.writeFile(new URL(filePath), contents);
  }

  /** The same files, every path from another folder: what a test reads a
   *  home's files through, beside the repository's. */
  createFolderReader(rootFolder: URL): InMemoryFileReaders {
    return Object.assign(new InMemoryFileReaders({}, rootFolder), {
      contentsByFile: this.contentsByFile,
      modifiedAtByFile: this.modifiedAtByFile,
      calls: this.calls,
    });
  }

  /** Author or replace one file, modified now unless a test says when. */
  writeFile(fileUrl: URL, contents: string | Uint8Array, modifiedAt: Date = new Date()): void {
    // Bytes are kept as a copy, so what a caller does to its own leaves the file as written.
    this.contentsByFile.set(fileUrl.href, typeof contents === "string" ? contents : contents.slice());
    this.modifiedAtByFile.set(fileUrl.href, modifiedAt);
  }

  /** Drop one file, so a test can watch a listing shrink. */
  removeFile(fileUrl: URL): void {
    this.contentsByFile.delete(fileUrl.href);
    this.modifiedAtByFile.delete(fileUrl.href);
  }

  async readFilesRecursively(folderPath: string | URL): Promise<readonly (ReadFile & { readonly fileUrl: URL })[]> {
    const folderUrl = this.#resolveFolderUrl(folderPath);
    this.calls.push(`files under ${folderUrl.href}`);
    return this.#listFilesUnder(folderUrl).map(([filePath, contents]) => ({
      path: findRelativePath(this.rootFolder, new URL(filePath)),
      fileUrl: new URL(filePath),
      contents: decodeContents(contents),
    }));
  }

  async readBytesRecursively(
    folderPath: string | URL,
  ): Promise<readonly (ReadFile<Uint8Array> & { readonly fileUrl: URL })[]> {
    const folderUrl = this.#resolveFolderUrl(folderPath);
    this.calls.push(`bytes under ${folderUrl.href}`);
    return this.#listFilesUnder(folderUrl).map(([filePath, contents]) => ({
      path: findRelativePath(this.rootFolder, new URL(filePath)),
      fileUrl: new URL(filePath),
      contents: encodeContents(contents),
    }));
  }

  async listFiles(folderPath: string | URL): Promise<readonly ListedFile[]> {
    const folderUrl = this.#resolveFolderUrl(folderPath);
    this.calls.push(`listed files under ${folderUrl.href}`);
    return this.#listFilesUnder(folderUrl)
      .filter(([filePath]) => !filePath.slice(folderUrl.href.length).includes("/"))
      .map(([filePath]) => ({
        path: findRelativePath(this.rootFolder, new URL(filePath)),
        modifiedAt: this.modifiedAtByFile.get(filePath) ?? new Date(),
      }));
  }

  async listFolders(folderPath: string | URL): Promise<readonly string[]> {
    const folderUrl = this.#resolveFolderUrl(folderPath);
    this.calls.push(`folders under ${folderUrl.href}`);
    const folderNames = this.#listFilesUnder(folderUrl).flatMap(([filePath]) => {
      const restNames = filePath.slice(folderUrl.href.length).split("/");
      return restNames.length < 2 ? [] : [restNames[0] ?? ""];
    });
    return [...new Set(folderNames)].map((folderName) =>
      findRelativePath(this.rootFolder, new URL(`${folderName}/`, folderUrl)),
    );
  }

  /** What one file holds, for a test reading back what a build wrote. Not the
   *  port's: the hexagon reads a folder, never one file it has not been
   *  handed. */
  async readFile(fileUrl: URL): Promise<string> {
    const contents = this.contentsByFile.get(fileUrl.href);
    if (contents === undefined)
      throw new MissingHeldFileFault(
        `This charter holds no file at ${fileUrl.href}`,
        "Write the file before reading it back.",
      );
    return decodeContents(contents);
  }

  findFileAddress(filePath: string): string {
    return resolveFileUrl(this.rootFolder, filePath).href;
  }

  async readIfThere(filePath: string | URL): Promise<string | undefined> {
    const fileUrl = filePath instanceof URL ? filePath : resolveFileUrl(this.rootFolder, filePath);
    this.calls.push(`read ${fileUrl.href}`);
    const contents = this.contentsByFile.get(fileUrl.href);
    return contents === undefined ? undefined : decodeContents(contents);
  }

  async readBytesIfThere(filePath: string | URL): Promise<Uint8Array | undefined> {
    const fileUrl = filePath instanceof URL ? filePath : resolveFileUrl(this.rootFolder, filePath);
    this.calls.push(`read bytes ${fileUrl.href}`);
    const contents = this.contentsByFile.get(fileUrl.href);
    return contents === undefined ? undefined : encodeContents(contents);
  }

  /** The folder at a path, as the address its files are keyed under. */
  #resolveFolderUrl(folderPath: string | URL): URL {
    if (folderPath instanceof URL) return folderPath;
    return folderPath === "" ? this.rootFolder : resolveFileUrl(this.rootFolder, `${folderPath}/`);
  }

  /** Every file under one folder, at any depth, by its address. */
  #listFilesUnder(folderUrl: URL): readonly (readonly [string, string | Uint8Array])[] {
    return [...this.contentsByFile.entries()].filter(([filePath]) => filePath.startsWith(folderUrl.href));
  }
}
