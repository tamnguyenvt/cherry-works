import { z } from "#module/shared/module.js";
import type { ShortStrings } from "../../helper.js";
import type { CharterRoot } from "../charter/charter-root.js";
import { McpAuthMethod, type McpAuthMethodName } from "../mcp/mcp-auth-method.value-object.js";
import { McpPrimitive } from "../primitive/mcp-primitive.js";
import { McpOrigin, McpOrigins, type McpToolDefinition } from "./mcp-origin.js";

/** What a list of mcp origins a build wrote holds: each origin read by its ids
 *  and its address, the rest of it kept as the build wrote it. */
const McpOriginsTextSchema = z.object({
  origins: z.array(z.looseObject({ ids: z.array(z.string()), address: z.string() })),
});

/** Makes the list of mcp origins a build writes, and reads back the one it
 *  wrote. */
export class McpOriginsFactory {
  /** The list of mcp origins a build wrote, read back from its text; none
   *  where the text holds no such list. */
  static create(mcpOriginsText: string): McpOrigins | undefined;
  /**
   * Every mcp origin the charter's mcps reach, each once, whichever layer declared it
   * (FR-145).
   *
   * One per address and `path`: the repository and a vendor may call one mcp origin
   * by two names, and it is one mcp origin under both. What is held is where it is and
   * how it is signed in to — every way any mcp there allows — the name
   * each id is served under, and nothing an mcp's own file already says but the
   * tools it declares, as `toolsByOriginKey` says the mcp origin listed them, sorted by
   * name (EVAL-FR-031).
   */
  static create(
    charter: CharterRoot,
    shortMcpIds: ShortStrings,
    toolsByOriginKey?: ReadonlyMap<string, readonly McpToolDefinition[]>,
  ): McpOrigins;
  static create(
    mcpOriginsSource: CharterRoot | string,
    shortMcpIds: ShortStrings = {},
    toolsByOriginKey: ReadonlyMap<string, readonly McpToolDefinition[]> = new Map(),
  ): McpOrigins | undefined {
    if (typeof mcpOriginsSource === "string") {
      let mcpOriginsJson: unknown;
      try {
        mcpOriginsJson = JSON.parse(mcpOriginsSource);
      } catch {
        return undefined;
      }
      const mcpOriginsParse = McpOriginsTextSchema.safeParse(mcpOriginsJson);
      if (!mcpOriginsParse.success) return undefined;
      return new McpOrigins(
        (
          mcpOriginsParse.data.origins as unknown as readonly (Omit<McpOrigin, "auth"> & {
            readonly auth?: readonly McpAuthMethodName[];
          })[]
        ).map((origin) => new McpOrigin({ ...origin, auth: (origin.auth ?? []).map(McpAuthMethod.of) })),
      );
    }
    const charter = mcpOriginsSource;
    const mcpPrimitivesByOriginKey = new Map<string, McpPrimitive[]>();
    for (const primitive of [...charter.primitives].sort((leftPrimitive, rightPrimitive) =>
      leftPrimitive.headers.id < rightPrimitive.headers.id ? -1 : 1,
    )) {
      if (!(primitive instanceof McpPrimitive)) continue;
      const originKey = primitive.originKey;
      mcpPrimitivesByOriginKey.set(originKey, [...(mcpPrimitivesByOriginKey.get(originKey) ?? []), primitive]);
    }

    return new McpOrigins(
      [...mcpPrimitivesByOriginKey.entries()]
        .sort(([leftOriginKey], [rightOriginKey]) => (leftOriginKey < rightOriginKey ? -1 : 1))
        .map(([originKey, mcpsAtOrigin]) => {
          const [firstMcp] = mcpsAtOrigin as [(typeof mcpsAtOrigin)[number], ...typeof mcpsAtOrigin];
          const { endpoint, command, args: commandArguments = [], path } = firstMcp.headers;
          const tokenEnv = mcpsAtOrigin.find((mcpPrimitive) => mcpPrimitive.headers.tokenEnv !== undefined)?.headers
            .tokenEnv;
          const auths = new Set(mcpsAtOrigin.flatMap((mcpPrimitive) => mcpPrimitive.headers.auth ?? []));
          const declaredTools = new Set(mcpsAtOrigin.flatMap((mcpPrimitive) => mcpPrimitive.headers.tools));
          const listedTools = toolsByOriginKey.get(originKey);

          return new McpOrigin({
            ids: mcpsAtOrigin.map((mcpPrimitive) => mcpPrimitive.headers.id),
            names: Object.fromEntries(
              mcpsAtOrigin.map((mcpPrimitive) => [
                mcpPrimitive.headers.id,
                shortMcpIds[mcpPrimitive.headers.id] as string,
              ]),
            ),
            address: firstMcp.address,
            ...(endpoint === undefined ? {} : { endpoint }),
            ...(command === undefined
              ? {}
              : { command: { command, args: commandArguments, ...(tokenEnv === undefined ? {} : { tokenEnv }) } }),
            ...(path === undefined ? {} : { path }),
            auth: McpAuthMethod.names.filter((authName) => auths.has(authName)).map(McpAuthMethod.of),
            ...(listedTools !== undefined && {
              tools: listedTools
                .filter(({ name }) => declaredTools.has(name))
                .sort((leftTool, rightTool) => leftTool.name.localeCompare(rightTool.name)),
            }),
          });
        }),
    );
  }

  private constructor() {}
}
