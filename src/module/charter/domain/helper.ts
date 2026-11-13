import { UnmappedYamlFault, UnreadableYamlFault, YamlLib } from "#module/shared/module.js";
import { InvalidPrimitiveFault } from "./models/charter.fault.js";

export { PrimitiveHelper } from "./models/primitive/primitive.helper.js";

/** A line that, written unquoted after `header: `, YAML reads as something
 *  other than the line: one starting with an indicator, one holding `: ` or
 *  ` #`, one with space at either end, and one that is a boolean, a null or a
 *  number. */
const YAML_READS_OTHERWISE =
  /^[-?:,[\]{}#&*!|>'"%@`]|: | #|:$|^\s|\s$|^$|^(true|false|yes|no|on|off|null|~)$|^[-+]?(\d[\d_]*)?\.?\d+([eE][-+]?\d+)?$/i;

/** Each string, shortened to a name of its own: what `shortenStringsOf`
 *  answers, keyed by the string it was handed. */
export type ShortStrings = Readonly<Record<string, string>>;

/** How content is written and read back, shared by several models: a frontmatter value and block, strings shortened apart, and what a content hashes to. */
export class ContentHelper {
  /**
   * The headers one frontmatter block declares. An empty block is no headers,
   * not an error. A block whose notation does not parse, or that is not a
   * mapping of names to values, raises an `InvalidPrimitiveFault`, the
   * person's to correct: a finding under its file (SDK-FR-004).
   */
  static parseFrontmatterFields(block: string): Readonly<Record<string, unknown>> {
    try {
      return YamlLib.parseYamlFields(block);
    } catch (yamlFault) {
      if (yamlFault instanceof UnreadableYamlFault)
        throw new InvalidPrimitiveFault(
          `The frontmatter is not readable: ${yamlFault.message}`,
          `Correct the notation: each header is "name: value", one per line.`,
          { internal: false },
        );
      if (yamlFault instanceof UnmappedYamlFault)
        throw new InvalidPrimitiveFault(
          "The frontmatter must be a list of named headers, one per line — not a bare value or a list.",
          `Write it as "id: <name>" and the rest of the headers this kind requires, one per line.`,
          { internal: false },
        );
      throw yamlFault;
    }
  }

  /** How one header value is written into the frontmatter. A list becomes
   *  `["a", "b"]`, with every entry in double quotes, because an unquoted glob
   *  such as `*.md` starts with `*`, which YAML reads as an alias. A line YAML
   *  would read as something other than that text — a list, a mapping, a comment,
   *  a quoted string, a boolean or a number — is written in double quotes too, so
   *  a sensor's `[ -z … ] || …` reads back as the command it is. Any other value
   *  is written as it is. */
  static formatFrontmatterValue(headerValue: unknown): string {
    if (Array.isArray(headerValue)) return `[${headerValue.map((listEntry) => JSON.stringify(listEntry)).join(", ")}]`;
    if (typeof headerValue === "boolean") return String(headerValue);
    const headerText = String(headerValue);
    return YAML_READS_OTHERWISE.test(headerText) ? JSON.stringify(headerText) : headerText;
  }

  /** The headers and the body of a markdown file opening with a `---`
   *  frontmatter block, or nothing for a file that does not. */
  static parseFrontmatter(markdown: string): { headers: Readonly<Record<string, unknown>>; body: string } | undefined {
    const lines = markdown.replace(/^\uFEFF/, "").split(/\r?\n/);
    const frontmatterEndIndex =
      lines[0]?.trim() === "---" ? lines.findIndex((line, lineIndex) => lineIndex > 0 && line.trim() === "---") : -1;
    if (frontmatterEndIndex === -1) return undefined;
    return {
      headers: ContentHelper.parseFrontmatterFields(lines.slice(1, frontmatterEndIndex).join("\n")),
      body: lines
        .slice(frontmatterEndIndex + 1)
        .join("\n")
        .replace(/^(\s*\n)+/, "")
        .trimEnd(),
    };
  }

  /**
   * Each string shortened to its first segment and four hex characters hashed
   * from the whole: `moneyforward_c3ae` for `moneyforward/billing-service`,
   * the first segment being what comes before the first `/`.
   *
   * Short whatever the string's length, and the same whatever other strings are
   * handed in with it, since the hash is of this string alone. FNV-1a over 32
   * bits, the first four hex characters kept: a name to tell strings apart by,
   * not a secret. Two that hash alike are told apart by a number, `_2` onward, in
   * the order the strings sort in.
   */
  static shortenStringsOf(strings: readonly string[]): ShortStrings {
    const shortStrings: Record<string, string> = {};
    const takenShortStrings = new Set<string>();
    for (const longString of [...new Set(strings)].sort()) {
      const firstSegment = longString.split("/")[0];
      let hash = 0x811c9dc5;
      for (const stringCharacter of longString) hash = Math.imul(hash ^ stringCharacter.charCodeAt(0), 0x01000193);
      const hashedString = `${firstSegment}_${(hash >>> 0).toString(16).padStart(8, "0").slice(0, 4)}`;

      let shortString = hashedString;
      for (let count = 2; takenShortStrings.has(shortString); count++) shortString = `${hashedString}_${count}`;
      takenShortStrings.add(shortString);
      shortStrings[longString] = shortString;
    }
    return shortStrings;
  }

  /** The hash of one text, in hex: what tells two readings of a primitive apart,
   *  as a short string that crosses HTTP as it is (FR-078). FNV-1a over 64 bits:
   *  read synchronously wherever a primitive is, and a mark of change, not a
   *  secret. */
  static createContentHash(content: string): string {
    let hash = 0xcbf29ce484222325n;
    for (const contentCharacter of content)
      hash = BigInt.asUintN(64, (hash ^ BigInt(contentCharacter.codePointAt(0)!)) * 0x100000001b3n);
    return hash.toString(16).padStart(16, "0");
  }

  private constructor() {}
}
