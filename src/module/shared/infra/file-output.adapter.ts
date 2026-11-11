import { chmod, mkdir, rm, rmdir, writeFile } from "node:fs/promises";
import { FolderAddress, type FolderURL } from "../app/port/out/folder-address.port.js";
import { AdapterFault, type ForWritingFiles } from "../app/port/out/writing-files.port.js";
import { urlAt } from "./helper.js";

/** DRIVEN ADAPTER: the filesystem, written to. What the charter compiles to,
 *  put where a host will look for it.
 *
 *  The directories are made on the way: a projection lands in `.claude/skills/`
 *  whether anything has been built here before or not, and the hexagon names a
 *  path rather than a sequence of directories to create.
 *
 *  Set up on one folder, the repository's root, and every path it is handed
 *  is from there (CORE-FR-217). */
export class FileOutput implements ForWritingFiles {
  readonly #rootFolder: FolderURL;

  constructor(
    /** The folder every path is from: refused here unless it names one
     *  (SDK-FR-010). */
    rootFolder: URL,
  ) {
    this.#rootFolder = FolderAddress.urlOf(rootFolder);
  }

  async write(
    filePath: string,
    contents: string | Uint8Array,
    options: { readonly executable?: boolean } = {},
  ): Promise<void> {
    const file = urlAt(this.#rootFolder, filePath);
    try {
      await mkdir(new URL(".", file), { recursive: true });
      // Bytes go down as they are; only text is encoded (CORE-FR-207).
      await writeFile(file, contents, typeof contents === "string" ? "utf8" : undefined);
      // Set whether or not the file was there: a mode passed to `writeFile` is
      // only taken when it creates one.
      if (options.executable === true) await chmod(file, 0o755);
    } catch (writeError) {
      // Said in this adapter's words, what the disk said kept as the cause for
      // the log alone (SDK-FR-018).
      throw new AdapterFault(
        `"${file.pathname}" could not be written.`,
        `Check that "${file.pathname}" can be written, and run this again.`,
        { internal: false, cause: writeError },
      );
    }
  }

  async delete(filePath: string): Promise<void> {
    await rm(urlAt(this.#rootFolder, filePath), { force: true });
  }

  async deleteFolder(folderPath: string): Promise<void> {
    const folder = urlAt(this.#rootFolder, `${folderPath}/`);
    await rm(folder, { recursive: true, force: true }).catch((rmError: unknown) => {
      throw new AdapterFault(
        `"${folder.pathname}" could not be deleted.`,
        `Check that "${folder.pathname}" can be written, and run this again.`,
        { internal: false, cause: rmError },
      );
    });
  }

  async deleteEmptyFolder(folderPath: string): Promise<void> {
    const folder = urlAt(this.#rootFolder, `${folderPath}/`);
    await rmdir(folder).catch((rmdirError: NodeJS.ErrnoException) => {
      if (rmdirError.code !== "ENOTEMPTY" && rmdirError.code !== "EEXIST" && rmdirError.code !== "ENOENT")
        throw new AdapterFault(
          `"${folder.pathname}" could not be deleted.`,
          `Check that "${folder.pathname}" can be written, and run this again.`,
          { internal: false, cause: rmdirError },
        );
    });
  }
}
