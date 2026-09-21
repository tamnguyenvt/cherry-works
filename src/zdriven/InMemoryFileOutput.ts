import type { ForWritingFiles } from "#hexagon/port/zdriven/ForWritingFiles.js";
import type { InMemoryFileReaders } from "./InMemoryFileReaders.js";

/** Files written into memory, into the same map they are read back out of: what
 *  a test builds a charter with without touching a disk, and the second
 *  implementation that earns the port its place (plan §2.4).
 *
 *  Writing into the reader is what makes a second build see the first one's
 *  files — which is how a projection with no primitive left behind it, and a
 *  compiled file someone edited by hand, are watched. */
export class InMemoryFileOutput implements ForWritingFiles {
  constructor(private readonly files: InMemoryFileReaders) {}

  async write(file: URL, contents: string): Promise<void> {
    this.files.write(file, contents);
  }

  async delete(file: URL): Promise<void> {
    this.files.remove(file);
  }
}
