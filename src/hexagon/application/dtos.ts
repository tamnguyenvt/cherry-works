import type { DataDTOs, OutcomeDTOs } from "../port/driver/dtos/index.js";
import type { Fault, Faults, FaultsByFile } from "../domain/models/Fault.js";
import type { Catalogue } from "../domain/models/output/CharterOutput.js";
import type { ScopedPrimitive } from "../domain/models/charter/CharterRoot.js";
import type { PrimitiveHeader, PrimitiveRequirements } from "../domain/models/charter/primitive/Primitive.js";
import type { TestCaseReport, TestRunReport } from "../domain/services/testService.js";
import type { WorkspaceSettings } from "../domain/models/Settings.js";
import type { PlanSummary } from "../service/buildService.js";

/**
 * What the application answers a driver with, made of what the domain and its
 * services handed it: one function per DTO a use case answers with, named for
 * it. Here rather than on the models, so a model knows nothing of what a driver
 * reads or that there is one (plan §3.0) — the rule `models-know-no-dto` keeps
 * it so.
 */

/** The full listing, every entry carrying what it is. What the catalogue files
 *  hold is `full` and `compact`, which stay as agents read them. */
export function catalogueDTO(catalogue: Catalogue): DataDTOs.Catalogue {
  return { type: "Catalogue", data: { entries: catalogue.full.map((one) => ({ type: "CatalogueEntry", data: one })) } };
}

/**
 * What checking a repository found (FR-040): the agents it compiles for, every
 * fault under its file and counted, how many files a build would still change —
 * `null` where the charter does not hold, since nothing was previewed — the
 * vendors edited here, and how many of the four questions are unwell.
 *
 * A repository compiling for no agent is well — the neutral surface is compiled
 * for everybody (FR-019) — and the other three are unwell with an error in the
 * charter, a vendor edited here, or a build still to run or one that cannot be
 * known, since the charter does not hold.
 */
export function doctorOutcomeDTO(
  { agents }: WorkspaceSettings,
  faultsByFile: FaultsByFile,
  planSummary: PlanSummary | undefined,
  driftedVendors: readonly string[],
  repo: URL,
): OutcomeDTOs.DoctorOutcome {
  const faults = Object.values(faultsByFile.files).flat();
  const errorCount = faults.filter((one) => one.severity === "error").length;
  const pendingCount =
    planSummary === undefined ? null : planSummary.added.length + planSummary.edited.length + planSummary.deleted.length;
  const unwell = [errorCount > 0, driftedVendors.length > 0, pendingCount !== 0];
  return {
    type: "DoctorOutcome",
    data: {
      agents,
      errorCount,
      warnCount: faults.filter((one) => one.severity === "warn").length,
      pendingCount,
      faultsByFile: faultsByFileDTO(faultsByFile, repo),
      driftedVendors,
      problemCount: unwell.filter(Boolean).length,
    },
  };
}

/** What explaining a primitive found: the primitive as the whole charter sees
 *  it, when its kind comes up, the mixins it uses and the corpus it cites,
 *  what uses or cites it, and the test cases that name it (FR-014, FR-017). */
export function explanationOutcomeDTO(
  scopedPrimitive: ScopedPrimitive,
  activatesWhen: string,
  useMixins: readonly ScopedPrimitive[],
  rationale: ScopedPrimitive | undefined,
  hosts: readonly ScopedPrimitive[],
  citers: readonly ScopedPrimitive[],
  testCasesByFile: Readonly<Record<string, readonly string[]>>,
): OutcomeDTOs.ExplanationOutcome {
  return {
    type: "ExplanationOutcome",
    data: {
      scopedPrimitive: scopedPrimitiveDTO(scopedPrimitive),
      activatesWhen,
      useMixins: useMixins.map(scopedPrimitiveDTO),
      ...(rationale === undefined ? {} : { rationale: scopedPrimitiveDTO(rationale) }),
      hosts: hosts.map(scopedPrimitiveDTO),
      citers: citers.map(scopedPrimitiveDTO),
      testCasesByFile: { type: "TestCasesByFile", data: testCasesByFile },
    },
  };
}

/** One fault: what it says, without the `Error` it was raised as — an `Error`
 *  does not survive being sent, and these three do. */
export function faultDTO({ message, fix, severity }: Fault): DataDTOs.Fault {
  return { type: "Fault", data: { message, fix, severity } };
}

/** Faults under no file yet, every one of them. */
export function faultsDTO(faults: Faults): DataDTOs.Faults {
  return { type: "Faults", data: { faults: faults.faults.map(faultDTO) } };
}

