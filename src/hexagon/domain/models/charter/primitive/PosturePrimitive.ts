import type { z } from "zod";
import { BasePrimitive, CommonHeadersSchema, headersOf, GoodArraySchema, type RequiredHeaders, type AssetFile } from "./BasePrimitive.js";
import type { PrimitiveLayer } from "../PrimitiveLayer.js";

/** What the agent may and may not do, as permission lists (FR-004). */
export const PostureHeadersSchema = CommonHeadersSchema.extend({
  allow: GoodArraySchema,
  deny: GoodArraySchema,
});
export type PostureHeaders = Readonly<z.infer<typeof PostureHeadersSchema>>;

export class PosturePrimitive extends BasePrimitive<PostureHeaders> {
  static readonly kind = "posture" as const;
  readonly kind = PosturePrimitive.kind;

  /** What this kind requires beyond the common headers, declared where its
   *  contract is: it is read both where a file is checked and where one is
   *  scaffolded (FR-004, FR-039). */
  static override readonly requires = { allow: "list", deny: "list" } as const satisfies RequiredHeaders;

  /** The schema its headers are read by: what `headersOf` refuses a file
   *  against, and what says the shape of every header this kind takes, required
   *  or not (FR-004). */
  static override readonly schema = PostureHeadersSchema;

  /** When a reader of this charter is to open this kind at all, said
   *  where the kind's contract is: the neutral surface lists one
   *  line per kind and none of them is written down twice (FR-002). */
  static readonly activatesWhen = "always, wherever the host can be told what to `allow` and what to `deny`";

  /** A posture as an author writes one: what a refused header is fixed with. */
  static readonly sample: PostureHeaders = {
    id: "no-force-push",
    description: "Never rewrite history someone else may have pulled.",
    allow: ["Bash(git push:*)"],
    deny: ["Bash(git push --force:*)"],
  };

  /** One posture, or every fault its headers have (FR-004). */
  static of(record: Readonly<Record<string, unknown>>, body: string, assets: readonly AssetFile[] = [], primitiveLayer?: PrimitiveLayer): PosturePrimitive {
    return new PosturePrimitive(headersOf(PosturePrimitive, PostureHeadersSchema, record), body, assets, primitiveLayer);
  }
}
