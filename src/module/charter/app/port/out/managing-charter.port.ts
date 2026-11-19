import type { RawCharterMetadata } from "../../../domain/models/charter/raw-charter-metadata.js";
import type { EvalSuite } from "../../../domain/models/eval/eval-suite.js";
import type { RawEvalSuite } from "../../../domain/models/eval/raw-eval-suite.js";
import type { Primitive } from "../../../domain/models/primitive/primitive.js";
import type { RawPrimitive } from "../../../domain/models/primitive/raw-primitive.js";
import type { RawTestSuite } from "../../../domain/models/test/raw-test-suite.js";
import type { TestSuite } from "../../../domain/models/test/test-suite.js";
import type { CharterInstall } from "../../../domain/models/vendor/charter-install.js";
import type { VendorSource } from "../../../domain/models/vendor/vendor-source.js";
import type { VendorSourceOrigin } from "../../../domain/models/vendor/vendor-source-origin.value-object.js";

export {
  AdapterFault,
  FileOutsideFolderFault,
  type ForReadingFiles,
  type ForWritingFiles,
  OccupiedPrimitiveFileFault,
  OldLayoutFault,
  OrphanPrimitiveFault,
  OverlappingPrimitiveFoldersFault,
  type ReadFile,
} from "../../../../shared/module.js";
export { charterPath, outputPath } from "../../../domain/constants.js";
export { CharterPath } from "../../../domain/models/charter/charter-path.js";
export { RawCharterMetadata } from "../../../domain/models/charter/raw-charter-metadata.js";
export { VendorRecord } from "../../../domain/models/charter/vendor-record.value-object.js";
export { CharterOutputItem } from "../../../domain/models/charter-output/charter-output-item.js";
export { CopyPlan, ProjectionPlan, WritePlan } from "../../../domain/models/charter-output/projection-plan.js";
export type { EvalSuite } from "../../../domain/models/eval/eval-suite.js";
export { RawEvalSuite } from "../../../domain/models/eval/raw-eval-suite.js";
export { AssetFile } from "../../../domain/models/primitive/asset-file.js";
export { BasePrimitive } from "../../../domain/models/primitive/base-primitive.js";
export { type Primitive, Primitives } from "../../../domain/models/primitive/primitive.js";
export { PrimitiveLayer } from "../../../domain/models/primitive/primitive-layer.value-object.js";
/** The models and the layout a charter repository keeps a charter in, named
 *  again here so an adapter keeping one imports nothing of the hexagon but its
 *  port. */
export { RawPrimitive } from "../../../domain/models/primitive/raw-primitive.js";
export { SkillPrimitive } from "../../../domain/models/primitive/skill-primitive.js";
export { RawTestSuite } from "../../../domain/models/test/raw-test-suite.js";
export type { TestSuite } from "../../../domain/models/test/test-suite.js";
export { CharterInstall } from "../../../domain/models/vendor/charter-install.js";
export { SourceCharter, VendorSource } from "../../../domain/models/vendor/vendor-source.js";
export type { VendorSourceOrigin } from "../../../domain/models/vendor/vendor-source-origin.value-object.js";
export type { ForFetchingCharterSources } from "./fetching-charter-sources.port.js";

/** Keeps a repository's charter, wherever it keeps it, and knows how: its
 *  primitives, the vendors it installed, its test cases and its eval cases,
 *  through this one port (CORE-FR-228), and reads back what the last build
 *  laid of it, each item known by its path inside the output, never by
 *  where the output lands (CORE-FR-221). Where a primitive, an asset of one, a
 *  vendor's or a suite sits is its own to know, never the engine's, which knows
 *  a primitive by its layer, kind and id and a suite by its name
 *  (CORE-FR-213). */
export interface ForManagingCharter {
  /** Every primitive kept of the repository's charter, each with its assets,
   *  in the layer of the charter it is kept in: authored, or installed where the
   *  charter holds where it came from (VENDOR-FR-009, VENDOR-FR-010). */
  loadCharter(): Promise<readonly RawPrimitive[]>;

  /** Every charter kept, each with what it holds of where it came from where it
   *  was installed (VENDOR-FR-009, VENDOR-FR-010). */
  loadCharterMetadata(): Promise<readonly RawCharterMetadata[]>;

