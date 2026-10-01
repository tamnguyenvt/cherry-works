import type { CharterRoot, ScopedPrimitive } from "../../models/charter/CharterRoot.js";
import { MCP_MENTION } from "../../models/charter/primitive/McpPrimitive.js";
import { MixinPrimitive } from "../../models/charter/primitive/MixinPrimitive.js";
import { ScriptPrimitive } from "../../models/charter/primitive/ScriptPrimitive.js";
import { TemplatePrimitive } from "../../models/charter/primitive/TemplatePrimitive.js";
import type { ShortStrings } from "../../models/helper.js";
import { CompiledPrimitive } from "../../models/output/common/CompiledPrimitive.js";
import { stamp } from "../../models/output/StampedDocument.js";
import { OUT_DIRECTORY } from "../../path.js";

/**
 * One primitive as an agent opens it, in the output folder whichever layer
 * brought it (FR-139, FR-140).
 *
 * A script and a template are the file they stand for: their body alone, under
 * the extension they declare, with no stamp, since a stamp would be a line of
 * the file; a script is run by its path (FR-159, FR-160). Every other kind is
 * its headers and the whole of what it says — the bodies of its mixins, then
 * its own — stamped with where to change it instead.
 */
export function compiledPrimitiveOf(charter: CharterRoot, one: ScopedPrimitive, shortenMcpIdentities: ShortStrings): CompiledPrimitive {
  const { identity, primitive } = one;
  const { id } = primitive.headers;
  if (primitive instanceof ScriptPrimitive || primitive instanceof TemplatePrimitive)
    return new CompiledPrimitive(
      identity,
      `${OUT_DIRECTORY}/${primitive.kind}/${id}.${primitive.headers.extension}`,
      // Its body ending in one newline, and an empty body an empty file.
      primitive.body === "" ? "" : `${primitive.body.replace(/\n*$/, "")}\n`,
      primitive instanceof ScriptPrimitive,
    );

  const markdown = primitive.toMarkdown({
    // A mixin nothing answers to is left out: the charter already names that
    // file as an error, and a build refused for it never reaches here (FR-009).
    mixins: charter.mixinsOf(one).flatMap((mixin) => (mixin.primitive instanceof MixinPrimitive ? [mixin.primitive] : [])),
    // Each place the body names as `mcp:<id>` written as the name its tools are
    // served under, `<name>__<tool>`, which every host's name for them holds
    // whatever it puts before it (FR-147).
    idReplacer: (body) => body.replace(MCP_MENTION, (mentionedIdentity) => shortenMcpIdentities[mentionedIdentity] ?? mentionedIdentity),
  });
  return new CompiledPrimitive(identity, `${OUT_DIRECTORY}/${primitive.kind}/${id}.md`, stamp(markdown), false);
}
