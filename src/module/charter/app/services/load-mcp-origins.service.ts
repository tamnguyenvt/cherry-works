import { DomainFault, FaultsByFile, type ForCallingMcpServers } from "../../../shared/module.js";
import { outputPath } from "../../domain/constants.js";
import type { CharterRoot } from "../../domain/models/charter/charter-root.js";
import {
  MissingMcpOriginsFault,
  UnlistableMcpToolsFault,
  UnlistedMcpToolFault,
  UnreadableMcpOriginsFault,
} from "../../domain/models/charter.fault.js";
import { McpDeclaredTools } from "../../domain/models/charter-output/mcp-declared-tools.js";
import { type McpOrigin, McpOrigins, McpToolDefinition } from "../../domain/models/charter-output/mcp-origin.js";
import { McpOriginTools } from "../../domain/models/charter-output/mcp-origin-tools.js";
import { McpOriginsFactory } from "../../domain/models/charter-output/mcp-origins.factory.js";
import { McpPrimitive } from "../../domain/models/primitive/mcp-primitive.js";
import { PrimitiveFactory } from "../../domain/models/primitive/primitive.factory.js";
import { PrimitiveLayer } from "../../domain/models/primitive/primitive-layer.value-object.js";
import { RawPrimitive } from "../../domain/models/primitive/raw-primitive.js";
import { CharterOutputService } from "../../domain/services/charter-output.service.js";
import type { ForManagingCharter } from "../port/out/managing-charter.port.js";

/** What the last build laid is read back through: the charter's repository. */
type CompiledOutputReader = Pick<ForManagingCharter, "readCompiledOutputItem" | "describeItemPlace">;

/** How long one mcp origin has to answer a build asking for its tools. */
const LIST_TIMEOUT_MS = 10_000;

/** What a build reaches the mcp origins with: the MCP servers, and the
 *  developer's own access token to each, renewed where it has expired or
 *  `isRefused` says the mcp origin has just refused it — charter authoring's to
 *  keep (CORE-FR-229). */
export interface McpReaching {
  readonly mcpServerCaller: ForCallingMcpServers;
  readonly loadAccessToken: (origin: McpOrigin, isRefused: boolean) => Promise<string>;
}

/** Reads the mcp origins a build saved, and the tools they serve. */
export class LoadMcpOriginsService {
  /**
   * The mcp origins the last build listed, read through what laid it (FR-145,
   * CORE-FR-221). What signing in and serving reach: the list a build wrote,
   * never the charter, so both see the same mcp origins whatever was edited
   * since.
   *
   * No list is refused, saying to build; one that does not read is refused
   * saying to build again, since only a build writes it.
   */
  async loadMcpOrigins(compiledOutputReader: CompiledOutputReader): Promise<McpOrigins> {
    const mcpOriginsPlace = compiledOutputReader.describeItemPlace(outputPath.mcpOriginsFileName);
    const mcpOriginsText = await compiledOutputReader.readCompiledOutputItem(outputPath.mcpOriginsFileName);
    if (mcpOriginsText === undefined)
      throw new MissingMcpOriginsFault(
        `There is no ${mcpOriginsPlace}, so no mcp origin has been listed yet.`,
        'Run "cw build" first.',
        { internal: false },
      );

    const mcpOrigins = McpOriginsFactory.create(mcpOriginsText);
    if (mcpOrigins !== undefined) return mcpOrigins;
    throw new UnreadableMcpOriginsFault(
      `${mcpOriginsPlace} does not hold a list of mcp origins.`,
      'Run "cw build" to write it again.',
      { internal: false },
    );
  }

  /**
   * The tools each of these mcps declares, under its id: read from its
   * compiled document, as the last build laid it, since the list of mcp
   * origins holds where an mcp origin is and nothing an mcp's own file says
   * (FR-145). The server reads these and no charter.
   *
   * An mcp whose compiled document is missing or does not read is answered
   * as none: the caller says so, naming it, and serves the rest.
   */
  async loadMcpTools(compiledOutputReader: CompiledOutputReader, mcpIds: readonly string[]): Promise<McpDeclaredTools> {
    const toolNamesById = new Map<string, readonly string[] | undefined>();
    for (const id of mcpIds) {
      if (toolNamesById.has(id)) continue;
      toolNamesById.set(id, undefined);
      const compiledMcpPath = outputPath.getCompiledPrimitivePath(McpPrimitive.kind, id);
      const compiledDocument = await compiledOutputReader.readCompiledOutputItem(compiledMcpPath);
      if (compiledDocument === undefined) continue;
      try {
        const primitive = PrimitiveFactory.create(
          new RawPrimitive(
            PrimitiveLayer.REPO,
            McpPrimitive.kind,
            id,
            compiledDocument,
            [],
            compiledOutputReader.describeItemPlace(compiledMcpPath),
          ),
        );
        if (primitive instanceof McpPrimitive) toolNamesById.set(id, primitive.headers.tools);
      } catch {
        // Said by the caller, as a missing one is.
      }
    }
    return new McpDeclaredTools(toolNamesById);
  }

