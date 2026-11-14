import { FlagSchema, z } from "#module/shared/module.js";
import { ContentHelper } from "../../helper.js";
import { InvalidPrimitiveFault } from "../charter.fault.js";
import { AgentPrimitive } from "./agent-primitive.js";
import { BasePrimitive } from "./base-primitive.js";
import { CorpusPrimitive } from "./corpus-primitive.js";
import { GuidePrimitive } from "./guide-primitive.js";
import { McpPrimitive } from "./mcp-primitive.js";
import { MixinPrimitive } from "./mixin-primitive.js";
import { PlaybookPrimitive } from "./playbook-primitive.js";
import { PosturePrimitive } from "./posture-primitive.js";
import { ScriptPrimitive } from "./script-primitive.js";
import { SensorPrimitive } from "./sensor-primitive.js";
import { SkillPrimitive } from "./skill-primitive.js";
import { TemplatePrimitive } from "./template-primitive.js";

/** The classes, one per kind. Adding a kind is a file beside them and a line here; what
 *  the kinds are is read back off this list rather than written down twice. */
const PRIMITIVE_CLASSES = [
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
const KINDS = Object.freeze(PRIMITIVE_CLASSES.map((primitiveClass) => primitiveClass.kind));

export type Kind = (typeof KINDS)[number];

/** Which class reads each kind. */
const PRIMITIVE_CLASS_BY_KIND = new Map<Kind, (typeof PRIMITIVE_CLASSES)[number]>(
  PRIMITIVE_CLASSES.map((primitiveClass) => [primitiveClass.kind, primitiveClass]),
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
    readonly isRequired: boolean,
    /** Every value the kind reads this header as, where the set is closed — a
     *  sensor's `signal` — so it is chosen rather than typed (FR-118). A header
     *  whose set is open has none. */
    readonly allowedValues?: readonly string[],
  ) {}
}

/** Every kind of primitive the charter knows, and how a primitive is read, made and named. */
export class Primitives {
  static get classes(): typeof PRIMITIVE_CLASSES {
    return PRIMITIVE_CLASSES;
  }

  static get kinds(): typeof KINDS {
    return KINDS;
  }

  /** An id as someone typed it, at a command or in a request, held to the shape
   *  an id is written in: text that is not one names nothing to look for
   *  (FR-172). */
  static idOf(typedId: string): string {
    if (!BasePrimitive.headersSchema().shape.id.safeParse(typedId).success)
      throw new InvalidPrimitiveFault(
        `"${typedId}" is not an id: one is lowercase letters, digits and inner hyphens, in segments joined by "/".`,
        'Type it as the primitive declares it, as in "no-any".',
        { internal: false },
      );
    return typedId;
  }

  static isKind(kindName: unknown): kindName is Kind {
    return typeof kindName === "string" && (KINDS as readonly string[]).includes(kindName);
  }

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
  static headersOf(kind: Kind): readonly PrimitiveHeader[] {
    const kindClass = PRIMITIVE_CLASS_BY_KIND.get(kind)!;
    const requiredHeaders = { ...BasePrimitive.requires, ...kindClass.requires };

    return Object.entries(kindClass.schema.shape)
      .filter(([headerName]) => headerName !== "id")
      .map(([headerName, headerSchema]) => {
        // What the header holds — an array of lines, a closed set, or one line —
        // with optional and readonly taken off: they wrap what is held rather than
        // being part of it.
        let heldType: unknown = headerSchema;
        while (!(heldType instanceof z.ZodArray) && typeof (heldType as { unwrap?: unknown })?.unwrap === "function")
          heldType = (heldType as { unwrap: () => unknown }).unwrap();
        return new PrimitiveHeader(
          headerName,
          heldType instanceof z.ZodArray ? "list" : "line",
          headerName in requiredHeaders,
          heldType instanceof z.ZodEnum
            ? (heldType.options as readonly string[])
            : heldType === FlagSchema
              ? ["true", "false"]
              : undefined,
        );
      });
  }

  /** One primitive of this kind as its own class declares one, written out the
   *  way a file holds it — the kind first, since it is what decides how the rest
   *  is read. What an author is shown beside the headers they are to answer, and
   *  the same sample a refused file is held up against (FR-001). */
  static sampleOf(kind: Kind): string {
    return Object.entries({ kind, ...PRIMITIVE_CLASS_BY_KIND.get(kind)!.sample })
      .map(([field, sampleValue]) => `${field}: ${ContentHelper.formatFrontmatterValue(sampleValue)}`)
      .join("\n");
  }

  private constructor() {}
}
