import { type AgentProvider, z } from "#module/shared/module.js";

/**
 * What a repository configured itself with — which agents it chose, the
 * ceiling of a main context, where its sessions are kept on
 * this machine (FR-033, EVAL-FR-006, EVAL-FR-012). Kept by the workspace
 * module alone, and handed to the applications that run by it (CORE-FR-231).
 */
export class WorkspaceSettings {
  /** The tokens of main context past which the health check warns where the
   *  repository set none (EVAL-FR-006). */
  static readonly defaultMainContextCeiling = 20_000;

  /** How the settings are written: which agents is checked against the ones
   *  the engine compiles for by the factory, which is told them. */
  static readonly schema = z.object({
    agents: z.array(z.string()),
    mainContextCeiling: z.number().int().positive().optional(),
    sessionContextMark: z.number().int().positive().optional(),
    sessionAnalysisFolder: z
      .string()
      .regex(/^(\/|~\/)/)
      .optional(),
  });

  constructor(
    readonly agentProviders: readonly AgentProvider[],
    readonly mainContextCeiling?: number,
    readonly sessionAnalysisFolder?: string,
  ) {}

  /** Written as the settings file holds them, each agent by its name
   *  (FR-033). */
  toJSON(): { agents: readonly string[]; mainContextCeiling?: number; sessionAnalysisFolder?: string } {
    return {
      agents: this.agentProviders.map(({ name }) => name),
      ...(this.mainContextCeiling === undefined ? {} : { mainContextCeiling: this.mainContextCeiling }),
      ...(this.sessionAnalysisFolder === undefined ? {} : { sessionAnalysisFolder: this.sessionAnalysisFolder }),
    };
  }

  /** The ceiling the health check holds a main context to. */
  get mainContextCeilingOrDefault(): number {
    return this.mainContextCeiling ?? WorkspaceSettings.defaultMainContextCeiling;
  }
}
