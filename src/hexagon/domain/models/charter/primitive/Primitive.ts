import { z } from "zod";
import { AgentPrimitive } from "./AgentPrimitive.js";
import { CorpusPrimitive } from "./CorpusPrimitive.js";
import { GuidePrimitive } from "./GuidePrimitive.js";
import { McpPrimitive } from "./McpPrimitive.js";
import { MixinPrimitive } from "./MixinPrimitive.js";
import { PlaybookPrimitive } from "./PlaybookPrimitive.js";
import { PosturePrimitive } from "./PosturePrimitive.js";
import { SensorPrimitive } from "./SensorPrimitive.js";
import { SkillPrimitive } from "./SkillPrimitive.js";
import { ScriptPrimitive } from "./ScriptPrimitive.js";
import { TemplatePrimitive } from "./TemplatePrimitive.js";
import { BasePrimitive, CommonHeadersSchema, DELIMITER, type AssetFile } from "./BasePrimitive.js";
import type { PrimitiveLayer } from "../PrimitiveLayer.js";
import { CharterPrimitiveFault, throwAggregateError, type DomainFault } from "../../DomainFault.js";
import { formatFrontmatterValue } from "../../helper.js";
import type { ForParsingYaml } from "../../../../port/zdriven/ForParsingYaml.js";

/** The classes, one per kind. Adding a kind is a file beside them and a line here; what
 *  the kinds are is read back off this list rather than written down twice. */
export const PRIMITIVE_CLASSES = [
  GuidePrimitive,
  SensorPrimitive,
  SkillPrimitive,
  PlaybookPrimitive,
  AgentPrimitive,
  PosturePrimitive,
  CorpusPrimitive,
  MixinPrimitive,
  McpPrimitive,
  ScriptPrimitive,
  TemplatePrimitive,
] as const;

/**
 * A primitive of any kind, discriminated on `kind`: reading
 * `headers.globs` compiles on a guide and nowhere else.
 *
 * Each kind is a class of its own, holding what it requires of a file and
 * refusing one that does not hold it, so having a `Primitive` is the promise
 * that the kind's contract holds (FR-004). Read off what those classes return
 * rather than listed again: a constructor is protected, so `of` is the only way
 * one comes into being, and what it hands back is what a primitive is.
 */
export type Primitive = ReturnType<(typeof PRIMITIVE_CLASSES)[number]["of"]>;

/** The primitive kinds, each read off the class that reads it. The set is
 *  closed: any other value is a fault naming the file and the offending kind
 *  (FR-001). */
export const KINDS = Object.freeze(PRIMITIVE_CLASSES.map((one) => one.kind));

export type Kind = (typeof KINDS)[number];

/** An id as someone typed it, at a command or in a request, held to the shape
 *  an id is written in: text that is not one names nothing to look for
 *  (FR-172). */
export function primitiveIdOf(typed: string): string {
  if (!CommonHeadersSchema.shape.id.safeParse(typed).success)
    throw new CharterPrimitiveFault(
      `"${typed}" is not an id: one is lowercase letters, digits and inner hyphens, in segments joined by "/".`,
      'Type it as the primitive declares it, as in "no-any".',
    );
  return typed;
}

export function isKind(value: unknown): value is Kind {
  return typeof value === "string" && (KINDS as readonly string[]).includes(value);
}

/** Which class reads each kind. */
const CLASS_OF = new Map<Kind, (typeof PRIMITIVE_CLASSES)[number]>(
  PRIMITIVE_CLASSES.map((one) => [one.kind, one]),
);

/** One header a kind's author may answer for: the shape the answer takes,
 *  whether a file written without it is refused, and — where the kind reads it
 *  from a closed set — the values it may hold. What is asked before a file of
 *  this kind can be written, and what is refused where a file was written
 *  without it — one declaration, read twice. */
export class PrimitiveHeader {
  constructor(
    readonly field: string,
    readonly shape: "line" | "list",
    readonly required: boolean,
    /** Every value the kind reads this header as, where the set is closed — a
     *  sensor's `signal` — so it is chosen rather than typed (FR-118). A header
     *  whose set is open has none. */
    readonly allowedValues?: readonly string[],
  ) {}}

/** Everything one kind takes of whoever authors it: every header in the order
 *  they are asked, and one primitive of that kind written out, so an author
 *  reading what is wanted also reads what it looks like answered (FR-001,
 *  FR-039). */
export class PrimitiveRequirements {
  constructor(
    readonly headers: readonly PrimitiveHeader[],
    readonly sample: string,
  ) {}}

/**
 * Every header one kind takes: what every primitive declares, and what this
 * kind's own contract adds on top of it — each with the shape it holds and
 * whether the kind refuses a file without it (FR-004, FR-039).
 *
 * Read off the kind's own class rather than listed again here, so a kind that
 * grows a header is asked for it without anything else being told. The shape
 * comes off the schema a file is refused against, so a header a kind takes
 * without requiring — a guide's globs — is written the shape it is read as, and
 * whoever answers one reads the same contract that refuses it.
 *
 * `kind` and `id` are not among them: the first is what is being asked about
 * and the second is what the primitive is to be called, so both are known
 * before there is anything to ask.
 */
