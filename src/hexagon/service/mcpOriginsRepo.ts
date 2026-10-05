import { DomainFault, FaultsByFile } from "../domain/models/DomainFault.js";
import type { CharterRoot } from "../domain/models/charter/CharterRoot.js";
import { McpPrimitive } from "../domain/models/charter/primitive/McpPrimitive.js";
import { primitiveOf } from "../domain/models/charter/primitive/Primitive.js";
import { McpOrigins, originKeyOf, type McpOrigin, type McpToolDefinition } from "../domain/models/output/common/McpOrigin.js";
import { compile } from "../domain/services/compile/compileService.js";
import { OUT_DIRECTORY, outFolderIn } from "../domain/path.js";
import type { ForAuthorizing } from "../port/zdriven/ForAuthorizing.js";
import type { ForCallingMcpServers } from "../port/zdriven/ForCallingMcpServers.js";
import type { ForKeepingSecrets } from "../port/zdriven/ForKeepingSecrets.js";
import type { ForParsingYaml } from "../port/zdriven/ForParsingYaml.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";
import { credentialFor } from "./credentialRepo.js";

/** How long one mcp origin has to answer a build asking for its tools. */
const LIST_TIMEOUT_MS = 10_000;

/** What a build reaches the mcp origins with: the MCP servers, and the developer's
 *  own credentials to them. */
export interface McpReaching {
  readonly mcpServers: ForCallingMcpServers;
  readonly secrets: ForKeepingSecrets;
  readonly authorizing: ForAuthorizing;
}

/**
 * The mcp origins the last build listed, as `.cw/out/mcp-origins.json` holds them
 * (FR-145). What signing in and serving reach: the list a build wrote, never
 * the charter, so both see the same mcp origins whatever was edited since.
 *
 * No list is refused, saying to build; one that does not read is refused
 * saying to build again, since only a build writes it.
 */
export async function loadMcpOrigins(repo: URL, fileReader: ForReadingFiles): Promise<McpOrigins> {
  const file = `${OUT_DIRECTORY}/mcp-origins.json`;
  const contents = await fileReader.readIfThere(new URL("mcp-origins.json", outFolderIn(repo)));
  if (contents === undefined)
    throw new DomainFault(`There is no ${file}, so no mcp origin has been listed yet.`, 'Run "cw build" first.');

  try {
    const mcpOriginsJson: unknown = JSON.parse(contents);
    const origins = (mcpOriginsJson as { origins?: unknown }).origins;
    if (Array.isArray(origins)) return new McpOrigins(origins as readonly McpOrigin[]);
  } catch {
    // Said below, as any list that does not read is.
  }
  throw new DomainFault(`${file} does not hold a list of mcp origins.`, 'Run "cw build" to write it again.');
}

/**
 * The tools each mcp the last build compiled declares, under its id: read
 * from its compiled document, found through `.cw/out/catalog.json`, since the
 * list of mcp origins holds where an mcp origin is and nothing an mcp's own file says
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
  let catalogEntries: readonly { id?: unknown; kind?: unknown; file?: unknown }[] = [];
  try {
    const catalogJson: unknown = JSON.parse(contents ?? "[]");
    if (Array.isArray(catalogJson)) catalogEntries = catalogJson;
  } catch {
    // No mcp is read from a catalogue that does not read; each is said missing.
  }

  const toolsById = new Map<string, readonly string[]>();
  for (const { id, kind, file } of catalogEntries) {
    if (kind !== McpPrimitive.kind || typeof id !== "string" || typeof file !== "string") continue;
    const compiledDocument = await fileReader.readIfThere(new URL(file, repo));
    if (compiledDocument === undefined) continue;
    try {
      const primitive = primitiveOf(compiledDocument, yamlParser);
      if (primitive instanceof McpPrimitive) toolsById.set(id, primitive.headers.tools);
    } catch {
      // Said by the caller, as a missing one is.
    }
  }
  return toolsById;
}

/**
 * The tools each mcp origin of the charter lists, by `originKeyOf`, for the build to
 * keep beside it, so the server lists them without reaching it (EVAL-FR-031).
 *
 * Each mcp origin is asked at once, under the developer's own credential, and let
 * go. One that cannot be reached or is not signed in to, and a tool an mcp
 * declares that its mcp origin does not list, is a fault under that mcp's file: the
 * build stops on it. Without `refreshMcpOrigins`, or without `mcpReaching` to
 * ask them with, no mcp origin is asked, and each keeps what the last build
 * kept.
 */
