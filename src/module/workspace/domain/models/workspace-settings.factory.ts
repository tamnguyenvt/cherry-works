import { WorkspaceSettings } from "./workspace-settings.js";
import { SettingsFault } from "./workspace.fault.js";

/** Makes a repository's settings out of the text it keeps them in. */
export class WorkspaceSettingsFactory {
  /**
   * The settings the text says, every agent among `supportedAgents`. No text is
   * a repository never set up, which compiles for no agent (FR-019). Text that
   * does not read is refused, saying what to correct (FR-037).
   */
  static create(settingsText: string | undefined, supportedAgents: readonly string[]): WorkspaceSettings {
    if (settingsText === undefined) return new WorkspaceSettings([]);

    let settingsJson: unknown;
    try {
      settingsJson = JSON.parse(settingsText);
    } catch {
      throw new SettingsFault(`These are this repository's own settings and this is not JSON.`, `Correct it, or delete it and run "cw init" to write it again.`, { internal: false });
    }
    const settingsParseResult = WorkspaceSettings.schema.safeParse(settingsJson);
    if (!settingsParseResult.success || !settingsParseResult.data.agents.every((agentName) => supportedAgents.includes(agentName)))
      throw WorkspaceSettingsFactory.#findSettingsFault(settingsJson, supportedAgents);
    const { agents, mainContextCeiling, sessionAnalysisFolder } = settingsParseResult.data;
    return new WorkspaceSettings(agents, mainContextCeiling, sessionAnalysisFolder);
  }

  /** What is wrong with settings that do not read, the first field of them
   *  that does not, and the next move. */
  static #findSettingsFault(settingsJson: unknown, supportedAgents: readonly string[]): SettingsFault {
    if (typeof settingsJson !== "object" || settingsJson === null || Array.isArray(settingsJson))
      return new SettingsFault(`These are this repository's own settings and this holds something other than a set of fields.`, `Write it as an object, as in { "agents": ["claude"] }.`, { internal: false });

    const { agents, mainContextCeiling, sessionContextMark, sessionAnalysisFolder } = settingsJson as {
      agents?: unknown;
      mainContextCeiling?: unknown;
      sessionContextMark?: unknown;
      sessionAnalysisFolder?: unknown;
    };
    if (!Array.isArray(agents))
      return new SettingsFault(`"agents" is what this repository compiles its charter for, and it is not a list of names here.`, `Write it as a list of names, as in { "agents": ["claude"] }.`, { internal: false });

    const isSupported = (agentName: unknown): boolean => typeof agentName === "string" && supportedAgents.includes(agentName);
    if (!agents.every(isSupported))
      return new SettingsFault(
        `This says it compiles for ${agents
          .filter((agentName) => !isSupported(agentName))
          .map((agentName) => `"${String(agentName)}"`)
          .join(", ")}, and this engine compiles for no such agent.`,
        `Name any of ${supportedAgents.join(", ")}, or drop what is left.`,
        { internal: false },
      );

    if (!WorkspaceSettings.schema.shape.sessionAnalysisFolder.safeParse(sessionAnalysisFolder).success)
      return new SettingsFault(
        `"sessionAnalysisFolder" is where each session's tokens are kept on this machine, and ${JSON.stringify(sessionAnalysisFolder)} is no absolute path or path under "~/".`,
        `Write it as one, as in { "agents": ["claude"], "sessionAnalysisFolder": "~/.cherry-works/sessions" }, or drop it for a folder of this repository's own under ~/.cherry-works.`,
        { internal: false },
      );

    if (!WorkspaceSettings.schema.shape.sessionContextMark.safeParse(sessionContextMark).success)
      return new SettingsFault(
        `"sessionContextMark" is every how many tokens a session says what it has used, and ${JSON.stringify(sessionContextMark)} is no whole number above 0.`,
        `Write it as one, as in { "agents": ["claude"], "sessionContextMark": 100000 }, or drop it for 100000.`,
        { internal: false },
      );

    return new SettingsFault(
      `"mainContextCeiling" is the tokens past which the health check warns of the main context, and ${JSON.stringify(mainContextCeiling)} is no whole number above 0.`,
      `Write it as one, as in { "agents": ["claude"], "mainContextCeiling": 20000 }, or drop it for 20000.`,
      { internal: false },
    );
  }
}
