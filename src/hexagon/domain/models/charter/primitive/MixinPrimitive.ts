import { z } from "zod";
import { BasePrimitive, CommonHeaders, headersOf, type RequiredHeaders } from "./BasePrimitive.js";

/** Headers and body reused by other primitives. A leaf: it lends its body to
 *  the host that pulls it in, and pulls in none of its own (FR-006). */
export const MixinHeaders = CommonHeaders.extend({
  /** Never: reading refuses a mixin that declares one. */
  mixins: z.undefined().optional(),
});
export type MixinHeaders = Readonly<z.infer<typeof MixinHeaders>>;

export class MixinPrimitive extends BasePrimitive<MixinHeaders> {
  static readonly kind = "mixin" as const;
  readonly kind = MixinPrimitive.kind;

  /** What this kind requires beyond the common headers: nothing. Declared all
   *  the same, since what a file is scaffolded with is read off this (FR-039). */
  static override readonly requires = {} as const satisfies RequiredHeaders;

  /** The schema its headers are read by: what `headersOf` refuses a file
   *  against, and what says the shape of every header this kind takes, required
   *  or not (FR-004). */
  static override readonly schema = MixinHeaders;

  /** When a reader of this charter is to open this kind at all, said
   *  where the kind's contract is: the neutral surface lists one
   *  line per kind and none of them is written down twice (FR-002). */
  static readonly activatesWhen = "never on its own: its body is lent to the primitives that pull it in";

  /** A mixin as an author writes one: what a refused header is fixed with. */
  static readonly sample: MixinHeaders = {
    id: "typescript-scope",
    description: "What counts as TypeScript application code.",
    globs: ["src/**/*.ts"],
  };

  /** One mixin, or every fault its headers have (FR-004, FR-006). */
  static of(record: Readonly<Record<string, unknown>>, body: string): MixinPrimitive {
    return new MixinPrimitive(headersOf(MixinPrimitive, MixinHeaders, record), body);
  }
}
