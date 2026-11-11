// The library's declarations from workspace, split from dist/index.d.ts for reading.

/** Every schema of this module's DTOs, under its name — the name it carries
 *  as `type` — in alphabetical order. */
declare const WorkspaceDTOs: {
  WorkspaceSettings: z.ZodObject<
    {
      type: z.ZodLiteral<"WorkspaceSettings">;
      data: z.ZodObject<
        {
          isSetUp: z.ZodBoolean;
          agents: z.ZodReadonly<z.ZodArray<z.ZodString>>;
          mainContextCeiling: z.ZodNumber;
          sessionAnalysisFolder: z.ZodOptional<z.ZodString>;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: {
      isSetUp: boolean;
      agents: readonly string[];
      mainContextCeiling: number;
      sessionAnalysisFolder?: string | undefined;
    }) => {
      type: "WorkspaceSettings";
      data: {
        isSetUp: boolean;
        agents: readonly string[];
        mainContextCeiling: number;
        sessionAnalysisFolder?: string | undefined;
      };
    };
  };
};

/** Every DTO's type, under its name: what its schema infers. */
declare namespace WorkspaceDTOs {
  type WorkspaceSettings = z.infer<typeof WorkspaceDTOs.WorkspaceSettings>;
}

/**
 * DRIVER PORT — managing the workspace: what a repository configured itself
 * with, kept in its settings, and setting it up (CORE-FR-231). Whoever
 * composes the engine reads them here and hands them to the applications that
 * run by them; neither the charter nor runtime reads them.
 *
 * Every answer is a DTO, told apart from the others it may be by its `type`;
 * whatever stops an operation is among them, a `FaultDTOs.Fault`, and never
 * thrown (SDK-FR-004, SDK-FR-017, SDK-FR-018). Settings that do not read are
 * a `SettingsFault`, saying what to correct (FR-037).
 */
interface ForManagingWorkspace {
  /** The agents a repository may name in its settings: the ones the engine
   *  was composed to compile for (CORE-FR-221). */
  readonly agentProviderNames: readonly string[];
  /** The settings the repository keeps; none is a repository never set up,
   *  which compiles for no agent (FR-019). */
  settings(): Promise<WorkspaceDTOs.WorkspaceSettings | FaultDTOs.Fault>;
  /**
   * The repository set up for these agents (FR-032 – FR-038): its settings
   * kept, the ceiling kept where one was set now or before and written only
   * where it is not the 20,000 none means, and version control told to ignore
   * the log, once, every other line of its ignore file kept (CORE-FR-225), and a
   * README written where it has none, naming the `cw` that set it up.
   * No agent, an agent this engine compiles for none of, and a ceiling that
   * is no whole number above 0 are refused, nothing kept (FR-033).
   */
  setUp(
    agents: readonly string[],
    cwVersion: string,
    mainContextCeiling?: number,
  ): Promise<WorkspaceDTOs.WorkspaceSettings | FaultDTOs.Fault>;
}
