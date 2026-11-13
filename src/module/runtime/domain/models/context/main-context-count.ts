import type { AgentProvider } from "#module/shared/module.js";

/** How far an estimate may be from the exact count, as a share of the exact
 *  count (EVAL-SC-002). */
const ACCURACY_LIMIT = 0.15;

/** What one primitive, or the charter itself, puts into an agent's main
 *  context, counted exactly by the agent's own command line, beside its
 *  estimate (EVAL-FR-004). Where it names `globs`, it is loaded only when a
 *  file they match is touched. */
export class MainContextLoadCount {
  constructor(
    readonly id: string,
    readonly kind: string,
    readonly exactTokenCount: number,
    readonly estimatedTokenCount: number,
    readonly globs?: readonly string[],
  ) {}

  /** How far the estimate is from the exact count, as a share of the exact
   *  count; none where the exact count is nothing. */
  get differenceRatio(): number | undefined {
    return this.exactTokenCount === 0
      ? undefined
      : (this.estimatedTokenCount - this.exactTokenCount) / this.exactTokenCount;
  }
}

/**
 * What a charter puts into one agent's main context, counted exactly and
 * estimated (EVAL-FR-004): what is loaded when a session opens, the largest
 * exact count first, and both totals; apart from them, what is loaded only
 * when a file is touched. The totals more than 15% apart are past what the
 * estimate is held to (EVAL-SC-002).
 */
export class MainContextCount {
  static get accuracyLimit(): typeof ACCURACY_LIMIT {
    return ACCURACY_LIMIT;
  }

  readonly sessionLoadCounts: readonly MainContextLoadCount[];
  readonly fileLoadCounts: readonly MainContextLoadCount[];

  constructor(
    readonly agentProvider: AgentProvider,
    loadCounts: readonly MainContextLoadCount[],
  ) {
    const loadCountsLargestFirst = [...loadCounts].sort(
      (leftLoadCount, rightLoadCount) =>
        rightLoadCount.exactTokenCount - leftLoadCount.exactTokenCount ||
        leftLoadCount.id.localeCompare(rightLoadCount.id),
    );
    this.sessionLoadCounts = loadCountsLargestFirst.filter((loadCount) => loadCount.globs === undefined);
    this.fileLoadCounts = loadCountsLargestFirst.filter((loadCount) => loadCount.globs !== undefined);
  }

  get exactTotalTokens(): number {
    return this.sessionLoadCounts.reduce((tokenCount, loadCount) => tokenCount + loadCount.exactTokenCount, 0);
  }

  get estimatedTotalTokens(): number {
    return this.sessionLoadCounts.reduce((tokenCount, loadCount) => tokenCount + loadCount.estimatedTokenCount, 0);
  }

  /** How far the estimated total is from the exact one, as a share of the
   *  exact one; none where the exact total is nothing. */
  get totalDifferenceRatio(): number | undefined {
    const exactTotalTokens = this.exactTotalTokens;
    return exactTotalTokens === 0 ? undefined : (this.estimatedTotalTokens - exactTotalTokens) / exactTotalTokens;
  }

  /** Past the limit where the totals are more than 15% apart, or where the
   *  exact total is nothing and the estimate is not. */
  get isPastAccuracyLimit(): boolean {
    const totalDifferenceRatio = this.totalDifferenceRatio;
    return totalDifferenceRatio === undefined
      ? this.estimatedTotalTokens !== 0
      : Math.abs(totalDifferenceRatio) > ACCURACY_LIMIT;
  }
}