/** Every fault under the file it is wrong with, each file named from the
 *  repository — the path an author would type, not the `href` it was read
 *  from. */
export function faultsByFileDTO(faultsByFile: FaultsByFile, repo: URL): DataDTOs.FaultsByFile {
  return {
    type: "FaultsByFile",
    data: {
      files: Object.fromEntries(
        Object.entries(faultsByFile.namedFrom(repo).files).map(([file, faults]) => [file, faults.map(faultDTO)]),
      ),
    },
  };
}

/** One primitive as its file holds it now: the primitive as the whole charter
 *  sees it, its body, and its revision — a content hash — which a save
 *  hands back to say which text it was made over (FR-075, FR-078). */
export function primitiveSnapshotDTO(scopedPrimitive: ScopedPrimitive, revision: string): DataDTOs.PrimitiveSnapshot {
  return {
    type: "PrimitiveSnapshot",
    data: { scopedPrimitive: scopedPrimitiveDTO(scopedPrimitive), body: scopedPrimitive.primitive.body, revision },
  };
}

/** What a build did, or would do: the four lists as they are. */
export function planSummaryDTO({ added, edited, deleted, unchanged }: PlanSummary): DataDTOs.PlanSummary {
  return { type: "PlanSummary", data: { added, edited, deleted, unchanged } };
}

/** One header a kind takes: what a driver asks an author by. */
export function primitiveHeaderDTO({ field, shape, required, allowedValues }: PrimitiveHeader): DataDTOs.PrimitiveHeader {
  return {
    type: "PrimitiveHeader",
    data: { field, shape, required, ...(allowedValues === undefined ? {} : { allowedValues }) },
  };
}

/** Everything one kind takes, and one of that kind written out. */
export function primitiveRequirementsDTO({ headers, sample }: PrimitiveRequirements): DataDTOs.PrimitiveRequirements {
  return { type: "PrimitiveRequirements", data: { headers: headers.map(primitiveHeaderDTO), sample } };
}

/** Every kind under the line saying when a primitive of it comes up, each read
 *  off the class that reads that kind (FR-010). The same declarations the
 *  compiled orientation says it in, so a listing and what an agent reads cannot
 *  come to say different things. */
export function primitiveKindsDTO(
  kinds: readonly { readonly kind: string; readonly activatesWhen: string }[],
): DataDTOs.PrimitiveKinds {
  return { type: "PrimitiveKinds", data: Object.fromEntries(kinds.map((one) => [one.kind, one.activatesWhen])) };
}

/** One primitive as the whole charter sees it: what it is called and what it is
 *  for, the file it was authored in, which layer that file arrived in, and
 *  every header it declared (FR-017). */
export function scopedPrimitiveDTO({ identity, scope, file, primitive }: ScopedPrimitive): DataDTOs.ScopedPrimitive {
  return {
    type: "ScopedPrimitive",
    data: {
      identity,
      kind: primitive.kind,
      description: primitive.headers.description,
      file,
      scope,
      // A header nobody wrote is left out rather than carried as undefined: this
      // says what the file declared.
      headers: Object.fromEntries(
        Object.entries(primitive.headers).filter(
          (entry): entry is [string, string | readonly string[]] => entry[1] !== undefined,
        ),
      ),
    },
  };
}

/** Every primitive given, as the whole charter sees each, ordered by identity
 *  the way the catalogue orders its entries. */
export function scopedPrimitivesDTO(scopedPrimitives: readonly ScopedPrimitive[]): DataDTOs.ScopedPrimitives {
  return {
    type: "ScopedPrimitives",
    data: {
      primitives: [...scopedPrimitives]
        .sort((one, another) => (one.identity < another.identity ? -1 : one.identity > another.identity ? 1 : 0))
        .map(scopedPrimitiveDTO),
    },
  };
}

/** One test case: the situation it put, whether it passed, and where it did
 *  not, the fault that says why. */
export function testCaseReportDTO({ situation, passed, unmet }: TestCaseReport): DataDTOs.TestCaseReport {
  return {
    type: "TestCaseReport",
    data: { situation, passed, ...(unmet === undefined ? {} : { unmet: faultDTO(unmet) }) },
  };
}

/** How every case came out. */
export function testRunReportDTO({ testCaseReports }: TestRunReport): DataDTOs.TestRunReport {
  return { type: "TestRunReport", data: { testCaseReports: testCaseReports.map(testCaseReportDTO) } };
}

/** What a repository configured itself with. */
export function workspaceSettingsDTO({ agents }: WorkspaceSettings): DataDTOs.WorkspaceSettings {
  return { type: "WorkspaceSettings", data: { agents } };
}
