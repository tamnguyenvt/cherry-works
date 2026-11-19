import { ApplicationService, DomainFault, type FaultDTOs, type ForReportingProgress } from "../../shared/module.js";
import { WorkspaceSettingsFactory } from "../domain/models/settings/workspace-settings.factory.js";
import { WorkspaceSettings } from "../domain/models/settings/workspace-settings.js";
import { UnsetWorkspaceFault } from "../domain/models/workspace.fault.js";
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

      // The ceiling is kept where one was set, now or before, and so is the
      // mark of `cw vendor init`; settings that do not read keep neither, since
      // they are written again (EVAL-FR-006, FR-037, VENDOR-FR-027).
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
        undefined,
        keptWorkspaceSettings?.isVendor,
      );
      await this.#workspaceSettingsRepository.saveSettings(workspaceSettings);
      await this.#workspaceSettingsRepository.keepLogIgnored();
      await this.#workspaceSettingsRepository.keepReadme(cwVersion);
      return this.#workspaceSettingsDTOOf(workspaceSettings, true);
    });
  }

  async setVendorMark(): Promise<WorkspaceDTOs.WorkspaceSettings | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("ManagingWorkspace.setVendorMark", async () => {
      const rawSettings = await this.#workspaceSettingsRepository.loadSettings();
      if (rawSettings === undefined)
        throw new UnsetWorkspaceFault(
          'This repository was never set up, and only one set up is marked as set up by "cw vendor init".',
          'Run "cw init" first, choosing your agent.',
          { internal: false },
        );
      const { agentProviders, mainContextCeiling, sessionAnalysisFolder } = WorkspaceSettingsFactory.create(
        rawSettings,
        this.agentProviderNames,
      );
      const workspaceSettings = new WorkspaceSettings(agentProviders, mainContextCeiling, sessionAnalysisFolder, true);
      await this.#workspaceSettingsRepository.saveSettings(workspaceSettings);
      return this.#workspaceSettingsDTOOf(workspaceSettings, true);
    });
  }

  /** The settings as a driver reads them, the ceiling as the health check
   *  holds a main context to it. */
  #workspaceSettingsDTOOf(
    { agentProviders, mainContextCeilingOrDefault, sessionAnalysisFolder, isVendor }: WorkspaceSettings,
    isSetUp: boolean,
  ): WorkspaceDTOs.WorkspaceSettings {
    return WorkspaceDTOs.WorkspaceSettings.of({
      isSetUp,
      agents: agentProviders.map(({ name }) => name),
      mainContextCeiling: mainContextCeilingOrDefault,
      ...(sessionAnalysisFolder === undefined ? {} : { sessionAnalysisFolder }),
      ...(isVendor ? { isVendor } : {}),
    });
  }
}
