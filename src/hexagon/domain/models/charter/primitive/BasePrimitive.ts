import { z } from "zod";
import { CharterPrimitiveFault, throwAggregateError } from "../../Fault.js";
import { formatFrontmatterValue } from "../../helper.js";

/** The delimiter a primitive's headers are written between. One constant for
 *  the writing here and the reading in `primitiveOf`, so the two cannot drift. */
export const DELIMITER = "---";

/** One line of text with something on it: a header written down and left
 *  blank is one nothing can read. */
export const goodLine = z.string().regex(/\S/);

/** A list of names, paths or globs with at least one in it: a kind that
 *  requires a list reads it entry by entry, and an empty one gives it nothing
 *  to read. */
export const goodArray = z.array(goodLine).min(1).readonly();

/** The headers every kind declares, whatever else its own contract asks for
 *  (data-model §1). Each kind's own headers extend these, so what every
 *  primitive holds is written once. */
export const CommonHeaders = z.object({
  /** Slugs joined by `/`, so identities can be grouped by team or domain
   *  (FR-141). The `/` puts the file in folders and nothing else: nothing is
   *  read from where a file sits. At most 50 characters, so every name a host
   *  is given for it — an mcp's tools among them — stays within what the host
   *  takes (FR-157). */
  id: z
    .string()
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\/[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/)
    .refine((id) => id.length <= 50, { message: `"id" is at most 50 characters.` }),
  /** All an agent reads of a primitive before opening its body. */
  description: goodLine,
  tags: z.array(goodLine).readonly().optional(),
  /** The files this primitive speaks about, where it speaks about any. A guide's
   *  are what decide when its body is loaded; a mixin may name them to say how
   *  far what it lends reaches (FR-006). */
  globs: z.array(goodLine).readonly().optional(),
  /** `corpus:<id>`, the reasoning this primitive cites (FR-005). */
  rationale: goodLine.optional(),
  mixins: z.array(goodLine).readonly().optional(),
});
export type CommonHeaders = Readonly<z.infer<typeof CommonHeaders>>;

/**
 * What every kind of primitive is: the headers its file declared, and the body
 * loaded only when it activates (FR-002, FR-013).
 *
 * A kind's own class extends this, declares the headers it requires, and
 * refuses a file that does not hold them — so having one is the promise that
 * the kind's contract holds (FR-004). What a file declared is read once, where
 * it is checked, and held as that kind's headers from then on.
 */
export abstract class BasePrimitive<Headers extends CommonHeaders = CommonHeaders> {
  /** What every kind requires of its author, whatever else its own contract
   *  asks for. A kind's own `requires` stands beside this rather than adding to
   *  it, so whoever asks for a kind's headers asks for both (FR-039). `id` is
   *  not among them: a primitive is named where it is asked for rather than
   *  answered for, so what is left to ask about is what it is for. */
  static readonly requires: RequiredHeaders = { description: "line" };

  /** The schema every kind's headers are read by, its own standing in place of
   *  this. What a file is refused against, and the one place saying what shape
   *  each header holds — including the ones a kind takes without requiring, so
   *  whoever is writing a header reads its shape off the same contract a file
   *  is refused against (FR-004). */
  static readonly schema: z.ZodObject = CommonHeaders;

  protected constructor(
    /** What this primitive's file declared, read as the contract of its kind:
     *  typed by whichever kind this is, so `headers.globs` compiles on a guide
     *  and nowhere else. */
    readonly headers: Headers,
    readonly body: string,
  ) {}

  /** Which kind this is. Each class declares it as a literal, and those
   *  literals are where `Kind` comes from. */
  abstract readonly kind: string;

  /**
   * This primitive as the file it is authored in: its headers between the
   * delimiters, and its body under them.
   *
   * The other direction of the reading `primitiveOf` does, and the same
   * frontmatter, so a file written here is a file that reads back as this
   * primitive. Said here rather than by whoever writes, for the reason
   * `description` is: what a primitive holds is the primitive's own, and a
   * caller holding one already has everything the file says.
   *
   * The kind leads, since it is what decides how the rest is read (FR-003). A
   * list is written the way the parser gives it back, so an author opening the
   * file finds what they declared rather than a second spelling of it.
   *
   * The body is this primitive's own unless another is handed in: compiled, it
   * is the body with its mixins' written in (FR-139).
   */
  toMarkdown(body: string = this.body): string {
    return [
      DELIMITER,
      ...Object.entries({ kind: this.kind, ...this.headers }).map(([field, value]) => `${field}: ${formatFrontmatterValue(value)}`),
      DELIMITER,
      "",
      body,
    ]
      .join("\n")
      // One newline at the end and no blank line before it, whether or not
      // there is a body yet: a file just written and one written over a body
      // its author has since filled in end the same way.
      .replace(/\n*$/, "\n");
  }

  /**
   * The one line this primitive is found by, composed: what its author wrote it
   * is for, and — where its kind decides when it applies — what it applies to.
   *
   * Said here rather than by whoever compiles, because what makes a kind
   * activate is the kind's own contract (FR-001, FR-004): a skill's triggers are
   * the author's words, which only a skill knows how to say in a line. A kind
   * that nothing activates on its description is the description it was
   * written with.
   */
  description(): string {
    return this.headers.description;
  }
}

/**
 * What one kind requires beyond the common headers, and the shape each of them
 * takes: one line of text, or a list of names.
 *
 * Declared by the kind's own class, because what a kind requires is its own
 * contract (FR-004). Written as data, so what a file being scaffolded is to be
 * given is read off it (FR-039).
 */
export type RequiredHeaders = Readonly<Record<string, "line" | "list">>;

/**
 * One kind's headers, read off what its file declared by that kind's schema, or
 * one fault saying they are not what the kind holds (FR-004).
 *
 * The fault does not list what is wrong, header by header: it shows the kind's
 * own sample, and an author holding the two side by side sees the difference.
 * Where the schema said what is wrong in its own words — a rule spanning two
 * headers, which no sample shows at a glance — those words are the message.
 */
export function headersOf<Schema extends z.ZodType>(
  sampledKind: {
  readonly kind: string;
  readonly sample: Readonly<Record<string, unknown>>;
},
  headerSchema: Schema,
  record: Readonly<Record<string, unknown>>,
): Readonly<z.infer<Schema>> {
  const parsed = headerSchema.safeParse(record);
  if (parsed.success) return parsed.data;

  const { kind, sample } = sampledKind;
  const refinementMessages = parsed.error.issues.filter((issue) => issue.code === "custom").map((issue) => issue.message);
  const sampleLines = Object.entries({ kind, ...sample }).map(([field, value]) => `${field}: ${formatFrontmatterValue(value)}`);
  return throwAggregateError([
    new CharterPrimitiveFault(
      refinementMessages.length > 0 ? refinementMessages.join(" ") : `These headers are not what a ${kind} holds.`,
      `Write them the way this ${kind} does:\n${sampleLines.join("\n")}`,
    ),
  ]);
}
