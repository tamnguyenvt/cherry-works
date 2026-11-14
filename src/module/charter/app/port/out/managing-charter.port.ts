import type { EvalSuite } from "../../../domain/models/eval/eval-suite.js";
import type { RawEvalSuite } from "../../../domain/models/eval/raw-eval-suite.js";
import type { Primitive } from "../../../domain/models/primitive/primitive.js";
import type { RawPrimitive } from "../../../domain/models/primitive/raw-primitive.js";
import type { RawTestSuite } from "../../../domain/models/test/raw-test-suite.js";
import type { TestSuite } from "../../../domain/models/test/test-suite.js";
import type { RawVendorRoot } from "../../../domain/models/vendor/raw-vendor-root.js";
import type { RawVendorSource } from "../../../domain/models/vendor/raw-vendor-source.js";
import type { VendorSource } from "../../../domain/models/vendor/vendor-source.js";
import type { VendorSourceOrigin } from "../../../domain/models/vendor/vendor-source-origin.value-object.js";

export {
  AdapterFault,
  FileOutsideFolderFault,
  type ForReadingFiles,
  type ForWritingFiles,
  OccupiedPrimitiveFileFault,
  OldLayoutFault,
  OldVendorLayoutFault,
  OverlappingPrimitiveFoldersFault,
  type ReadFile,
} from "../../../../shared/module.js";
export { charterPath, outputPath, vendorSourcePath } from "../../../domain/constants.js";
export { CharterPath } from "../../../domain/models/charter/charter-path.js";
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
export { RawVendorRoot } from "../../../domain/models/vendor/raw-vendor-root.js";
export { RawSourceSkill, RawVendorSource } from "../../../domain/models/vendor/raw-vendor-source.js";
export { SourceCharter, SourceSkill, VendorSource } from "../../../domain/models/vendor/vendor-source.js";
export type { VendorSourceOrigin } from "../../../domain/models/vendor/vendor-source-origin.value-object.js";
export { VendorSourcePath } from "../../../domain/models/vendor/vendor-source-path.js";
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
  /** Every primitive kept of the repository's charter, its own layer and each
   *  vendor's, each with its assets. */
  loadCharter(): Promise<readonly RawPrimitive[]>;

  /** A place laid out for each kind of primitive, where none was: what a
   *  repository is set up with (FR-057). */
  createCharter(): Promise<void>;

  /** One new primitive of the repository's own layer kept, with its assets
   *  where none stands there already, and a file already in its folder left
   *  as one of them; its uri. Refused, with nothing written, where it is kept
   *  already, would be kept inside another or around it, or would land outside
   *  the charter (FR-167, CORE-FR-044). Handed the primitive as authored, which
   *  is kept nowhere yet. */
  addPrimitive(primitive: Primitive): Promise<string>;

  /** New primitives of the repository's own layer kept together, each one's
   *  uri in order; refused, with nothing written, as one added is, and where
   *  any file is already in one's folder (CORE-FR-194). Handed each as it is
   *  kept, not as a `Primitive` the way `addPrimitive` is: what is injected is
   *  a vendor's source copied byte for byte, and a primitive written again
   *  from the model would not be those bytes. */
  injectPrimitives(rawPrimitives: readonly RawPrimitive[]): Promise<readonly string[]>;

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
   *  and read: its own charter, the charters it keeps apart, and its skills.
   *  Whoever asked says `removeFetchedSource` once done. A source that cannot be
   *  reached raises an `AdapterFault` saying so (CORE-FR-190). */
  fetchVendorSource(vendorSourceOrigin: VendorSourceOrigin, version?: string): Promise<RawVendorSource>;

  /** The temporary folder a source was fetched into, removed with all it holds. */
  removeFetchedSource(rawVendorSource: RawVendorSource): Promise<void>;

  /** The name of every vendor kept, `<owner>/<repository>/<name>`; a vendor
   *  laid out the way an earlier version installed one is refused by the
   *  store, naming the folder to delete (FR-053, FR-180). */
  loadVendorRoot(): Promise<RawVendorRoot>;

  /** One vendor of a source fetched and filtered kept under the name its
   *  origin gives it: each charter's primitives copied whole, as the source
   *  holds them, the source's own under `vendorSourcePath.ownCharterName` and each
   *  kept apart under its own name; each skill's folder copied under the own
   *  charter's and kept as the skill it converts to. Each replaces what stood
   *  there before it; what else the vendor's folder holds is left as it was
   *  (CORE-FR-042, CORE-FR-186 to CORE-FR-189, CORE-FR-196). */
  storeVendor(vendorSource: VendorSource): Promise<void>;

  /** Where a vendor installed under this name is kept, in this keeper's
   *  words: said back, never read. */
  findVendorUri(vendorName: string): string;

  /** The vendor installed under this name taken away, with each folder above
   *  it that leaves empty (FR-047, CORE-FR-204). */
  removeVendor(vendorName: string): Promise<void>;

  /** Every test suite kept, by its name, with what it holds. */
  loadTestSuites(): Promise<readonly RawTestSuite[]>;

  /** One test suite kept under this name, as its author wrote it, over
   *  whatever it held. */
  writeTestSuite(name: string, testSuite: TestSuite): Promise<void>;

  /** The test suite kept under this name taken away. */
  removeTestSuite(name: string): Promise<void>;

  /** Every file of evaluation cases kept, by the name it is reported under,
   *  with what it holds. */
  loadEvalSuites(): Promise<readonly RawEvalSuite[]>;

  /** One file of evaluation cases kept under this name, as its author wrote
   *  it, over whatever it held. */
  writeEvalSuite(name: string, evalSuite: EvalSuite): Promise<void>;

  /** The file of evaluation cases kept under this name taken away. */
  removeEvalSuite(name: string): Promise<void>;

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
