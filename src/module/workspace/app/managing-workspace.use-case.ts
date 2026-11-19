import { ApplicationService, DomainFault, type FaultDTOs, type ForReportingProgress } from "../../shared/module.js";
import { WorkspaceSettingsFactory } from "../domain/models/settings/workspace-settings.factory.js";
import { WorkspaceSettings } from "../domain/models/settings/workspace-settings.js";
import type { ForManagingWorkspace } from "./port/in/managing-workspace.port.js";
import { WorkspaceDTOs } from "./port/in/workspace.dto.js";
import type { ForStoringWorkspaceSettings } from "./port/out/storing-workspace-settings.port.js";

/**
 * APPLICATION SERVICE — managing the workspace: what a repository configured
 * itself with, and setting it up (CORE-FR-231). Which agents it checks them
 * against is what it was composed with: the ones the engine compiles for.
 */
export class ManagingWorkspace extends ApplicationService implements ForManagingWorkspace {
  readonly #workspaceSettingsRepository: ForStoringWorkspaceSettings;
  readonly agentProviderNames: readonly string[];

  constructor(
    workspaceSettingsRepository: ForStoringWorkspaceSettings,
    agentProviderNames: readonly string[],
    progressReporter: ForReportingProgress,
  ) {
    super(progressReporter);
    this.#workspaceSettingsRepository = workspaceSettingsRepository;
    this.agentProviderNames = agentProviderNames;
  }

  async readWorkspaceSettings(): Promise<WorkspaceDTOs.WorkspaceSettings | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("ManagingWorkspace.readWorkspaceSettings", async () => {
      const rawSettings = await this.#workspaceSettingsRepository.loadSettings();
      return this.#workspaceSettingsDTOOf(
        WorkspaceSettingsFactory.create(rawSettings, this.agentProviderNames),
        rawSettings !== undefined,
      );
    });
  }

  async setUpWorkspace(
    agentNames: readonly string[],
    cwVersion: string,
    mainContextCeiling?: number,
  ): Promise<WorkspaceDTOs.WorkspaceSettings | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("ManagingWorkspace.setUpWorkspace", async () => {
      const chosenWorkspaceSettings = WorkspaceSettingsFactory.createChosen(
        agentNames,
        this.agentProviderNames,
        mainContextCeiling,
      );

      // The ceiling is kept where one was set, now or before; settings that
      // do not read keep none, since they are written again (EVAL-FR-006,
      // FR-037).
      let keptWorkspaceSettings: WorkspaceSettings | undefined;
      try {
        keptWorkspaceSettings = WorkspaceSettingsFactory.create(
          await this.#workspaceSettingsRepository.loadSettings(),
          this.agentProviderNames,
        );
      } catch (raisedValue) {
        if (!(raisedValue instanceof DomainFault) || raisedValue.internal) throw raisedValue;
      }
      const workspaceSettings = new WorkspaceSettings(
        chosenWorkspaceSettings.agentProviders,
        chosenWorkspaceSettings.mainContextCeiling ?? keptWorkspaceSettings?.mainContextCeiling,
      );
      await this.#workspaceSettingsRepository.saveSettings(workspaceSettings);
      await this.#workspaceSettingsRepository.keepLogIgnored();
      await this.#workspaceSettingsRepository.keepReadme(cwVersion);
      return this.#workspaceSettingsDTOOf(workspaceSettings, true);
    });
  }

  /** The settings as a driver reads them, the ceiling as the health check
   *  holds a main context to it. */
  #workspaceSettingsDTOOf(
    { agentProviders, mainContextCeilingOrDefault, sessionAnalysisFolder }: WorkspaceSettings,
    isSetUp: boolean,
  ): WorkspaceDTOs.WorkspaceSettings {
    return WorkspaceDTOs.WorkspaceSettings.of({
      isSetUp,
      agents: agentProviders.map(({ name }) => name),
      mainContextCeiling: mainContextCeilingOrDefault,
      ...(sessionAnalysisFolder === undefined ? {} : { sessionAnalysisFolder }),
    });
  }
}
