import { chmod, mkdir, rm, rmdir, writeFile } from "node:fs/promises";
import { FolderAddress, type FolderURL } from "../app/port/out/folder-address.port.js";
import {
  type ForWritingFiles,
  UndeletableFolderFault,
  UnwritableFileFault,
} from "../app/port/out/writing-files.port.js";
import { resolveFileUrl } from "./helper.js";

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
    this.#rootFolder = FolderAddress.parseFolderUrl(rootFolder);
  }

  async writeFile(
    filePath: string,
    contents: string | Uint8Array,
    options: { readonly isExecutable?: boolean } = {},
  ): Promise<void> {
    const fileUrl = resolveFileUrl(this.#rootFolder, filePath);
    try {
      await mkdir(new URL(".", fileUrl), { recursive: true });
      // Bytes go down as they are; only text is encoded (CORE-FR-207).
      await writeFile(fileUrl, contents, typeof contents === "string" ? "utf8" : undefined);
      // Set whether or not the file was there: a mode passed to `writeFile` is
      // only taken when it creates one.
      if (options.isExecutable === true) await chmod(fileUrl, 0o755);
    } catch (writeError) {
      // Said in this adapter's words, what the disk said kept as the cause for
      // the log alone (SDK-FR-018).
      throw new UnwritableFileFault(
        `"${fileUrl.pathname}" could not be written.`,
        `Check that "${fileUrl.pathname}" can be written, and run this again.`,
        { internal: false, cause: writeError },
      );
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    await rm(resolveFileUrl(this.#rootFolder, filePath), { force: true });
  }

  async deleteFolder(folderPath: string): Promise<void> {
    const folderUrl = resolveFileUrl(this.#rootFolder, `${folderPath}/`);
    await rm(folderUrl, { recursive: true, force: true }).catch((rmError: unknown) => {
      throw new UndeletableFolderFault(
        `"${folderUrl.pathname}" could not be deleted.`,
        `Check that "${folderUrl.pathname}" can be written, and run this again.`,
        { internal: false, cause: rmError },
      );
    });
  }

  async deleteEmptyFolder(folderPath: string): Promise<void> {
    const folderUrl = resolveFileUrl(this.#rootFolder, `${folderPath}/`);
    await rmdir(folderUrl).catch((rmdirError: NodeJS.ErrnoException) => {
      if (rmdirError.code !== "ENOTEMPTY" && rmdirError.code !== "EEXIST" && rmdirError.code !== "ENOENT")
        throw new UndeletableFolderFault(
          `"${folderUrl.pathname}" could not be deleted.`,
          `Check that "${folderUrl.pathname}" can be written, and run this again.`,
          { internal: false, cause: rmdirError },
        );
    });
  }
}
