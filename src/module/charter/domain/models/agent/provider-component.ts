import type { AgentProvider } from "#module/shared/module.js";

/**
 * One file an agent reads, whichever agent: what it is and what it holds, so
 * laying it knows nothing of the agent that asked for it but its kind there
 * and its id (FR-018).
 *
 * An agent's file is a document (`DocumentBasedComponent`) or settings
 * (`SettingBasedComponent`); each of an agent's own kinds extends one of the two.
 * Where it lands, and how it goes over what is there, is its agent's
 * projection's (CORE-FR-221).
 */
export abstract class ProviderComponent {
  constructor(
    /** The agent that reads it. */
    readonly agentProvider: AgentProvider,
    /** The kind of the primitive it was compiled from, or `charter` where it
     *  is the whole charter's. */
    readonly primitiveKind: string,
    /** What that agent knows it by: the name it is called, or, for a file of
     *  the whole charter, the folder it is for or the part it plays. */
    readonly id: string,
    /** The whole of what the file holds, or of this engine's part of it, each
     *  path into the compiled output under `$CW_OUT/`. */
    readonly text: string,
    readonly warnings: readonly string[] = [],
  ) {}

  /** Which of its agent's kinds this is. Each class declares it as a literal. */
  abstract readonly kind: string;
}