  /**
   * The tools each mcp origin of the charter lists, by `McpPrimitive.originKey`, for the build to
   * keep beside it, so the server lists them without reaching it (EVAL-FR-031).
   *
   * Each mcp origin is asked at once, under the developer's own credential, and let
   * go. One that cannot be reached or is not signed in to, and a tool an mcp
   * declares that its mcp origin does not list, is a fault under that mcp's file: the
   * build stops on it. Without `shouldRefreshMcpOrigins`, or without `mcpReaching` to
   * ask them with, no mcp origin is asked, and each keeps what the last build
   * kept.
   */
  async loadToolsByOriginKey(
    charterRoot: CharterRoot,
    compiledOutputReader: CompiledOutputReader,
    mcpReaching: McpReaching | undefined,
    shouldRefreshMcpOrigins: boolean,
  ): Promise<McpOriginTools> {
    const mcpPrimitiveById = new Map(
      charterRoot.primitives.flatMap((primitive) =>
        primitive instanceof McpPrimitive ? [[primitive.headers.id, primitive] as const] : [],
      ),
    );
    if (!shouldRefreshMcpOrigins || mcpReaching === undefined) {
      const keptOrigins = await this.loadMcpOrigins(compiledOutputReader).then(
        ({ origins }) => origins,
        () => [],
      );
      // A kept mcp origin's tools are its mcps' still where the last build
      // reached them: at the same address and path.
      const toolsByOriginKey = new Map(
        keptOrigins.flatMap((origin) => {
          const keptMcpPrimitive = origin.ids
            .flatMap((id) => mcpPrimitiveById.get(id) ?? [])
            .find(
              (mcpPrimitive) => mcpPrimitive.address === origin.address && mcpPrimitive.headers.path === origin.path,
            );
          return origin.tools === undefined || keptMcpPrimitive === undefined
            ? []
            : [[keptMcpPrimitive.originKey, origin.tools] as const];
        }),
      );
      return new McpOriginTools(toolsByOriginKey, FaultsByFile.emptyFaultsByFile);
    }

    const { mcpServerCaller, loadAccessToken } = mcpReaching;
    const mcpOriginResults = await Promise.all(
      CharterOutputService.compileCharterRoot(charterRoot, [])
        .findCharterOutputItem(McpOrigins)
        .origins.map(async (origin) => {
          const mcpPrimitives = origin.ids.flatMap((id) => mcpPrimitiveById.get(id) ?? []);
          // Every mcp of the origin is at its address and path: the first tells it apart.
          const originKey = mcpPrimitives[0]?.originKey;
          try {
            const accessToken = origin.auth.length > 0 ? await loadAccessToken(origin, false) : undefined;
            const connection = await mcpServerCaller.connectServer(origin, accessToken, LIST_TIMEOUT_MS);
            await connection.closeConnection();
            const listedTools = connection.tools.map(
              ({ name, description, inputSchema }) => new McpToolDefinition(name, description ?? "", inputSchema),
            );
            const listedToolNames = new Set(listedTools.map(({ name }) => name));
            const faultsByFile = new FaultsByFile(
              Object.fromEntries(
                mcpPrimitives.flatMap((mcpPrimitive) => {
                  const missingToolNames = mcpPrimitive.headers.tools.filter(
                    (toolName) => !listedToolNames.has(toolName),
                  );
                  if (missingToolNames.length === 0) return [];
                  const fault = new UnlistedMcpToolFault(
                    `${origin.address} has no tool ${missingToolNames.map((toolName) => `"${toolName}"`).join(", ")}, which this mcp declares.`,
                    `Declare only tools it lists: ${[...listedToolNames].sort().join(", ")}.`,
                    { internal: false },
                  );
                  return [[mcpPrimitive.uri, [fault]] as const];
                }),
              ),
            );
            return { originKey, listedTools, faultsByFile };
          } catch (raisedValue) {
            // A fault of the system's own is logged and never said (SDK-FR-017).
            if (!(raisedValue instanceof DomainFault) || raisedValue.internal) throw raisedValue;
            const fault = new UnlistableMcpToolsFault(
              `The build could not ask ${origin.address} for its tools: ${raisedValue.message}`,
              raisedValue.fix,
              { internal: false },
            );
            return {
              originKey,
              faultsByFile: new FaultsByFile(
                Object.fromEntries(mcpPrimitives.map((mcpPrimitive) => [mcpPrimitive.uri, [fault]])),
              ),
            };
          }
        }),
    );
    return new McpOriginTools(
      new Map(
        mcpOriginResults.flatMap(({ originKey, listedTools }) =>
          originKey === undefined || listedTools === undefined ? [] : [[originKey, listedTools] as const],
        ),
      ),
      mcpOriginResults.reduce(
        (faultsByFile, mcpOriginResult) => faultsByFile.mergeWith(mcpOriginResult.faultsByFile),
        FaultsByFile.emptyFaultsByFile,
      ),
    );
  }
}

/** The one LoadMcpOriginsService the composition root hands every use case that asks for it. */
export const loadMcpOriginsService = new LoadMcpOriginsService();
