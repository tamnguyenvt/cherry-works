import { dto, groupByType, StringsSchema, z } from "#module/shared/app/port/in/index.js";

/**
 * What the workspace module answers with: what a repository configured itself
 * with (CORE-FR-231). `{ type, data }`, `type` its name exactly as
 * `WorkspaceDTOs` keys it. Written with the kernel's DTO entry alone, never its
 * module.ts: a client that imports this file bundles no server code.
 */

/** What a repository configured itself with: whether it was ever set up, which
 *  agents it chose, the ceiling a main context is held to — 20,000
 *  where it set none — where its sessions are kept on this machine, where
 *  it named a folder of its own, and that `cw vendor init` set it up, where
 *  it did. */
const WorkspaceSettingsSchema = dto(
  "WorkspaceSettings",
  z.object({
    isSetUp: z.boolean(),
    agents: StringsSchema,
    mainContextCeiling: z.number(),
    sessionAnalysisFolder: z.string().optional(),
    isVendor: z.boolean().optional(),
  }),
);

/** Every schema of this module's DTOs, under its name — the name it carries
 *  as `type` — in alphabetical order. */
export const WorkspaceDTOs = groupByType(WorkspaceSettingsSchema);

/** Every DTO's type, under its name: what its schema infers. */
export namespace WorkspaceDTOs {
  export type WorkspaceSettings = z.infer<typeof WorkspaceDTOs.WorkspaceSettings>;
}
