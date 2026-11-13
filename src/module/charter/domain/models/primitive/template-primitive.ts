import type { z } from "#module/shared/module.js";
import type { AssetFile } from "./asset-file.js";
import { BasePrimitive, type RequiredHeaders } from "./base-primitive.js";
import type { PrimitiveLayer } from "./primitive-layer.value-object.js";

/** A file the agent fills or copies, written as its body. Beyond the common
 *  headers it asks for nothing: the agent reads what kind of file it is off
 *  the body itself (FR-158). */
export type TemplateHeaders = Readonly<z.infer<typeof TemplatePrimitive.schema>>;

export class TemplatePrimitive extends BasePrimitive {
  declare readonly headers: TemplateHeaders;

  static readonly kind = "template" as const;
  readonly kind = TemplatePrimitive.kind;

  /** What this kind requires beyond the common headers: nothing. Declared all
   *  the same, since what a file is scaffolded with is read off this (FR-039). */
  static override readonly requires = {} as const satisfies RequiredHeaders;

  /** The schema its headers are read by (FR-004). */
  static override readonly schema = super.headersSchema().extend({});

  /** When a reader of this charter is to open this kind at all (FR-002). */
  static readonly activatesWhen =
    "a primitive names it as `[[<id>]]` — a file the agent fills or copies, written as its body";

  /** A template as an author writes one: what a refused header is fixed with. */
  static readonly sample: TemplateHeaders = {
    id: "release-note",
    description: "The shape every release note follows.",
  };

  /** One template, or every fault its headers have (FR-004). */
  static of(
    headerRecord: Readonly<Record<string, unknown>>,
    body: string,
    assets: readonly AssetFile[] = [],
    primitiveLayer?: PrimitiveLayer,
    keptUri?: string,
  ): TemplatePrimitive {
    return new TemplatePrimitive(
      BasePrimitive.headersOf(TemplatePrimitive, TemplatePrimitive.schema, headerRecord),
      body,
      assets,
      primitiveLayer,
      keptUri,
    );
  }
}
