import {
  BasePrimitive,
  type CharterInstall,
  charterPath,
  type EvalSuite,
  FileOutsideFolderFault,
  type ForFetchingCharterSources,
  type ForManagingCharter,
  type ForReadingFiles,
  type ForWritingFiles,
  OccupiedPrimitiveFileFault,
  OrphanPrimitiveFault,
  OverlappingPrimitiveFoldersFault,
  outputPath,
  type Primitive,
  PrimitiveLayer,
  RawCharterMetadata,
  RawEvalSuite,
  RawPrimitive,
  RawTestSuite,
  SourceCharter,
  type TestSuite,
  VendorSource,
  type VendorSourceOrigin,
} from "../app/port/out/managing-charter.port.js";
import {
  assertNewLayout,
  createOldLayoutFault,
  findItemPlace,
  findOldLayoutPaths,
  OUT_FOLDER,
  readRawPrimitives,
} from "./helper.js";

/** Read as an address would read it, under a folder that is no root, so
 *  neither a `..` nor a leading `/` can step out of it. */
const UNROOTED_FOLDER = "memory://repo/root/";

/**
 * Keeps a charter as files, all of it through the one port (CORE-FR-228),
 * under `.cw/charter/` (CORE-FR-224, VENDOR-FR-009): one folder per
 * charter, `<charter>/`, holding its primitives, `primitive/<kind>/<id>/`, each index.md
 * and its assets; its test cases under `test/` and its eval cases under
 * `eval/`, a JSON file each; and, where it was installed, its
 * `cw-vendor.json` (VENDOR-FR-010). A source is read as cw lays one out: its
 * charters as a repository keeps its own (VENDOR-FR-017).
 *
 * A repository laid out the old way — its kinds right under `.cw/charter/` or
 * `.cw/charter/primitive/`, its tests, eval cases and vendors right under
 * `.cw/` or `.cw/charter/` — is refused by every operation, and so is a source
 * laid out that way, naming the skill that moves it (CORE-FR-226,
 * VENDOR-FR-011).
 */
export class FileCharterRepository implements ForManagingCharter {
  readonly #fileReader: ForReadingFiles;
  readonly #fileWriter: ForWritingFiles;
  readonly #sourceFetcher: ForFetchingCharterSources;

  constructor(fileReader: ForReadingFiles, fileWriter: ForWritingFiles, sourceFetcher: ForFetchingCharterSources) {
    this.#fileReader = fileReader;
    this.#fileWriter = fileWriter;
    this.#sourceFetcher = sourceFetcher;
  }

