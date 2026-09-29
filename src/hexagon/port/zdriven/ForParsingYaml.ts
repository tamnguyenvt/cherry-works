/** What `parse` throws, named again here so an adapter answering this port
 *  names this port and nothing behind it. */
export { CharterPrimitiveFault } from "../../domain/models/DomainFault.js";

/**
 * DRIVEN PORT — translator. The domain hands over the frontmatter block and
 * gets fields back.
 *
 * The charter is authored in YAML, and a YAML parser is a library — exactly
 * what the domain may not import. So the notation is named here and read
 * outside: a block of text in, named fields out, and which parser did it is the
 * adapter's business.
 */
export interface ForParsingYaml {
  /**
   * The fields declared in one frontmatter block. An empty block is no fields,
   * not an error.
   *
   * @throws CharterPrimitiveFault when the notation itself does not parse, or
   * when the block is not a mapping of names to values — the one fault a file
   * has that no reading of its headers could find.
   */
  parse(block: string): Readonly<Record<string, unknown>>;
}
