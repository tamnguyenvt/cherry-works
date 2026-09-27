/**
 * The agents this engine compiles for, named once for the whole domain.
 *
 * Said here rather than by whoever happens to need it: the settings check a
 * repository's answer against this list, the compilers are one per name in it,
 * and `cw init` offers exactly these to choose from — what is installed on the
 * machine is nothing this engine asks about. One list, so teaching this
 * engine a host is a name added here and a compiler that answers to it — and
 * nothing anywhere can name a host the rest of the engine has never heard of.
 *
 * Closed the way the kinds are: a name outside it is not an agent this
 * engine compiles for, and saying so is a fault rather than a run that quietly
 * writes nothing (FR-018, FR-033).
 */
export const AGENT_PROVIDERS = ["claude"] as const;

/** One of them, read off the list rather than written out again. */
export type AgentProvider = (typeof AGENT_PROVIDERS)[number];

/** Is this name one of them? The one way anything asks — a name read off a file
 *  is a string until this says otherwise. */
export function isAgentProvider(name: unknown): name is AgentProvider {
  return typeof name === "string" && (AGENT_PROVIDERS as readonly string[]).includes(name);
}

/**
 * What each host calls a tool `cw mcp serve` serves as `<prefix>__<tool>`, and
 * the longest name it takes (FR-157).
 *
 * Declared per host because the name is the host's: claude puts the server's
 * name and its own separators in front of it. A second host brings its own
 * here, and a served name is checked against each.
 */
export const HOST_TOOL_NAMINGS: Readonly<
  Record<AgentProvider, { readonly hostToolNameOf: (servedName: string) => string; readonly longest: number }>
> = {
  claude: { hostToolNameOf: (servedName) => `mcp__cw__${servedName}`, longest: 64 },
};
