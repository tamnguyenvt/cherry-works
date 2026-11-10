/**
 * One file a build has decided about, before anything on disk moves.
 *
 * Where it goes, what it would hold once the build is done, and what is there
 * now — so what a build would do to it is read off the plan rather than worked
 * out again against disk (FR-022).
 */
export class WritePlan {
  constructor(
    /** Where it sits, at its path from what is built — the repository, or a
     *  checkout of it: what a build says it did. */
    readonly path: string,
    /** Where it sits, at its path from the repository: where it is written. */
    readonly filePath: string,
    /** What the build would leave in it, or nothing where the plan is to take
     *  it away. */
    readonly contents?: string | Uint8Array | undefined,
    /** What it holds now, or nothing where there is no such file yet: its
     *  bytes where it is a copy, which are what it is compared by
     *  (CORE-FR-207). */
    readonly heldContents?: string | Uint8Array | undefined,
    /** Run by its path once it is down: a built script (FR-160). */
    readonly isExecutable?: boolean,
  ) {}
}

/** One folder a plan puts down as a source holds it, every file under it at
 *  any depth, replacing whatever that folder held (CORE-FR-042). */
export class CopyPlan {
  constructor(
    /** Where it sits in the source it is copied from, the empty path its
     *  root. */
    readonly sourcePath: string,
    /** Where it lands, at its path from the repository. */
    readonly destinationPath: string,
  ) {}
}

/** One reading of a charter, or of a vendor's source, said as what it would
 *  do to disk: a build writes each file, an install copies a folder too. */
export class ProjectionPlan<Plan extends WritePlan | CopyPlan = WritePlan> {
  constructor(
    readonly warnings: readonly string[],
    /** What the last build left, whether this one writes it again or not; or
     *  what an install takes away once it is down. */
    readonly cleanupPlan: readonly WritePlan[],
    /** Everything this reading would put down, in order. */
    readonly projectionPlan: readonly Plan[],
  ) {}
}

/**
 * What a build did, or would do: each file under what happened to it (FR-020,
 * FR-022).
 *
 * The one answer both give, so a preview and the build after it say the same
 * thing in the same words — every path from the repository.
 *
 * A summary of the whole `ProjectionPlan`, and not a third half of it. The cleanup plan
 * and the projection plan are each one side, file by file with what it holds:
 * what the last build left, and what this one puts down. This is what the two
 * come to read together, each path under the one change it gets and no contents
 * left — a file both halves name is written again here, never deleted.
 */
export class PlanSummary {
  constructor(
    /** Put where there was no such file. */
    readonly added: readonly string[],
    /** Written over something that said something else. */
    readonly edited: readonly string[],
    /** Taken away, its primitive gone with it. */
    readonly deleted: readonly string[],
    /** Already holding exactly what the build compiles to. */
    readonly unchanged: readonly string[],
    readonly warnings: readonly string[] = [],
  ) {}
}
