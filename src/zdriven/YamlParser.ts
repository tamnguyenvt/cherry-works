import { parse } from "yaml";
import { CharterPrimitiveFault, type ForParsingYaml } from "#hexagon/port/zdriven/ForParsingYaml.js";

/** Frontmatter in YAML, the notation the format is authored in. The only
 *  non-trivial parse in the system, and the reason the port exists. */
export class YamlParser implements ForParsingYaml {
  parse(block: string): Readonly<Record<string, unknown>> {
    let value: unknown;
    try {
      value = parse(block, { merge: false });
    } catch (cause) {
      throw new CharterPrimitiveFault(
        `The frontmatter is not readable: ${(cause as Error).message.split("\n")[0]}`,
        `Correct the notation: each header is "name: value", one per line.`,
      );
    }
    if (value === null || value === undefined) return {};
    if (typeof value !== "object" || Array.isArray(value)) {
      throw new CharterPrimitiveFault(
        "The frontmatter must be a list of named headers, one per line — not a bare value or a list.",
        `Write it as "id: <name>" and the rest of the headers this kind requires, one per line.`,
      );
    }
    return value as Record<string, unknown>;
  }
}
