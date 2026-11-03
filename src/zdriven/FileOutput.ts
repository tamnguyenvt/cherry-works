import { chmod, mkdir, rm, rmdir, writeFile } from "node:fs/promises";
import { AdapterFault, type ForWritingFiles } from "#hexagon/port/zdriven/ForWritingFiles.js";

/** DRIVEN ADAPTER: the filesystem, written to. What the charter compiles to,
 *  put where a host will look for it.
 *
 *  The directories are made on the way: a projection lands in `.claude/skills/`
 *  whether anything has been built here before or not, and the hexagon names a
 *  path rather than a sequence of directories to create. */
export class FileOutput implements ForWritingFiles {
  async write(file: URL, contents: string | Uint8Array, options: { readonly executable?: boolean } = {}): Promise<void> {
    await mkdir(new URL(".", file), { recursive: true });
    // Bytes go down as they are; only text is encoded (CORE-FR-207).
    await writeFile(file, contents, typeof contents === "string" ? "utf8" : undefined);
    // Set whether or not the file was there: a mode passed to `writeFile` is
    // only taken when it creates one.
    if (options.executable === true) await chmod(file, 0o755);
  }

  async delete(file: URL): Promise<void> {
    await rm(file, { force: true });
  }

  async deleteFolder(folder: URL): Promise<void> {
    await rm(folder, { recursive: true, force: true }).catch((rmError: unknown) => {
      throw new AdapterFault(`${rmError}`, `Check that "${folder.pathname}" can be written, and run this again.`);
    });
  }

  async deleteEmptyFolder(folder: URL): Promise<void> {
    await rmdir(folder).catch((rmdirError: NodeJS.ErrnoException) => {
      if (rmdirError.code !== "ENOTEMPTY" && rmdirError.code !== "EEXIST" && rmdirError.code !== "ENOENT")
        throw new AdapterFault(`${rmdirError}`, `Check that "${folder.pathname}" can be written, and run this again.`);
    });
  }
}
