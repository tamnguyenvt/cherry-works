import type { RawPrimitive } from "../../../domain/models/primitive/raw-primitive.js";
import type { Primitive } from "../../../domain/models/primitive/primitive.js";
import type { VendorSource } from "../../../domain/models/vendor/vendor-source.js";
import type { RawVendorSource } from "../../../domain/models/vendor/raw-vendor-source.js";
import type { VendorSourceOrigin } from "../../../domain/models/vendor/vendor-source-origin.js";
import type { ProjectionPlan, CopyPlan, WritePlan } from "../../../domain/models/projection/projection-plan.js";
import type { VendorRoot } from "../../../domain/models/vendor/vendor-root.js";
import type { RawTestSuite } from "../../../domain/models/test/raw-test-suite.js";
import type { TestSuite } from "../../../domain/models/test/test-suite.js";
import type { RawEvalSuite } from "../../../domain/models/eval/raw-eval-suite.js";
import type { OutputPart } from "../../../domain/models/projection/output-part.js";

/** The models and the layout a charter repository keeps a charter in, named
 *  again here so an adapter keeping one imports nothing of the hexagon but its
 *  port. */
export { RawPrimitive } from "../../../domain/models/primitive/raw-primitive.js";
export { Primitives, type Primitive } from "../../../domain/models/primitive/primitive.js";
export { BasePrimitive } from "../../../domain/models/primitive/base-primitive.js";
export { SkillPrimitive } from "../../../domain/models/primitive/skill-primitive.js";
export { PrimitiveLayer } from "../../../domain/models/primitive/primitive-layer.js";
export { VendorSource, SourceCharter, SourceSkill } from "../../../domain/models/vendor/vendor-source.js";
export { RawVendorSource, RawSourceSkill } from "../../../domain/models/vendor/raw-vendor-source.js";
export { type VendorSourceOrigin } from "../../../domain/models/vendor/vendor-source-origin.js";
export { VendorRoot } from "../../../domain/models/vendor/vendor-root.js";
export { VendorRootFactory } from "../../../domain/models/vendor/vendor-root.factory.js";
export { type ProjectionPlan, CopyPlan, type WritePlan } from "../../../domain/models/projection/projection-plan.js";
export { RawTestSuite } from "../../../domain/models/test/raw-test-suite.js";
export type { TestSuite } from "../../../domain/models/test/test-suite.js";
export { RawEvalSuite } from "../../../domain/models/eval/raw-eval-suite.js";
export { OutputPart } from "../../../domain/models/projection/output-part.js";
export { CharterFolder } from "../../../domain/models/charter/charter-folder.js";
export { PrimitivesFolder } from "../../../domain/models/charter/primitives-folder.js";
export { VendorsFolder } from "../../../domain/models/charter/vendors-folder.js";
export { TestFolder } from "../../../domain/models/charter/test-folder.js";
export { EvalFolder } from "../../../domain/models/charter/eval-folder.js";
export type { ForFetchingCharterSources } from "./fetching-charter-sources.port.js";
export type { ForReadingFiles, ReadFile } from "../../../../shared/module.js";
export type { ForWritingFiles } from "../../../../shared/module.js";
export { AdapterFault } from "../../../../shared/module.js";

/** Keeps a repository's charter, wherever it keeps it, and knows how: its
 *  primitives, the vendors it installed, its test cases and its eval cases,
 *  through this one port (CORE-FR-228), and reads back what the last build
 *  laid of it, each part known by its host, the part it plays, its kind and its
 *  id, never by a path the engine knows (CORE-FR-221). Where a primitive, an asset of one, a
 *  vendor's or a suite sits is its own to know, never the engine's, which knows
 *  a primitive by its layer, kind and id and a suite by its name
 *  (CORE-FR-213). */
export interface ForManagingCharter {
  /** Every primitive kept of the repository's charter, its own layer and each
   *  vendor's, each with its assets. Under `checkoutPath`, a checkout of the
   *  repository such as a worktree, where one is named. */
  loadCharter(checkoutPath?: string): Promise<readonly RawPrimitive[]>;

  /** A place laid out for each kind of primitive, where none was: what a
   *  repository is set up with (FR-057). */
  createCharter(): Promise<void>;

  /** One new primitive of the repository's own layer kept, with its assets
   *  where none stands there already, and a file already in its folder left
   *  as one of them; its uri. Refused, with nothing written, where it is kept
   *  already, would be kept inside another or around it, or would land outside
   *  the charter (FR-167, CORE-FR-044). */
  addPrimitive(rawPrimitive: RawPrimitive): Promise<string>;

  /** New primitives of the repository's own layer kept together, each one's
   *  uri in order; refused, with nothing written, as one added is, and where
   *  any file is already in one's folder (CORE-FR-194). */
  injectPrimitives(rawPrimitives: readonly RawPrimitive[]): Promise<readonly string[]>;

  /** Refused where the repository is laid out in a way this store no longer
   *  keeps, naming what moves it (CORE-FR-226). */
  assertLayout(): Promise<void>;

  /** Where the repository's own layer is kept, said back and never read. */
  findCharterUri(): string;

  /** One primitive of the repository's own layer kept over what it was, its
   *  assets as they are (FR-075). */
  rewritePrimitive(primitive: Primitive): Promise<void>;

  /** One primitive of the repository's own layer taken away, with its assets,
   *  and nothing else (FR-076, FR-167). */
  removePrimitive(primitive: Primitive): Promise<void>;

  /** One commit of this source, at this version where one is named, fetched
   *  and read: its own charter, the charters it keeps apart, and its skills.
   *  Whoever asked says `cleanupVendorSource` once done. A source that cannot be
   *  reached raises an `AdapterFault` saying so (CORE-FR-190). */
  fetchVendorSource(vendorSourceOrigin: VendorSourceOrigin, version?: string): Promise<RawVendorSource>;

  /** Let go of what was kept of a source fetched. */
  cleanupVendorSource(rawVendorSource: RawVendorSource): Promise<void>;

  /** Every vendor installed (FR-053). */
  loadVendorRoot(): Promise<VendorRoot>;

  /** One vendor of a source fetched put down by its plan, in order: each
   *  folder copied from the source as it holds it, each file written or taken
   *  away; what else the vendor folder holds is left as it was (CORE-FR-042,
   *  CORE-FR-186 to CORE-FR-189, CORE-FR-196). */
  storeVendor(vendorSource: VendorSource, projectionPlan: ProjectionPlan<WritePlan | CopyPlan>): Promise<void>;

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
   *  with what it holds. Under `checkoutPath`, a checkout of the repository
   *  such as a worktree, where one is named. */
  loadEvalSuites(checkoutPath?: string): Promise<readonly RawEvalSuite[]>;

  /** One file of evaluation cases kept under this name, as its author wrote
   *  it, over whatever it held. */
  writeEvalSuite(name: string, evalSuiteText: string): Promise<void>;

  /** The file of evaluation cases kept under this name taken away. */
  removeEvalSuite(name: string): Promise<void>;

  /** The text a build laid for this part, as it was laid; nothing where none
   *  was. Under `checkoutPath`, a checkout of the repository such as a
   *  worktree, where one is named. */
  loadLaidText(outputPart: OutputPart, checkoutPath?: string): Promise<string | undefined>;

  /** Where this part is laid, in the repository's own words: said back where
   *  a message names it, and never read. */
  findPlace(outputPart: OutputPart): string;

  /** Where the build's output lands, in the repository's own words: what
   *  `$CW_OUT` stands for in what the output holds, where a command of it is
   *  run (CORE-FR-221). */
  findOutputFolder(): string;
}
