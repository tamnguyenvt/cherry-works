import { z } from "zod";
import { BasePrimitive, CommonHeadersSchema, headersOf, type RequiredHeaders } from "./BasePrimitive.js";
import { FileExtensionSchema } from "./ScriptPrimitive.js";

/**
 * Where a body names a template: `template:<id>`, the id as FR-141 writes one.
 * The id is the first group.
 */
export const TEMPLATE_MENTION = /\btemplate:([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*)/g;

/** A file the agent fills or copies: its body is the whole of the file, and
 *  `extension` says what the built file is called (FR-158). */
export const TemplateHeadersSchema = CommonHeadersSchema.extend({
  extension: FileExtensionSchema,
  /** Never: the built file is exactly what its author wrote (FR-004). */
  mixins: z.undefined().optional(),
});
export type TemplateHeaders = Readonly<z.infer<typeof TemplateHeadersSchema>>;

export class TemplatePrimitive extends BasePrimitive<TemplateHeaders> {
  static readonly kind = "template" as const;
  readonly kind = TemplatePrimitive.kind;

  /** What this kind requires beyond the common headers, declared where its
   *  contract is (FR-004, FR-039). */
  static override readonly requires = { extension: "line" } as const satisfies RequiredHeaders;

  /** The schema its headers are read by (FR-004). */
  static override readonly schema = TemplateHeadersSchema;

  /** When a reader of this charter is to open this kind at all (FR-002). */
  static readonly activatesWhen = "a primitive names it as `template:<id>` — a file the agent fills or copies, built to `.cw/out/template/<id>.<extension>`";

  /** A template as an author writes one: what a refused header is fixed with. */
  static readonly sample: TemplateHeaders = {
    id: "release-note",
    description: "The shape every release note follows.",
    extension: "md",
  };

  /** One template, or every fault its headers have (FR-004). */
  static of(record: Readonly<Record<string, unknown>>, body: string): TemplatePrimitive {
    return new TemplatePrimitive(headersOf(TemplatePrimitive, TemplateHeadersSchema, record), body);
  }
}
