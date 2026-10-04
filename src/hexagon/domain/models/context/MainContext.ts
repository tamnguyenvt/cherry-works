import type { AgentProvider } from "../AgentProvider.js";

/** The tokens a repository holds an agent's main context to when it sets
 *  none (EVAL-FR-006). */
export const DEFAULT_CONTEXT_CEILING = 20_000;

/**
 * What one primitive, or the charter itself, puts into an agent's main
 * context, as the text the agent is sent: when a session opens, or — where it
 * names `globs` — when a file they match is touched (EVAL-FR-001,
 * EVAL-FR-003). `id` is the primitive's, or the file's for what the charter
 * puts there itself.
 */
export interface MainContextText {
  readonly id: string;
  readonly kind: string;
  readonly text: string;
  readonly globs?: readonly string[];
}

/** One of those, counted. */
export interface MainContextLoad {
  readonly id: string;
  readonly kind: string;
  readonly tokens: number;
  readonly globs?: readonly string[];
}

/**
 * What a charter puts into one agent's main context, in tokens (EVAL-FR-001 –
 * EVAL-FR-003): what is loaded when a session opens, the largest first, and
 * their total; apart from them, what is loaded only when a file is touched,
 * which is neither in the total nor held to the ceiling. Estimated, or counted
 * exactly by the agent's own command line.
 */
export class MainContext {
  readonly sessionLoads: readonly MainContextLoad[];
  readonly fileLoads: readonly MainContextLoad[];

  constructor(
    readonly agent: AgentProvider,
    loads: readonly MainContextLoad[],
    readonly isExact: boolean,
  ) {
    const loadsLargestFirst = [...loads].sort((one, other) => other.tokens - one.tokens || one.id.localeCompare(other.id));
    this.sessionLoads = loadsLargestFirst.filter((load) => load.globs === undefined);
    this.fileLoads = loadsLargestFirst.filter((load) => load.globs !== undefined);
  }

  get totalTokens(): number {
    return this.sessionLoads.reduce((total, load) => total + load.tokens, 0);
  }

  isOverCeiling(contextCeiling: number): boolean {
    return this.totalTokens > contextCeiling;
  }
}
