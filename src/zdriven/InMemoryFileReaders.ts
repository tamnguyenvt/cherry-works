import type { ForReadingFiles, ReadFile } from "#hexagon/port/zdriven/ForReadingFiles.js";

/** Files held in memory: the text of each, keyed by its URL. What a test
 *  authors a charter in without touching a disk, and the second implementation
 *  that earns the port its place (plan §2.4). */
export class InMemoryFileReaders implements ForReadingFiles {
  private readonly texts = new Map<string, string>();

  /** Every listing and every read served, in order, for a test that cares how
   *  often it was asked. */
  readonly calls: string[] = [];

  constructor(files: Readonly<Record<string, string>> = {}) {
    for (const [file, text] of Object.entries(files)) this.write(new URL(file), text);
  }

  /** Author or replace one file. */
  write(file: URL, text: string): void {
    this.texts.set(file.href, text);
  }

  /** Drop one file, so a test can watch a listing shrink. */
  remove(file: URL): void {
    this.texts.delete(file.href);
  }

  async readFilesRecursively(folder: URL): Promise<readonly ReadFile[]> {
    this.calls.push(`files under ${folder.href}`);
    return [...this.texts.entries()]
      .filter(([file]) => file.startsWith(folder.href))
      .map(([file, contents]) => ({ file: new URL(file), contents }));
  }

  async listFolders(folder: URL): Promise<readonly URL[]> {
    this.calls.push(`folders under ${folder.href}`);
    const names = [...this.texts.keys()]
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
    const text = this.texts.get(file.href);
    if (text === undefined) throw new Error(`This charter holds no file at ${file.href}`);
    return text;
  }

  async readIfThere(file: URL): Promise<string | undefined> {
    this.calls.push(`read ${file.href}`);
    return this.texts.get(file.href);
  }

}
