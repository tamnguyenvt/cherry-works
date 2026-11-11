import { checkoutPathOf, filePathOf } from "../../shared/module.js";
import {
  AdapterFault,
  BasePrimitive,
  CopyPlan,
  EvalFolder,
  type ForFetchingCharterSources,
  type ForManagingCharter,
  type ForReadingFiles,
  type ForWritingFiles,
  type OutputPart,
  type Primitive,
  PrimitiveLayer,
  Primitives,
  PrimitivesFolder,
  type ProjectionPlan,
  RawEvalSuite,
  type RawPrimitive,
  RawSourceSkill,
  RawTestSuite,
  RawVendorSource,
  SourceCharter,
  TestFolder,
  type TestSuite,
  VendorRoot,
  VendorRootFactory,
  VendorSource,
  type VendorSourceOrigin,
  VendorsFolder,
  type WritePlan,
} from "../app/port/out/managing-charter.port.js";
import {
  assertNewLayout,
  createOldLayoutFault,
  OUT_FOLDER,
  oldLayoutPathsOf,
  placeOfPart,
  rawPrimitivesOf,
  skillFilesOf,
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

  async loadCharter(checkoutPath = ""): Promise<readonly RawPrimitive[]> {
    const checkoutFolderPath = checkoutPathOf(checkoutPath);
    await assertNewLayout(this.#fileReader, checkoutFolderPath);
    const keptFiles = (
      await Promise.all(
        [PrimitivesFolder.path, VendorsFolder.path].map((folderPath) =>
          this.#fileReader.readBytesRecursively(`${checkoutFolderPath}${folderPath}`),
        ),
      )
    )
      .flat()
      .map(({ path, contents }) => ({ path: path.slice(checkoutFolderPath.length), contents }));
    // A checkout's files are named where they sit in the repository: the
    // checkout is gone once it is read (EVAL-FR-021).
    const findFileAddress = (path: string) => this.#fileReader.findFileAddress(path);
    return [
      ...rawPrimitivesOf(keptFiles, `${PrimitivesFolder.path}/`, PrimitiveLayer.REPO, findFileAddress),
      ...VendorRootFactory.create(
        keptFiles.map(({ path }) => path),
        findFileAddress,
      ).vendors.flatMap(({ name }) =>
        rawPrimitivesOf(
          keptFiles,
          `${VendorsFolder.path}/${name}/${VendorRoot.primitivesFolder}/`,
          PrimitiveLayer.ofVendor(name),
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
    for (const kind of Primitives.kinds) await this.#fileWriter.write(`${PrimitivesFolder.path}/${kind}/.gitkeep`, "");
    for (const folderPath of [TestFolder.path, EvalFolder.path, VendorsFolder.path])
      await this.#fileWriter.write(`${folderPath}/.gitkeep`, "");
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
    const charterFilePaths = (await this.#fileReader.readBytesRecursively(PrimitivesFolder.path)).map(
      ({ path }) => path,
    );
    const plannedFiles: { readonly path: string; readonly contents: string | Uint8Array }[] = [];
    const addedIndexPaths: string[] = [];
    for (const rawPrimitive of rawPrimitives) {
      const indexPath = this.#indexPathOf(rawPrimitive.kind, rawPrimitive.id);
      if (charterFilePaths.includes(indexPath) || addedIndexPaths.includes(indexPath))
        throw new AdapterFault(
          `${indexPath} is already there, and writing this one would write over what it holds.`,
          `Open it, or run this again with an id this charter has not got.`,
          { internal: false },
        );
      // Going down from a kind's folder the first index.md is the primitive, so
      // a folder inside another primitive's would be one of its assets, and one
      // holding a primitive would take it for one of its own (FR-167).
      const primitiveFolder = indexPath.slice(0, -BasePrimitive.index.length);
      const kindFolder = `${PrimitivesFolder.path}/${rawPrimitive.kind}/`;
      const primitiveInTheWay = [...charterFilePaths, ...addedIndexPaths].find(
        (charterFilePath) =>
          charterFilePath.startsWith(kindFolder) &&
          charterFilePath.endsWith(`/${BasePrimitive.index}`) &&
          (primitiveFolder.startsWith(charterFilePath.slice(0, charterFilePath.lastIndexOf("/") + 1)) ||
            charterFilePath.startsWith(primitiveFolder)),
      );
      if (primitiveInTheWay !== undefined && isFolderOwned)
        throw new AdapterFault(
          `${primitiveInTheWay} and ${rawPrimitive.uri} claim overlapping primitive folders at ${indexPath}.`,
          "Inject primitives whose folders are apart from the existing files.",
          { internal: false },
        );
      if (primitiveInTheWay !== undefined)
        throw new AdapterFault(
          `${primitiveInTheWay} is a primitive, and ${indexPath} would sit inside its folder or hold it, so both would claim its files. Every file under a primitive's folder is one of its assets.`,
          `Run this again with an id whose folder is apart from it.`,
          { internal: false },
        );
      const heldPath = isFolderOwned
        ? charterFilePaths.find((charterFilePath) => charterFilePath.startsWith(primitiveFolder))
        : undefined;
      if (heldPath !== undefined)
        throw new AdapterFault(
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
        const assetPath = `${primitiveFolder}${assetFile.file}`;
        if (
          !new URL(assetPath.split("/").map(encodeURIComponent).join("/"), UNROOTED_FOLDER).href.startsWith(
            new URL(primitiveFolder, UNROOTED_FOLDER).href,
          )
        )
          throw isFolderOwned
            ? new AdapterFault(
                `${assetFile.file} would land outside ${primitiveFolder}.`,
                "Inject from a source whose files stay inside each primitive's folder.",
                { internal: false },
              )
            : new AdapterFault(
                `${assetFile.file} would land outside ${primitiveFolder}.`,
                "Keep every file of a primitive inside its folder.",
                { internal: false },
              );
        if (!charterFilePaths.includes(assetPath)) plannedFiles.push({ path: assetPath, contents: assetFile.contents });
      }
    }
    this.#assertInsideCharter(plannedFiles.map(({ path }) => path));
    for (const { path, contents } of plannedFiles) await this.#fileWriter.write(path, contents);
    return addedIndexPaths.map((indexPath) => this.#fileReader.findFileAddress(indexPath));
  }

  async assertLayout(): Promise<void> {
    await assertNewLayout(this.#fileReader);
  }

  findCharterUri(): string {
    return this.#fileReader.findFileAddress(PrimitivesFolder.path);
  }

  async rewritePrimitive(primitive: Primitive): Promise<void> {
    await assertNewLayout(this.#fileReader);
    const indexPath = this.#indexPathOf(primitive.kind, primitive.headers.id);
    this.#assertInsideCharter([indexPath]);
    await this.#fileWriter.write(indexPath, primitive.toMarkdown());
  }

  async removePrimitive(primitive: Primitive): Promise<void> {
    await assertNewLayout(this.#fileReader);
    const indexPath = this.#indexPathOf(primitive.kind, primitive.headers.id);
    const primitiveFolder = indexPath.slice(0, -BasePrimitive.index.length);
    const removedPaths = [indexPath, ...primitive.assets.map((assetFile) => `${primitiveFolder}${assetFile.file}`)];
    this.#assertInsideCharter(removedPaths);
    for (const path of removedPaths) await this.#fileWriter.delete(path);
  }

  async fetchVendorSource(vendorSourceOrigin: VendorSourceOrigin, version?: string): Promise<RawVendorSource> {
    const { sourceUri } = vendorSourceOrigin;
    const fetchedCommit = await this.#sourceFetcher.fetchCommit(sourceUri, version);
    try {
      const sourcePaths = await this.#sourceFetcher.listFilesAt(fetchedCommit);
      // A source laid out the old way, its own charter or one kept apart, is
      // refused before anything of it is read (CORE-FR-226).
      const oldSourcePaths = [
        ...oldLayoutPathsOf(sourcePaths),
        ...[
          ...new Set(
            sourcePaths
              .filter((sourcePath) => sourcePath.startsWith(`${VendorSource.chartersFolder}/`))
              .map((sourcePath) => sourcePath.split("/").slice(0, 2).join("/")),
          ),
        ].flatMap((charterFolderPath) => oldLayoutPathsOf(sourcePaths, `${charterFolderPath}/`)),
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
        const charterPrefix = `${sourcePrefix}${PrimitivesFolder.path}/`;
        return new SourceCharter(
          charterName,
          sourcePaths.some((sourcePath) => sourcePath.startsWith(charterPrefix)),
          sourcePaths.some((sourcePath) => sourcePath.startsWith(`${sourcePrefix}${VendorsFolder.path}/`)),
          // Only a primitive kept in its folder is one a source publishes.
          rawPrimitivesOf(
            await readFilesUnder(charterPrefix),
            charterPrefix,
            PrimitiveLayer.REPO,
            (path) => path,
          ).filter(({ isKeptApart }) => isKeptApart),
          charterSource,
          `${sourcePrefix}${VendorsFolder.path}`,
          `${sourcePrefix}${PrimitivesFolder.path}`,
        );
      };
      const ownCharter = sourcePaths.some((sourcePath) => sourcePath.startsWith(`${PrimitivesFolder.path}/`))
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
        skillFilesOf(sourcePaths).map(async (skillFile) => {
          const skillFolderPrefix = skillFile.slice(0, -VendorSource.skillFile.length);
          const assets = (await readFilesUnder(skillFolderPrefix))
            .filter(({ path }) => path !== skillFile)
            .map(({ path, contents }) => ({ file: path.slice(skillFolderPrefix.length), contents }));
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
      await this.#sourceFetcher.forgetCommit(fetchedCommit);
      throw raisedValue;
    }
  }

  async cleanupVendorSource(rawVendorSource: RawVendorSource): Promise<void> {
    await this.#sourceFetcher.forgetCommit(rawVendorSource.commit);
  }

  async loadVendorRoot(): Promise<VendorRoot> {
    await assertNewLayout(this.#fileReader);
    return VendorRootFactory.create(await this.#loadVendorFilePaths(), (folderPath) =>
      this.#fileReader.findFileAddress(folderPath),
    );
  }

  async storeVendor(vendorSource: VendorSource, projectionPlan: ProjectionPlan<WritePlan | CopyPlan>): Promise<void> {
    // A folder is copied as the source holds it, and a link a source left on
    // the way is refused where it is copied (CORE-FR-044).
    for (const writeOrCopyPlan of projectionPlan.projectionPlan) {
      if (writeOrCopyPlan instanceof CopyPlan)
        await this.#sourceFetcher.checkoutFolderAt(
          vendorSource.commit,
          writeOrCopyPlan.sourcePath,
          writeOrCopyPlan.destinationPath,
        );
      else if (writeOrCopyPlan.contents === undefined) await this.#fileWriter.delete(writeOrCopyPlan.filePath);
      else await this.#writeVendorFile(writeOrCopyPlan.filePath, writeOrCopyPlan.contents);
    }
    for (const { filePath } of projectionPlan.cleanupPlan) await this.#fileWriter.delete(filePath);
  }

  findVendorUri(vendorName: string): string {
    return this.#fileReader.findFileAddress(`${VendorsFolder.path}/${vendorName}`);
  }

  async removeVendor(vendorName: string): Promise<void> {
    await assertNewLayout(this.#fileReader);
    const vendorFolder = `${VendorsFolder.path}/${vendorName}`;
    await this.#fileWriter.deleteFolder(vendorFolder);
    // Each folder above it goes too once nothing is left in it, up to the
    // vendor folder and never past it.
    for (
      let parentFolderNames = vendorFolder.split("/").slice(0, -1);
      `${parentFolderNames.join("/")}/`.startsWith(`${VendorsFolder.path}/`);
      parentFolderNames = parentFolderNames.slice(0, -1)
    )
      await this.#fileWriter.deleteEmptyFolder(parentFolderNames.join("/"));
  }

  async loadTestSuites(): Promise<readonly RawTestSuite[]> {
    await assertNewLayout(this.#fileReader);
    return (await this.#fileReader.readFilesRecursively(TestFolder.path))
      .filter(({ path }) => path.endsWith(".json"))
      .map(
        ({ path, contents }) =>
          new RawTestSuite(path.slice(`${TestFolder.path}/`.length), contents, this.#fileReader.findFileAddress(path)),
      );
  }

  async writeTestSuite(name: string, testSuite: TestSuite): Promise<void> {
    await assertNewLayout(this.#fileReader);
    await this.#fileWriter.write(`${TestFolder.path}/${name}`, testSuite.body);
  }

  async removeTestSuite(name: string): Promise<void> {
    await assertNewLayout(this.#fileReader);
    await this.#fileWriter.delete(`${TestFolder.path}/${name}`);
  }

  async loadEvalSuites(checkoutPath = ""): Promise<readonly RawEvalSuite[]> {
    const checkoutFolderPath = checkoutPathOf(checkoutPath);
    await assertNewLayout(this.#fileReader, checkoutFolderPath);
    return (await this.#fileReader.readFilesRecursively(`${checkoutFolderPath}${EvalFolder.path}`))
      .filter(({ path }) => path.endsWith(".json"))
      .map(
        ({ path, contents }) =>
          new RawEvalSuite(
            path.slice(`${checkoutFolderPath}${EvalFolder.path}/`.length),
            contents,
            this.#fileReader.findFileAddress(path.slice(checkoutFolderPath.length)),
          ),
      );
  }

  async writeEvalSuite(name: string, evalSuiteText: string): Promise<void> {
    await assertNewLayout(this.#fileReader);
    await this.#fileWriter.write(`${EvalFolder.path}/${name}`, evalSuiteText);
  }

  async removeEvalSuite(name: string): Promise<void> {
    await assertNewLayout(this.#fileReader);
    await this.#fileWriter.delete(`${EvalFolder.path}/${name}`);
  }

  /** Where a primitive of the repository's own layer is kept. */
  #indexPathOf(kind: string, id: string): string {
    return `${PrimitivesFolder.path}/${kind}/${id}/${BasePrimitive.index}`;
  }

  /** Refused unless every path stays inside the repository's own charter: a
   *  `..`, or a name escaped to read as one, would carry a file out of it
   *  (CORE-FR-044). */
  #assertInsideCharter(charterFilePaths: readonly string[]): void {
    const charterFolderHref = new URL(`${PrimitivesFolder.path}/`, UNROOTED_FOLDER).href;
    const outsidePath = charterFilePaths.find(
      (path) =>
        !new URL(path.split("/").map(encodeURIComponent).join("/"), UNROOTED_FOLDER).href.startsWith(charterFolderHref),
    );
    if (outsidePath !== undefined)
      throw new AdapterFault(
        `${outsidePath} would land outside ${PrimitivesFolder.path}/.`,
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
    return listFilePathsUnder(VendorsFolder.path);
  }

  /** One file kept at this path, put down fresh: what stood there is taken away
   *  first, since a write follows a link and a source may have put one there
   *  (CORE-FR-044). */
  async #writeVendorFile(path: string, contents: string | Uint8Array): Promise<void> {
    await this.#fileWriter.delete(path);
    await this.#fileWriter.write(path, contents);
  }

  async loadLaidText(outputPart: OutputPart, checkoutPath = ""): Promise<string | undefined> {
    // What a build laid in a repository laid out the old way is not read: the
    // repository is refused until it is moved (CORE-FR-226).
    await assertNewLayout(this.#fileReader, checkoutPathOf(checkoutPath));
    return this.#fileReader.readIfThere(filePathOf(checkoutPath, placeOfPart(outputPart)));
  }

  findPlace(outputPart: OutputPart): string {
    return placeOfPart(outputPart);
  }

  findOutputFolder(): string {
    return OUT_FOLDER;
  }
}
