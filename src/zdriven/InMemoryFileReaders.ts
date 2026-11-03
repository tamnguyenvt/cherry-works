import type { ForReadingFiles, ListedFile, ReadFile } from "#hexagon/port/zdriven/ForReadingFiles.js";
import { decodeContents, encodeContents } from "./helper.js";

/** Files held in memory: the text or the bytes of each, keyed by its URL, as
 *  it was written, and read back as either. What a test
 *  authors a charter in without touching a disk, and the second implementation
 *  that earns the port its place (plan §2.4). */
export class InMemoryFileReaders implements ForReadingFiles {
  private readonly contentsByFile = new Map<string, string | Uint8Array>();
  private readonly modifiedAtByFile = new Map<string, Date>();

  /** Every listing and every read served, in order, for a test that cares how
   *  often it was asked. */
  readonly calls: string[] = [];

  constructor(files: Readonly<Record<string, string | Uint8Array>> = {}) {
    for (const [file, contents] of Object.entries(files)) this.write(new URL(file), contents);
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

  async readFilesRecursively(folder: URL): Promise<readonly ReadFile[]> {
    this.calls.push(`files under ${folder.href}`);
    return [...this.contentsByFile.entries()]
      .filter(([file]) => file.startsWith(folder.href))
      .map(([file, contents]) => ({ file: new URL(file), contents: decodeContents(contents) }));
  }

  async readBytesRecursively(folder: URL): Promise<readonly ReadFile<Uint8Array>[]> {
    this.calls.push(`bytes under ${folder.href}`);
    return [...this.contentsByFile.entries()]
      .filter(([file]) => file.startsWith(folder.href))
      .map(([file, contents]) => ({ file: new URL(file), contents: encodeContents(contents) }));
  }

  async listFiles(folder: URL): Promise<readonly ListedFile[]> {
    this.calls.push(`listed files under ${folder.href}`);
    return [...this.contentsByFile.keys()]
      .filter((file) => file.startsWith(folder.href) && !file.slice(folder.href.length).includes("/"))
      .map((file) => ({ file: new URL(file), modifiedAt: this.modifiedAtByFile.get(file) ?? new Date() }));
  }

  async listFolders(folder: URL): Promise<readonly URL[]> {
    this.calls.push(`folders under ${folder.href}`);
    const names = [...this.contentsByFile.keys()]
      .filter((file) => file.startsWith(folder.href))
      .flatMap((file) => {
        const rest = file.slice(folder.href.length).split("/");
        return rest.length < 2 ? [] : [rest[0] ?? ""];
      });
    return [...new Set(names)].map((name) => new URL(`${name}/`, folder));
  }

  /** What one file holds, for a test reading back what a build wrote. Not the
   *  port's: the hexagon reads a folder, never one file it has not been
   *  handed. */
  async read(file: URL): Promise<string> {
    const contents = this.contentsByFile.get(file.href);
    if (contents === undefined) throw new Error(`This charter holds no file at ${file.href}`);
    return decodeContents(contents);
  }

  async readIfThere(file: URL): Promise<string | undefined> {
    this.calls.push(`read ${file.href}`);
    const contents = this.contentsByFile.get(file.href);
    return contents === undefined ? undefined : decodeContents(contents);
  }

  async readBytesIfThere(file: URL): Promise<Uint8Array | undefined> {
    this.calls.push(`read bytes ${file.href}`);
    const contents = this.contentsByFile.get(file.href);
    return contents === undefined ? undefined : encodeContents(contents);
  }

}
