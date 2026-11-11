import type { WorkspaceReadme } from "../../../domain/models/workspace-readme.js";
import type { WorkspaceSettings } from "../../../domain/models/workspace-settings.js";

export { WorkspaceReadme } from "../../../domain/models/workspace-readme.js";
/** The model and the layout the settings are kept in, named again here so an
 *  adapter keeping them imports nothing of the hexagon but its port. */
export { WorkspaceSettings } from "../../../domain/models/workspace-settings.js";
export { SettingsFile } from "../../../domain/value-objects/settings-file.js";

/**
 * DRIVEN PORT — where a repository keeps its settings and the ignore file of
 * its workspace (CORE-FR-231, CORE-FR-225).
 */
export interface ForStoringWorkspaceSettings {
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
