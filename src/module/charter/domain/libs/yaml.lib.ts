import { parse } from "yaml";
import { CharterPrimitiveFault } from "../models/charter.fault.js";

/**
 * LIBRARY — YAML, the notation a charter's frontmatter is authored in. It
 * knows about YAML text and nothing about primitives, which is why the domain
 * asks it rather than importing the parser itself.
 */

/**
 * The fields one frontmatter block declares. An empty block is no fields, not
 * an error. A block whose notation does not parse, or that is not a mapping of
 * names to values, raises a `CharterPrimitiveFault`, the person's to correct:
 * a finding under its file (SDK-FR-004).
 */
export function yamlFieldsOf(block: string): Readonly<Record<string, unknown>> {
  let value: unknown;
  try {
    value = parse(block, { merge: false });
  } catch (cause) {
    throw new CharterPrimitiveFault(
      `The frontmatter is not readable: ${(cause as Error).message.split("\n")[0]}`,
      `Correct the notation: each header is "name: value", one per line.`,
      { internal: false },
    );
  }
  if (value === null || value === undefined) return {};
  if (typeof value !== "object" || Array.isArray(value))
    throw new CharterPrimitiveFault(
      "The frontmatter must be a list of named headers, one per line — not a bare value or a list.",
      `Write it as "id: <name>" and the rest of the headers this kind requires, one per line.`,
      { internal: false },
    );
  return value as Record<string, unknown>;
}
