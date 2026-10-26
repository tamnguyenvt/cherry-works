import type { z } from "zod";
import { BasePrimitive, CommonHeadersSchema, headersOf, GoodArraySchema, FlagSchema, type RequiredHeaders, type AssetFile } from "./BasePrimitive.js";
import type { PrimitiveLayer } from "../PrimitiveLayer.js";

/** Know-how loaded when a request matches its triggers (FR-004). */
export const SkillHeadersSchema = CommonHeadersSchema.extend({
  triggers: GoodArraySchema,
  /** Whether it is kept out of the commands its host offers the user, being a
   *  step of something else; the agent still opens it (CORE-FR-173). */
  "disable-user-invocation": FlagSchema.optional(),
  /** Whether the agent is kept from opening it by itself, its description
   *  matching what is asked; the user still runs it as a command (CORE-FR-181). */
  "disable-model-invocation": FlagSchema.optional(),
}).superRefine((headers, context) => {
  // Kept from both, nobody could open it (CORE-FR-183).
  if (headers["disable-user-invocation"] === true && headers["disable-model-invocation"] === true)
    context.addIssue({
      code: "custom",
      message: `This skill declares both "disable-user-invocation: true" and "disable-model-invocation: true", so neither the user nor the agent could open it; drop one.`,
    });
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
