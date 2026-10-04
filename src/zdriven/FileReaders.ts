import { readdir, readFile, stat } from "node:fs/promises";
import type { Dirent } from "node:fs";
import type { ForReadingFiles, ListedFile, ReadFile } from "#hexagon/port/zdriven/ForReadingFiles.js";

/** DRIVEN ADAPTER: the filesystem. The charter as it was authored, on a disk.
 *
 *  A directory that is not there is no files rather than a failure: a charter
 *  holding some of the kind directories and not the rest is a charter, and the
 *  rest are authored the day someone needs them. Anything else the disk refuses — a
 *  permission, a broken link — is raised, since that is a repository to fix and
 *  not a charter to report on. */
export class FileReaders implements ForReadingFiles {
  async readFilesRecursively(folder: URL): Promise<readonly ReadFile[]> {
    const found = await Promise.all(
      (await entriesOf(folder)).map(async (entry) => {
        if (entry.isDirectory()) return this.readFilesRecursively(under(folder, entry.name));
        const file = new URL(encodeURIComponent(entry.name), folder);
        return [{ file, contents: await readFile(file, "utf8") }];
      }),
    );
    return found.flat();
  }

  async listFiles(folder: URL): Promise<readonly ListedFile[]> {
    return Promise.all(
      (await entriesOf(folder))
        .filter((entry) => entry.isFile())
        .map(async (entry) => {
          const file = new URL(encodeURIComponent(entry.name), folder);
          return { file, modifiedAt: (await stat(file)).mtime };
        }),
    );
  }

  async listFolders(folder: URL): Promise<readonly URL[]> {
    return (await entriesOf(folder)).filter((entry) => entry.isDirectory()).map((entry) => under(folder, entry.name));
  }

  async readIfThere(file: URL): Promise<string | undefined> {
    try {
      return await readFile(file, "utf8");
    } catch (raised) {
      if ((raised as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw raised;
    }
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
