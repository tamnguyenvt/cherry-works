import { DomainFault, FaultsByFile, type ForCallingMcpServers } from "../../../shared/module.js";
import type { CharterRoot } from "../../domain/models/charter/charter-root.js";
import { McpPrimitive } from "../../domain/models/primitive/mcp-primitive.js";
import { PrimitiveFactory } from "../../domain/models/primitive/primitive.factory.js";
import { PrimitiveLayer } from "../../domain/models/primitive/primitive-layer.js";
import { RawPrimitive } from "../../domain/models/primitive/raw-primitive.js";
import { McpOrigin, McpOrigins } from "../../domain/models/projection/mcp-origin.js";
import { McpOriginTools } from "../../domain/models/projection/mcp-origin-tools.js";
import { OutputPart } from "../../domain/models/projection/output-part.js";
import { CompileService } from "../../domain/services/compile.service.js";
import type { ForManagingCharter } from "../port/out/managing-charter.port.js";

/** What the last build laid is read back through: the charter's repository. */
type LaidCharterLoader = Pick<ForManagingCharter, "loadLaidText" | "findPlace">;

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
   * saying to build again, since only a build writes it. Read off a checkout of
   * the repository instead, such as a worktree, where `checkoutPath` names one.
   */
  async loadMcpOrigins(laidCharterLoader: LaidCharterLoader, checkoutPath = ""): Promise<McpOrigins> {
    const mcpOriginsPlace = laidCharterLoader.findPlace(McpOrigins.outputPart);
    const contents = await laidCharterLoader.loadLaidText(McpOrigins.outputPart, checkoutPath);
    if (contents === undefined)
      throw new DomainFault(
        `There is no ${mcpOriginsPlace}, so no mcp origin has been listed yet.`,
        'Run "cw build" first.',
        { internal: false },
      );

    try {
      const mcpOriginsJson: unknown = JSON.parse(contents);
      const origins = (mcpOriginsJson as { origins?: unknown }).origins;
      if (Array.isArray(origins))
        return new McpOrigins((origins as readonly McpOrigin[]).map((origin) => new McpOrigin(origin)));
    } catch {
      // Said below, as any list that does not read is.
    }
    throw new DomainFault(
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
    laidCharterLoader: LaidCharterLoader,
    mcpIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly string[] | undefined>> {
    const toolsById = new Map<string, readonly string[] | undefined>();
    for (const id of mcpIds) {
      if (toolsById.has(id)) continue;
      toolsById.set(id, undefined);
      const compiledMcpPart = OutputPart.ofPrimitive(McpPrimitive.kind, id);
      const compiledDocument = await laidCharterLoader.loadLaidText(compiledMcpPart);
      if (compiledDocument === undefined) continue;
      try {
        const primitive = PrimitiveFactory.create(
          new RawPrimitive(
            PrimitiveLayer.REPO,
            McpPrimitive.kind,
            id,
            compiledDocument,
            [],
            laidCharterLoader.findPlace(compiledMcpPart),
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
   * The tools each mcp origin of the charter lists, by `McpOrigins.originKeyOf`, for the build to
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
    checkoutPath: string,
    charter: CharterRoot,
    laidCharterLoader: LaidCharterLoader,
    mcpReaching: McpReaching | undefined,
    refreshMcpOrigins: boolean,
  ): Promise<McpOriginTools> {
    if (!refreshMcpOrigins || mcpReaching === undefined) {
      const keptOrigins = await this.loadMcpOrigins(laidCharterLoader, checkoutPath).then(
        ({ origins }) => origins,
        () => [],
      );
      const toolsByOriginKey = new Map(
        keptOrigins.flatMap((origin) =>
          origin.tools === undefined ? [] : [[McpOrigins.originKeyOf(origin), origin.tools] as const],
        ),
      );
      return new McpOriginTools(toolsByOriginKey, FaultsByFile.none);
    }

    const { mcpServers, loadAccessToken } = mcpReaching;
    const mcpPrimitiveById = new Map(
      charter.primitives.flatMap((primitive) =>
        primitive instanceof McpPrimitive ? [[primitive.headers.id, primitive] as const] : [],
      ),
    );
    const mcpOriginResults = await Promise.all(
      CompileService.compileCharterRoot(charter, []).mcpOrigins.origins.map(async (origin) => {
        const mcpPrimitives = origin.ids.flatMap((id) => mcpPrimitiveById.get(id) ?? []);
        try {
          const accessToken = origin.auth.length > 0 ? await loadAccessToken(origin, false) : undefined;
          const connection = await mcpServers.connect(origin, accessToken, LIST_TIMEOUT_MS);
          await connection.close();
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
                const fault = new DomainFault(
                  `${origin.address} has no tool ${missingTools.map((tool) => `"${tool}"`).join(", ")}, which this mcp declares.`,
                  `Declare only tools it lists: ${[...listedToolNames].sort().join(", ")}.`,
                  { internal: false },
                );
                return [[mcpPrimitive.uri, [fault]] as const];
              }),
            ),
          );
          return { key: McpOrigins.originKeyOf(origin), listedTools, faultsByFile };
        } catch (raisedValue) {
          // A fault of the system's own is logged and never said (SDK-FR-017).
          if (!(raisedValue instanceof DomainFault) || raisedValue.internal) throw raisedValue;
          const fault = new DomainFault(
            `The build could not ask ${origin.address} for its tools: ${raisedValue.message}`,
            raisedValue.fix,
            { internal: false },
          );
          return {
            key: McpOrigins.originKeyOf(origin),
            faultsByFile: new FaultsByFile(
              Object.fromEntries(mcpPrimitives.map((mcpPrimitive) => [mcpPrimitive.uri, [fault]])),
            ),
          };
        }
      }),
    );
    return new McpOriginTools(
      new Map(
        mcpOriginResults.flatMap(({ key, listedTools }) =>
          listedTools === undefined ? [] : [[key, listedTools] as const],
        ),
      ),
      mcpOriginResults.reduce(
        (faultsByFile, mcpOriginResult) => faultsByFile.with(mcpOriginResult.faultsByFile),
        FaultsByFile.none,
      ),
    );
  }
}

/** The one LoadMcpOriginsService the composition root hands every use case that asks for it. */
export const loadMcpOriginsService = new LoadMcpOriginsService();
