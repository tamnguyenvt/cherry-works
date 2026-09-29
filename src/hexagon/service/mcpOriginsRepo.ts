import { DomainFault } from "../domain/models/DomainFault.js";
import type { McpOrigin } from "../domain/models/output/common/McpOrigin.js";
import { OUT_DIRECTORY, outFolderIn } from "../domain/path.js";
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
