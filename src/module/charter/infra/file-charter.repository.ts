import {
  BasePrimitive,
  CopyPlan,
  EVAL_FOLDER_PATH,
  type EvalSuite,
  FileOutsideFolderFault,
  type ForFetchingCharterSources,
  type ForManagingCharter,
  type ForReadingFiles,
  type ForWritingFiles,
  OccupiedPrimitiveFileFault,
  OverlappingPrimitiveFoldersFault,
  outputPath,
  PRIMITIVES_FOLDER_PATH,
  type Primitive,
  PrimitiveLayer,
  Primitives,
  RawEvalSuite,
  type RawPrimitive,
  RawSourceSkill,
  RawTestSuite,
  RawVendorSource,
  SkillPrimitive,
  SourceCharter,
  TEST_FOLDER_PATH,
  type TestSuite,
  VENDORS_FOLDER_PATH,
  VendorRoot,
  VendorRootFactory,
  VendorSource,
  type VendorSourceOrigin,
  WritePlan,
} from "../app/port/out/managing-charter.port.js";
import {
  assertNewLayout,
  createOldLayoutFault,
  findItemPlace,
  findOldLayoutPaths,
  findSkillFiles,
  OUT_FOLDER,
  readRawPrimitives,
} from "./helper.js";

/** Read as an address would read it, under a folder that is no root, so
 *  neither a `..` nor a leading `/` can step out of it. */
const UNROOTED_FOLDER = "memory://repo/root/";

