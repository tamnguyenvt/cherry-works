import { type ForReadingFiles, type ForWritingFiles, filePathOf, pathFromCheckout } from "../../shared/module.js";
import {
  type CharterOutput,
  type ForManagingLocalOutput,
  McpOrigins,
  ProjectionPlan,
  WritePlan,
} from "../app/port/out/managing-local-output.port.js";
import { laidTextOf, OUT_FOLDER, placeOfPart } from "./helper.js";

/**
 * DRIVEN ADAPTER: a build's output laid onto the repository as files, under
 * `.cw/out/`, which nothing else writes, each part as the build compiled it
 * (CORE-FR-221); and every file a build planned, each agent's own among them,
 * written.
 */
export class LocalRepoManipulator implements ForManagingLocalOutput {
  readonly #fileReader: ForReadingFiles;
  readonly #fileWriter: ForWritingFiles;

  constructor(fileReader: ForReadingFiles, fileWriter: ForWritingFiles) {
    this.#fileReader = fileReader;
    this.#fileWriter = fileWriter;
  }

  async createProjectionPlan(charterOutput: CharterOutput, checkoutPath = ""): Promise<ProjectionPlan> {
    const [cleanupPlan, layingPlan] = await Promise.all([
      this.#planCleanup(checkoutPath),
      this.#planWriting(checkoutPath, charterOutput),
    ]);
    return new ProjectionPlan([], cleanupPlan, layingPlan);
  }

  async writePlan(buildPlan: ProjectionPlan): Promise<void> {
    // Taking away first and writing second, so nothing written has to be
    // compared with what was there.
    await Promise.all(buildPlan.cleanupPlan.map((cleanupFile) => this.#fileWriter.delete(cleanupFile.filePath)));
    for (const layingFile of buildPlan.projectionPlan)
      await this.#fileWriter.write(layingFile.filePath, layingFile.contents ?? "", {
        executable: layingFile.isExecutable === true,
      });
  }

  /**
   * Everything one output would write (FR-020, FR-021), one entry to a path,
   * with what is there now read beside it: each part as the build compiled
   * it, each path into the output written from where it lands.
   */
  async #planWriting(checkoutPath: string, charterOutput: CharterOutput): Promise<readonly WritePlan[]> {
    const writePlanByPath = new Map<string, WritePlan>();

    for (const compiledPart of charterOutput.compiledParts) {
      const partPath = placeOfPart(compiledPart.outputPart);
      const filePath = filePathOf(checkoutPath, partPath);
      // Each path into the output written from where the part lands: a
      // document's from its own folder, so its links resolve as written;
      // any other file's from the repository's root, where a command runs.
      // What the mcp origins listed is laid in their own words (CORE-FR-221).
      const isOwnWords = compiledPart.outputPart.path === McpOrigins.outputPart.path;
      const laidText = isOwnWords
        ? compiledPart.text
        : laidTextOf(compiledPart.text, partPath.endsWith(".md") ? partPath : undefined);
      writePlanByPath.set(
        partPath,
        new WritePlan(partPath, filePath, laidText, await this.#fileReader.readIfThere(filePath), false),
      );

      // A compiled primitive's assets, beside its document, as the bytes they
      // hold and compared with the bytes there now, so a file no text says is
      // still kept whole (CORE-FR-207).
      if (!("assets" in compiledPart)) continue;
      const partFolder = partPath.slice(0, partPath.lastIndexOf("/") + 1);
      for (const { file, contents: assetBytes, executable } of compiledPart.assets) {
        const assetPath = `${partFolder}${file}`;
        const assetFilePath = filePathOf(checkoutPath, assetPath);
        writePlanByPath.set(
          assetPath,
          new WritePlan(
            assetPath,
            assetFilePath,
            assetBytes,
            await this.#fileReader.readBytesIfThere(assetFilePath),
            executable,
          ),
        );
      }
    }

    return [...writePlanByPath.values()];
  }

  /** Everything the last build left under the output folder, which nothing
   *  else writes (FR-020). */
  async #planCleanup(checkoutPath: string): Promise<readonly WritePlan[]> {
    const outFiles = await this.#fileReader.readFilesRecursively(filePathOf(checkoutPath, OUT_FOLDER));
    return outFiles.map(
      ({ path, contents }) => new WritePlan(pathFromCheckout(checkoutPath, path), path, undefined, contents),
    );
  }
}
