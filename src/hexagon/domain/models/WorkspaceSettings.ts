import { z } from "zod";
import { AGENT_PROVIDERS, type AgentProvider } from "./AgentProvider.js";
import { DEFAULT_MAIN_CONTEXT_CEILING } from "./context/MainContext.js";

/**
 * What a settings file may hold, as the one shape everything else reads it
 * through (FR-037).
 *
 * The agents are the list this engine compiles for and not names in general: a
 * repository that wrote down a host and got nothing built for it would have no
 * way of telling that from a host with nothing to build. A field added to setup
 * is a field added here, and every reader gets it typed.
 */
export const WorkspaceSettingsSchema = z.object({
  agents: z.array(z.enum(AGENT_PROVIDERS)),
  /** The tokens past which the health check warns of the main context a
   *  session opens with (EVAL-FR-006). */
  mainContextCeiling: z.number().int().positive().optional(),
  /** Every how many tokens a session tells the developer what it has used
   *  (EVAL-FR-010). Read by `session-tokens-counter`, which runs outside the
   *  engine; held here so a wrong one is refused like any other field. */
  sessionContextMark: z.number().int().positive().optional(),
  /** Where `session-tokens-counter` keeps each session, a folder per session
   *  id holding its `session-analysis.jsonl`: an absolute path or one under
   *  `~/`; a folder of this repository's own under `~/.cherry-works/` where it
   *  sets none (EVAL-FR-009). */
  sessionAnalysisFolder: z.string().regex(/^(\/|~\/)/).optional(),
});

/** What a repository configured this engine with, as its settings file records
 *  it (FR-037, FR-038): today the agents it compiles for, tomorrow whatever
 *  else setup has to remember. Read by `loadSettings` and by nothing else. */
export class WorkspaceSettings {
  constructor(
    readonly agents: readonly AgentProvider[],
    /** 20,000 where the repository set none (EVAL-FR-006). */
    readonly mainContextCeiling: number = DEFAULT_MAIN_CONTEXT_CEILING,
    /** Where each session is kept, as the repository wrote it; a folder of its
     *  own under `~/.cherry-works/` where it set none (EVAL-FR-009). */
    readonly sessionAnalysisFolder?: string,
  ) {}
}
