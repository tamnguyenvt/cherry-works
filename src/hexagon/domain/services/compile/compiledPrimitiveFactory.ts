import type { CharterRoot } from "../../models/charter/CharterRoot.js";
import { MixinPrimitive } from "../../models/charter/primitive/MixinPrimitive.js";
import type { Primitive } from "../../models/charter/primitive/Primitive.js";
import { ScriptPrimitive } from "../../models/charter/primitive/ScriptPrimitive.js";
import { CompiledPrimitive } from "../../models/output/common/CompiledPrimitive.js";
import { stamp } from "../../models/output/StampedDocument.js";
import { BasePrimitive, REFERENCE } from "../../models/charter/primitive/BasePrimitive.js";

/** What a body is read through to find the names in it: a fenced block, a link
 *  and a code span are each taken whole, so a name inside one is seen as part
 *  of it; what is left over is a name standing on its own (FR-147). */
const PRIMITIVES_MENTION = new RegExp(
  [
    /^ {0,3}(`{3,}|~{3,})[\s\S]*?(?:^ {0,3}\1[^\n]*$|(?![\s\S]))/.source,
    /\[[^\]\n]*\]\([^)\n]*\)/.source,
    /`[^`\n]*`/.source,
    REFERENCE.source,
  ].join("|"),
  "gm",
);

/** A code span holding one name and nothing else. */
const PRIMITIVES_EXACT_MENTION = new RegExp(`^\`${REFERENCE.source}\`$`);

/**
 * One primitive as an agent opens it, in the output folder whichever layer
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
 * link: the id as its text, and the file the catalogue names for it as its target,
 * from this document. A name the charter does not hold is left as
 * written: the charter has refused it, and a build never reaches here with one
 * (FR-147, FR-162).
 */
export function compiledPrimitiveOf(charter: CharterRoot, primitive: Primitive): CompiledPrimitive {

  const markdown = primitive.toMarkdown({
    // A mixin nothing answers to is left out: the charter already names that
    // file as an error, and a build refused for it never reaches here (FR-009).
    mixins: charter.mixinsOf(primitive).flatMap((mixin) => (mixin instanceof MixinPrimitive ? [mixin] : [])),
    idReplacer: (body) =>
      body.replace(PRIMITIVES_MENTION, (found) => {
        const exactFound = PRIMITIVES_EXACT_MENTION.test(found);
        const isReference = /^\[\[[^\]]*\]\]$/.test(found);
        if (!exactFound && !isReference) return found;
        const referencedId = (exactFound ? found.slice(1, -1) : found).slice(2, -2);
        const referencedPrimitive = charter.primitiveById.get(referencedId);
        // Up from this document's folder to the output folder, a step per
        // segment of its path, then down to the one it names. The id is the
        // text, in a code span where the author wrote one.
        return referencedPrimitive === undefined
          ? found
          : `[${exactFound ? `\`${referencedId}\`` : referencedId}](${"../".repeat(primitive.primitiveFolder.split("/").length)}${referencedPrimitive.primitiveFolder}/${referencedPrimitive.index})`;
      }),
  });
  return new CompiledPrimitive(
    primitive.kind,
    primitive.headers.id,
    stamp(markdown),
    primitive.assets.map((assetFile) => ({
      ...assetFile,
      executable: primitive instanceof ScriptPrimitive && primitive.isExecutionFile(assetFile.file),
    })),
  );
}
