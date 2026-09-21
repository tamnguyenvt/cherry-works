import { mkdir, rm, writeFile } from "node:fs/promises";
import type { ForWritingFiles } from "#hexagon/port/zdriven/ForWritingFiles.js";

/** DRIVEN ADAPTER: the filesystem, written to. What the charter compiles to,
 *  put where a host will look for it.
 *
 *  The directories are made on the way: a projection lands in `.claude/skills/`
 *  whether anything has been built here before or not, and the hexagon names a
 *  path rather than a sequence of directories to create. */
export class FileOutput implements ForWritingFiles {
  async write(file: URL, contents: string): Promise<void> {
    await mkdir(new URL(".", file), { recursive: true });
    await writeFile(file, contents, "utf8");
  }

  async delete(file: URL): Promise<void> {
    await rm(file, { force: true });
  }
}
