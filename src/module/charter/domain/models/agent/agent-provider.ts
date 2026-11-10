/** The name of an agent a charter is compiled for, as a file, a DTO or a
 *  command line writes it: whichever names the projections the engine was
 *  composed with answer to, never a list of its own (CORE-FR-221). */
export type AgentProviderName = string;

/** One agent a charter is compiled for, by its name: what it reads of a
 *  charter, and where, is its projection's (FR-018, CORE-FR-221). */
export class AgentProvider {
  constructor(readonly name: AgentProviderName) {}

  toString(): AgentProviderName {
    return this.name;
  }
}
