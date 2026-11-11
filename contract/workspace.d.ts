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

/** The README a repository's workspace is set up with: what the folder is,
 *  the `cw` that set it up, and how to start authoring the charter in it.
 *  Written once, at setup, and the repository's to change after. */
declare class WorkspaceReadme {
  /** The version of `cw` that set the charter up. */
  readonly cwVersion: string;
  static readonly path = ".cw/README.md";
  constructor(
    /** The version of `cw` that set the charter up. */
    cwVersion: string,
  );
  get text(): string;
}

/**
 * What a repository configured itself with — which agents it compiles its
 * charter for, the ceiling of a main context, where its sessions are kept on
 * this machine (FR-033, EVAL-FR-006, EVAL-FR-012). Kept by the workspace
 * module alone, and handed to the applications that run by it (CORE-FR-231).
 */
declare class WorkspaceSettings {
  readonly agents: readonly string[];
  readonly mainContextCeiling?: number | undefined;
  readonly sessionAnalysisFolder?: string | undefined;
  /** The tokens of main context past which the health check warns where the
   *  repository set none (EVAL-FR-006). */
  static readonly defaultMainContextCeiling = 20000;
  /** How the settings are written: which agents is checked against the ones
   *  the engine compiles for by the factory, which is told them. */
  static readonly schema: z.ZodObject<
    {
      agents: z.ZodArray<z.ZodString>;
      mainContextCeiling: z.ZodOptional<z.ZodNumber>;
      sessionContextMark: z.ZodOptional<z.ZodNumber>;
      sessionAnalysisFolder: z.ZodOptional<z.ZodString>;
    },
    z.core.$strip
  >;
  constructor(
    agents: readonly string[],
    mainContextCeiling?: number | undefined,
    sessionAnalysisFolder?: string | undefined,
  );
  /** The ceiling the health check holds a main context to. */
  get mainContextCeilingOrDefault(): number;
}

/** Where a repository keeps what it configured itself with, from its root
 *  (CORE-FR-231), and the ignore file of the workspace beside it, with the
 *  line of it that keeps the log out of version control (CORE-FR-225). */
declare class SettingsFile {
  static readonly path = ".cw/settings.json";
  static readonly gitignorePath = ".cw/.gitignore";
  static readonly logLine = "log/";
}

/**
 * DRIVEN PORT — where a repository keeps its settings and the ignore file of
 * its workspace (CORE-FR-231, CORE-FR-225).
 */
interface ForStoringWorkspaceSettings {
  /** The text the settings are kept in, or nothing where the repository was
   *  never set up. */
  loadSettingsText(): Promise<string | undefined>;
  /** These settings kept, the ceiling only where it is not the default. */
  saveSettings(workspaceSettings: WorkspaceSettings): Promise<void>;
  /** Version control told to ignore the log, once, every other line of the
   *  workspace's ignore file kept. */
  keepLogIgnored(): Promise<void>;
  /** The workspace's README written, where it has none: one already there is
   *  the repository's own. */
  keepReadme(workspaceReadme: WorkspaceReadme): Promise<void>;
}

/** The settings kept as JSON in `.cw/settings.json`, and the workspace's
 *  ignore file beside them, both read and written as files of the repository. */
declare class FileWorkspaceSettingsRepository implements ForStoringWorkspaceSettings {
  #private;
  constructor(fileReader: ForReadingFiles, fileWriter: ForWritingFiles);
  loadSettingsText(): Promise<string | undefined>;
  saveSettings({ agents, mainContextCeiling }: WorkspaceSettings): Promise<void>;
  keepLogIgnored(): Promise<void>;
  keepReadme(workspaceReadme: WorkspaceReadme): Promise<void>;
}
