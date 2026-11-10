import { WorkspaceSettings } from "../domain/models/workspace-settings.js";
import { WorkspaceReadme } from "../domain/models/workspace-readme.js";
import { WorkspaceSettingsFactory } from "../domain/models/workspace-settings.factory.js";
import { DomainFault, type FaultDTOs, type ForReportingProgress, ApplicationService } from "../../shared/module.js";
import { MainContextCeilingFault, NoAgentFault, UnknownAgentFault } from "../domain/models/workspace.fault.js";
import { WorkspaceDTOs } from "./port/in/workspace.dto.js";
import type { ForManagingWorkspace } from "./port/in/managing-workspace.port.js";
import type { ForStoringWorkspaceSettings } from "./port/out/storing-workspace-settings.port.js";

/**
 * APPLICATION SERVICE — managing the workspace: what a repository configured
 * itself with, and setting it up (CORE-FR-231). Which agents it checks them
 * against is what it was composed with: the ones the engine compiles for.
 */
export class ManagingWorkspace extends ApplicationService implements ForManagingWorkspace {
  readonly #workspaceSettingsRepository: ForStoringWorkspaceSettings;
  readonly agentProviderNames: readonly string[];

  constructor(workspaceSettingsRepository: ForStoringWorkspaceSettings, agentProviderNames: readonly string[], progressReporter: ForReportingProgress) {
    super(progressReporter);
    this.#workspaceSettingsRepository = workspaceSettingsRepository;
    this.agentProviderNames = agentProviderNames;
  }

  async settings(): Promise<WorkspaceDTOs.WorkspaceSettings | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("ManagingWorkspace.settings", async () => {
      const settingsText = await this.#workspaceSettingsRepository.loadSettingsText();
      return this.#workspaceSettingsDTOOf(WorkspaceSettingsFactory.create(settingsText, this.agentProviderNames), settingsText !== undefined);
    });
  }

  async setUp(agents: readonly string[], cwVersion: string, mainContextCeiling?: number): Promise<WorkspaceDTOs.WorkspaceSettings | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("ManagingWorkspace.setUp", async () => {
      // A charter is authored to instruct an agent (FR-033).
      if (agents.length === 0)
        throw new NoAgentFault(`Setup was given no agent to compile for, and a charter compiles for at least one.`, `Choose at least one of: ${this.agentProviderNames.join(", ")}.`, { internal: false });
      const unknownAgentName = agents.find((agentName) => !this.agentProviderNames.includes(agentName));
      if (unknownAgentName !== undefined)
        throw new UnknownAgentFault(`This engine compiles for no agent called "${unknownAgentName}".`, `Name any of: ${this.agentProviderNames.join(", ")}.`, { internal: false });
      if (!WorkspaceSettings.schema.shape.mainContextCeiling.safeParse(mainContextCeiling).success)
        throw new MainContextCeilingFault(`A context ceiling is the tokens past which the health check warns, and ${mainContextCeiling} is no whole number above 0.`, "Give one, as in --mainContextCeiling 20000.", { internal: false });

      // The ceiling is kept where one was set, now or before; settings that do
      // not read keep none, since they are written again (EVAL-FR-006, FR-037).
      let keptCeiling = mainContextCeiling;
      if (keptCeiling === undefined) {
        try {
          keptCeiling = WorkspaceSettingsFactory.create(await this.#workspaceSettingsRepository.loadSettingsText(), this.agentProviderNames).mainContextCeiling;
        } catch (raisedValue) {
          if (!(raisedValue instanceof DomainFault) || raisedValue.internal) throw raisedValue;
        }
      }
      const workspaceSettings = new WorkspaceSettings(agents, keptCeiling);
      await this.#workspaceSettingsRepository.saveSettings(workspaceSettings);
      await this.#workspaceSettingsRepository.keepLogIgnored();
      await this.#workspaceSettingsRepository.keepReadme(new WorkspaceReadme(cwVersion));
      return this.#workspaceSettingsDTOOf(workspaceSettings, true);
    });
  }

  /** The settings as a driver reads them, the ceiling as the health check
   *  holds a main context to it. */
  #workspaceSettingsDTOOf({ agents, mainContextCeilingOrDefault, sessionAnalysisFolder }: WorkspaceSettings, isSetUp: boolean): WorkspaceDTOs.WorkspaceSettings {
    return WorkspaceDTOs.WorkspaceSettings.of({ isSetUp, agents, mainContextCeiling: mainContextCeilingOrDefault, ...(sessionAnalysisFolder === undefined ? {} : { sessionAnalysisFolder }) });
  }
}
