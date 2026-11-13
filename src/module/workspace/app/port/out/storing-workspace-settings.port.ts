import type { RawWorkspaceSettings } from "../../../domain/models/settings/raw-workspace-settings.js";
import type { WorkspaceSettings } from "../../../domain/models/settings/workspace-settings.js";

export { settingsPath } from "../../../domain/constants.js";
/** The model and the layout the settings are kept in, named again here so an
 *  adapter keeping them imports nothing of the hexagon but its port. */
export { RawWorkspaceSettings } from "../../../domain/models/settings/raw-workspace-settings.js";
export { WorkspaceSettings } from "../../../domain/models/settings/workspace-settings.js";

/**
 * DRIVEN PORT — where a repository keeps its settings and the ignore file of
 * its workspace (CORE-FR-231, CORE-FR-225).
 */
export interface ForStoringWorkspaceSettings {
  /** The settings as they are kept, or nothing where the repository was
   *  never set up. */
  loadSettings(): Promise<RawWorkspaceSettings | undefined>;

  /** These settings kept, the ceiling only where it is not the default. */
  saveSettings(workspaceSettings: WorkspaceSettings): Promise<void>;

  /** Version control told to ignore the log, once, every other line of the
   *  workspace's ignore file kept. */
  keepLogIgnored(): Promise<void>;

  /** The workspace's README written, saying which `cw` set it up, where it
   *  has none: one already there is the repository's own. */
  keepReadme(cwVersion: string): Promise<void>;
}
