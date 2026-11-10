import { z } from "zod";
import { OutputPart } from "../projection/output-part.js";
import { BasePrimitive, type RequiredHeaders, type AssetFile } from "./base-primitive.js";
import type { PrimitiveLayer } from "./primitive-layer.js";

/** Files the agent or a sensor runs, kept as real files beside the script's
 *  `index.md`: its assets (FR-165). */
export type ScriptHeaders = Readonly<z.infer<typeof ScriptPrimitive.schema>>;

export class ScriptPrimitive extends BasePrimitive {
  declare readonly headers: ScriptHeaders;

  static readonly kind = "script" as const;
  readonly kind = ScriptPrimitive.kind;

  /** What this kind requires beyond the common headers, declared where its
   *  contract is (FR-004, FR-039). */
  static override readonly requires = { executionPath: "line" } as const satisfies RequiredHeaders;

  /** The schema its headers are read by (FR-004). */
  static override readonly schema = super.headersSchema().extend({
    /** The one asset that runs, from the script's `index.md`: `./` and a path
     *  inside its folder, no segment of which climbs out again. Letters, digits,
     *  `.`, `_` and `-` only: it is written into commands a shell reads
     *  (FR-169). */
    executionPath: z.string().regex(/^\.\/[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/).refine((executionPath) => !executionPath.split("/").slice(1).some((segment) => segment === "." || segment === ".."), {
      message: `"executionPath" stays inside the script's own folder: no segment of it is "." or "..".`,
    }),
  });

  /** When a reader of this charter is to open this kind at all (FR-002): where
   *  its assets are copied is a link to a script's folder, written as the
   *  projection lays it. */
  static readonly activatesWhen =
    `a primitive names it as \`[[<id>]]\`, or a sensor runs it — its assets, copied to \`${OutputPart.ofPrimitive("script", "<id>").linkOf("./")}\`, of which its \`executionPath\` names the one to run`;

  /** A script as an author writes one: what a refused header is fixed with. */
  static readonly sample: ScriptHeaders = {
    id: "check-changelog",
    description: "Fail when CHANGELOG.md holds no entry for the version being released.",
    executionPath: "./run.sh",
  };

  /** One script, or every fault its headers have (FR-004). */
  static of(record: Readonly<Record<string, unknown>>, body: string, assets: readonly AssetFile[] = [], primitiveLayer?: PrimitiveLayer, keptUri?: string): ScriptPrimitive {
    return new ScriptPrimitive(BasePrimitive.headersOf(ScriptPrimitive, ScriptPrimitive.schema, record), body, assets, primitiveLayer, keptUri);
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
