import type { z } from "zod";
import { BasePrimitive, CommonHeadersSchema, headersOf, GoodArraySchema, type RequiredHeaders, type AssetFile } from "./BasePrimitive.js";
import type { PrimitiveLayer } from "../PrimitiveLayer.js";

/** Know-how loaded when a request matches its triggers (FR-004). */
export const SkillHeadersSchema = CommonHeadersSchema.extend({
  triggers: GoodArraySchema,
});
export type SkillHeaders = Readonly<z.infer<typeof SkillHeadersSchema>>;

export class SkillPrimitive extends BasePrimitive<SkillHeaders> {
  static readonly kind = "skill" as const;
  readonly kind = SkillPrimitive.kind;

  /** What this kind requires beyond the common headers, declared where its
   *  contract is: it is read both where a file is checked and where one is
   *  scaffolded (FR-004, FR-039). */
  static override readonly requires = { triggers: "list" } as const satisfies RequiredHeaders;

  /** The schema its headers are read by: what `headersOf` refuses a file
   *  against, and what says the shape of every header this kind takes, required
   *  or not (FR-004). */
  static override readonly schema = SkillHeadersSchema;

  /** When a reader of this charter is to open this kind at all, said
   *  where the kind's contract is: the neutral surface lists one
   *  line per kind and none of them is written down twice (FR-002). */
  static readonly activatesWhen = "one of its `triggers` matches what is being asked";

  /** A skill as an author writes one: what a refused header is fixed with. */
  static readonly sample: SkillHeaders = {
    id: "refactoring",
    description: "Change how code is structured without changing what it does.",
    triggers: ["refactor this", "clean this up"],
  };

  /** What this is found by: what it is for, and the requests its author said
   *  bring it up. */
  override description(): string {
    return `${this.headers.description} Use when: ${this.headers.triggers.join("; ")}.`;
  }

  /** One skill, or every fault its headers have (FR-004). */
  static of(record: Readonly<Record<string, unknown>>, body: string, assets: readonly AssetFile[] = [], primitiveLayer?: PrimitiveLayer): SkillPrimitive {
    return new SkillPrimitive(headersOf(SkillPrimitive, SkillHeadersSchema, record), body, assets, primitiveLayer);
  }
}
