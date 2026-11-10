/**
 * MODULE — the workspace: what a repository configured itself with.
 *
 * Everything it lets the code outside it reach, and the only file the code
 * outside it imports (`.dependency-cruiser.cjs`).
 */
export { ManagingWorkspace } from "./app/managing-workspace.use-case.js";
export { type ForStoringWorkspaceSettings, SettingsFile, WorkspaceReadme, WorkspaceSettings } from "./app/port/out/storing-workspace-settings.port.js";
export { WorkspaceDTOs } from "./app/port/in/workspace.dto.js";
export { type ForManagingWorkspace, SETTINGS_FILE } from "./app/port/in/managing-workspace.port.js";
export { FileWorkspaceSettingsRepository } from "./infra/file-workspace-settings.repository.js";
