import type { z } from "zod";
import { BasePrimitive, CommonHeadersSchema, headersOf, GoodArraySchema, FlagSchema, type RequiredHeaders, type AssetFile } from "./BasePrimitive.js";
import type { PrimitiveLayer } from "../PrimitiveLayer.js";

/** An ordered procedure loaded when a request matches its triggers (FR-004). */
export const PlaybookHeadersSchema = CommonHeadersSchema.extend({
  triggers: GoodArraySchema,
  /** Whether it is kept out of the commands its host offers the user, being a
   *  step of something else; the agent still opens it (CORE-FR-173). */
  "disable-user-invocation": FlagSchema.optional(),
});
export type PlaybookHeaders = Readonly<z.infer<typeof PlaybookHeadersSchema>>;

export class PlaybookPrimitive extends BasePrimitive<PlaybookHeaders> {
  static readonly kind = "playbook" as const;
  readonly kind = PlaybookPrimitive.kind;

  /** What this kind requires beyond the common headers, declared where its
   *  contract is: it is read both where a file is checked and where one is
   *  scaffolded (FR-004, FR-039). */
  static override readonly requires = { triggers: "list" } as const satisfies RequiredHeaders;

  /** The schema its headers are read by: what `headersOf` refuses a file
   *  against, and what says the shape of every header this kind takes, required
   *  or not (FR-004). */
  static override readonly schema = PlaybookHeadersSchema;

  /** When a reader of this charter is to open this kind at all, said
   *  where the kind's contract is: the neutral surface lists one
   *  line per kind and none of them is written down twice (FR-002). */
  static readonly activatesWhen = "one of its `triggers` matches; the body is a sequence of skills";

  /** A playbook as an author writes one: what a refused header is fixed with. */
  static readonly sample: PlaybookHeaders = {
    id: "ship-a-feature",
    description: "Take a finished branch from review to release.",
    triggers: ["ship this", "release this feature"],
  };

  /** What this is found by: what it is for, and the requests its author said
   *  bring it up. */
  override description(): string {
    return `${this.headers.description} Use when: ${this.headers.triggers.join("; ")}.`;
  }

  /** One playbook, or every fault its headers have (FR-004). */
  static of(record: Readonly<Record<string, unknown>>, body: string, assets: readonly AssetFile[] = [], primitiveLayer?: PrimitiveLayer): PlaybookPrimitive {
    return new PlaybookPrimitive(headersOf(PlaybookPrimitive, PlaybookHeadersSchema, record), body, assets, primitiveLayer);
  }
}