export async function loadToolsByOriginKey(
  repo: URL,
  charter: CharterRoot,
  fileReader: ForReadingFiles,
  mcpReaching: McpReaching | undefined,
  refreshMcpOrigins: boolean,
): Promise<{ readonly toolsByOriginKey: ReadonlyMap<string, readonly McpToolDefinition[]>; readonly faultsByFile: FaultsByFile }> {
  if (!refreshMcpOrigins || mcpReaching === undefined) {
    const keptOrigins = await loadMcpOrigins(repo, fileReader).then(
      ({ origins }) => origins,
      () => [],
    );
    const toolsByOriginKey = new Map(keptOrigins.flatMap((origin) => (origin.tools === undefined ? [] : [[originKeyOf(origin), origin.tools] as const])));
    return { toolsByOriginKey, faultsByFile: FaultsByFile.none };
  }

  const { mcpServers, secrets, authorizing } = mcpReaching;
  const mcpPrimitiveById = new Map(charter.primitives.flatMap((primitive) => (primitive instanceof McpPrimitive ? [[primitive.headers.id, primitive] as const] : [])));
  const mcpOriginResults = await Promise.all(
    compile(charter, []).mcpOrigins.origins.map(async (origin) => {
      const mcpPrimitives = origin.ids.flatMap((id) => mcpPrimitiveById.get(id) ?? []);
      try {
        const accessToken = origin.auth.length > 0 ? await credentialFor(secrets, authorizing, origin) : undefined;
        const connection = await mcpServers.connect(origin, accessToken, LIST_TIMEOUT_MS);
        await connection.close();
        const listedTools = connection.tools.map(({ name, description, inputSchema }) => ({ name, description: description ?? "", inputSchema }));
        const listedToolNames = new Set(listedTools.map(({ name }) => name));
        const faultsByFile = new FaultsByFile(
          Object.fromEntries(
            mcpPrimitives.flatMap((mcpPrimitive) => {
              const missingTools = mcpPrimitive.headers.tools.filter((tool) => !listedToolNames.has(tool));
              if (missingTools.length === 0) return [];
              const fault = new DomainFault(
                `${origin.address} has no tool ${missingTools.map((tool) => `"${tool}"`).join(", ")}, which this mcp declares.`,
                `Declare only tools it lists: ${[...listedToolNames].sort().join(", ")}.`,
              );
              return [[mcpPrimitive.file, [fault]] as const];
            }),
          ),
        );
        return { key: originKeyOf(origin), listedTools, faultsByFile };
      } catch (raised) {
        if (!(raised instanceof DomainFault)) throw raised;
        const fault = new DomainFault(`The build could not ask ${origin.address} for its tools: ${raised.message}`, raised.fix);
        return { key: originKeyOf(origin), faultsByFile: new FaultsByFile(Object.fromEntries(mcpPrimitives.map((mcpPrimitive) => [mcpPrimitive.file, [fault]]))) };
      }
    }),
  );
  return {
    toolsByOriginKey: new Map(mcpOriginResults.flatMap(({ key, listedTools }) => (listedTools === undefined ? [] : [[key, listedTools] as const]))),
    faultsByFile: mcpOriginResults.reduce((faultsByFile, mcpOriginResult) => faultsByFile.with(mcpOriginResult.faultsByFile), FaultsByFile.none),
  };
}
