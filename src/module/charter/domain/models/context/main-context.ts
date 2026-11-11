import type { AgentProvider } from "../agent/agent-provider.js";

/** The tokens a repository holds an agent's main context to when it sets
 *  none (EVAL-FR-006). */
const DEFAULT_MAIN_CONTEXT_CEILING = 20_000;

/**
 * What one primitive, or the charter itself, puts into an agent's main
 * context, as the text the agent is sent: when a session opens, or — where it
 * names `globs` — when a file they match is touched (EVAL-FR-001,
 * EVAL-FR-003). `id` is the primitive's, or, for what the charter puts there
 * itself, the file it is laid at.
 *
 * Its text is as it is laid: an agent reads what is laid, and what that is
 * is the agent's projection's to say (CORE-FR-221).
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
  static get defaultCeiling(): typeof DEFAULT_MAIN_CONTEXT_CEILING {
    return DEFAULT_MAIN_CONTEXT_CEILING;
  }

  readonly sessionLoads: readonly MainContextLoad[];
  readonly fileLoads: readonly MainContextLoad[];

  constructor(
    readonly agent: AgentProvider,
    loads: readonly MainContextLoad[],
    readonly isExact: boolean,
  ) {
    const loadsLargestFirst = [...loads].sort(
      (one, other) => other.tokens - one.tokens || one.id.localeCompare(other.id),
    );
    this.sessionLoads = loadsLargestFirst.filter((load) => load.globs === undefined);
    this.fileLoads = loadsLargestFirst.filter((load) => load.globs !== undefined);
  }

  get totalTokens(): number {
    return this.sessionLoads.reduce((total, load) => total + load.tokens, 0);
  }

  isOverCeiling(mainContextCeiling: number): boolean {
    return this.totalTokens > mainContextCeiling;
  }
}