  async loadCharter(): Promise<readonly RawPrimitive[]> {
    await assertNewLayout(this.#fileReader);
    const keptFiles = await this.#fileReader.readBytesRecursively(charterPath.charterFolderPath);
    const chartersPathPrefix = `${charterPath.charterFolderPath}/`;
    // A file kept right in the charter root, its `.gitkeep`, is no charter's.
    const charterNames = [
      ...new Set(
        keptFiles
          .map(({ path }) => path.slice(chartersPathPrefix.length).split("/"))
          .filter((pathNames) => pathNames.length > 1)
          .map(([charterName = ""]) => charterName),
      ),
    ].sort();
    const findFileAddress = (path: string) => this.#fileReader.findFileAddress(path);
    return charterNames.flatMap((charterName) =>
      readRawPrimitives(
        keptFiles,
        `${chartersPathPrefix}${charterName}/${charterPath.primitivesFolderName}/`,
        keptFiles.some(({ path }) => path === `${chartersPathPrefix}${charterName}/${charterPath.vendorRecordFileName}`)
          ? PrimitiveLayer.installedLayerOf(charterName)
          : PrimitiveLayer.authoredLayerOf(charterName),
        findFileAddress,
      ),
    );
  }

  async loadCharterMetadata(): Promise<readonly RawCharterMetadata[]> {
    await assertNewLayout(this.#fileReader);
    return Promise.all(
      (await this.#fileReader.listFolders(charterPath.charterFolderPath)).map(async (charterFolderPath) => {
        const vendorRecordPath = `${charterFolderPath}/${charterPath.vendorRecordFileName}`;
        return new RawCharterMetadata(
          charterFolderPath.slice(`${charterPath.charterFolderPath}/`.length),
          await this.#fileReader.readIfThere(vendorRecordPath),
          this.#fileReader.findFileAddress(charterFolderPath),
          this.#fileReader.findFileAddress(vendorRecordPath),
        );
      }),
    );
  }

  async createCharter(): Promise<void> {
    await assertNewLayout(this.#fileReader);
    // The charter root, holding no charter: a filesystem only keeps a folder
    // once there is a file in it, and git only records one at all once there
    // is (FR-001, VENDOR-FR-013).
    await this.#fileWriter.writeFile(`${charterPath.charterFolderPath}/.gitkeep`, "");
  }

  async addPrimitive(primitive: Primitive): Promise<string> {
    const [addedUri = ""] = await this.#writePrimitives(
      [
        new RawPrimitive(
          primitive.layer,
          primitive.kind,
          primitive.headers.id,
          primitive.writeMarkdown(),
          primitive.assets,
          primitive.uri,
        ),
      ],
      false,
    );
    return addedUri;
  }

  /** New primitives of the repository's own layer written, every refusal
   *  settled before anything is: one kept already, or inside another or around
   *  it (FR-167), anything landing outside the charter (CORE-FR-044), and,
   *  where `isFolderOwned`, any file already in one's folder (CORE-FR-194);
   *  otherwise such a file is left as it is, one of its assets. */
  async #writePrimitives(rawPrimitives: readonly RawPrimitive[], isFolderOwned: boolean): Promise<readonly string[]> {
    await assertNewLayout(this.#fileReader);
    // Read, never only listed: a link kept there is a path a write must not
    // land on either, and a listing of files and folders leaves it out
    // (CORE-FR-044).
    const charterFilePaths = (await this.#fileReader.readBytesRecursively(charterPath.charterFolderPath)).map(
      ({ path }) => path,
    );
    const plannedFiles: { readonly path: string; readonly contents: string | Uint8Array }[] = [];
    const addedIndexPaths: string[] = [];
    for (const rawPrimitive of rawPrimitives) {
      const indexPath = this.#findIndexPath(rawPrimitive.layer, rawPrimitive.kind, rawPrimitive.id);
      if (charterFilePaths.includes(indexPath) || addedIndexPaths.includes(indexPath))
        throw new OccupiedPrimitiveFileFault(
          `${indexPath} is already there, and writing this one would write over what it holds.`,
          `Open it, or run this again with an id this charter has not got.`,
          { internal: false },
        );
      // Going down from a kind's folder the first index.md is the primitive, so
      // a folder inside another primitive's would be one of its assets, and one
      // holding a primitive would take it for one of its own (FR-167).
      const primitiveFolderPath = indexPath.slice(0, -BasePrimitive.indexFileName.length);
      const kindFolderPath = indexPath.slice(
        0,
        indexPath.length - `${rawPrimitive.id}/${BasePrimitive.indexFileName}`.length,
      );
      const indexPathInTheWay = [...charterFilePaths, ...addedIndexPaths].find(
        (charterFilePath) =>
          charterFilePath.startsWith(kindFolderPath) &&
          charterFilePath.endsWith(`/${BasePrimitive.indexFileName}`) &&
          (primitiveFolderPath.startsWith(charterFilePath.slice(0, charterFilePath.lastIndexOf("/") + 1)) ||
            charterFilePath.startsWith(primitiveFolderPath)),
      );
      if (indexPathInTheWay !== undefined && isFolderOwned)
        throw new OverlappingPrimitiveFoldersFault(
          `${indexPathInTheWay} and ${rawPrimitive.uri} claim overlapping primitive folders at ${indexPath}.`,
          "Inject primitives whose folders are apart from the existing files.",
          { internal: false },
        );
      if (indexPathInTheWay !== undefined)
        throw new OverlappingPrimitiveFoldersFault(
          `${indexPathInTheWay} is a primitive, and ${indexPath} would sit inside its folder or hold it, so both would claim its files. Every file under a primitive's folder is one of its assets.`,
          `Run this again with an id whose folder is apart from it.`,
          { internal: false },
        );
      const heldPath = isFolderOwned
        ? charterFilePaths.find((charterFilePath) => charterFilePath.startsWith(primitiveFolderPath))
        : undefined;
      if (heldPath !== undefined)
        throw new OverlappingPrimitiveFoldersFault(
          `${heldPath} and ${rawPrimitive.uri} claim overlapping primitive folders at ${indexPath}.`,
          "Inject primitives whose folders are apart from the existing files.",
          { internal: false },
        );
      addedIndexPaths.push(indexPath);
      plannedFiles.push({
        path: indexPath,
        contents: rawPrimitive.contents instanceof Uint8Array ? rawPrimitive.contents : rawPrimitive.text,
      });
      // An asset already standing there is its author's, and is left as it is
      // (FR-167).
      for (const assetFile of rawPrimitive.assets) {
        const assetPath = `${primitiveFolderPath}${assetFile.assetPath}`;
        if (
          !new URL(assetPath.split("/").map(encodeURIComponent).join("/"), UNROOTED_FOLDER).href.startsWith(
            new URL(primitiveFolderPath, UNROOTED_FOLDER).href,
          )
        )
          throw isFolderOwned
            ? new FileOutsideFolderFault(
                `${assetFile.assetPath} would land outside ${primitiveFolderPath}.`,
                "Inject from a source whose files stay inside each primitive's folder.",
                { internal: false },
              )
            : new FileOutsideFolderFault(
                `${assetFile.assetPath} would land outside ${primitiveFolderPath}.`,
                "Keep every file of a primitive inside its folder.",
                { internal: false },
              );
        if (!charterFilePaths.includes(assetPath)) plannedFiles.push({ path: assetPath, contents: assetFile.contents });
      }
    }
    this.#assertInsideCharter(plannedFiles.map(({ path }) => path));
    for (const { path, contents } of plannedFiles) await this.#fileWriter.writeFile(path, contents);
    return addedIndexPaths.map((indexPath) => this.#fileReader.findFileAddress(indexPath));
  }

  async assertLayout(): Promise<void> {
    await assertNewLayout(this.#fileReader);
  }

  describeCharterPlace(): string {
    return charterPath.charterFolderPath;
  }

  findCharterUri(): string {
    return this.#fileReader.findFileAddress(charterPath.charterFolderPath);
  }

  async rewritePrimitive(primitive: Primitive): Promise<void> {
    await assertNewLayout(this.#fileReader);
    const indexPath = this.#findIndexPath(primitive.layer, primitive.kind, primitive.headers.id);
    this.#assertInsideCharter([indexPath]);
    await this.#fileWriter.writeFile(indexPath, primitive.writeMarkdown());
  }

  async removePrimitive(primitive: Primitive): Promise<void> {
    await assertNewLayout(this.#fileReader);
    const indexPath = this.#findIndexPath(primitive.layer, primitive.kind, primitive.headers.id);
    const primitiveFolderPath = indexPath.slice(0, -BasePrimitive.indexFileName.length);
    const removedPaths = [
      indexPath,
      ...primitive.assets.map((assetFile) => `${primitiveFolderPath}${assetFile.assetPath}`),
    ];
    this.#assertInsideCharter(removedPaths);
    for (const path of removedPaths) await this.#fileWriter.deleteFile(path);
  }

  async fetchVendorSource(vendorSourceOrigin: VendorSourceOrigin, version?: string): Promise<VendorSource> {
    const { sourceUri } = vendorSourceOrigin;
    const fetchedCommit = await this.#sourceFetcher.fetchCommit(sourceUri, version);
    try {
      const sourcePaths = await this.#sourceFetcher.listFilesAt(fetchedCommit);
      // A source laid out the old way is refused before anything of it is read
      // (CORE-FR-226, VENDOR-FR-011).
      const oldSourcePaths = findOldLayoutPaths(sourcePaths);
      if (oldSourcePaths.length > 0) throw createOldLayoutFault(sourceUri, oldSourcePaths);
      // A file named to climb out of its folder is refused before anything of
      // the source is written (CORE-FR-044).
      const climbingPath = sourcePaths.find((sourcePath) =>
        sourcePath.split("/").some((pathName) => pathName === ".." || pathName === "."),
      );
      if (climbingPath !== undefined)
        throw new FileOutsideFolderFault(
          `${climbingPath} would land outside the folder it is copied into.`,
          "Install from a source whose files stay inside their folders.",
          { internal: false },
        );
      const readFilesUnder = (folderPrefix: string) =>
        Promise.all(
          sourcePaths
            .filter((sourcePath) => sourcePath.startsWith(folderPrefix))
            .map(async (path) => ({ path, contents: await this.#sourceFetcher.readBytesAt(fetchedCommit, path) })),
        );
      // Its charters, kept as a repository keeps its own (VENDOR-FR-017).
      const chartersPathPrefix = `${charterPath.charterFolderPath}/`;
      const charterNames = [
        ...new Set(
          sourcePaths
            .filter((sourcePath) => sourcePath.startsWith(chartersPathPrefix))
            .map((sourcePath) => sourcePath.slice(chartersPathPrefix.length).split("/"))
            .filter((pathNames) => pathNames.length > 1)
            .map(([charterName = ""]) => charterName),
        ),
      ].sort();
      const sourceCharters = await Promise.all(
        charterNames.map(async (charterName) => {
          const charterFolderPath = `${chartersPathPrefix}${charterName}`;
          const vendorRecordPath = `${charterFolderPath}/${charterPath.vendorRecordFileName}`;
          // Only a primitive kept in its folder is one a source publishes.
          const primitivesFolderPrefix = `${charterFolderPath}/${charterPath.primitivesFolderName}/`;
          const publishedRawPrimitives = readRawPrimitives(
            await readFilesUnder(primitivesFolderPrefix),
            primitivesFolderPrefix,
            PrimitiveLayer.authoredLayerOf(charterName),
            (path) => path,
          ).filter(({ isKeptApart }) => isKeptApart);
          // What of the charter is copied: each primitive's folder, its test
          // cases and its eval cases; a file kept beside them is no part of it
          // (CORE-FR-196, VENDOR-FR-017).
          const keptFolderPaths = [
            ...publishedRawPrimitives.map(({ uri }) =>
              uri.slice(`${charterFolderPath}/`.length, -`/${BasePrimitive.indexFileName}`.length),
            ),
            ...[charterPath.testFolderName, charterPath.evalFolderName].filter((suitesFolderName) =>
              sourcePaths.some((sourcePath) => sourcePath.startsWith(`${charterFolderPath}/${suitesFolderName}/`)),
            ),
          ];
          return new SourceCharter(
            charterName,
            sourcePaths.includes(vendorRecordPath),
            publishedRawPrimitives,
            charterFolderPath,
            keptFolderPaths,
          );
        }),
      );
      return new VendorSource(
        vendorSourceOrigin,
        fetchedCommit,
        await this.#sourceFetcher.findCommitId(fetchedCommit),
        sourceCharters,
      );
    } catch (raisedValue) {
      await this.#sourceFetcher.removeFetchedCommit(fetchedCommit);
      throw raisedValue;
    }
  }

  async removeFetchedSource(vendorSource: VendorSource): Promise<void> {
    await this.#sourceFetcher.removeFetchedCommit(vendorSource.commit);
  }

  async storeCharters(vendorSource: VendorSource, charterInstalls: readonly CharterInstall[]): Promise<void> {
    await assertNewLayout(this.#fileReader);
    // Every charter checked out aside first: a link a source left on the way
    // is refused there, before any charter held is replaced (VENDOR-FR-017).
    // What an install cut short left there is taken away first.
    await this.#fileWriter.deleteFolder(charterPath.installingFolderPath);
    try {
      for (const {
        charterName,
        sourceCharter: { sourceFolder, keptFolderPaths },
      } of charterInstalls) {
        this.#assertInsideCharter([`${charterPath.charterFolderPath}/${charterName}/`]);
        for (const keptFolderPath of keptFolderPaths)
          await this.#sourceFetcher.checkOutFolder(
            vendorSource.commit,
            `${sourceFolder}/${keptFolderPath}`,
            `${charterPath.installingFolderPath}/${charterName}/${keptFolderPath}`,
          );
      }
    } finally {
      await this.#fileWriter.deleteFolder(charterPath.installingFolderPath);
    }
    for (const {
      charterName,
      sourceCharter: { sourceFolder, keptFolderPaths },
      vendorRecord,
    } of charterInstalls) {
      // Replaced whole: what the name held before is taken away first
      // (VENDOR-FR-020).
      const charterFolderPath = `${charterPath.charterFolderPath}/${charterName}`;
      this.#assertInsideCharter([`${charterFolderPath}/`]);
      await this.#fileWriter.deleteFolder(charterFolderPath);
      // A folder is copied as the source holds it, and a link a source left on
      // the way is refused where it is copied (CORE-FR-044).
      for (const keptFolderPath of keptFolderPaths)
        await this.#sourceFetcher.checkOutFolder(
          vendorSource.commit,
          `${sourceFolder}/${keptFolderPath}`,
          `${charterFolderPath}/${keptFolderPath}`,
        );
      const vendorRecordPath = `${charterFolderPath}/${charterPath.vendorRecordFileName}`;
      await this.#fileWriter.deleteFile(vendorRecordPath);
      if (vendorRecord !== undefined)
        await this.#fileWriter.writeFile(vendorRecordPath, `${JSON.stringify(vendorRecord, null, 2)}\n`);
    }
  }

  findCharterFolderUri(charterName: string): string {
    return this.#fileReader.findFileAddress(`${charterPath.charterFolderPath}/${charterName}`);
  }

  async removeCharter(charterName: string): Promise<void> {
    await assertNewLayout(this.#fileReader);
    const charterFolderPath = `${charterPath.charterFolderPath}/${charterName}`;
    this.#assertInsideCharter([`${charterFolderPath}/`]);
    await this.#fileWriter.deleteFolder(charterFolderPath);
  }

  async loadTestSuites(): Promise<readonly RawTestSuite[]> {
    await assertNewLayout(this.#fileReader);
    return (await this.#readSuiteFiles(charterPath.testFolderName)).map(
      ({ name, charterName, contents, uri }) => new RawTestSuite(name, charterName, contents, uri),
    );
  }

  async writeTestSuite(charterName: string, name: string, testSuite: TestSuite): Promise<void> {
    await assertNewLayout(this.#fileReader);
    await this.#fileWriter.writeFile(
      this.#findSuitePath(charterName, charterPath.testFolderName, name),
      testSuite.body,
    );
  }

  async removeTestSuite(charterName: string, name: string): Promise<void> {
    await assertNewLayout(this.#fileReader);
    await this.#fileWriter.deleteFile(this.#findSuitePath(charterName, charterPath.testFolderName, name));
  }

  async loadEvalSuites(): Promise<readonly RawEvalSuite[]> {
    await assertNewLayout(this.#fileReader);
    return (await this.#readSuiteFiles(charterPath.evalFolderName)).map(
      ({ name, charterName, contents, uri }) => new RawEvalSuite(name, charterName, contents, uri),
    );
  }

  async writeEvalSuite(charterName: string, name: string, evalSuite: EvalSuite): Promise<void> {
    await assertNewLayout(this.#fileReader);
    await this.#fileWriter.writeFile(
      this.#findSuitePath(charterName, charterPath.evalFolderName, name),
      evalSuite.body,
    );
  }

  async removeEvalSuite(charterName: string, name: string): Promise<void> {
    await assertNewLayout(this.#fileReader);
    await this.#fileWriter.deleteFile(this.#findSuitePath(charterName, charterPath.evalFolderName, name));
  }

  /** Every JSON file of cases kept in this folder of each charter, by its name
   *  there and its charter (VENDOR-FR-009): that folder alone is read of each. */
  async #readSuiteFiles(suitesFolderName: string) {
    const charterFolderPaths = await this.#fileReader.listFolders(charterPath.charterFolderPath);
    const suiteFileLists = await Promise.all(
      charterFolderPaths.map(async (charterFolderPath) => {
        const charterName = charterFolderPath.split("/").pop() ?? "";
        const suitesFolderPath = `${charterPath.charterFolderPath}/${charterName}/${suitesFolderName}`;
        return (await this.#fileReader.readFilesRecursively(suitesFolderPath)).flatMap(({ path, contents }) =>
          path.endsWith(".json")
            ? [
                {
                  name: path.slice(`${suitesFolderPath}/`.length),
                  charterName,
                  contents,
                  uri: this.#fileReader.findFileAddress(path),
                },
              ]
            : [],
        );
      }),
    );
    return suiteFileLists.flat();
  }

  /** Where a file of cases of this charter is kept. */
  #findSuitePath(charterName: string, suitesFolderName: string, name: string): string {
    return `${charterPath.charterFolderPath}/${charterName}/${suitesFolderName}/${name}`;
  }

  /** Where a primitive of a charter the repository authored is kept
   *  (VENDOR-FR-009). */
  #findIndexPath(primitiveLayer: PrimitiveLayer, kind: string, id: string): string {
    if (primitiveLayer.charterName === undefined)
      throw new OrphanPrimitiveFault(
        `"${id}" names no charter to be kept in.`,
        "Name the charter of every primitive written.",
        {
          internal: true,
        },
      );
    return `${charterPath.charterFolderPath}/${primitiveLayer.charterName}/${charterPath.primitivesFolderName}/${kind}/${id}/${BasePrimitive.indexFileName}`;
  }

  /** Refused unless every path stays inside the repository's own charter: a
   *  `..`, or a name escaped to read as one, would carry a file out of it
   *  (CORE-FR-044). */
  #assertInsideCharter(charterFilePaths: readonly string[]): void {
    const charterFolderHref = new URL(`${charterPath.charterFolderPath}/`, UNROOTED_FOLDER).href;
    const outsidePath = charterFilePaths.find(
      (path) =>
        !new URL(path.split("/").map(encodeURIComponent).join("/"), UNROOTED_FOLDER).href.startsWith(charterFolderHref),
    );
    if (outsidePath !== undefined)
      throw new FileOutsideFolderFault(
        `${outsidePath} would land outside ${charterPath.charterFolderPath}/.`,
        "Write only files of the repository's own charter.",
        { internal: false },
      );
  }

  async readCompiledOutputItem(itemPath: string): Promise<string | undefined> {
    // What a build laid in a repository laid out the old way is not read: the
    // repository is refused until it is moved (CORE-FR-226).
    await assertNewLayout(this.#fileReader);
    return this.#fileReader.readIfThere(findItemPlace(itemPath));
  }

  describeItemPlace(itemPath: string): string {
    return findItemPlace(itemPath);
  }

  resolveOutputLinks(laidText: string): string {
    return laidText.replaceAll(outputPath.cwOutFolderPlaceholder, OUT_FOLDER);
  }
}
