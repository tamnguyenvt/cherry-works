import type { ForReadingFiles, ListedFile, ReadFile } from "../../app/port/out/reading-files.port.js";
import { FolderAddress, type FolderURL } from "../../app/port/out/folder-address.port.js";
import { decodeContents, encodeContents, pathFrom, urlAt } from "../helper.js";

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

  constructor(files: Readonly<Record<string, string | Uint8Array>> = {}, rootFolder: URL = new URL("file:///repo/")) {
    this.rootFolder = FolderAddress.urlOf(rootFolder);
    for (const [file, contents] of Object.entries(files)) this.write(new URL(file), contents);
  }

  /** The same files, every path from another folder: what a test reads a
   *  home's files through, beside the repository's. */
  rootedAt(rootFolder: URL): InMemoryFileReaders {
    return Object.assign(new InMemoryFileReaders({}, rootFolder), { contentsByFile: this.contentsByFile, modifiedAtByFile: this.modifiedAtByFile, calls: this.calls });
  }

  /** Author or replace one file, modified now unless a test says when. */
  write(file: URL, contents: string | Uint8Array, modifiedAt: Date = new Date()): void {
    // Bytes are kept as a copy, so what a caller does to its own leaves the file as written.
    this.contentsByFile.set(file.href, typeof contents === "string" ? contents : contents.slice());
    this.modifiedAtByFile.set(file.href, modifiedAt);
  }

  /** Drop one file, so a test can watch a listing shrink. */
  remove(file: URL): void {
    this.contentsByFile.delete(file.href);
    this.modifiedAtByFile.delete(file.href);
  }

  async readFilesRecursively(folderPath: string | URL): Promise<readonly (ReadFile & { readonly file: URL })[]> {
    const folder = this.#folderUrlOf(folderPath);
    this.calls.push(`files under ${folder.href}`);
    return this.#filesUnder(folder).map(([file, contents]) => ({ path: pathFrom(this.rootFolder, new URL(file)), file: new URL(file), contents: decodeContents(contents) }));
  }

  async readBytesRecursively(folderPath: string | URL): Promise<readonly (ReadFile<Uint8Array> & { readonly file: URL })[]> {
    const folder = this.#folderUrlOf(folderPath);
    this.calls.push(`bytes under ${folder.href}`);
    return this.#filesUnder(folder).map(([file, contents]) => ({ path: pathFrom(this.rootFolder, new URL(file)), file: new URL(file), contents: encodeContents(contents) }));
  }

  async listFiles(folderPath: string | URL): Promise<readonly ListedFile[]> {
    const folder = this.#folderUrlOf(folderPath);
    this.calls.push(`listed files under ${folder.href}`);
    return this.#filesUnder(folder)
      .filter(([file]) => !file.slice(folder.href.length).includes("/"))
      .map(([file]) => ({ path: pathFrom(this.rootFolder, new URL(file)), modifiedAt: this.modifiedAtByFile.get(file) ?? new Date() }));
  }

  async listFolders(folderPath: string | URL): Promise<readonly string[]> {
    const folder = this.#folderUrlOf(folderPath);
    this.calls.push(`folders under ${folder.href}`);
    const folderNames = this.#filesUnder(folder).flatMap(([file]) => {
      const restNames = file.slice(folder.href.length).split("/");
      return restNames.length < 2 ? [] : [restNames[0] ?? ""];
    });
    return [...new Set(folderNames)].map((folderName) => pathFrom(this.rootFolder, new URL(`${folderName}/`, folder)));
  }

  /** What one file holds, for a test reading back what a build wrote. Not the
   *  port's: the hexagon reads a folder, never one file it has not been
   *  handed. */
  async read(file: URL): Promise<string> {
    const contents = this.contentsByFile.get(file.href);
    if (contents === undefined) throw new Error(`This charter holds no file at ${file.href}`);
    return decodeContents(contents);
  }

  findFileAddress(filePath: string): string {
    return urlAt(this.rootFolder, filePath).href;
  }

  async readIfThere(filePath: string | URL): Promise<string | undefined> {
    const file = filePath instanceof URL ? filePath : urlAt(this.rootFolder, filePath);
    this.calls.push(`read ${file.href}`);
    const contents = this.contentsByFile.get(file.href);
    return contents === undefined ? undefined : decodeContents(contents);
  }

  async readBytesIfThere(filePath: string | URL): Promise<Uint8Array | undefined> {
    const file = filePath instanceof URL ? filePath : urlAt(this.rootFolder, filePath);
    this.calls.push(`read bytes ${file.href}`);
    const contents = this.contentsByFile.get(file.href);
    return contents === undefined ? undefined : encodeContents(contents);
  }

  /** The folder at a path, as the address its files are keyed under. */
  #folderUrlOf(folderPath: string | URL): URL {
    if (folderPath instanceof URL) return folderPath;
    return folderPath === "" ? this.rootFolder : urlAt(this.rootFolder, `${folderPath}/`);
  }

  /** Every file under one folder, at any depth, by its address. */
  #filesUnder(folder: URL): readonly (readonly [string, string | Uint8Array])[] {
    return [...this.contentsByFile.entries()].filter(([file]) => file.startsWith(folder.href));
  }
}
