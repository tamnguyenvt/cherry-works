import { parse } from "yaml";
import { InvalidPrimitiveFault } from "../models/charter.fault.js";

/**
 * LIBRARY — YAML, the notation a charter's frontmatter is authored in. It
 * knows about YAML text and nothing about primitives, which is why the domain
 * asks it rather than importing the parser itself.
 */

/**
 * The fields one frontmatter block declares. An empty block is no fields, not
 * an error. A block whose notation does not parse, or that is not a mapping of
 * names to values, raises an `InvalidPrimitiveFault`, the person's to correct:
 * a finding under its file (SDK-FR-004).
 */
export function parseYamlFields(block: string): Readonly<Record<string, unknown>> {
  let yamlValue: unknown;
  try {
    yamlValue = parse(block, { merge: false });
  } catch (cause) {
    throw new InvalidPrimitiveFault(
      `The frontmatter is not readable: ${(cause as Error).message.split("\n")[0]}`,
      `Correct the notation: each header is "name: value", one per line.`,
      { internal: false },
    );
  }
  if (yamlValue === null || yamlValue === undefined) return {};
  if (typeof yamlValue !== "object" || Array.isArray(yamlValue))
    throw new InvalidPrimitiveFault(
      "The frontmatter must be a list of named headers, one per line — not a bare value or a list.",
      `Write it as "id: <name>" and the rest of the headers this kind requires, one per line.`,
      { internal: false },
    );
  return yamlValue as Record<string, unknown>;
}