/**
 * Keeps a charter as files, all of it through the one port (CORE-FR-228),
 * under `.cw/charter/` (CORE-FR-224): the repository's own primitives under
 * `primitive/`, each a folder of its kind's, `<kind>/<id>/`, holding its
 * index.md and its assets; the vendors it installed under `vendor/`, each
 * named as it was installed; its test cases under `test/` and its eval cases
 * under `eval/`, a JSON file each. A source is read as cw lays one out: its
 * own charter at `.cw/charter/primitive/`, charters kept apart at
 * `charters/<name>/.cw/charter/primitive/`, and skills under `skills/`
 * (CORE-FR-185, CORE-FR-195).
 *
 * A repository laid out the old way — its kinds right under `.cw/charter/`,
 * its tests, eval cases and vendors right under `.cw/` — is refused by every
 * operation, and so is a source laid out that way, naming the skill that
 * moves it (CORE-FR-226).
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
    const keptFiles = (
      await Promise.all(
        [PRIMITIVES_FOLDER_PATH, VENDORS_FOLDER_PATH].map((folderPath) =>
          this.#fileReader.readBytesRecursively(folderPath),
        ),
      )
    ).flat();
    const findFileAddress = (path: string) => this.#fileReader.findFileAddress(path);
    return [
      ...readRawPrimitives(keptFiles, `${PRIMITIVES_FOLDER_PATH}/`, PrimitiveLayer.REPO, findFileAddress),
      ...VendorRootFactory.create(
        keptFiles.map(({ path }) => path),
        findFileAddress,
      ).vendors.flatMap(({ name }) =>
        readRawPrimitives(
          keptFiles,
          `${VENDORS_FOLDER_PATH}/${name}/${VendorRoot.primitivesFolder}/`,
          PrimitiveLayer.vendorLayerOf(name),
          findFileAddress,
        ),
      ),
    ];
  }

  async createCharter(): Promise<void> {
    await assertNewLayout(this.#fileReader);
    // A folder per kind, and one each for the tests, the eval cases and the
    // vendors, which a filesystem only keeps once there is a file in it — and
    // which git only records at all once there is one (FR-001, CORE-FR-224).
    for (const kind of Primitives.kinds)
      await this.#fileWriter.writeFile(`${PRIMITIVES_FOLDER_PATH}/${kind}/.gitkeep`, "");
    for (const folderPath of [TEST_FOLDER_PATH, EVAL_FOLDER_PATH, VENDORS_FOLDER_PATH])
      await this.#fileWriter.writeFile(`${folderPath}/.gitkeep`, "");
  }

  async addPrimitive(rawPrimitive: RawPrimitive): Promise<string> {
    const [addedUri = ""] = await this.#writePrimitives([rawPrimitive], false);
    return addedUri;
  }

  async injectPrimitives(rawPrimitives: readonly RawPrimitive[]): Promise<readonly string[]> {
    return this.#writePrimitives(rawPrimitives, true);
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
    const charterFilePaths = (await this.#fileReader.readBytesRecursively(PRIMITIVES_FOLDER_PATH)).map(
      ({ path }) => path,
    );
    const plannedFiles: { readonly path: string; readonly contents: string | Uint8Array }[] = [];
    const addedIndexPaths: string[] = [];
    for (const rawPrimitive of rawPrimitives) {
      const indexPath = this.#findIndexPath(rawPrimitive.kind, rawPrimitive.id);
      if (charterFilePaths.includes(indexPath) || addedIndexPaths.includes(indexPath))
        throw new OccupiedPrimitiveFileFault(
          `${indexPath} is already there, and writing this one would write over what it holds.`,
          `Open it, or run this again with an id this charter has not got.`,
          { internal: false },
        );
      // Going down from a kind's folder the first index.md is the primitive, so
      // a folder inside another primitive's would be one of its assets, and one
      // holding a primitive would take it for one of its own (FR-167).
      const primitiveFolder = indexPath.slice(0, -BasePrimitive.indexFileName.length);
      const kindFolder = `${PRIMITIVES_FOLDER_PATH}/${rawPrimitive.kind}/`;
      const indexPathInTheWay = [...charterFilePaths, ...addedIndexPaths].find(
        (charterFilePath) =>
          charterFilePath.startsWith(kindFolder) &&
          charterFilePath.endsWith(`/${BasePrimitive.indexFileName}`) &&
          (primitiveFolder.startsWith(charterFilePath.slice(0, charterFilePath.lastIndexOf("/") + 1)) ||
            charterFilePath.startsWith(primitiveFolder)),
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
        ? charterFilePaths.find((charterFilePath) => charterFilePath.startsWith(primitiveFolder))
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
        const assetPath = `${primitiveFolder}${assetFile.assetPath}`;
        if (
          !new URL(assetPath.split("/").map(encodeURIComponent).join("/"), UNROOTED_FOLDER).href.startsWith(
            new URL(primitiveFolder, UNROOTED_FOLDER).href,
          )
        )
          throw isFolderOwned
            ? new FileOutsideFolderFault(
                `${assetFile.assetPath} would land outside ${primitiveFolder}.`,
                "Inject from a source whose files stay inside each primitive's folder.",
                { internal: false },
              )
            : new FileOutsideFolderFault(
                `${assetFile.assetPath} would land outside ${primitiveFolder}.`,
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

  findCharterUri(): string {
    return this.#fileReader.findFileAddress(PRIMITIVES_FOLDER_PATH);
  }

  async rewritePrimitive(primitive: Primitive): Promise<void> {
    await assertNewLayout(this.#fileReader);
    const indexPath = this.#findIndexPath(primitive.kind, primitive.headers.id);
    this.#assertInsideCharter([indexPath]);
    await this.#fileWriter.writeFile(indexPath, primitive.writeMarkdown());
  }

  async removePrimitive(primitive: Primitive): Promise<void> {
    await assertNewLayout(this.#fileReader);
    const indexPath = this.#findIndexPath(primitive.kind, primitive.headers.id);
    const primitiveFolder = indexPath.slice(0, -BasePrimitive.indexFileName.length);
    const removedPaths = [
      indexPath,
      ...primitive.assets.map((assetFile) => `${primitiveFolder}${assetFile.assetPath}`),
    ];
    this.#assertInsideCharter(removedPaths);
    for (const path of removedPaths) await this.#fileWriter.deleteFile(path);
  }

  async fetchVendorSource(vendorSourceOrigin: VendorSourceOrigin, version?: string): Promise<RawVendorSource> {
    const { sourceUri } = vendorSourceOrigin;
    const fetchedCommit = await this.#sourceFetcher.fetchCommit(sourceUri, version);
    try {
      const sourcePaths = await this.#sourceFetcher.listFilesAt(fetchedCommit);
      // A source laid out the old way, its own charter or one kept apart, is
      // refused before anything of it is read (CORE-FR-226).
      const oldSourcePaths = [
        ...findOldLayoutPaths(sourcePaths),
        ...[
          ...new Set(
            sourcePaths
              .filter((sourcePath) => sourcePath.startsWith(`${VendorSource.chartersFolder}/`))
              .map((sourcePath) => sourcePath.split("/").slice(0, 2).join("/")),
          ),
        ].flatMap((charterFolderPath) => findOldLayoutPaths(sourcePaths, `${charterFolderPath}/`)),
      ];
      if (oldSourcePaths.length > 0) throw createOldLayoutFault(sourceUri, oldSourcePaths);
      const readFilesUnder = (folderPrefix: string) =>
        Promise.all(
          sourcePaths
            .filter((sourcePath) => sourcePath.startsWith(folderPrefix))
            .map(async (path) => ({ path, contents: await this.#sourceFetcher.readBytesAt(fetchedCommit, path) })),
        );
      /** One charter of the source, under this folder of it: "" for its own. */
      const loadSourceCharter = async (charterName: string, charterSource: string): Promise<SourceCharter> => {
        const sourcePrefix = charterSource === "" ? "" : `${charterSource}/`;
        const charterPrefix = `${sourcePrefix}${PRIMITIVES_FOLDER_PATH}/`;
        return new SourceCharter(
          charterName,
          sourcePaths.some((sourcePath) => sourcePath.startsWith(charterPrefix)),
          sourcePaths.some((sourcePath) => sourcePath.startsWith(`${sourcePrefix}${VENDORS_FOLDER_PATH}/`)),
          // Only a primitive kept in its folder is one a source publishes.
          readRawPrimitives(
            await readFilesUnder(charterPrefix),
            charterPrefix,
            PrimitiveLayer.REPO,
            (path) => path,
          ).filter(({ isKeptApart }) => isKeptApart),
          charterSource,
          `${sourcePrefix}${VENDORS_FOLDER_PATH}`,
          `${sourcePrefix}${PRIMITIVES_FOLDER_PATH}`,
        );
      };
      const ownCharter = sourcePaths.some((sourcePath) => sourcePath.startsWith(`${PRIMITIVES_FOLDER_PATH}/`))
        ? await loadSourceCharter("", "")
        : undefined;
      const charterNames = [
        ...new Set(
          sourcePaths
            .filter(
              (sourcePath) =>
                sourcePath.startsWith(`${VendorSource.chartersFolder}/`) && sourcePath.split("/").length > 2,
            )
            .map((sourcePath) => sourcePath.split("/")[1] ?? ""),
        ),
      ].sort();
      const sourceCharters = await Promise.all(
        charterNames.map((charterName) =>
          loadSourceCharter(charterName, `${VendorSource.chartersFolder}/${charterName}`),
        ),
      );
      const rawSourceSkills = await Promise.all(
        findSkillFiles(sourcePaths).map(async (skillFile) => {
          const skillFolderPrefix = skillFile.slice(0, -VendorSource.skillFile.length);
          const assets = (await readFilesUnder(skillFolderPrefix))
            .filter(({ path }) => path !== skillFile)
            .map(({ path, contents }) => ({ assetPath: path.slice(skillFolderPrefix.length), contents }));
          return new RawSourceSkill(
            await this.#sourceFetcher.readFileAt(fetchedCommit, skillFile),
            assets,
            skillFile,
            skillFolderPrefix.slice(0, -1),
          );
        }),
      );
      return new RawVendorSource(vendorSourceOrigin, fetchedCommit, ownCharter, sourceCharters, rawSourceSkills);
    } catch (raisedValue) {
      await this.#sourceFetcher.removeTempCommit(fetchedCommit);
      throw raisedValue;
    }
  }

  async removeTempSource(rawVendorSource: RawVendorSource): Promise<void> {
    await this.#sourceFetcher.removeTempCommit(rawVendorSource.commit);
  }

  async loadVendorRoot(): Promise<VendorRoot> {
    await assertNewLayout(this.#fileReader);
    return VendorRootFactory.create(await this.#loadVendorFilePaths(), (folderPath) =>
      this.#fileReader.findFileAddress(folderPath),
    );
  }

  async storeVendor(vendorSource: VendorSource): Promise<void> {
    // Where each part of a vendor lands, in order: each charter's primitives
    // copied whole, the source's own under its own charter's name and each
    // kept apart under its own; each skill's folder copied under the own
    // charter's, its index.md written as the skill it converts to and its
    // `SKILL.md` taken away once it is down (CORE-FR-186).
    const findPrimitivesFolder = (charterName: string) =>
      `${VENDORS_FOLDER_PATH}/${vendorSource.origin.name}/${charterName}/${VendorRoot.primitivesFolder}`;
    const writeOrCopyPlans: (WritePlan | CopyPlan)[] = [];
    const cleanupPlans: WritePlan[] = [];
    if (vendorSource.ownCharter !== undefined)
      writeOrCopyPlans.push(
        new CopyPlan(vendorSource.ownCharter.sourceFolder, findPrimitivesFolder(VendorSource.ownCharterName)),
      );
    for (const { name, sourceFolder } of vendorSource.charters)
      writeOrCopyPlans.push(new CopyPlan(sourceFolder, findPrimitivesFolder(name)));
    for (const { convertedSkill, sourceFolder } of vendorSource.skills) {
      const skillFolder = `${findPrimitivesFolder(VendorSource.ownCharterName)}/${SkillPrimitive.kind}/${convertedSkill.headers.id}`;
      const [indexPath, skillFilePath] = [
        `${skillFolder}/${SkillPrimitive.indexFileName}`,
        `${skillFolder}/${VendorSource.skillFile}`,
      ];
      writeOrCopyPlans.push(
        new CopyPlan(sourceFolder, skillFolder),
        new WritePlan(indexPath, indexPath, convertedSkill.writeMarkdown()),
      );
      cleanupPlans.push(new WritePlan(skillFilePath, skillFilePath));
    }

    // A folder is copied as the source holds it, and a link a source left on
    // the way is refused where it is copied (CORE-FR-044).
    for (const writeOrCopyPlan of writeOrCopyPlans) {
      if (writeOrCopyPlan instanceof CopyPlan)
        await this.#sourceFetcher.checkOutFolder(
          vendorSource.commit,
          writeOrCopyPlan.sourcePath,
          writeOrCopyPlan.destinationPath,
        );
      else if (writeOrCopyPlan.contents === undefined) await this.#fileWriter.deleteFile(writeOrCopyPlan.filePath);
      else await this.#writeVendorFile(writeOrCopyPlan.filePath, writeOrCopyPlan.contents);
    }
    for (const { filePath } of cleanupPlans) await this.#fileWriter.deleteFile(filePath);
  }

  findVendorUri(vendorName: string): string {
    return this.#fileReader.findFileAddress(`${VENDORS_FOLDER_PATH}/${vendorName}`);
  }

  async removeVendor(vendorName: string): Promise<void> {
    await assertNewLayout(this.#fileReader);
    const vendorFolder = `${VENDORS_FOLDER_PATH}/${vendorName}`;
    await this.#fileWriter.deleteFolder(vendorFolder);
    // Each folder above it goes too once nothing is left in it, up to the
    // vendor folder and never past it.
    for (
      let parentFolderNames = vendorFolder.split("/").slice(0, -1);
      `${parentFolderNames.join("/")}/`.startsWith(`${VENDORS_FOLDER_PATH}/`);
      parentFolderNames = parentFolderNames.slice(0, -1)
    )
      await this.#fileWriter.deleteEmptyFolder(parentFolderNames.join("/"));
  }

  async loadTestSuites(): Promise<readonly RawTestSuite[]> {
    await assertNewLayout(this.#fileReader);
    return (await this.#fileReader.readFilesRecursively(TEST_FOLDER_PATH))
      .filter(({ path }) => path.endsWith(".json"))
      .map(
        ({ path, contents }) =>
          new RawTestSuite(path.slice(`${TEST_FOLDER_PATH}/`.length), contents, this.#fileReader.findFileAddress(path)),
      );
  }

  async writeTestSuite(name: string, testSuite: TestSuite): Promise<void> {
    await assertNewLayout(this.#fileReader);
    await this.#fileWriter.writeFile(`${TEST_FOLDER_PATH}/${name}`, testSuite.body);
  }

  async removeTestSuite(name: string): Promise<void> {
    await assertNewLayout(this.#fileReader);
    await this.#fileWriter.deleteFile(`${TEST_FOLDER_PATH}/${name}`);
  }

  async loadEvalSuites(): Promise<readonly RawEvalSuite[]> {
    await assertNewLayout(this.#fileReader);
    return (await this.#fileReader.readFilesRecursively(EVAL_FOLDER_PATH))
      .filter(({ path }) => path.endsWith(".json"))
      .map(
        ({ path, contents }) =>
          new RawEvalSuite(path.slice(`${EVAL_FOLDER_PATH}/`.length), contents, this.#fileReader.findFileAddress(path)),
      );
  }

  async writeEvalSuite(name: string, evalSuite: EvalSuite): Promise<void> {
    await assertNewLayout(this.#fileReader);
    await this.#fileWriter.writeFile(`${EVAL_FOLDER_PATH}/${name}`, evalSuite.body);
  }

  async removeEvalSuite(name: string): Promise<void> {
    await assertNewLayout(this.#fileReader);
    await this.#fileWriter.deleteFile(`${EVAL_FOLDER_PATH}/${name}`);
  }

  /** Where a primitive of the repository's own layer is kept. */
  #findIndexPath(kind: string, id: string): string {
    return `${PRIMITIVES_FOLDER_PATH}/${kind}/${id}/${BasePrimitive.indexFileName}`;
  }

  /** Refused unless every path stays inside the repository's own charter: a
   *  `..`, or a name escaped to read as one, would carry a file out of it
   *  (CORE-FR-044). */
  #assertInsideCharter(charterFilePaths: readonly string[]): void {
    const charterFolderHref = new URL(`${PRIMITIVES_FOLDER_PATH}/`, UNROOTED_FOLDER).href;
    const outsidePath = charterFilePaths.find(
      (path) =>
        !new URL(path.split("/").map(encodeURIComponent).join("/"), UNROOTED_FOLDER).href.startsWith(charterFolderHref),
    );
    if (outsidePath !== undefined)
      throw new FileOutsideFolderFault(
        `${outsidePath} would land outside ${PRIMITIVES_FOLDER_PATH}/.`,
        "Write only files of the repository's own charter.",
        { internal: false },
      );
  }

  /** The path of every file kept under the vendor folder. Listed, never read:
   *  a link a source left there is no file of a vendor's, and reading it would
   *  refuse the whole listing. */
  async #loadVendorFilePaths(): Promise<readonly string[]> {
    const listFilePathsUnder = async (folderPath: string): Promise<readonly string[]> => [
      ...(await this.#fileReader.listFiles(folderPath)).map(({ path }) => path),
      ...(await Promise.all((await this.#fileReader.listFolders(folderPath)).map(listFilePathsUnder))).flat(),
    ];
    return listFilePathsUnder(VENDORS_FOLDER_PATH);
  }

  /** One file kept at this path, put down fresh: what stood there is taken away
   *  first, since a write follows a link and a source may have put one there
   *  (CORE-FR-044). */
  async #writeVendorFile(path: string, contents: string | Uint8Array): Promise<void> {
    await this.#fileWriter.deleteFile(path);
    await this.#fileWriter.writeFile(path, contents);
  }

  async readBuiltOutputItem(itemPath: string): Promise<string | undefined> {
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
