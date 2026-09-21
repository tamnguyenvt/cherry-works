import type { z } from "zod";
import { BasePrimitive, CommonHeaders, headersOf, type RequiredHeaders } from "./BasePrimitive.js";

/** A standard the agent is held to. Its body is loaded when a touched file
 *  matches one of its globs, and on every turn where it names none (FR-004). */
export const GuideHeaders = CommonHeaders.extend({});
export type GuideHeaders = Readonly<z.infer<typeof GuideHeaders>>;

export class GuidePrimitive extends BasePrimitive<GuideHeaders> {
  static readonly kind = "guide" as const;
  readonly kind = GuidePrimitive.kind;

  /** What this kind requires beyond the common headers: nothing. Declared all
   *  the same, since what a file is scaffolded with is read off this (FR-039). */
  static override readonly requires = {} as const satisfies RequiredHeaders;

  /** The schema its headers are read by: what `headersOf` refuses a file
   *  against, and what says the shape of every header this kind takes, required
   *  or not (FR-004). */
  static override readonly schema = GuideHeaders;

  /** When a reader of this charter is to open this kind at all, said
   *  where the kind's contract is: the neutral surface lists one
   *  line per kind and none of them is written down twice (FR-002). */
  static readonly activatesWhen = "a touched file matches one of its `globs`, or every turn where globs are not specified";

  /** A guide as an author writes one: what a refused header is fixed with. */
  static readonly sample: GuideHeaders = {
    id: "no-any",
    description: "Reject the any type in application code.",
    globs: ["src/**/*.ts"],
    tags: ["typescript"],
    rationale: "corpus:type-safety",
  };

  /** One guide, or every fault its headers have (FR-004). */
  static of(record: Readonly<Record<string, unknown>>, body: string): GuidePrimitive {
    return new GuidePrimitive(headersOf(GuidePrimitive, GuideHeaders, record), body);
  }
}
