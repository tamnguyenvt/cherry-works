import type { ForReadingFiles, ForWritingFiles } from "#module/shared/module.js";
import {
  type ForStoringWorkspaceSettings,
  RawWorkspaceSettings,
  settingsPath,
  WorkspaceSettings,
} from "../app/port/out/storing-workspace-settings.port.js";

/** Where the charter's own home of Cherry Works is published. */
const CHERRY_WORKS_URL = "https://github.com/tamnguyenvt/cherry-works";

/** The settings kept as JSON in `.cw/settings.json`, and the workspace's
 *  ignore file beside them, both read and written as files of the repository. */
export class FileWorkspaceSettingsRepository implements ForStoringWorkspaceSettings {
  readonly #fileReader: ForReadingFiles;
  readonly #fileWriter: ForWritingFiles;

  constructor(fileReader: ForReadingFiles, fileWriter: ForWritingFiles) {
    this.#fileReader = fileReader;
    this.#fileWriter = fileWriter;
  }

  async loadSettings(): Promise<RawWorkspaceSettings | undefined> {
    const settingsText = await this.#fileReader.readIfThere(settingsPath.settingsFilePath);
    return settingsText === undefined ? undefined : new RawWorkspaceSettings(settingsText);
  }

  async saveSettings({ agentProviders, mainContextCeiling }: WorkspaceSettings): Promise<void> {
    const keptCeiling =
      mainContextCeiling === WorkspaceSettings.defaultMainContextCeiling ? undefined : mainContextCeiling;
    await this.#fileWriter.writeFile(
      settingsPath.settingsFilePath,
      `${JSON.stringify({ agents: agentProviders.map(({ name }) => name), ...(keptCeiling === undefined ? {} : { mainContextCeiling: keptCeiling }) }, null, 2)}\n`,
    );
  }

  async keepLogIgnored(): Promise<void> {
    const gitignoreText = (await this.#fileReader.readIfThere(settingsPath.gitignoreFilePath)) ?? "";
    if (gitignoreText.split("\n").includes(settingsPath.logIgnoreLine)) return;
    await this.#fileWriter.writeFile(
      settingsPath.gitignoreFilePath,
      `${gitignoreText}${gitignoreText === "" || gitignoreText.endsWith("\n") ? "" : "\n"}${settingsPath.logIgnoreLine}\n`,
    );
  }

  async keepReadme(cwVersion: string): Promise<void> {
    if ((await this.#fileReader.readIfThere(settingsPath.readmeFilePath)) !== undefined) return;
    await this.#fileWriter.writeFile(
      settingsPath.readmeFilePath,
      `# Cherry Works

This folder holds the charter that governs the coding agents working in this repository, kept by [Cherry Works](${CHERRY_WORKS_URL}). It was set up with \`cw\` ${cwVersion}.

- \`charter/\` — the charter: \`primitive/\` for what this repository authors, one folder per kind; \`test/\` and \`eval/\` for its tests and eval cases; \`vendor/\` for charters and skills installed with \`cw vendor add\`, read-only.
- \`out/\` — what \`cw build\` compiles the charter to; never edit it.
- \`settings.json\` — what this repository was set up with.

## Author it

- Ask your agent to run the \`/cw-author\` skill: it asks what a primitive needs and writes it.
- Or run \`cw run portal\` and author it in the browser.

Then run \`cw build\` to lay the charter out for every agent.
`,
    );
  }
}
