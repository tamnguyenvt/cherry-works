/** How one header value is written into the frontmatter. A list becomes
 *  `["a", "b"]`, with every entry in double quotes, because an unquoted glob
 *  such as `*.md` starts with `*`, which YAML reads as an alias. A line YAML
 *  would read as something other than that text — a list, a mapping, a comment,
 *  a quoted string, a boolean or a number — is written in double quotes too, so
 *  a sensor's `[ -z … ] || …` reads back as the command it is. Any other value
 *  is written as it is. */
export function formatFrontmatterValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((one) => JSON.stringify(one)).join(", ")}]`;
  if (typeof value === "boolean") return String(value);
  const line = String(value);
  return YAML_READS_OTHERWISE.test(line) ? JSON.stringify(line) : line;
}

/** A line that, written unquoted after `header: `, YAML reads as something
 *  other than the line: one starting with an indicator, one holding `: ` or
 *  ` #`, one with space at either end, and one that is a boolean, a null or a
 *  number. */
const YAML_READS_OTHERWISE =
  /^[-?:,[\]{}#&*!|>'"%@`]|: | #|:$|^\s|\s$|^$|^(true|false|yes|no|on|off|null|~)$|^[-+]?(\d[\d_]*)?\.?\d+([eE][-+]?\d+)?$/i;

/** Each string, shortened to a name of its own: what `shortenStringsOf`
 *  answers, keyed by the string it was handed. */
export type ShortStrings = Readonly<Record<string, string>>;

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
export function shortenStringsOf(strings: readonly string[]): ShortStrings {
  const shortStrings: Record<string, string> = {};
  const takenShortStrings = new Set<string>();
  for (const string of [...new Set(strings)].sort()) {
    const firstSegment = string.split("/")[0];
    let hash = 0x811c9dc5;
    for (const char of string) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
    const hashedString = `${firstSegment}_${(hash >>> 0).toString(16).padStart(8, "0").slice(0, 4)}`;

    let shortString = hashedString;
    for (let count = 2; takenShortStrings.has(shortString); count++) shortString = `${hashedString}_${count}`;
    takenShortStrings.add(shortString);
    shortStrings[string] = shortString;
  }
  return shortStrings;
}

/** The hash of one text, in hex: what tells two readings of a primitive apart,
 *  as a short string that crosses HTTP as it is (FR-078). FNV-1a over 64 bits:
 *  read synchronously wherever a primitive is, and a mark of change, not a
 *  secret. */
export function contentHashOf(content: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const char of content) hash = BigInt.asUintN(64, (hash ^ BigInt(char.codePointAt(0)!)) * 0x100000001b3n);
  return hash.toString(16).padStart(16, "0");
}
