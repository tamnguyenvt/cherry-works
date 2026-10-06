import { z } from "zod";
import { CharterPrimitiveFault, throwAggregateError } from "../../DomainFault.js";
import { contentHashOf, formatFrontmatterValue } from "../../helper.js";
import { REPO_PRIMITIVE_LAYER, type PrimitiveLayer, type LayerName } from "../PrimitiveLayer.js";

/** One file of a primitive's folder beside its `index.md`: the path it has in
 *  that folder, and what it holds (FR-168). */
export interface AssetFile {
  readonly file: string;
  readonly contents: string;
}

/** An id as FR-141 writes one: lowercase slugs joined by `/`. */
const ID_SOURCE = /[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*/.source;

/**
 * Where a body or a sensor's `run` names another primitive: `[[<id>]]`, of any
 * kind (FR-172). Only a name so written is a reference, so prose is never taken
 * for one. The id is the first group.
 */
export const REFERENCE = new RegExp(`\\[\\[(${ID_SOURCE})\\]\\]`, "g");

/**
 * Where an agent's `tools` holds an mcp origin: `[[<id>]]` for every tool that mcp
 * declares, `[[<id>]]:<tool>` for one of them (FR-156). The id is the first
 * group, the tool the second where one is named.
 */
export const TOOL_REFERENCE = new RegExp(`^\\[\\[(${ID_SOURCE})\\]\\](?::([^:\\s]+))?$`);

/** The delimiter a primitive's headers are written between. One constant for
 *  the writing here and the reading in `primitiveOf`, so the two cannot drift. */
export const DELIMITER = "---";

/** One line of text with something on it: a header written down and left
 *  blank is one nothing can read. */
export const GoodLineSchema = z.string().regex(/\S/);

/** A list of names, paths or globs with at least one in it: a kind that
 *  requires a list reads it entry by entry, and an empty one gives it nothing
 *  to read. */
export const GoodArraySchema = z.array(GoodLineSchema).min(1).readonly();

/** A yes or a no: `true` or `false`, read as YAML reads it off a file, or as
 *  the line an author typed at `cw add` or in the portal. */
export const FlagSchema = z
  .unknown()
  .refine((value) => [true, false, "true", "false"].includes(value as never), { message: "A yes or no header is written true or false." })
  .transform((value) => value === true || value === "true");

/** The headers every kind declares, whatever else its own contract asks for
 *  (data-model §1). Each kind's own headers extend these, so what every
 *  primitive holds is written once. */
export const CommonHeadersSchema = z.object({
  /** Slugs joined by `/`, so ids can be grouped by team or domain
   *  (FR-141). The `/` is written `-` in the file's name and nothing else:
   *  nothing is read from what a file is called. At most 40 characters, so every name a host
   *  is given for it — an mcp's tools among them, `mcp__cw__mcp-<id>__<tool>` —
   *  stays within what the host takes (FR-157). */
  id: z
    .string()
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\/[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/)
    .refine((id) => id.length <= 40, { message: `"id" is at most 40 characters.` }),
  /** All an agent reads of a primitive before opening its body. */
  description: GoodLineSchema,
  tags: z.array(GoodLineSchema).readonly().optional(),
  /** The files this primitive speaks about, where it speaks about any. A guide's
   *  are what decide when its body is loaded; a mixin may name them to say how
   *  far what it lends reaches (FR-006). */
  globs: z.array(GoodLineSchema).readonly().optional(),
  /** The id of the corpus this primitive cites as its reasoning (FR-005,
   *  FR-172). */
  rationale: GoodLineSchema.optional(),
  mixins: z.array(GoodLineSchema).readonly().optional(),
});
export type CommonHeaders = Readonly<z.infer<typeof CommonHeadersSchema>>;

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

  /** The file a primitive's folder is read from, and compiled to (FR-141):
   *  said here for whoever reads a folder before any primitive is read off it,
   *  and by `index` on every primitive. */
  static readonly index = "index.md";

  /** The schema every kind's headers are read by, its own standing in place of
   *  this. What a file is refused against, and the one place saying what shape
   *  each header holds — including the ones a kind takes without requiring, so
   *  whoever is writing a header reads its shape off the same contract a file
   *  is refused against (FR-004). */
  static readonly schema: z.ZodObject = CommonHeadersSchema;

  protected constructor(
    /** What this primitive's file declared, read as the contract of its kind:
     *  typed by whichever kind this is, so `headers.globs` compiles on a guide
     *  and nowhere else. */
    readonly headers: Headers,
    readonly body: string,
    /** Every file of its folder beside its `index.md`, at any depth (FR-168). */
    readonly assets: readonly AssetFile[] = [],
    /** The layer it was read in; a primitive authored here is in this
     *  repository's. */
    primitiveLayer: PrimitiveLayer = REPO_PRIMITIVE_LAYER,
  ) {
    this.layerName = primitiveLayer.name;
    this.charterFolder = primitiveLayer.charterFolder;
  }

  /** Whose layer it came from. It says where it was written, never what it is
   *  called (FR-014, FR-019). */
  readonly layerName: LayerName;

  /** Its layer's charter folder, from the repository: `.cw/charter`,
   *  `.cw/vendor/<name>`, or the engine's own name for its layer. */
  readonly charterFolder: string;

  /** The `index.md` it was authored in, from the repository (FR-141). */
  get file(): string {
    return `${this.charterFolder}/${this.primitiveFolder}/${this.index}`;
  }

  /** Whether a word someone searched for is anywhere a reader would look for
   *  it: the id, the kind, what it is for, when its kind comes up, its
   *  file, or any header it declared — ignoring case, since whoever typed it
   *  did not know how it was written (FR-114). */
  search(word: string): boolean {
    const headerValues = Object.values(this.headers).flatMap((value) =>
      value === undefined ? [] : Array.isArray(value) ? value : [String(value)],
    );
    const loweredWord = word.toLowerCase();
    return [this.headers.id, this.kind, this.activatesWhen, this.file, ...headerValues].some((one) => one.toLowerCase().includes(loweredWord));
  }

  /** Which kind this is. Each class declares it as a literal, and those
   *  literals are where `Kind` comes from. */
  abstract readonly kind: string;

  /** Its folder, from its charter folder: its kind, then each segment of its
   *  id (FR-141). */
  get primitiveFolder(): string {
    return `${this.kind}/${this.headers.id}`;
  }

  /** The file of that folder it is read from (FR-141). */
  get index(): string {
    return BasePrimitive.index;
  }


  /** When a reader of this charter is to open a primitive of its kind at all:
   *  the line its kind's class declares, in the words `cw kinds` says it in
   *  (FR-002, FR-029). */
  get activatesWhen(): string {
    return (this.constructor as unknown as { readonly activatesWhen: string }).activatesWhen;
  }

  /** The hash of it written out, which is what a save writes: what a save is
   *  checked against, so an edit made on disk since it was opened is not
   *  written over (FR-078). */
  get hash(): string {
    return contentHashOf(this.toMarkdown());
  }

  /** Its id as every name given to a host writes it, `/` as `-`:
   *  `mfbs-no-any` for `mfbs/no-any`, so a skill is invoked as `/mfbs-no-any`
   *  (FR-141, FR-171). Made here, once, so nothing that names a host's file
   *  spells it again. */
  get normId(): string {
    return this.headers.id.replace(/\//g, "-");
  }

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
   * Written as its author wrote it unless the compiler says otherwise (FR-139):
   * `mixins` lend their bodies, before this one's own so it reads as the point
   * and theirs as the setting — nothing is merged and no header moves (FR-006);
   * and `idReplacer` rewrites the body as its reader uses it, each mcp origin,
   * script and template it names as a link to its file (FR-147).
   */
  toMarkdown({
    mixins = [],
    idReplacer = (body) => body,
  }: {
    /** The mixin primitives it pulls in, in the order it named them: all a
     *  mixin lends is its body. */
    readonly mixins?: readonly { readonly body: string }[];
    readonly idReplacer?: (body: string) => string;
  } = {}): string {
    const body = [...mixins.map((mixin) => mixin.body), this.body].filter((one) => one.trim() !== "").join("\n\n");
    return [
      DELIMITER,
      ...Object.entries({ kind: this.kind, ...this.headers }).map(([field, value]) => `${field}: ${formatFrontmatterValue(value)}`),
      DELIMITER,
      "",
      idReplacer(body),
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
