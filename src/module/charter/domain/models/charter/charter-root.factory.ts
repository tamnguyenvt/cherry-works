import { DomainFault, FaultsByFile, ManyFindingsFault } from "../../../../shared/module.js";
import { InconsistentCharterFault } from "../charter.fault.js";
import { BasePrimitive } from "../primitive/base-primitive.js";
import { PrimitiveFactory } from "../primitive/primitive.factory.js";
import type { Primitive } from "../primitive/primitive.js";
import { type LayerName, PrimitiveLayer } from "../primitive/primitive-layer.value-object.js";
import { RawPrimitive } from "../primitive/raw-primitive.js";
import { CharterRoot } from "./charter-root.js";

/** The order the layers are read in: the engine's first, so the first claim
 *  on an id is the one kept and a collision with it is filed against what its
 *  author can rename (plan §3.1). */
const LAYER_ORDER: readonly LayerName[] = [
  PrimitiveLayer.BUILTIN.name,
  PrimitiveLayer.REPO.name,
  PrimitiveLayer.vendorName,
];

/** Makes a repository's charter out of the primitives kept of it, and what
 *  the engine brings. */
export class CharterRootFactory {
  /**
   * The one way a charter is read (FR-008): every use case comes through here, so
   * a charter is parsed in one place and one way.
   *
   * A charter is what the engine brings, what this repository authored and
   * what it installed, each primitive handed over as it is kept: its layer, its
   * kind and id, its text and its assets. Where it is kept is what keeps it to
   * know; the engine reads nothing off it (CORE-FR-213).
   *
   * The engine's layer arrives ready-made, and is read again by
   * `PrimitiveFactory.create` against its kind's contract like every other, so
   * none reaches the charter unchecked (CORE-FR-020).
   *
   * What reads as a primitive is held under where it is kept; what does not
   * leaves its faults under that same place. So a charter always comes back, and
   * one read names every bad file rather than the first (FR-009).
   */
  static create(handedPrimitives: readonly (RawPrimitive | Primitive)[]): CharterRoot {
    const primitives: Primitive[] = [];
    const faultsByFile: Record<string, readonly DomainFault[]> = {};
    const primitiveLayerByUri: Record<string, PrimitiveLayer> = {};

    // Read layer by layer, each in the order its places sort in, whatever order
    // they arrived in: a charter compiles to the same bytes however it was
    // kept (SC-007).
    for (const layerName of LAYER_ORDER)
      for (const handedPrimitive of handedPrimitives
        .filter(({ layer }) => layer.name === layerName)
        .sort((leftPrimitive, rightPrimitive) => leftPrimitive.uri.localeCompare(rightPrimitive.uri))) {
        primitiveLayerByUri[handedPrimitive.uri] = handedPrimitive.layer;
        const folderUriOf = (kind: string, id: string) =>
          (handedPrimitive instanceof RawPrimitive ? handedPrimitive.folderUriOf?.(kind, id) : undefined) ??
          `${kind}/${id}/`;
        // A primitive is a folder holding its index.md; a markdown file of its own
        // is how an earlier version kept one, and is sent where it belongs now
        // (FR-141).
        if (handedPrimitive instanceof RawPrimitive && !handedPrimitive.isKeptApart) {
          faultsByFile[handedPrimitive.uri] = [
            new InconsistentCharterFault(
              `This is a markdown file of its own, and a primitive is a folder holding its ${BasePrimitive.indexFileName}.`,
              `Move it to "${folderUriOf(handedPrimitive.kind, handedPrimitive.id)}${BasePrimitive.indexFileName}".`,
              { internal: false },
            ),
          ];
          continue;
        }
        try {
          const primitive = PrimitiveFactory.create(handedPrimitive);
          // It is kept under its kind and id: what it declares is what it is kept
          // as (FR-003, FR-141).
          if (
            handedPrimitive instanceof RawPrimitive &&
            (primitive.kind !== handedPrimitive.kind || primitive.headers.id !== handedPrimitive.id)
          ) {
            faultsByFile[handedPrimitive.uri] = [
              new InconsistentCharterFault(
                `This declares "${primitive.kind}" "${primitive.headers.id}", and it is kept at "${handedPrimitive.kind}/${handedPrimitive.id}/${BasePrimitive.indexFileName}"; a primitive is kept at "<kind>/<id>/${BasePrimitive.indexFileName}".`,
                `Move its folder to "${folderUriOf(primitive.kind, primitive.headers.id)}", or declare the kind and id its folder says.`,
                { internal: false },
              ),
            ];
            continue;
          }
          primitives.push(primitive);
        } catch (raisedValue) {
          // Every fault one file has arrives together (FR-009), and so does the one
          // fault a parser meant for the person, such as frontmatter that does
          // not read: what is wrong with a file is a finding under it, never a
          // failure of the read (SDK-FR-004). Anything else is not this file being
          // wrong and is not ours to swallow.
          if (raisedValue instanceof DomainFault && !raisedValue.internal) {
            faultsByFile[handedPrimitive.uri] = [raisedValue];
            continue;
          }
          if (!(raisedValue instanceof ManyFindingsFault)) throw raisedValue;
          // A finding is a fault the person can correct. An internal fault in the
          // same aggregate would otherwise be shown under the file (SDK-FR-018).
          const findingFaults = raisedValue.faults.filter(
            (error): error is DomainFault => error instanceof DomainFault && !error.internal,
          );
          if (findingFaults.length !== raisedValue.faults.length) throw raisedValue;
          faultsByFile[handedPrimitive.uri] = findingFaults;
        }
      }

    return new CharterRoot(primitives, new FaultsByFile(faultsByFile), primitiveLayerByUri);
  }

  private constructor() {}
}
