import { outputPath } from "../../constants.js";
import { PrimitiveHelper } from "../../helper.js";
import type { CharterRoot } from "../charter/charter-root.js";
import { MixinPrimitive } from "../primitive/mixin-primitive.js";
import type { Primitive } from "../primitive/primitive.js";
import { ScriptPrimitive } from "../primitive/script-primitive.js";
import { CompiledAsset, CompiledPrimitive } from "./compiled-primitive.js";
import { StampedDocument } from "./stamped-document.value-object.js";

/** Makes one primitive's compiled document. */
export class CompiledPrimitiveFactory {
  /**
   * One primitive as an agent opens it, in the compiled output whichever layer
   * brought it (FR-139, FR-140).
   *
   * Every kind, a template's included, is its headers and the whole of what it
   * says — the bodies of its mixins, then its own — stamped with where to change
   * it instead (FR-139).
   *
   * Every primitive's assets are copied beside its document as they are, so each
   * `./<file>` names the copy from the document as it named the file from its
   * `index.md`; of a script's, the one it runs alone is run by its path (FR-160,
   * FR-166, FR-168).
   *
   * Each primitive a body names as `[[<id>]]`, of any kind, is written as a
   * link: the id as its text, and that primitive's compiled document as its
   * target, from this document, wherever the projection lays the two. A name the charter does not hold is left as
   * written: the charter has refused it, and a build never reaches here with one
   * (FR-147, FR-162).
   */
  static create(charterRoot: CharterRoot, primitive: Primitive): CompiledPrimitive {
    const markdownText = primitive.writeMarkdown({
      // A mixin nothing answers to is left out: the charter already names that
      // file as an error, and a build refused for it never reaches here (FR-009).
      mixins: charterRoot
        .mixinsOf(primitive)
        .flatMap((mixinPrimitive) => (mixinPrimitive instanceof MixinPrimitive ? [mixinPrimitive] : [])),
      idReplacer: (body) =>
        PrimitiveHelper.rewriteStandaloneReferences(body, (referencedId, isInCodeSpan) => {
          const referencedPrimitive = charterRoot.primitiveById.get(referencedId);
          // The id is the text, in a code span where the author wrote one.
          return referencedPrimitive === undefined
            ? undefined
            : `[${isInCodeSpan ? `\`${referencedId}\`` : referencedId}](${outputPath.getLinkTo(outputPath.getCompiledPrimitivePath(referencedPrimitive.kind, referencedPrimitive.headers.id))})`;
        }),
    });
    return new CompiledPrimitive(
      primitive.kind,
      primitive.headers.id,
      new StampedDocument(markdownText),
      primitive.assets.map(
        (assetFile) =>
          new CompiledAsset(
            assetFile.assetPath,
            assetFile.contents,
            primitive instanceof ScriptPrimitive && primitive.isExecutionFile(assetFile.assetPath),
          ),
      ),
    );
  }

  private constructor() {}
}
