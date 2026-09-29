import { DomainFault } from "../domain/models/DomainFault.js";
import { McpPrimitive } from "../domain/models/charter/primitive/McpPrimitive.js";
import { primitiveOf } from "../domain/models/charter/primitive/Primitive.js";
import type { McpOrigin } from "../domain/models/output/common/McpOrigin.js";
import { OUT_DIRECTORY, outFolderIn } from "../domain/path.js";
import type { ForParsingYaml } from "../port/zdriven/ForParsingYaml.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";

/**
 * The places the last build listed, as `.cw/out/mcp-origins.json` holds them
 * (FR-145). What signing in and serving reach: the list a build wrote, never
 * the charter, so both see the same places whatever was edited since.
 *
 * No list is refused, saying to build; one that does not read is refused
 * saying to build again, since only a build writes it.
 */
export async function loadMcpOrigins(repo: URL, fileReader: ForReadingFiles): Promise<readonly McpOrigin[]> {
  const file = `${OUT_DIRECTORY}/mcp-origins.json`;
  const contents = await fileReader.readIfThere(new URL("mcp-origins.json", outFolderIn(repo)));
  if (contents === undefined)
    throw new DomainFault(`There is no ${file}, so no place has been listed yet.`, 'Run "cw build" first.');

  try {
    const mcpOriginsJson: unknown = JSON.parse(contents);
    const origins = (mcpOriginsJson as { origins?: unknown }).origins;
    if (Array.isArray(origins)) return origins as readonly McpOrigin[];
  } catch {
    // Said below, as any list that does not read is.
  }
  throw new DomainFault(`${file} does not hold a list of places.`, 'Run "cw build" to write it again.');
}

/**
 * The tools each mcp the last build compiled declares, under its identity: read
 * from its compiled document, found through `.cw/out/catalog.json`, since the
 * list of places holds where a place is and nothing an mcp's own file says
 * (FR-145). The server reads these and no charter.
 *
 * An mcp whose compiled document is missing or does not read is left out: the
 * caller says so, naming it, and serves the rest.
 */
export async function loadMcpTools(
  repo: URL,
  fileReader: ForReadingFiles,
  yamlParser: ForParsingYaml,
): Promise<ReadonlyMap<string, readonly string[]>> {
  const contents = await fileReader.readIfThere(new URL("catalog.json", outFolderIn(repo)));
  let catalogEntries: readonly { identity?: unknown; kind?: unknown; file?: unknown }[] = [];
  try {
    const catalogJson: unknown = JSON.parse(contents ?? "[]");
    if (Array.isArray(catalogJson)) catalogEntries = catalogJson;
  } catch {
    // No mcp is read from a catalogue that does not read; each is said missing.
  }

  const toolsByIdentity = new Map<string, readonly string[]>();
  for (const { identity, kind, file } of catalogEntries) {
    if (kind !== McpPrimitive.kind || typeof identity !== "string" || typeof file !== "string") continue;
    const compiledDocument = await fileReader.readIfThere(new URL(file, repo));
    if (compiledDocument === undefined) continue;
    try {
      const primitive = primitiveOf(compiledDocument, yamlParser);
      if (primitive instanceof McpPrimitive) toolsByIdentity.set(identity, primitive.headers.tools);
    } catch {
      // Said by the caller, as a missing one is.
    }
  }
  return toolsByIdentity;
}
