import { z } from "zod";
import { AGENT_PROVIDERS, type AgentProvider } from "./AgentProvider.js";

/**
 * What a settings file may hold, as the one shape everything else reads it
 * through (FR-037).
 *
 * The agents are the list this engine compiles for and not names in general: a
 * repository that wrote down a host and got nothing built for it would have no
 * way of telling that from a host with nothing to build. A field added to setup
 * is a field added here, and every reader gets it typed.
 */
export const SETTINGS = z.object({
  agents: z.array(z.enum(AGENT_PROVIDERS)),
});

/** What a repository configured this engine with, as its settings file records
 *  it (FR-037, FR-038): today the agents it compiles for, tomorrow whatever
 *  else setup has to remember. Read by `loadSettings` and by nothing else. */
export class WorkspaceSettings {
  constructor(readonly agents: readonly AgentProvider[]) {}}
