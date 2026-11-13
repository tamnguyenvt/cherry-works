/** The tools each mcp declares, under its id, as the last build compiled its
 *  document: none for an mcp whose compiled document is missing or does not
 *  read, which the server says, naming it, and serves the rest (FR-145). */
export class McpDeclaredTools {
  constructor(readonly toolNamesById: ReadonlyMap<string, readonly string[] | undefined>) {}
}
