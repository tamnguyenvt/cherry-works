import type { ForWritingFiles } from "../../app/port/out/writing-files.port.js";
import { urlAt } from "../helper.js";
import type { InMemoryFileReaders } from "./in-memory-file-readers.adapter.js";

/** Files written into memory, into the same map they are read back out of: what
 *  a test builds a charter with without touching a disk, and the second
 *  implementation that earns the port its place (plan §2.4).
 *
 *  Writing into the reader is what makes a second build see the first one's
 *  files — which is how a projection with no primitive left behind it, and a
 *  compiled file someone edited by hand, are watched. */
export class InMemoryFileOutput implements ForWritingFiles {
  constructor(private readonly files: InMemoryFileReaders) {}

  /** Every file last written as executable, for a test asking which. */
  readonly executables = new Set<string>();

  async write(
    filePath: string,
    contents: string | Uint8Array,
    options: { readonly executable?: boolean } = {},
  ): Promise<void> {
    const file = urlAt(this.files.rootFolder, filePath);
    this.files.write(file, contents);
    if (options.executable === true) this.executables.add(file.href);
    else this.executables.delete(file.href);
  }

  async delete(filePath: string): Promise<void> {
    this.files.remove(urlAt(this.files.rootFolder, filePath));
  }

  async deleteFolder(folderPath: string): Promise<void> {
    for (const { path } of await this.files.readFilesRecursively(folderPath))
      this.files.remove(urlAt(this.files.rootFolder, path));
  }

  /** A folder here is only the files under it, so an empty one is not there. */
  async deleteEmptyFolder(_folderPath: string): Promise<void> {}
}
