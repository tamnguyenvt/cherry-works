import type { z } from "#module/shared/module.js";
import type { AssetFile } from "./asset-file.js";
import { BasePrimitive, type RequiredHeaders } from "./base-primitive.js";
import type { PrimitiveLayer } from "./primitive-layer.value-object.js";

/** Reasoning a primitive cites, loaded only on demand. Beyond the common
 *  headers it asks for nothing (FR-004). */
export type CorpusHeaders = Readonly<z.infer<typeof CorpusPrimitive.schema>>;

export class CorpusPrimitive extends BasePrimitive {
  declare readonly headers: CorpusHeaders;

  static readonly kind = "corpus" as const;
  readonly kind = CorpusPrimitive.kind;

  /** What this kind requires beyond the common headers: nothing. Declared all
   *  the same, since what a file is scaffolded with is read off this (FR-039). */
  static override readonly requires = {} as const satisfies RequiredHeaders;

  /** The schema its headers are read by: what `BasePrimitive.headersOf` refuses a file
   *  against, and what says the shape of every header this kind takes, required
   *  or not (FR-004). */
  static override readonly schema = super.headersSchema().extend({});

  /** When a reader of this charter is to open this kind at all, said
   *  where the kind's contract is: the neutral surface lists one
   *  line per kind and none of them is written down twice (FR-002). */
  static readonly activatesWhen = "a primitive's `rationale` cites it — the reasoning, read when someone asks why";

  /** A corpus as an author writes one: what a refused header is fixed with. */
  static readonly sample: CorpusHeaders = {
    id: "type-safety",
    description: "Why the charter insists on types.",
  };

  /** One corpus, or every fault its headers have (FR-004). */
  static of(
    headerRecord: Readonly<Record<string, unknown>>,
    body: string,
    assets: readonly AssetFile[] = [],
    primitiveLayer?: PrimitiveLayer,
    keptUri?: string,
  ): CorpusPrimitive {
    return new CorpusPrimitive(
      BasePrimitive.headersOf(CorpusPrimitive, CorpusPrimitive.schema, headerRecord),
      body,
      assets,
      primitiveLayer,
      keptUri,
    );
  }
}
