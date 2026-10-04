import type { z } from "zod";
import { BasePrimitive, CommonHeadersSchema, headersOf, GoodArraySchema, type RequiredHeaders, type AssetFile } from "./BasePrimitive.js";
import type { PrimitiveLayer } from "../PrimitiveLayer.js";

/** A role the agent delegates to, with the tools it may use (FR-004). */
export const AgentHeadersSchema = CommonHeadersSchema.extend({
  tools: GoodArraySchema,
});
export type AgentHeaders = Readonly<z.infer<typeof AgentHeadersSchema>>;

export class AgentPrimitive extends BasePrimitive<AgentHeaders> {
  static readonly kind = "agent" as const;
  readonly kind = AgentPrimitive.kind;

  /** What this kind requires beyond the common headers, declared where its
   *  contract is: it is read both where a file is checked and where one is
   *  scaffolded (FR-004, FR-039). */
  static override readonly requires = { tools: "list" } as const satisfies RequiredHeaders;

  /** The schema its headers are read by: what `headersOf` refuses a file
   *  against, and what says the shape of every header this kind takes, required
   *  or not (FR-004). */
  static override readonly schema = AgentHeadersSchema;

  /** When a reader of this charter is to open this kind at all, said
   *  where the kind's contract is: the neutral surface lists one
   *  line per kind and none of them is written down twice (FR-002). */
  static readonly activatesWhen =
    "it is spawned by id, holding the `tools` it lists and nothing else — a place as `[[<id>]]`, or one of its tools as `[[<id>]]:<tool>`";

  /** An agent as an author writes one: what a refused header is fixed with.
   *  It holds one tool of a place the way an author writes it (FR-156). */
  static readonly sample: AgentHeaders = {
    id: "reviewer",
    description: "Review a diff and name what is wrong with it.",
    tools: ["Read", "Grep", "[[mfbs/billing]]:search_code"],
  };

  /** One agent, or every fault its headers have (FR-004). */
  static of(record: Readonly<Record<string, unknown>>, body: string, assets: readonly AssetFile[] = [], primitiveLayer?: PrimitiveLayer): AgentPrimitive {
    return new AgentPrimitive(headersOf(AgentPrimitive, AgentHeadersSchema, record), body, assets, primitiveLayer);
  }
}
