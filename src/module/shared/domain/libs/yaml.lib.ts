import { parse } from "yaml";
import { UnmappedYamlFault, UnreadableYamlFault } from "../models/domain.fault.js";

/**
 * LIBRARY — YAML, the notation a charter's frontmatter is authored in. It
 * knows about YAML text and nothing about primitives, which is why the domain
 * asks it rather than importing the parser itself, and says in its own terms
 * what it could not read.
 */
export class YamlLib {
  /**
   * The fields one YAML block declares. An empty block is no fields, not an
   * error. A block whose notation does not parse raises an
   * `UnreadableYamlFault`, its message what the parser said; one that is not a
   * mapping of names to values, an `UnmappedYamlFault`.
   */
  static parseYamlFields(block: string): Readonly<Record<string, unknown>> {
    let yamlValue: unknown;
    try {
      yamlValue = parse(block, { merge: false });
    } catch (cause) {
      throw new UnreadableYamlFault((cause as Error).message.split("\n")[0]!, "Correct the YAML notation.", {
        internal: false,
      });
    }
    if (yamlValue === null || yamlValue === undefined) return {};
    if (typeof yamlValue !== "object" || Array.isArray(yamlValue))
      throw new UnmappedYamlFault(
        "The YAML is a bare value or a list, not named fields.",
        "Write it as named fields.",
        {
          internal: false,
        },
      );
    return yamlValue as Record<string, unknown>;
  }

  private constructor() {}
}
