/** An id as FR-141 writes one: lowercase slugs joined by `/`. */
const ID_SOURCE = /[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*/.source;

/**
 * Where a body or a sensor's `run` names another primitive: `[[<id>]]`, of any
 * kind (FR-172). Only a name so written is a reference, so prose is never taken
 * for one. The id is the first group.
 */
const REFERENCE = new RegExp(`\\[\\[(${ID_SOURCE})\\]\\]`, "g");

/**
 * Where an agent's `tools` holds an mcp origin: `[[<id>]]` for every tool that mcp
 * declares, `[[<id>]]:<tool>` for one of them (FR-156). The id is the first
 * group, the tool the second where one is named.
 */
const TOOL_REFERENCE = new RegExp(`^\\[\\[(${ID_SOURCE})\\]\\](?::([^:\\s]+))?$`);

/** What a body is read through to find the names in it: a fenced block, a link
 *  and a code span are each taken whole, so a name inside one is seen as part
 *  of it; what is left over is a name standing on its own (FR-147). */
const STANDALONE_REFERENCE = new RegExp(
  [
    /^ {0,3}(`{3,}|~{3,})[\s\S]*?(?:^ {0,3}\1[^\n]*$|(?![\s\S]))/.source,
    /\[[^\]\n]*\]\([^)\n]*\)/.source,
    /`[^`\n]*`/.source,
    REFERENCE.source,
  ].join("|"),
  "gm",
);

/** A code span holding one name and nothing else. */
const CODE_SPAN_REFERENCE = new RegExp(`^\`${REFERENCE.source}\`$`);

/** How one primitive names another, `[[<id>]]`, read out of a text and written back into it (FR-156, FR-172). */
export class PrimitiveHelper {
  /** Each id a text names as `[[<id>]]`, in the order written, whether the charter holds it or not. */
  static findReferencedIds(text: string): readonly string[] {
    return [...text.matchAll(REFERENCE)].map(([, referencedId]) => referencedId!);
  }

  /** The mcp origin an agent's `tools` entry names, and the one tool where it names one; nothing for an entry naming no mcp origin. */
  static parseToolReference(toolEntry: string): { mcpId: string; toolName: string | undefined } | undefined {
    const [, mcpId, toolName] = toolEntry.match(TOOL_REFERENCE) ?? [];
    return mcpId === undefined ? undefined : { mcpId, toolName };
  }

  /** The text with each `[[<id>]]` written as `replaceReference` answers for it. */
  static rewriteReferences(
    text: string,
    replaceReference: (referenceText: string, referencedId: string) => string,
  ): string {
    return text.replace(REFERENCE, (referenceText, referencedId: string) =>
      replaceReference(referenceText, referencedId),
    );
  }

  /**
   * The body with each name standing on its own — `[[<id>]]`, or a code span
   * holding one alone — written as `replaceReference` answers for it, and each
   * name inside a longer code span, a link or a fenced block left as written
   * (FR-147). `replaceReference` answers nothing to leave a name as written.
   */
  static rewriteStandaloneReferences(
    body: string,
    replaceReference: (referencedId: string, isInCodeSpan: boolean) => string | undefined,
  ): string {
    return body.replace(STANDALONE_REFERENCE, (mentionText) => {
      const isInCodeSpan = CODE_SPAN_REFERENCE.test(mentionText);
      const isReference = /^\[\[[^\]]*\]\]$/.test(mentionText);
      if (!isInCodeSpan && !isReference) return mentionText;
      const referencedId = (isInCodeSpan ? mentionText.slice(1, -1) : mentionText).slice(2, -2);
      return replaceReference(referencedId, isInCodeSpan) ?? mentionText;
    });
  }

  private constructor() {}
}
