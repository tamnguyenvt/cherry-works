import { type DomainFault, FaultHelper, ManyFindingsFault } from "../../../../shared/module.js";
import { ContentHelper } from "../../helper.js";
import { InvalidPrimitiveFault } from "../charter.fault.js";
import { BasePrimitive } from "./base-primitive.js";
import { type Primitive, Primitives } from "./primitive.js";
import { RawPrimitive } from "./raw-primitive.js";

/** Makes one primitive out of what was handed in raw, or reads a ready-made
 *  one again. */
export class PrimitiveFactory {
  /**
   * A primitive from the raw one: its index.md as kept, or the headers and
   * body an author answered.
   *
   * Returns one, or throws a `ManyFindingsFault` carrying what is wrong with it, so
   * a caller reading a whole charter collects it under the file (FR-009).
   * What is checked is the same either way: a primitive gathered at the command
   * line holds what its kind requires, or it is refused before any file is
   * written, and there is no second reading of what a kind demands to keep in
   * step with the first (FR-039).
   *
   * The kind is the one the headers declare, and it must be one the charter
   * knows. Where a primitive sits says nothing about what it is: it is read as
   * what it says it is (FR-003).
   *
   * Answers are what an author typed, so a header under a name the kind never
   * named is refused rather than parsed away: the kind's schema reads the
   * headers it holds and drops the rest, and a file written from the answers
   * would be missing what its author believes they said (FR-011). Said in the
   * same words whether the answer was typed at a prompt, given as a flag or
   * sent from the portal (FR-012), and beside whatever else the answers got
   * wrong (FR-009). A kept index.md is read as it always was.
   *
   * A ready-made primitive, as the engine brings its own, has its headers read
   * again by its kind's schema: the same contract and the same faults as a
   * file, so none reaches the charter unchecked (CORE-FR-020).
   */
  static create(handedPrimitive: RawPrimitive | Primitive): Primitive {
    if (!(handedPrimitive instanceof RawPrimitive))
      return Primitives.classes
        .find((primitiveClass) => primitiveClass.kind === handedPrimitive.kind)!
        .of(
          handedPrimitive.headers,
          handedPrimitive.body,
          handedPrimitive.assets,
          handedPrimitive.layer,
          handedPrimitive.uri,
        );

    let headers: Readonly<Record<string, unknown>>;
    let body: string;

    const { contents } = handedPrimitive;
    const isAnswered = typeof contents === "object" && !(contents instanceof Uint8Array);
    if (!isAnswered) {
      // The frontmatter block and the body around it: the opening delimiter is
      // the first line, and the block ends at the next delimiter on its own line.
      const lines = handedPrimitive.text.replace(/^﻿/, "").split(/\r?\n/);
      if (lines[0]?.trim() !== BasePrimitive.delimiter)
        FaultHelper.throwAggregate([
          new InvalidPrimitiveFault(
            `This file opens with no "${BasePrimitive.delimiter}" frontmatter block.`,
            `Add one at the top declaring at least "id" and "description".`,
            { internal: false },
          ),
        ]);
      const closingLineIndex = lines.findIndex(
        (line, lineIndex) => lineIndex > 0 && line.trim() === BasePrimitive.delimiter,
      );
      if (closingLineIndex === -1)
        FaultHelper.throwAggregate([
          new InvalidPrimitiveFault(
            `The frontmatter block is never closed.`,
            `Add a "${BasePrimitive.delimiter}" line after the headers.`,
            { internal: false },
          ),
        ]);
      headers = ContentHelper.parseFrontmatterFields(lines.slice(1, closingLineIndex).join("\n"));
      // The blank lines between the headers and the body, and the whitespace at
      // its end, are the file's; the indentation of its first line is the body's,
      // which its compiled document keeps (FR-139).
      body = lines
        .slice(closingLineIndex + 1)
        .join("\n")
        .replace(/^(\s*\n)+/, "")
        .trimEnd();
    } else {
      ({ headers, body } = contents);
    }

    if (!Primitives.isKind(headers.kind))
      FaultHelper.throwAggregate([
        headers.kind === undefined
          ? new InvalidPrimitiveFault(
              `This file declares no "kind", so nothing knows what to read it as.`,
              `Add "kind: <one the charter knows>" to the frontmatter.`,
              { internal: false },
            )
          : new InvalidPrimitiveFault(
              `"${String(headers.kind)}" is not a kind the charter knows.`,
              `Declare a kind the charter knows: ${Primitives.kinds.join(", ")}.`,
              { internal: false },
            ),
      ]);
    const kind = headers.kind;
    const kindClass = Primitives.classes.find((primitiveClass) => primitiveClass.kind === kind)!;
    if (Object.hasOwn(headers, "agent-provider") && !Object.hasOwn(kindClass.schema.shape, "agent-provider"))
      FaultHelper.throwAggregate([
        new InvalidPrimitiveFault(
          `A ${kind} holds no "agent-provider".`,
          'Use "agent-provider" only on posture and sensor primitives.',
          { internal: false },
        ),
      ]);
    if (!isAnswered)
      return kindClass.of(headers, body, handedPrimitive.assets, handedPrimitive.layer, handedPrimitive.uri);

    const headerFields = Primitives.headersOf(kind).map((header) => header.field);
    const unknownHeaderFaults = Object.keys(headers)
      .filter((field) => field !== "kind" && field !== "id" && !headerFields.includes(field))
      .map(
        (field) =>
          new InvalidPrimitiveFault(
            `A ${kind} holds no "${field}".`,
            `Answer one of what a ${kind} holds: ${headerFields.join(", ")}.`,
            { internal: false },
          ),
      );
    let primitive: Primitive | undefined;
    let schemaFaults: readonly DomainFault[] = [];
    try {
      primitive = kindClass.of(
        headers,
        body,
        handedPrimitive.assets,
        handedPrimitive.layer,
        handedPrimitive.uri || undefined,
      );
    } catch (raisedValue) {
      if (!(raisedValue instanceof ManyFindingsFault)) throw raisedValue;
      schemaFaults = raisedValue.faults as readonly DomainFault[];
    }
    if (primitive === undefined || unknownHeaderFaults.length > 0)
      FaultHelper.throwAggregate([...unknownHeaderFaults, ...schemaFaults]);
    return primitive;
  }

  private constructor() {}
}
