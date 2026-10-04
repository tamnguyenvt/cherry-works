import type { z } from "zod";
import { BasePrimitive, CommonHeadersSchema, headersOf, type RequiredHeaders, type AssetFile } from "./BasePrimitive.js";
import type { PrimitiveLayer } from "../PrimitiveLayer.js";

/** Reasoning a primitive cites, loaded only on demand. Beyond the common
 *  headers it asks for nothing (FR-004). */
export const CorpusHeadersSchema = CommonHeadersSchema.extend({});
export type CorpusHeaders = Readonly<z.infer<typeof CorpusHeadersSchema>>;

export class CorpusPrimitive extends BasePrimitive<CorpusHeaders> {
  static readonly kind = "corpus" as const;
  readonly kind = CorpusPrimitive.kind;

  /** What this kind requires beyond the common headers: nothing. Declared all
   *  the same, since what a file is scaffolded with is read off this (FR-039). */
  static override readonly requires = {} as const satisfies RequiredHeaders;

  /** The schema its headers are read by: what `headersOf` refuses a file
   *  against, and what says the shape of every header this kind takes, required
   *  or not (FR-004). */
  static override readonly schema = CorpusHeadersSchema;

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
  static of(record: Readonly<Record<string, unknown>>, body: string, assets: readonly AssetFile[] = [], primitiveLayer?: PrimitiveLayer): CorpusPrimitive {
    return new CorpusPrimitive(headersOf(CorpusPrimitive, CorpusHeadersSchema, record), body, assets, primitiveLayer);
  }
}
