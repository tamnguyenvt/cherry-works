import { AgentProvider } from "#module/shared/module.js";
import {
  InvalidMainContextCeilingFault,
  InvalidSettingsFault,
  NoAgentFault,
  UnknownAgentFault,
} from "../workspace.fault.js";
import type { RawWorkspaceSettings } from "./raw-workspace-settings.js";
import { WorkspaceSettings } from "./workspace-settings.js";

/** Makes a repository's settings out of how it keeps them. */
export class WorkspaceSettingsFactory {
  /**
   * The settings kept say, every agent among `supportedAgentNames`. None kept is
   * a repository never set up, which chose no agent (FR-019). Text that
   * does not read is refused, saying what to correct (FR-037).
   */
  static create(
    rawSettings: RawWorkspaceSettings | undefined,
    supportedAgentNames: readonly string[],
  ): WorkspaceSettings {
    if (rawSettings === undefined) return new WorkspaceSettings([]);

    let settingsJson: unknown;
    try {
      settingsJson = JSON.parse(rawSettings.text);
    } catch {
      throw new InvalidSettingsFault(
        `These are this repository's own settings and this is not JSON.`,
        `Correct it, or delete it and run "cw init" to write it again.`,
        { internal: false },
      );
    }
    const settingsParseResult = WorkspaceSettings.schema.safeParse(settingsJson);
    if (
      !settingsParseResult.success ||
      !settingsParseResult.data.agents.every((agentName) => supportedAgentNames.includes(agentName))
    )
      throw WorkspaceSettingsFactory.#findSettingsFault(settingsJson, supportedAgentNames);
    const { agents, mainContextCeiling, sessionAnalysisFolder, vendor: isVendor } = settingsParseResult.data;
    return new WorkspaceSettings(
      agents.map((agentName) => new AgentProvider(agentName)),
      mainContextCeiling,
      sessionAnalysisFolder,
      isVendor ?? false,
    );
  }

  /**
   * The settings a repository chooses at setup: at least one agent, for a
   * charter is authored to instruct one (FR-033), each among
   * `supportedAgentNames`, and a ceiling, where one is given, that is a whole
   * number above 0. Each is refused, saying what to give instead.
   */
  static createChosen(
    agentNames: readonly string[],
    supportedAgentNames: readonly string[],
    mainContextCeiling?: number,
  ): WorkspaceSettings {
    if (agentNames.length === 0)
      throw new NoAgentFault(
        `Setup was given no agent to choose, and a repository chooses at least one.`,
        `Choose at least one of: ${supportedAgentNames.join(", ")}.`,
        { internal: false },
      );
    const unknownAgentName = agentNames.find((agentName) => !supportedAgentNames.includes(agentName));
    if (unknownAgentName !== undefined)
      throw new UnknownAgentFault(
        `This engine compiles for no agent called "${unknownAgentName}".`,
        `Name any of: ${supportedAgentNames.join(", ")}.`,
        { internal: false },
      );
    if (!WorkspaceSettings.schema.shape.mainContextCeiling.safeParse(mainContextCeiling).success)
      throw new InvalidMainContextCeilingFault(
        `A context ceiling is the tokens past which the health check warns, and ${mainContextCeiling} is no whole number above 0.`,
        "Give one, as in --mainContextCeiling 20000.",
        { internal: false },
      );
    return new WorkspaceSettings(
      agentNames.map((agentName) => new AgentProvider(agentName)),
      mainContextCeiling,
    );
  }

  /** What is wrong with settings that do not read, the first field of them
   *  that does not, and the next move. */
  static #findSettingsFault(settingsJson: unknown, supportedAgentNames: readonly string[]): InvalidSettingsFault {
    if (typeof settingsJson !== "object" || settingsJson === null || Array.isArray(settingsJson))
      return new InvalidSettingsFault(
        `These are this repository's own settings and this holds something other than a set of fields.`,
        `Write it as an object, as in { "agents": ["claude"] }.`,
        { internal: false },
      );

    const { agents, mainContextCeiling, sessionContextMark, sessionAnalysisFolder, vendor } = settingsJson as {
      agents?: unknown;
      mainContextCeiling?: unknown;
      sessionContextMark?: unknown;
      sessionAnalysisFolder?: unknown;
      vendor?: unknown;
    };
    if (!Array.isArray(agents))
      return new InvalidSettingsFault(
        `"agents" lists the agents this repository chose, and it is not a list of names here.`,
        `Write it as a list of names, as in { "agents": ["claude"] }.`,
        { internal: false },
      );

    if (!agents.every((agentName) => WorkspaceSettingsFactory.#isSupportedAgentName(agentName, supportedAgentNames)))
      return new InvalidSettingsFault(
        `This chooses ${agents
          .filter((agentName) => !WorkspaceSettingsFactory.#isSupportedAgentName(agentName, supportedAgentNames))
          .map((agentName) => `"${String(agentName)}"`)
          .join(", ")}, and this engine compiles for no such agent.`,
        `Name any of ${supportedAgentNames.join(", ")}, or drop what is left.`,
        { internal: false },
      );

    if (!WorkspaceSettings.schema.shape.sessionAnalysisFolder.safeParse(sessionAnalysisFolder).success)
      return new InvalidSettingsFault(
        `"sessionAnalysisFolder" is where each session's tokens are kept on this machine, and ${JSON.stringify(sessionAnalysisFolder)} is no absolute path or path under "~/".`,
        `Write it as one, as in { "agents": ["claude"], "sessionAnalysisFolder": "~/.cherry-works/sessions" }, or drop it for a folder of this repository's own under ~/.cherry-works.`,
        { internal: false },
      );

    if (!WorkspaceSettings.schema.shape.vendor.safeParse(vendor).success)
      return new InvalidSettingsFault(
        `"vendor" says \`cw vendor init\` set this repository up, and ${JSON.stringify(vendor)} is no yes or no.`,
        `Write it as true, as in { "agents": ["claude"], "vendor": true }, or drop it where this repository releases no charter.`,
        { internal: false },
      );

    if (!WorkspaceSettings.schema.shape.sessionContextMark.safeParse(sessionContextMark).success)
      return new InvalidSettingsFault(
        `"sessionContextMark" is every how many tokens a session says what it has used, and ${JSON.stringify(sessionContextMark)} is no whole number above 0.`,
        `Write it as one, as in { "agents": ["claude"], "sessionContextMark": 100000 }, or drop it for 100000.`,
        { internal: false },
      );

    return new InvalidSettingsFault(
      `"mainContextCeiling" is the tokens past which the health check warns of the main context, and ${JSON.stringify(mainContextCeiling)} is no whole number above 0.`,
      `Write it as one, as in { "agents": ["claude"], "mainContextCeiling": 20000 }, or drop it for 20000.`,
      { internal: false },
    );
  }

  /** Whether this is the name of an agent among `supportedAgentNames`. */
  static #isSupportedAgentName(agentName: unknown, supportedAgentNames: readonly string[]): boolean {
    return typeof agentName === "string" && supportedAgentNames.includes(agentName);
  }

  private constructor() {}
}
