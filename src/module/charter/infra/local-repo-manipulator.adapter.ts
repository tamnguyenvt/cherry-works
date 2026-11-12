import {
  type ForReadingFiles,
  type ForWritingFiles,
  resolveCheckoutPath,
  resolveRepoPath,
} from "../../shared/module.js";
import {
  type CharterOutput,
  CompiledPrimitive,
  type ForManagingLocalOutput,
  McpOrigins,
  outputPath,
  ProjectionPlan,
  UnbuiltCheckoutAdapterFault,
  WritePlan,
} from "../app/port/out/managing-local-output.port.js";
import { findItemPlace, OUT_FOLDER, resolveLaidText } from "./helper.js";

/**
 * DRIVEN ADAPTER: a build's output laid onto the repository as files, under
 * `.cw/out/`, which nothing else writes, each item as the build compiled it
 * (CORE-FR-221); and every file a build planned, each agent's own among them,
 * written.
 */
export class LocalRepoManipulator implements ForManagingLocalOutput {
  readonly #fileReader: ForReadingFiles;
  readonly #fileWriter: ForWritingFiles;
  /** The checkout of the repository the output is laid in, such as a
   *  worktree, by its path from the repository; none for the repository's own. */
  readonly #checkoutFolder: string;

  constructor(fileReader: ForReadingFiles, fileWriter: ForWritingFiles, checkoutFolder = "") {
    this.#fileReader = fileReader;
    this.#fileWriter = fileWriter;
    this.#checkoutFolder = checkoutFolder;
  }

  /** The same output over another checkout. A class extending this one is
   *  refused, never built as this one: it builds itself over the checkout, by
   *  its own constructor (EVAL-FR-021). */
  createCheckoutOutput(checkoutFolder: string): LocalRepoManipulator {
    if (this.constructor !== LocalRepoManipulator)
      throw new UnbuiltCheckoutAdapterFault(
        `${this.constructor.name} extends LocalRepoManipulator and builds no copy of itself over the checkout "${checkoutFolder}".`,
        `Override createCheckoutOutput in ${this.constructor.name} to build it over the checkout.`,
      );
    return new LocalRepoManipulator(this.#fileReader, this.#fileWriter, checkoutFolder);
  }

  async createProjectionPlan(charterOutput: CharterOutput): Promise<ProjectionPlan> {
    const [cleanupPlan, layingPlan] = await Promise.all([
      this.#planCleanup(this.#checkoutFolder),
      this.#planWriting(this.#checkoutFolder, charterOutput),
    ]);
    return new ProjectionPlan([], cleanupPlan, layingPlan);
  }

  async writePlan(projectionPlan: ProjectionPlan): Promise<void> {
    // Taking away first and writing second, so nothing written has to be
    // compared with what was there.
    await Promise.all(
      projectionPlan.cleanupPlan.map((cleanupWritePlan) => this.#fileWriter.deleteFile(cleanupWritePlan.filePath)),
    );
    for (const layingWritePlan of projectionPlan.writePlans)
      await this.#fileWriter.writeFile(layingWritePlan.filePath, layingWritePlan.contents ?? "", {
        isExecutable: layingWritePlan.isExecutable === true,
      });
  }

  /**
   * Everything one output would write (FR-020, FR-021), one entry to a path,
   * with what is there now read beside it: each item as the build compiled
   * it, each path into the output written from where it lands.
   */
  async #planWriting(checkoutPath: string, charterOutput: CharterOutput): Promise<readonly WritePlan[]> {
    const writePlanByPath = new Map<string, WritePlan>();

    for (const charterOutputItem of charterOutput.charterOutputItems) {
      const itemPlace = findItemPlace(outputPath.getPath(charterOutputItem));
      const filePath = resolveRepoPath(checkoutPath, itemPlace);
      // Each path into the output written from where the item lands: a
      // document's from its own folder, so its links resolve as written;
      // any other file's from the repository's root, where a command runs.
      // What the mcp origins listed is laid in their own words (CORE-FR-221).
      const isOwnWords = charterOutputItem instanceof McpOrigins;
      const laidText = isOwnWords
        ? charterOutputItem.text
        : resolveLaidText(charterOutputItem.text, itemPlace.endsWith(".md") ? itemPlace : undefined);
      writePlanByPath.set(
        itemPlace,
        new WritePlan(itemPlace, filePath, laidText, await this.#fileReader.readIfThere(filePath), false),
      );

      // A compiled primitive's assets, beside its document, as the bytes they
      // hold and compared with the bytes there now, so a file no text says is
      // still kept whole (CORE-FR-207).
      if (!(charterOutputItem instanceof CompiledPrimitive)) continue;
      const itemFolder = itemPlace.slice(0, itemPlace.lastIndexOf("/") + 1);
      for (const { assetPath: assetFileName, contents: assetBytes, isExecutable } of charterOutputItem.assets) {
        const assetPath = `${itemFolder}${assetFileName}`;
        const assetFilePath = resolveRepoPath(checkoutPath, assetPath);
        writePlanByPath.set(
          assetPath,
          new WritePlan(
            assetPath,
            assetFilePath,
            assetBytes,
            await this.#fileReader.readBytesIfThere(assetFilePath),
            isExecutable,
          ),
        );
      }
    }

    return [...writePlanByPath.values()];
  }

  /** Everything the last build left under the output folder, which nothing
   *  else writes (FR-020). */
  async #planCleanup(checkoutPath: string): Promise<readonly WritePlan[]> {
    const outFiles = await this.#fileReader.readFilesRecursively(resolveRepoPath(checkoutPath, OUT_FOLDER));
    return outFiles.map(
      ({ path, contents }) => new WritePlan(resolveCheckoutPath(checkoutPath, path), path, undefined, contents),
    );
  }
}