  /** A place laid out for the charter root's charters, holding none: what a
   *  repository is set up with (FR-057, VENDOR-FR-013). */
  createCharter(): Promise<void>;

  /** One new primitive of the repository's own layer kept, with its assets
   *  where none stands there already, and a file already in its folder left
   *  as one of them; its uri. Refused, with nothing written, where it is kept
   *  already, would be kept inside another or around it, or would land outside
   *  the charter (FR-167, CORE-FR-044). Handed the primitive as authored, which
   *  is kept nowhere yet. */
  addPrimitive(primitive: Primitive): Promise<string>;

  /** Refused where the repository is laid out in a way this store no longer
   *  keeps, naming what moves it (CORE-FR-226). */
  assertLayout(): Promise<void>;

  /** Where the repository's own layer is kept, said back and never read. */
  findCharterUri(): string;

  /** Where an author edits the charter, in this keeper's words, from the
   *  repository's root where it keeps it there: what each agent is told to
   *  edit, said back and never read (SDK-FR-020). */
  describeCharterPlace(): string;

  /** One primitive of the repository's own layer kept over what it was, its
   *  assets as they are (FR-075). */
  rewritePrimitive(primitive: Primitive): Promise<void>;

  /** One primitive of the repository's own layer taken away, with its assets,
   *  and nothing else (FR-076, FR-167). */
  removePrimitive(primitive: Primitive): Promise<void>;

  /** One commit of this source, at this version where one is named, fetched
   *  and read: the charters it keeps (VENDOR-FR-017). Whoever asked says
   *  `removeFetchedSource` once done. A source that cannot be reached raises
   *  an `AdapterFault` saying so. */
  fetchVendorSource(vendorSourceOrigin: VendorSourceOrigin, version?: string): Promise<VendorSource>;

  /** The temporary folder a source was fetched into, removed with all it holds. */
  removeFetchedSource(vendorSource: VendorSource): Promise<void>;

  /** Each charter of a source fetched put in the repository as planned: what
   *  its name held taken away whole, the folders of the source's charter
   *  copied in as the source holds them, and its `cw-vendor.json` written, or
   *  taken away where it keeps none (VENDOR-FR-017 to VENDOR-FR-022). Nothing
   *  is staged and nothing committed. */
  storeCharters(vendorSource: VendorSource, charterInstalls: readonly CharterInstall[]): Promise<void>;

  /** Where a charter of this name is kept, in this keeper's words: said back,
   *  never read. */
  findCharterFolderUri(charterName: string): string;

  /** The charter of this name taken away whole (VENDOR-FR-021). */
  removeCharter(charterName: string): Promise<void>;

  /** Every test suite kept, by its name in its charter and that charter, with
   *  what it holds (VENDOR-FR-009). */
  loadTestSuites(): Promise<readonly RawTestSuite[]>;

  /** One test suite kept under this name in this charter, as its author wrote it, over
   *  whatever it held. */
  writeTestSuite(charterName: string, name: string, testSuite: TestSuite): Promise<void>;

  /** The test suite kept under this name in this charter taken away. */
  removeTestSuite(charterName: string, name: string): Promise<void>;

  /** Every file of evaluation cases kept, by its name in its charter and that
   *  charter, with what it holds (VENDOR-FR-009). */
  loadEvalSuites(): Promise<readonly RawEvalSuite[]>;

  /** One file of evaluation cases kept under this name in this charter, as its author wrote
   *  it, over whatever it held. */
  writeEvalSuite(charterName: string, name: string, evalSuite: EvalSuite): Promise<void>;

  /** The file of evaluation cases kept under this name in this charter taken away. */
  removeEvalSuite(charterName: string, name: string): Promise<void>;

  /** The text a build laid for the item at this path inside its output, as
   *  it was laid; nothing where none was. */
  readCompiledOutputItem(itemPath: string): Promise<string | undefined>;

  /** Where the item at this path inside the output is laid, in this keeper's
   *  words: said back where a message names it, and never read. */
  describeItemPlace(itemPath: string): string;

  /** A text the last build laid, each path into its output — `$CW_OUT/` and
   *  the path inside it — written as where this keeper laid the output, as a
   *  command of it is run (CORE-FR-221). */
  resolveOutputLinks(laidText: string): string;
}
