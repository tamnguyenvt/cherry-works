import { z } from "zod";
import { BasePrimitive, CommonHeadersSchema, headersOf, type RequiredHeaders, type AssetFile } from "./BasePrimitive.js";
import type { PrimitiveLayer } from "../PrimitiveLayer.js";

/**
 * Where a body names a script: `script:<id>`, the id as FR-141 writes one. The
 * id is the first group.
 */
export const SCRIPT_MENTION = /\bscript:([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*)/g;

/** Files the agent or a sensor runs, kept as real files beside the script's
 *  `index.md`: its assets (FR-165). */
export const ScriptHeadersSchema = CommonHeadersSchema.extend({
  /** The one asset that runs, from the script's `index.md`: `./` and a path
   *  inside its folder, no segment of which climbs out again. Letters, digits,
   *  `.`, `_` and `-` only: it is written into commands a shell reads
   *  (FR-169). */
  executionPath: z.string().regex(/^\.\/[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/).refine((executionPath) => !executionPath.split("/").slice(1).some((segment) => segment === "." || segment === ".."), {
    message: `"executionPath" stays inside the script's own folder: no segment of it is "." or "..".`,
  }),
});
export type ScriptHeaders = Readonly<z.infer<typeof ScriptHeadersSchema>>;

export class ScriptPrimitive extends BasePrimitive<ScriptHeaders> {
  static readonly kind = "script" as const;
  readonly kind = ScriptPrimitive.kind;

  /** What this kind requires beyond the common headers, declared where its
   *  contract is (FR-004, FR-039). */
  static override readonly requires = { executionPath: "line" } as const satisfies RequiredHeaders;

  /** The schema its headers are read by (FR-004). */
  static override readonly schema = ScriptHeadersSchema;

  /** When a reader of this charter is to open this kind at all (FR-002). */
  static readonly activatesWhen =
    "a primitive names it as `script:<id>`, or a sensor runs it — its assets, copied to `.cw/out/script/<id>/`, of which its `executionPath` names the one to run";

  /** A script as an author writes one: what a refused header is fixed with. */
  static readonly sample: ScriptHeaders = {
    id: "check-changelog",
    description: "Fail when CHANGELOG.md holds no entry for the version being released.",
    executionPath: "./run.sh",
  };

  /** One script, or every fault its headers have (FR-004). */
  static of(record: Readonly<Record<string, unknown>>, body: string, assetFiles: readonly AssetFile[] = [], primitiveLayer?: PrimitiveLayer): ScriptPrimitive {
    return new ScriptPrimitive(headersOf(ScriptPrimitive, ScriptHeadersSchema, record), body, assetFiles, primitiveLayer);
  }

  /** The asset that runs, as a path inside its folder: `run.sh` of
   *  `./run.sh`. */
  get executionPathInFolder(): string {
    return this.headers.executionPath.slice("./".length);
  }

  /** Whether an asset of it is the one its `executionPath` names: the one
   *  run by its path, and no other (FR-160). */
  isExecutionFile(file: string): boolean {
    return file === this.executionPathInFolder;
  }
}
