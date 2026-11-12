import { DomainFault, FaultsByFile, type ForCallingMcpServers } from "../../../shared/module.js";
import { outputPath } from "../../domain/constants.js";
import type { CharterRoot } from "../../domain/models/charter/charter-root.js";
import {
  MissingMcpOriginsFault,
  UnlistableMcpToolsFault,
  UnlistedMcpToolFault,
  UnreadableMcpOriginsFault,
} from "../../domain/models/charter.fault.js";
import { McpOrigin, McpOrigins } from "../../domain/models/charter-output/mcp-origin.js";
import { McpOriginTools } from "../../domain/models/charter-output/mcp-origin-tools.js";
import { McpAuthMethod, type McpAuthMethodName } from "../../domain/models/mcp/mcp-auth-method.value-object.js";
import { McpPrimitive } from "../../domain/models/primitive/mcp-primitive.js";
import { PrimitiveFactory } from "../../domain/models/primitive/primitive.factory.js";
import { PrimitiveLayer } from "../../domain/models/primitive/primitive-layer.value-object.js";
import { RawPrimitive } from "../../domain/models/primitive/raw-primitive.js";
import { CompileService } from "../../domain/services/compile.service.js";
import type { ForManagingCharter } from "../port/out/managing-charter.port.js";

/** What the last build laid is read back through: the charter's repository. */
type BuiltOutputReader = Pick<ForManagingCharter, "readBuiltOutputItem" | "describeItemPlace">;

/** How long one mcp origin has to answer a build asking for its tools. */
const LIST_TIMEOUT_MS = 10_000;

/** What a build reaches the mcp origins with: the MCP servers, and the
 *  developer's own access token to each, renewed where it has expired or
 *  `isRefused` says the mcp origin has just refused it — charter authoring's to
 *  keep (CORE-FR-229). */
export interface McpReaching {
  readonly mcpServers: ForCallingMcpServers;
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
  async loadMcpOrigins(builtOutputReader: BuiltOutputReader): Promise<McpOrigins> {
    const mcpOriginsPlace = builtOutputReader.describeItemPlace(outputPath.mcpOriginsFileName);
    const contents = await builtOutputReader.readBuiltOutputItem(outputPath.mcpOriginsFileName);
    if (contents === undefined)
      throw new MissingMcpOriginsFault(
        `There is no ${mcpOriginsPlace}, so no mcp origin has been listed yet.`,
        'Run "cw build" first.',
        { internal: false },
      );

    try {
      const mcpOriginsJson: unknown = JSON.parse(contents);
      const origins = (mcpOriginsJson as { origins?: unknown }).origins;
      // Each origin is read by its ids and address; one without them is a list
      // that does not read, as a list that is no list is.
      if (
        Array.isArray(origins) &&
        origins.every(
          (origin) =>
            Array.isArray((origin as Partial<McpOrigin>)?.ids) &&
            typeof (origin as Partial<McpOrigin>)?.address === "string",
        )
      )
        return new McpOrigins(
          (origins as readonly (Omit<McpOrigin, "auth"> & { readonly auth?: readonly McpAuthMethodName[] })[]).map(
            (origin) => new McpOrigin({ ...origin, auth: (origin.auth ?? []).map(McpAuthMethod.of) }),
          ),
        );
    } catch {
      // Said below, as any list that does not read is.
    }
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
  async loadMcpTools(
    builtOutputReader: BuiltOutputReader,
    mcpIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly string[] | undefined>> {
    const toolsById = new Map<string, readonly string[] | undefined>();
    for (const id of mcpIds) {
      if (toolsById.has(id)) continue;
      toolsById.set(id, undefined);
      const compiledMcpPath = outputPath.getCompiledPrimitivePath(McpPrimitive.kind, id);
      const compiledDocument = await builtOutputReader.readBuiltOutputItem(compiledMcpPath);
      if (compiledDocument === undefined) continue;
      try {
        const primitive = PrimitiveFactory.create(
          new RawPrimitive(
            PrimitiveLayer.REPO,
            McpPrimitive.kind,
            id,
            compiledDocument,
            [],
            builtOutputReader.describeItemPlace(compiledMcpPath),
          ),
        );
        if (primitive instanceof McpPrimitive) toolsById.set(id, primitive.headers.tools);
      } catch {
        // Said by the caller, as a missing one is.
      }
    }
    return toolsById;
  }

  /**
   * The tools each mcp origin of the charter lists, by `McpPrimitive.originKey`, for the build to
   * keep beside it, so the server lists them without reaching it (EVAL-FR-031).
   *
   * Each mcp origin is asked at once, under the developer's own credential, and let
   * go. One that cannot be reached or is not signed in to, and a tool an mcp
   * declares that its mcp origin does not list, is a fault under that mcp's file: the
   * build stops on it. Without `refreshMcpOrigins`, or without `mcpReaching` to
   * ask them with, no mcp origin is asked, and each keeps what the last build
   * kept.
   */
  async loadToolsByOriginKey(
    charter: CharterRoot,
    builtOutputReader: BuiltOutputReader,
    mcpReaching: McpReaching | undefined,
    refreshMcpOrigins: boolean,
  ): Promise<McpOriginTools> {
    const mcpPrimitiveById = new Map(
      charter.primitives.flatMap((primitive) =>
        primitive instanceof McpPrimitive ? [[primitive.headers.id, primitive] as const] : [],
      ),
    );
    if (!refreshMcpOrigins || mcpReaching === undefined) {
      const keptOrigins = await this.loadMcpOrigins(builtOutputReader).then(
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
      return new McpOriginTools(toolsByOriginKey, FaultsByFile.none);
    }

    const { mcpServers, loadAccessToken } = mcpReaching;
    const mcpOriginResults = await Promise.all(
      CompileService.compileCharterRoot(charter, [])
        .findCharterOutputItem(McpOrigins)
        .origins.map(async (origin) => {
          const mcpPrimitives = origin.ids.flatMap((id) => mcpPrimitiveById.get(id) ?? []);
          // Every mcp of the origin is at its address and path: the first tells it apart.
          const originKey = mcpPrimitives[0]?.originKey;
          try {
            const accessToken = origin.auth.length > 0 ? await loadAccessToken(origin, false) : undefined;
            const connection = await mcpServers.connectServer(origin, accessToken, LIST_TIMEOUT_MS);
            await connection.closeConnection();
            const listedTools = connection.tools.map(({ name, description, inputSchema }) => ({
              name,
              description: description ?? "",
              inputSchema,
            }));
            const listedToolNames = new Set(listedTools.map(({ name }) => name));
            const faultsByFile = new FaultsByFile(
              Object.fromEntries(
                mcpPrimitives.flatMap((mcpPrimitive) => {
                  const missingTools = mcpPrimitive.headers.tools.filter((tool) => !listedToolNames.has(tool));
                  if (missingTools.length === 0) return [];
                  const fault = new UnlistedMcpToolFault(
                    `${origin.address} has no tool ${missingTools.map((tool) => `"${tool}"`).join(", ")}, which this mcp declares.`,
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
        FaultsByFile.none,
      ),
    );
  }
}

/** The one LoadMcpOriginsService the composition root hands every use case that asks for it. */
export const loadMcpOriginsService = new LoadMcpOriginsService();
