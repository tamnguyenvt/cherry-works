/**
 * MODULE — the workspace: what a repository configured itself with.
 *
 * Everything of its engine it lets the code outside it reach; its adapters
 * are reached through `infra.ts` (`.dependency-cruiser.cjs`).
 */
export { ManagingWorkspace } from "./app/managing-workspace.use-case.js";
export type { ForManagingWorkspace } from "./app/port/in/managing-workspace.port.js";
export { WorkspaceDTOs } from "./app/port/in/workspace.dto.js";
export {
  type ForStoringWorkspaceSettings,
  RawWorkspaceSettings,
  settingsPath,
  WorkspaceSettings,
} from "./app/port/out/storing-workspace-settings.port.js";
