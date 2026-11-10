import { z } from "zod";
import { byType, dto, StringsSchema } from "../../../../shared/module.js";

/**
 * What the workspace module answers with: what a repository configured itself
 * with (CORE-FR-231). `{ type, data }`, `type` its name exactly as
 * `WorkspaceDTOs` keys it. Zod and nothing else: the page bundles this file.
 */

/** What a repository configured itself with: whether it was ever set up, which
 *  agents it compiles for, the ceiling a main context is held to — 20,000
 *  where it set none — and where its sessions are kept on this machine, where
 *  it named a folder of its own. */
const WorkspaceSettingsSchema = dto(
  "WorkspaceSettings",
  z.object({
    isSetUp: z.boolean(),
    agents: StringsSchema,
    mainContextCeiling: z.number(),
    sessionAnalysisFolder: z.string().optional(),
  }),
);

/** Every schema of this module's DTOs, under its name — the name it carries
 *  as `type` — in alphabetical order. */
export const WorkspaceDTOs = byType(WorkspaceSettingsSchema);

/** Every DTO's type, under its name: what its schema infers. */
export namespace WorkspaceDTOs {
  export type WorkspaceSettings = z.infer<typeof WorkspaceDTOs.WorkspaceSettings>;
}
