import { z } from "zod";
import { BasePrimitive, CommonHeadersSchema, headersOf, type RequiredHeaders } from "./BasePrimitive.js";

/** What a built file is called after its id: one or more segments of lowercase
 *  letters and digits joined by `.`, with no leading `.` — `sh`, `tar.gz`
 *  (FR-158). Shared by the two kinds whose body is a file. */
export const FileExtensionSchema = z.string().regex(/^[a-z0-9]+(\.[a-z0-9]+)*$/);

/**
 * Where a body names a script: `script:<id>`, the id as FR-141 writes one. The
 * id is the first group.
 */
export const SCRIPT_MENTION = /\bscript:([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*)/g;

/** A file the agent runs: its body is the whole of the file, and `extension`
 *  says what the built file is called (FR-158). */
export const ScriptHeadersSchema = CommonHeadersSchema.extend({
  extension: FileExtensionSchema,
  /** Never: a mixin's body before a script's would break its first line
   *  (FR-004). */
  mixins: z.undefined().optional(),
});
export type ScriptHeaders = Readonly<z.infer<typeof ScriptHeadersSchema>>;

export class ScriptPrimitive extends BasePrimitive<ScriptHeaders> {
  static readonly kind = "script" as const;
  readonly kind = ScriptPrimitive.kind;

  /** What this kind requires beyond the common headers, declared where its
   *  contract is (FR-004, FR-039). */
  static override readonly requires = { extension: "line" } as const satisfies RequiredHeaders;

  /** The schema its headers are read by (FR-004). */
  static override readonly schema = ScriptHeadersSchema;

  /** When a reader of this charter is to open this kind at all (FR-002). */
  static readonly activatesWhen = "a primitive names it as `script:<id>` — a file the agent runs, built to `.cw/out/script/<id>.<extension>`";

  /** A script as an author writes one: what a refused header is fixed with. */
  static readonly sample: ScriptHeaders = {
    id: "check-changelog",
    description: "Fail when CHANGELOG.md holds no entry for the version being released.",
    extension: "sh",
  };

  /** One script, or every fault its headers have (FR-004). */
  static of(record: Readonly<Record<string, unknown>>, body: string): ScriptPrimitive {
    return new ScriptPrimitive(headersOf(ScriptPrimitive, ScriptHeadersSchema, record), body);
  }
}
