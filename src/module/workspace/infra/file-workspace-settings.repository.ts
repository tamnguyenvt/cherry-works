import type { ForReadingFiles, ForWritingFiles } from "../../shared/module.js";
import { SettingsFile, WorkspaceReadme, WorkspaceSettings, type ForStoringWorkspaceSettings } from "../app/port/out/storing-workspace-settings.port.js";

/** The settings kept as JSON in `.cw/settings.json`, and the workspace's
 *  ignore file beside them, both read and written as files of the repository. */
export class FileWorkspaceSettingsRepository implements ForStoringWorkspaceSettings {
  readonly #fileReader: ForReadingFiles;
  readonly #fileWriter: ForWritingFiles;

  constructor(fileReader: ForReadingFiles, fileWriter: ForWritingFiles) {
    this.#fileReader = fileReader;
    this.#fileWriter = fileWriter;
  }

  async loadSettingsText(): Promise<string | undefined> {
    return this.#fileReader.readIfThere(SettingsFile.path);
  }

  async saveSettings({ agents, mainContextCeiling }: WorkspaceSettings): Promise<void> {
    const keptCeiling = mainContextCeiling === WorkspaceSettings.defaultMainContextCeiling ? undefined : mainContextCeiling;
    await this.#fileWriter.write(SettingsFile.path, `${JSON.stringify({ agents, ...(keptCeiling === undefined ? {} : { mainContextCeiling: keptCeiling }) }, null, 2)}\n`);
  }

  async keepLogIgnored(): Promise<void> {
    const gitignoreText = (await this.#fileReader.readIfThere(SettingsFile.gitignorePath)) ?? "";
    if (gitignoreText.split("\n").includes(SettingsFile.logLine)) return;
    await this.#fileWriter.write(SettingsFile.gitignorePath, `${gitignoreText}${gitignoreText === "" || gitignoreText.endsWith("\n") ? "" : "\n"}${SettingsFile.logLine}\n`);
  }

  async keepReadme(workspaceReadme: WorkspaceReadme): Promise<void> {
    if ((await this.#fileReader.readIfThere(WorkspaceReadme.path)) === undefined) await this.#fileWriter.write(WorkspaceReadme.path, workspaceReadme.text);
  }
}