export function primitiveHeadersOf(kind: Kind): readonly PrimitiveHeader[] {
  const kindClass = CLASS_OF.get(kind)!;
  const required = { ...BasePrimitive.requires, ...kindClass.requires };

  return Object.entries(kindClass.schema.shape)
    .filter(([field]) => field !== "id")
    .map(([field, type]) => {
      // What the header holds — an array of lines, a closed set, or one line —
      // with optional and readonly taken off: they wrap what is held rather than
      // being part of it.
      let heldType: unknown = type;
      while (!(heldType instanceof z.ZodArray) && typeof (heldType as { unwrap?: unknown })?.unwrap === "function")
        heldType = (heldType as { unwrap: () => unknown }).unwrap();
      return new PrimitiveHeader(
        field,
        heldType instanceof z.ZodArray ? "list" : "line",
        field in required,
        heldType instanceof z.ZodEnum ? (heldType.options as readonly string[]) : undefined,
      );
    });
}

/** One primitive of this kind as its own class declares one, written out the
 *  way a file holds it — the kind first, since it is what decides how the rest
 *  is read. What an author is shown beside the headers they are to answer, and
 *  the same sample a refused file is held up against (FR-001). */
export function primitiveSampleOf(kind: Kind): string {
  return Object.entries({ kind, ...CLASS_OF.get(kind)!.sample })
    .map(([field, value]) => `${field}: ${formatFrontmatterValue(value)}`)
    .join("\n");
}

/** Headers and body as a caller already holds them, for a primitive nobody has
 *  written a file for yet: what `cw add` gathers from whoever is authoring it. */
export interface UnparsedPrimitive {
  readonly headers: Readonly<Record<string, unknown>>;
  readonly body: string;
}

/**
 * A primitive from the text a port supplied, or from headers and a body a
 * caller already holds.
 *
 * Returns one, or throws an `AggregateError` carrying what is wrong with it, so
 * a caller reading a whole charter collects it under the file (FR-009).
 * What is checked is the same either way: a primitive gathered at the command
 * line holds what its kind requires, or it is refused before any file is
 * written, and there is no second reading of what a kind demands to keep in
 * step with the first (FR-039).
 *
 * The kind is the one the headers declare, and it must be one the charter
 * knows. Where a primitive sits says nothing about what it is: a file is read as
 * what it says it is (FR-003).
 *
 * An unparsed primitive is what an author answered, so a header under a name
 * the kind never named is refused rather than parsed away: the kind's schema
 * reads the headers it holds and drops the rest, and a file written from the
 * answers would be missing what its author believes they said (FR-011). Said
 * in the same words whether the answer was typed at a prompt, given as a flag
 * or sent from the portal (FR-012), and beside whatever else the answers got
 * wrong (FR-009). A file is read as it always was.
 */
export function primitiveOf(unparsedPrimitive: UnparsedPrimitive): Primitive;
export function primitiveOf(text: string, parser: ForParsingYaml, assetFiles?: readonly AssetFile[], primitiveLayer?: PrimitiveLayer): Primitive;
export function primitiveOf(
  input: string | UnparsedPrimitive,
  parser?: ForParsingYaml,
  assetFiles: readonly AssetFile[] = [],
  primitiveLayer?: PrimitiveLayer,
): Primitive {
  let headers: Readonly<Record<string, unknown>>;
  let body: string;

  if (typeof input === "string") {
    // The frontmatter block and the body around it: the opening delimiter is
    // the first line, and the block ends at the next delimiter on its own line.
    const lines = input.replace(/^﻿/, "").split(/\r?\n/);
    if (lines[0]?.trim() !== DELIMITER)
      throwAggregateError([
        new CharterPrimitiveFault(
          `This file opens with no "${DELIMITER}" frontmatter block.`,
          `Add one at the top declaring at least "id" and "description".`,
        ),
      ]);
    const end = lines.findIndex((line, index) => index > 0 && line.trim() === DELIMITER);
    if (end === -1)
      throwAggregateError([
        new CharterPrimitiveFault(
          `The frontmatter block is never closed.`,
          `Add a "${DELIMITER}" line after the headers.`,
        ),
      ]);
    headers = parser!.parse(lines.slice(1, end).join("\n"));
    // The blank lines between the headers and the body, and the whitespace at
    // its end, are the file's; the indentation of its first line is the body's,
    // which its compiled document keeps (FR-139).
    body = lines.slice(end + 1).join("\n").replace(/^(\s*\n)+/, "").trimEnd();
  } else {
    headers = input.headers;
    body = input.body;
  }

  if (!isKind(headers.kind))
    throwAggregateError([
      headers.kind === undefined
        ? new CharterPrimitiveFault(
            `This file declares no "kind", so nothing knows what to read it as.`,
            `Add "kind: <one the charter knows>" to the frontmatter.`,
          )
        : new CharterPrimitiveFault(
            `"${String(headers.kind)}" is not a kind the charter knows.`,
            `Declare a kind the charter knows: ${KINDS.join(", ")}.`,
          ),
    ]);
  const kind = headers.kind;
  if (typeof input === "string") return CLASS_OF.get(kind)!.of(headers, body, assetFiles, primitiveLayer);

  const headerFields = primitiveHeadersOf(kind).map((header) => header.field);
  const unknownHeaderFaults = Object.keys(headers)
    .filter((field) => field !== "kind" && field !== "id" && !headerFields.includes(field))
    .map(
      (field) =>
        new CharterPrimitiveFault(
          `A ${kind} holds no "${field}".`,
          `Answer one of what a ${kind} holds: ${headerFields.join(", ")}.`,
        ),
    );
  let primitive: Primitive | undefined;
  let schemaFaults: readonly DomainFault[] = [];
  try {
    primitive = CLASS_OF.get(kind)!.of(headers, body);
  } catch (raised) {
    if (!(raised instanceof AggregateError)) throw raised;
    schemaFaults = raised.errors as readonly DomainFault[];
  }
  if (primitive === undefined || unknownHeaderFaults.length > 0) throwAggregateError([...unknownHeaderFaults, ...schemaFaults]);
  return primitive;
}
